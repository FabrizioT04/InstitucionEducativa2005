export type UserRole = 'administrador' | 'profesor' | 'estudiante';

export interface AuthorizedUser {
  uid: string;
  role: UserRole;
}

export interface AccessibleAssignment {
  id: string;
  cursoId?: string;
  gradoId?: string;
  profesorId?: string;
}

export interface AccessPolicy {
  roles?: readonly UserRole[];
  classAccess?: 'read' | 'manage';
}

export type AccessDecision = 'allowed' | 'unauthenticated' | 'forbidden';

export function parseUserRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') return null;
  const role = value.trim().toLowerCase();
  return role === 'administrador' || role === 'profesor' || role === 'estudiante'
    ? role
    : null;
}
