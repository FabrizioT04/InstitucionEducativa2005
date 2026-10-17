import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AccessService } from '../core/auth/access.service';
import { SessionService } from '../core/auth/session.service';
import { accessGuard } from './access.guard';
import { authGuard } from './auth.guard';

describe('Navigation guards', () => {
  let access: jasmine.SpyObj<AccessService>;
  let session: jasmine.SpyObj<SessionService>;
  let router: Router;
  let route: ActivatedRouteSnapshot;
  const state = { url: '/manage-grades/class-1' } as RouterStateSnapshot;

  beforeEach(() => {
    access = jasmine.createSpyObj('AccessService', ['authorize']);
    session = jasmine.createSpyObj('SessionService', ['getVerifiedUser']);
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: AccessService, useValue: access },
      { provide: SessionService, useValue: session },
    ] });
    router = TestBed.inject(Router);
    route = {
      data: { roles: ['profesor'], classAccess: 'manage' },
      paramMap: convertToParamMap({ id: 'class-1' }),
    } as unknown as ActivatedRouteSnapshot;
  });

  it('passes the route policy and class ID to the access service', async () => {
    access.authorize.and.resolveTo('allowed');
    expect(await TestBed.runInInjectionContext(() => accessGuard(route, state))).toBeTrue();
    expect(access.authorize).toHaveBeenCalledWith(route.data, 'class-1');
  });

  for (const [decision, destination] of [
    ['unauthenticated', '/login'], ['forbidden', '/tabs/tab1'],
  ] as const) {
    it(`returns a redirect tree for ${decision}, without imperative navigation`, async () => {
      access.authorize.and.resolveTo(decision);
      const navigate = spyOn(router, 'navigate');
      const result = await TestBed.runInInjectionContext(() => accessGuard(route, state));
      expect(result instanceof UrlTree).toBeTrue();
      expect(router.serializeUrl(result as UrlTree)).toBe(destination);
      expect(navigate).not.toHaveBeenCalled();
    });
  }

  it('returns a login redirect for a missing verified session', async () => {
    session.getVerifiedUser.and.resolveTo(null);
    const result = await TestBed.runInInjectionContext(() => authGuard(route, state));
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('allows a verified session through the authentication guard', async () => {
    session.getVerifiedUser.and.resolveTo({ uid: 'user-1' });
    expect(await TestBed.runInInjectionContext(() => authGuard(route, state))).toBeTrue();
  });
});
