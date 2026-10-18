/** Accept both existing enrollment schemas without rewriting historical documents. */
export function enrollmentStudentId(data: Record<string, unknown>): string | null {
  for (const field of ['studentId', 'estudianteId']) {
    const value = data[field];
    if (typeof value === 'string' && value.trim().length > 0 && !value.includes('/')) return value;
  }
  return null;
}
