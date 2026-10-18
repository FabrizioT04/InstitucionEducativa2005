import {
  calculateGradeAverage, findTrimesterRecord, gradeDocumentId, normalizeGradeRecord,
  normalizeTrimesterGrades, parseGrade,
} from './grade.model';

describe('Grade model', () => {
  it('includes zero in the average (0, 15, 15 is 10)', () => {
    expect(calculateGradeAverage({ trimestre1: 0, trimestre2: 15, trimestre3: 15 })).toBe(10);
  });

  it('excludes pending terms and does not turn them into zero', () => {
    expect(normalizeTrimesterGrades({ trimestre1: '', trimestre2: '  ', trimestre3: undefined }))
      .toEqual({ trimestre1: null, trimestre2: null, trimestre3: null });
    expect(calculateGradeAverage({ trimestre1: 0, trimestre2: null, trimestre3: 20 })).toBe(10);
    expect(calculateGradeAverage({ trimestre1: null, trimestre2: null, trimestre3: null })).toBeNull();
  });

  it('distinguishes an assessed zero from no grades and rounds decimal averages', () => {
    expect(calculateGradeAverage({ trimestre1: 0, trimestre2: null, trimestre3: null })).toBe(0);
    expect(calculateGradeAverage({ trimestre1: 10, trimestre2: 10, trimestre3: 11 })).toBe(10.33);
  });

  it('accepts numeric form values at both boundaries', () => {
    expect(parseGrade('0')).toBe(0);
    expect(parseGrade('20')).toBe(20);
    expect(parseGrade(' 15.5 ')).toBe(15.5);
  });

  it('rejects out-of-range, non-finite and non-numeric grades', () => {
    for (const value of [-1, 20.01, NaN, Infinity, 'NaN', 'abc', true, false, {}, []]) {
      expect(() => parseGrade(value)).withContext(String(value)).toThrowError();
    }
  });

  it('recalculates historical averages without mutating stored data or losing the ID', () => {
    const data = { studentId: 'student', asignacionId: 'class', trimestre1: 0, trimestre2: 15, trimestre3: 15, promedioFinal: 15 };
    const record = normalizeGradeRecord('old-random-id', data);
    expect(record.id).toBe('old-random-id');
    expect(record.promedioFinal).toBe(10);
    expect(data.promedioFinal).toBe(15);
    expect(record.esTrimestral).toBeTrue();
  });

  it('preserves legacy individual evaluations, including zero', () => {
    const record = normalizeGradeRecord('legacy', { nota: 0, descripcion: 'Examen' });
    expect(record.esTrimestral).toBeFalse();
    expect(record.nota).toBe(0);
    expect(record.descripcion).toBe('Examen');
    expect(record.promedioFinal).toBeNull();
  });

  it('converts timestamps and tolerates absent dates', () => {
    const date = new Date('2026-01-01T12:00:00Z');
    expect(normalizeGradeRecord('id', { fecha: { toDate: () => date } }).fecha).toEqual(date);
    expect(normalizeGradeRecord('id', {}).fecha).toBeNull();
    expect(normalizeGradeRecord('id', { fecha: new Date(NaN) }).fecha).toBeNull();
  });

  it('generates stable, distinct and path-safe IDs for new records', () => {
    expect(gradeDocumentId('class', 'student')).toBe(gradeDocumentId('class', 'student'));
    expect(gradeDocumentId('a_b', 'c')).not.toBe(gradeDocumentId('a', 'b_c'));
    expect(gradeDocumentId('a/b', 'c/d')).not.toContain('/');
    expect(() => gradeDocumentId('', 'student')).toThrowError();
  });

  it('selects the existing trimester record and leaves individual grades separate', () => {
    const individual = normalizeGradeRecord('exam', { studentId: 'student', nota: 12 });
    const trimester = normalizeGradeRecord('old-id', { studentId: 'student', trimestre1: 10 });
    expect(findTrimesterRecord([individual, trimester], 'student')?.id).toBe('old-id');
    expect(findTrimesterRecord([individual], 'student')).toBeUndefined();
  });

  it('blocks ambiguous duplicate trimester records instead of overwriting one', () => {
    const first = normalizeGradeRecord('first', { studentId: 'student', trimestre1: 10 });
    const second = normalizeGradeRecord('second', { studentId: 'student', trimestre1: 15 });
    expect(() => findTrimesterRecord([first, second], 'student')).toThrowError(/duplicados/);
  });
});
