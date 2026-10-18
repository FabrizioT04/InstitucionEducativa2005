import {
  AttendanceDocument, AttendanceStudent, attendanceDay, attendanceDayBounds,
  attendanceDocumentId, buildAttendanceWrites, normalizeAttendanceStatus, selectDailyAttendance,
} from './attendance.model';

describe('Daily attendance model', () => {
  const day = '2026-10-17';
  const morning = new Date('2026-10-17T13:00:00Z');
  const afternoon = new Date('2026-10-17T18:00:00Z');
  const student: AttendanceStudent = { id: 'student-1', nombreCompleto: 'Ana', estadoAsistencia: 'PRESENTE' };
  const record = (id: string, fecha = morning, estado = 'PRESENTE'): AttendanceDocument => ({
    id, data: { asignacionId: 'class-1', estudianteId: student.id, fecha, estado },
  });

  it('uses the Peru day on both sides of local midnight', () => {
    expect(attendanceDay(new Date('2026-10-17T04:59:59.999Z'))).toBe('2026-10-16');
    expect(attendanceDay(new Date('2026-10-17T05:00:00Z'))).toBe(day);
    expect(attendanceDay(new Date('2026-10-18T04:59:59.999Z'))).toBe(day);
    expect(attendanceDayBounds(day)).toEqual({
      start: new Date('2026-10-17T05:00:00Z'), end: new Date('2026-10-18T05:00:00Z'),
    });
  });

  it('rejects invalid dates before querying attendance', () => {
    for (const invalid of ['2026-02-30', '2026-13-01', '17/10/2026', '']) {
      expect(() => attendanceDayBounds(invalid)).toThrowError('Fecha de asistencia inválida.');
    }
  });

  it('reads the legacy absence value but only accepts known states', () => {
    expect(normalizeAttendanceStatus('FALTA')).toBe('AUSENTE');
    expect(normalizeAttendanceStatus('AUSENTE')).toBe('AUSENTE');
    expect(normalizeAttendanceStatus('TARDANZA')).toBe('TARDANZA');
    for (const invalid of [null, undefined, '', 'PENDIENTE', 0]) {
      expect(normalizeAttendanceStatus(invalid)).toBeNull();
    }
  });

  it('separates the complete identity tuple without slash or delimiter collisions', () => {
    expect(attendanceDocumentId('a/b', 'c', day)).not.toContain('/');
    expect(attendanceDocumentId('a_b', 'c', day)).not.toBe(attendanceDocumentId('a', 'b_c', day));
    expect(attendanceDocumentId('a', 'b', day)).not.toBe(attendanceDocumentId('a', 'b', '2026-10-18'));
  });

  it('loads Firestore timestamps and normalizes legacy absences', () => {
    const document = record('legacy-id', morning, 'FALTA');
    document.data['fecha'] = { toDate: () => morning };
    const selected = selectDailyAttendance([document], 'class-1', day).get(student.id);
    expect(selected).toEqual({ id: 'legacy-id', estudianteId: student.id, fecha: morning, estado: 'AUSENTE' });
  });

  it('ignores records belonging to another class or day and malformed records', () => {
    const otherClass = record('other-class');
    otherClass.data['asignacionId'] = 'class-2';
    const malformed = record('bad-date');
    malformed.data['fecha'] = '2026-10-17';
    const selected = selectDailyAttendance([
      otherClass, malformed, record('yesterday', new Date('2026-10-17T04:00:00Z')), record('today'),
    ], 'class-1', day);
    expect(Array.from(selected.values()).map(value => value.id)).toEqual(['today']);
  });

  it('selects the latest legacy duplicate consistently without modifying the records', () => {
    const documents = [record('early'), record('latest-a', afternoon), record('latest-b', afternoon)];
    expect(selectDailyAttendance(documents, 'class-1', day).get(student.id)?.id).toBe('latest-b');
    expect(selectDailyAttendance([...documents].reverse(), 'class-1', day).get(student.id)?.id).toBe('latest-b');
    expect(documents.length).toBe(3);
  });

  it('prefers an existing canonical daily record over legacy duplicates', () => {
    const canonicalId = attendanceDocumentId('class-1', student.id, day);
    const documents = [record(canonicalId), record('late-legacy', afternoon)];
    expect(selectDailyAttendance(documents, 'class-1', day).get(student.id)?.id).toBe(canonicalId);
    expect(selectDailyAttendance([...documents].reverse(), 'class-1', day).get(student.id)?.id).toBe(canonicalId);
  });

  it('creates a stable ID and preserves a legacy ID and time on correction', () => {
    const created = buildAttendanceWrites('class-1', day, [student], new Map(), morning)[0];
    expect(created.id).toBe(attendanceDocumentId('class-1', student.id, day));
    const existing = selectDailyAttendance([record('legacy-id')], 'class-1', day);
    const corrected = buildAttendanceWrites('class-1', day, [{ ...student, estadoAsistencia: 'AUSENTE' }], existing, afternoon)[0];
    expect(corrected).toEqual({
      id: 'legacy-id', data: {
        asignacionId: 'class-1', estudianteId: student.id, dia: day, fecha: morning, estado: 'AUSENTE',
      },
    });
  });

  it('does not create multiple writes for duplicate enrollments', () => {
    expect(buildAttendanceWrites('class-1', day, [student, student], new Map(), morning).length).toBe(1);
  });

  it('requires correcting unknown saved statuses rather than marking them present', () => {
    const existing = selectDailyAttendance([record('legacy-id', morning, 'DESCONOCIDO')], 'class-1', day);
    expect(existing.get(student.id)?.estado).toBeNull();
    expect(() => buildAttendanceWrites('class-1', day, [{ ...student, estadoAsistencia: null }], existing, morning))
      .toThrowError('Selecciona un estado válido para todos los estudiantes.');
  });

  it('rejects saving a roster from a previous school day', () => {
    expect(() => buildAttendanceWrites('class-1', day, [student], new Map(), new Date('2026-10-18T05:00:00Z')))
      .toThrowError('La fecha cambió. Vuelve a cargar la lista antes de guardar.');
  });
});
