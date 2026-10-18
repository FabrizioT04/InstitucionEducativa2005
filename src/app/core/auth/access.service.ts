import { Injectable, inject } from '@angular/core';
import { AccessDecision, AccessPolicy, AuthorizedUser, parseUserRole } from './access.models';
import { AccessRepository } from './access.repository';
import { SessionService } from './session.service';

/**
 * Client navigation policy. Firestore rules must enforce the same restrictions:
 * a client guard cannot prevent direct SDK or REST access to data.
 */
@Injectable({ providedIn: 'root' })
export class AccessService {
  private readonly session = inject(SessionService);
  private readonly repository = inject(AccessRepository);

  async getCurrentUser(): Promise<AuthorizedUser | null> {
    try {
      const sessionUser = await this.session.getVerifiedUser();
      if (!sessionUser) return null;
      const profile = await this.repository.getProfile(sessionUser.uid);
      const role = parseUserRole(profile?.['rol']);
      // Do not reuse profiles across navigations or accept an identity that changed mid-read.
      return role && this.session.isCurrentUser(sessionUser.uid)
        ? { uid: sessionUser.uid, role }
        : null;
    } catch {
      return null;
    }
  }

  async authorize(policy: AccessPolicy, assignmentId: string | null = null): Promise<AccessDecision> {
    const user = await this.getCurrentUser();
    if (!user) return 'unauthenticated';
    if (policy.roles && !policy.roles.includes(user.role)) return 'forbidden';
    if (policy.classAccess && !(await this.canAccessClass(user, assignmentId, policy.classAccess))) {
      return 'forbidden';
    }
    return this.session.isCurrentUser(user.uid) ? 'allowed' : 'unauthenticated';
  }

  async canAccessClass(
    user: AuthorizedUser,
    assignmentId: string | null,
    access: 'read' | 'manage',
  ): Promise<boolean> {
    if (!assignmentId || assignmentId.includes('/')) return false;
    try {
      const assignment = await this.repository.getAssignment(assignmentId);
      if (!assignment) return false;
      if (user.role === 'administrador') return true;
      if (user.role === 'profesor') return assignment['profesorId'] === user.uid;
      return access === 'read' && await this.repository.isStudentEnrolled(user.uid, assignmentId);
    } catch {
      return false;
    }
  }
}
