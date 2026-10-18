import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(Auth);

  async getVerifiedUser(): Promise<{ uid: string } | null> {
    try {
      // Wait for Firebase to restore the persisted session before deciding.
      await this.auth.authStateReady();
      const user = this.auth.currentUser;
      return user?.emailVerified ? { uid: user.uid } : null;
    } catch {
      return null;
    }
  }

  isCurrentUser(uid: string): boolean {
    const user = this.auth.currentUser;
    return user?.uid === uid && user.emailVerified;
  }
}
