export interface TrimesterGrades {
  trimestre1: number | null;
  trimestre2: number | null;
  trimestre3: number | null;
}

export interface GradeRecord extends TrimesterGrades {
  id: string;
  asignacionId: string;
  studentId: string;
  esTrimestral: boolean;
  promedioFinal: number | null;
  descripcion: string | null;
  nota: number | null;
  fecha: Date | null;
}

export interface GradeInput {
  trimestre1: unknown;
  trimestre2: unknown;
  trimestre3: unknown;
}

export const GRADE_MIN = 0;
export const GRADE_MAX = 20;

/** A blank input is pending; zero is an assessed grade. */
export function parseGrade(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error('Las notas deben ser números entre 0 y 20.');
  }
  const grade = Number(value);
  if (!Number.isFinite(grade) || grade < GRADE_MIN || grade > GRADE_MAX) {
    throw new Error('Las notas deben ser números entre 0 y 20.');
  }
  return grade;
}

export function normalizeTrimesterGrades(input: GradeInput): TrimesterGrades {
  return {
    trimestre1: parseGrade(input.trimestre1),
    trimestre2: parseGrade(input.trimestre2),
    trimestre3: parseGrade(input.trimestre3),
  };
}

export function calculateGradeAverage(input: GradeInput): number | null {
  const grades = Object.values(normalizeTrimesterGrades(input))
    .filter((grade): grade is number => grade !== null);
  if (grades.length === 0) return null;
  return Math.round((grades.reduce((sum, grade) => sum + grade, 0) / grades.length) * 100) / 100;
}

/** Length-prefix the first ID to avoid collisions between two pairs of IDs. */
export function gradeDocumentId(asignacionId: string, studentId: string): string {
  if (!asignacionId || !studentId) throw new Error('La clase y el estudiante son obligatorios.');
  const assignment = encodeURIComponent(asignacionId);
  return `grade_${assignment.length}_${assignment}_${encodeURIComponent(studentId)}`;
}

export function normalizeGradeRecord(id: string, data: Record<string, unknown>): GradeRecord {
  const grades = normalizeTrimesterGrades({
    trimestre1: data['trimestre1'],
    trimestre2: data['trimestre2'],
    trimestre3: data['trimestre3'],
  });
  const esTrimestral = ['trimestre1', 'trimestre2', 'trimestre3'].some((key) => key in data);
  return {
    id,
    asignacionId: typeof data['asignacionId'] === 'string' ? data['asignacionId'] : '',
    studentId: typeof data['studentId'] === 'string' ? data['studentId'] : '',
    ...grades,
    esTrimestral,
    // Recalculate to correct old stored averages that excluded zero.
    promedioFinal: esTrimestral ? calculateGradeAverage(grades) : null,
    descripcion: typeof data['descripcion'] === 'string' ? data['descripcion'] : null,
    nota: parseGrade(data['nota']),
    fecha: gradeDate(data['fecha']),
  };
}

function gradeDate(value: unknown): Date | null {
  let date: unknown = value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    date = value.toDate();
  }
  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
}

/** Never silently choose one of multiple historical trimester documents. */
export function findTrimesterRecord(records: GradeRecord[], studentId: string): GradeRecord | undefined {
  const matches = records.filter((record) => record.studentId === studentId && record.esTrimestral);
  if (matches.length > 1) {
    throw new Error('Hay registros trimestrales duplicados. Solicita su revisión antes de modificar notas.');
  }
  return matches[0];
}
