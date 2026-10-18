import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AccessRepository } from './core/auth/access.repository';
import { SessionService } from './core/auth/session.service';

@Component({ standalone: true, template: 'Page loaded' })
class TestPage {}

// Exercise the real route policies without instantiating pages or connecting to Firebase.
const testRoutes: Routes = routes.map(({ loadComponent, loadChildren, ...route }) => ({
  ...route,
  ...(route.path === 'tabs'
    ? { children: [{ path: 'tab1', component: TestPage }, { path: 'tab2', component: TestPage }] }
    : loadComponent ? { component: TestPage } : {}),
}));

describe('Navigation permissions', () => {
  let session: jasmine.SpyObj<SessionService>;
  let repository: jasmine.SpyObj<AccessRepository>;
  let harness: RouterTestingHarness;
  let router: Router;

  beforeEach(async () => {
    session = jasmine.createSpyObj('SessionService', ['getVerifiedUser', 'isCurrentUser']);
    repository = jasmine.createSpyObj('AccessRepository', ['getProfile', 'getAssignment', 'isStudentEnrolled']);
    session.getVerifiedUser.and.resolveTo({ uid: 'user-1' });
    session.isCurrentUser.and.returnValue(true);
    repository.getProfile.and.resolveTo({ rol: 'estudiante' });
    repository.getAssignment.and.resolveTo({ profesorId: 'user-1' });
    repository.isStudentEnrolled.and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(testRoutes),
        { provide: SessionService, useValue: session },
        { provide: AccessRepository, useValue: repository },
      ],
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  it('redirects a signed-out or unverified session to login', async () => {
    session.getVerifiedUser.and.resolveTo(null);
    await harness.navigateByUrl('/tabs/tab1');
    expect(router.url).toBe('/login');
  });

  it('rechecks the profile when moving between tabs', async () => {
    await harness.navigateByUrl('/tabs/tab1');
    expect(router.url).toBe('/tabs/tab1');
    repository.getProfile.and.resolveTo(null);
    await harness.navigateByUrl('/tabs/tab2');
    expect(router.url).toBe('/login');
  });

  for (const url of [
    '/create-user', '/edit-user/other-user', '/user-list', '/user-list/profesor',
    '/create-event', '/create-comunicado', '/edit-comunicado/message-1',
    '/grade-management', '/manage-courses', '/manage-assignments',
    '/manage-assignments/class-1', '/manage-schedule/class-1',
  ]) {
    it(`prevents a student from opening ${url} directly`, async () => {
      await harness.navigateByUrl(url);
      expect(router.url).toBe('/tabs/tab1');
    });
  }

  it('allows an administrator to open user management', async () => {
    repository.getProfile.and.resolveTo({ rol: 'administrador' });
    await harness.navigateByUrl('/create-user');
    expect(router.url).toBe('/create-user');
  });

  it('reserves schedule editing for administrators even for the assigned professor', async () => {
    repository.getProfile.and.resolveTo({ rol: 'profesor' });
    await harness.navigateByUrl('/manage-schedule/class-1');
    expect(router.url).toBe('/tabs/tab1');
    repository.getProfile.and.resolveTo({ rol: 'administrador' });
    await harness.navigateByUrl('/manage-schedule/class-1');
    expect(router.url).toBe('/manage-schedule/class-1');
  });

  for (const page of ['manage-grades', 'manage-attendance']) {
    it(`allows a professor to open ${page} only for their assigned class`, async () => {
      repository.getProfile.and.resolveTo({ rol: 'profesor' });
      await harness.navigateByUrl(`/${page}/class-1`);
      expect(router.url).toBe(`/${page}/class-1`);
      repository.getAssignment.and.resolveTo({ profesorId: 'other-professor' });
      await harness.navigateByUrl(`/${page}/class-2`);
      expect(router.url).toBe('/tabs/tab1');
    });

    it(`prevents an enrolled student from opening ${page}`, async () => {
      await harness.navigateByUrl(`/${page}/class-1`);
      expect(router.url).toBe('/tabs/tab1');
    });
  }

  it('requires enrollment to open class details', async () => {
    await harness.navigateByUrl('/course-detail/class-1');
    expect(router.url).toBe('/course-detail/class-1');
    repository.isStudentEnrolled.and.resolveTo(false);
    await harness.navigateByUrl('/course-detail/class-2');
    expect(router.url).toBe('/tabs/tab1');
  });
});
