import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccessPolicy } from '../core/auth/access.models';
import { AccessService } from '../core/auth/access.service';

export const accessGuard: CanActivateFn = async (route) => {
  const access = inject(AccessService);
  const router = inject(Router);
  const decision = await access.authorize(route.data as AccessPolicy, route.paramMap.get('id'));
  if (decision === 'allowed') return true;
  return router.createUrlTree([decision === 'unauthenticated' ? '/login' : '/tabs/tab1']);
};
