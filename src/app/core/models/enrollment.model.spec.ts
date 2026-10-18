import { enrollmentStudentId } from './enrollment.model';

describe('Enrollment student ID', () => {
  it('reads current and legacy enrollments', () => {
    expect(enrollmentStudentId({ studentId: 'current' })).toBe('current');
    expect(enrollmentStudentId({ estudianteId: 'legacy' })).toBe('legacy');
    expect(enrollmentStudentId({ studentId: '', estudianteId: 'legacy' })).toBe('legacy');
  });

  it('prefers the current field when both are present', () => {
    expect(enrollmentStudentId({ studentId: 'current', estudianteId: 'legacy' })).toBe('current');
  });

  it('does not build user document paths from missing or malformed values', () => {
    for (const data of [{}, { studentId: 123 }, { studentId: ' ' }, { estudianteId: 'a/b' }]) {
      expect(enrollmentStudentId(data)).toBeNull();
    }
  });
});
