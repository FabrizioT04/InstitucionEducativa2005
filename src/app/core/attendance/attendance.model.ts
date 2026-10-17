export type AttendanceStatus = 'PRESENTE' | 'AUSENTE' | 'TARDANZA';

export interface AttendanceClass {
  id: string;
  nombreCompleto: string;
}

export interface AttendanceStudent {
  id: string;
  nombreCompleto: string;
  estadoAsistencia: AttendanceStatus | null;
}

export interface AttendanceDocument {
  id: string;
  data: Record<string, unknown>;
}

export interface DailyAttendance {
  id: string;
  estudianteId: string;
  fecha: Date;
  estado: AttendanceStatus | null;
}

export interface AttendanceWrite {
  id: string;
  data: {
    asignacionId: string;
    estudianteId: string;
    dia: string;
    fecha: Date;
    estado: AttendanceStatus;
  };
}

export function normalizeAttendanceStatus(value: unknown): AttendanceStatus | null {
  if (value === 'FALTA') return 'AUSENTE';
  return value === 'PRESENTE' || value === 'AUSENTE' || value === 'TARDANZA'
    ? value
    : null;
}

/** A school day always follows Peru's timezone, irrespective of the device timezone. */
export function attendanceDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function attendanceDayBounds(day: string): { start: Date; end: Date } {
  // Peru uses UTC-05:00 year-round for the contemporary school calendar.
  const start = new Date(`${day}T00:00:00-05:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(start.getTime()) || attendanceDay(start) !== day) {
    throw new Error('Fecha de asistencia inválida.');
  }
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function attendanceDocumentId(assignmentId: string, studentId: string, day: string): string {
  // Encoding the tuple prevents delimiter collisions and Firestore path separators.
  return encodeURIComponent(JSON.stringify([assignmentId, studentId, day]));
}

export function attendanceDate(value: unknown): Date | null {
  let date: unknown = value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    date = value.toDate();
  }
  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
}

/** Preserve legacy documents; select one deterministically without silently deleting duplicates. */
export function selectDailyAttendance(
  documents: AttendanceDocument[], assignmentId: string, day: string,
): Map<string, DailyAttendance> {
  const result = new Map<string, DailyAttendance>();
  for (const document of documents) {
    const data = document.data;
    const studentId = data['estudianteId'];
    const date = attendanceDate(data['fecha']);
    if (data['asignacionId'] !== assignmentId || typeof studentId !== 'string' || !date || attendanceDay(date) !== day) continue;
    const candidate: DailyAttendance = {
      id: document.id, estudianteId: studentId, fecha: date,
      estado: normalizeAttendanceStatus(data['estado']),
    };
    const existing = result.get(studentId);
    const canonicalId = attendanceDocumentId(assignmentId, studentId, day);
    if (!existing || candidate.id === canonicalId ||
      (existing.id !== canonicalId && (date > existing.fecha ||
        (date.getTime() === existing.fecha.getTime() && candidate.id > existing.id)))) {
      result.set(studentId, candidate);
    }
  }
  return result;
}

export function buildAttendanceWrites(
  assignmentId: string, day: string, students: AttendanceStudent[],
  existing: Map<string, DailyAttendance>, now = new Date(),
): AttendanceWrite[] {
  if (!assignmentId || day !== attendanceDay(now)) {
    throw new Error('La fecha cambió. Vuelve a cargar la lista antes de guardar.');
  }
  return Array.from(new Map(students.map(student => [student.id, student])).values()).map(student => {
    const status = normalizeAttendanceStatus(student.estadoAsistencia);
    if (!student.id || !status) throw new Error('Selecciona un estado válido para todos los estudiantes.');
    const prior = existing.get(student.id);
    return {
      id: prior?.id ?? attendanceDocumentId(assignmentId, student.id, day),
      data: {
        asignacionId: assignmentId, estudianteId: student.id, dia: day,
        fecha: prior?.fecha ?? now, estado: status,
      },
    };
  });
}
