import { AccessRepository } from './access.repository';
import { TestBed } from '@angular/core/testing';
import { AccessService } from './access.service';
import { SessionService } from './session.service';

describe('AccessService', () => {
  let session: jasmine.SpyObj<SessionService>;
  let repository: jasmine.SpyObj<AccessRepository>;
  let access: AccessService;

  beforeEach(() => {
    session = jasmine.createSpyObj('SessionService', ['getVerifiedUser', 'isCurrentUser']);
    repository = jasmine.createSpyObj('AccessRepository', ['getProfile', 'getAssignment', 'isStudentEnrolled']);
    session.getVerifiedUser.and.resolveTo({ uid: 'user-1' });
    session.isCurrentUser.and.returnValue(true);
    repository.getProfile.and.resolveTo({ rol: 'profesor' });
    repository.getAssignment.and.resolveTo({ profesorId: 'user-1' });
    repository.isStudentEnrolled.and.resolveTo(false);
    TestBed.configureTestingModule({ providers: [
      { provide: SessionService, useValue: session },
      { provide: AccessRepository, useValue: repository },
    ] });
    access = TestBed.inject(AccessService);
  });

  it('never reads protected profile data without a verified session', async () => {
    session.getVerifiedUser.and.resolveTo(null);
    expect(await access.authorize({})).toBe('unauthenticated');
    expect(repository.getProfile).not.toHaveBeenCalled();
  });

  for (const profile of [null, {}, { rol: 'owner' }, { rol: 123 }]) {
    it(`rejects a missing or invalid profile: ${JSON.stringify(profile)}`, async () => {
      repository.getProfile.and.resolveTo(profile);
      expect(await access.authorize({})).toBe('unauthenticated');
    });
  }

  it('normalizes supported legacy role capitalization', async () => {
    repository.getProfile.and.resolveTo({ rol: ' Administrador ' });
    expect(await access.authorize({ roles: ['administrador'] })).toBe('allowed');
  });

  it('fails closed when the profile cannot be read', async () => {
    repository.getProfile.and.rejectWith(new Error('permission-denied'));
    expect(await access.authorize({})).toBe('unauthenticated');
  });

  it('rejects a session that changed while the profile was loading', async () => {
    session.isCurrentUser.and.returnValue(false);
    expect(await access.authorize({})).toBe('unauthenticated');
  });

  it('refreshes the role instead of retaining administrator privileges', async () => {
    repository.getProfile.and.resolveTo({ rol: 'administrador' });
    expect(await access.authorize({ roles: ['administrador'] })).toBe('allowed');
    repository.getProfile.and.resolveTo({ rol: 'estudiante' });
    expect(await access.authorize({ roles: ['administrador'] })).toBe('forbidden');
  });

  it('allows a professor to manage their assigned class', async () => {
    expect(await access.authorize({ classAccess: 'manage' }, 'class-1')).toBe('allowed');
  });

  it('rejects another professor even when their role is permitted', async () => {
    repository.getAssignment.and.resolveTo({ profesorId: 'another-professor' });
    expect(await access.authorize({ roles: ['profesor'], classAccess: 'manage' }, 'class-1')).toBe('forbidden');
  });

  it('allows administrators to manage an existing class', async () => {
    repository.getProfile.and.resolveTo({ rol: 'administrador' });
    expect(await access.authorize({ classAccess: 'manage' }, 'class-1')).toBe('allowed');
  });

  it('rejects a missing class even for an administrator', async () => {
    repository.getProfile.and.resolveTo({ rol: 'administrador' });
    repository.getAssignment.and.resolveTo(null);
    expect(await access.authorize({ classAccess: 'manage' }, 'missing')).toBe('forbidden');
  });

  it('fails closed when class lookup fails', async () => {
    repository.getAssignment.and.rejectWith(new Error('permission-denied'));
    expect(await access.authorize({ classAccess: 'manage' }, 'class-1')).toBe('forbidden');
  });

  it('requires a class ID for every class policy', async () => {
    expect(await access.authorize({ classAccess: 'manage' })).toBe('forbidden');
    expect(repository.getAssignment).not.toHaveBeenCalled();
  });

  it('rejects a document path instead of a class ID', async () => {
    expect(await access.authorize({ classAccess: 'read' }, 'class-1/private/data')).toBe('forbidden');
    expect(repository.getAssignment).not.toHaveBeenCalled();
  });

  it('rejects a session switched while the class was loading', async () => {
    repository.getAssignment.and.callFake(async () => {
      session.isCurrentUser.and.returnValue(false);
      return { profesorId: 'user-1' };
    });
    expect(await access.authorize({ classAccess: 'manage' }, 'class-1')).toBe('unauthenticated');
  });

  it('allows an enrolled student to read, but never manage, a class', async () => {
    repository.getProfile.and.resolveTo({ rol: 'estudiante' });
    repository.isStudentEnrolled.and.resolveTo(true);
    expect(await access.authorize({ classAccess: 'read' }, 'class-1')).toBe('allowed');
    expect(repository.isStudentEnrolled).toHaveBeenCalledWith('user-1', 'class-1');
    expect(await access.authorize({ classAccess: 'manage' }, 'class-1')).toBe('forbidden');
  });

  it('rejects an unenrolled student', async () => {
    repository.getProfile.and.resolveTo({ rol: 'estudiante' });
    expect(await access.authorize({ classAccess: 'read' }, 'class-1')).toBe('forbidden');
  });

  it('fails closed when enrollment cannot be read', async () => {
    repository.getProfile.and.resolveTo({ rol: 'estudiante' });
    repository.isStudentEnrolled.and.rejectWith(new Error('permission-denied'));
    expect(await access.authorize({ classAccess: 'read' }, 'class-1')).toBe('forbidden');
  });
});
