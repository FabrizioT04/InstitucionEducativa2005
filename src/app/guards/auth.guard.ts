import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../core/auth/session.service';

/** Authentication only; accessGuard also requires an authorized user profile. */
export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return (await session.getVerifiedUser()) ? true : router.createUrlTree(['/login']);
};
