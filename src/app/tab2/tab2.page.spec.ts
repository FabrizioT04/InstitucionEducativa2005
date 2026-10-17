import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AccessRepository } from '../core/auth/access.repository';
import { AccessService } from '../core/auth/access.service';
import { AccessibleAssignment, UserRole } from '../core/auth/access.models';
import { SessionService } from '../core/auth/session.service';
import { Tab2Page } from './tab2.page';

describe('Tab2Page class listing', () => {
  let page: Tab2Page;
  let access: jasmine.SpyObj<AccessService>;
  let repository: jasmine.SpyObj<AccessRepository>;
  let session: jasmine.SpyObj<SessionService>;

  beforeEach(() => {
    access = jasmine.createSpyObj('AccessService', ['getCurrentUser']);
    repository = jasmine.createSpyObj('AccessRepository', ['listAssignments']);
    session = jasmine.createSpyObj('SessionService', ['isCurrentUser']);
    access.getCurrentUser.and.resolveTo({ uid: 'student-1', role: 'estudiante' });
    repository.listAssignments.and.resolveTo([]);
    session.isCurrentUser.and.returnValue(true);
    TestBed.configureTestingModule({ providers: [
      { provide: AccessService, useValue: access },
      { provide: AccessRepository, useValue: repository },
      { provide: SessionService, useValue: session },
      { provide: Firestore, useValue: {} },
      { provide: NavController, useValue: {} },
      { provide: AlertController, useValue: {} },
      { provide: ToastController, useValue: {} },
    ] });
    page = TestBed.runInInjectionContext(() => new Tab2Page());
  });

  for (const role of ['administrador', 'profesor', 'estudiante'] as UserRole[]) {
    it(`loads the assignment scope for the verified ${role} profile`, async () => {
      access.getCurrentUser.and.resolveTo({ uid: 'user-1', role });
      await page.ionViewWillEnter();
      expect(repository.listAssignments).toHaveBeenCalledWith({ uid: 'user-1', role });
      expect(page.userRole).toBe(role);
      expect(page.cargando).toBeFalse();
    });
  }

  it('does not query assignments when the session has no authorized profile', async () => {
    access.getCurrentUser.and.resolveTo(null);
    await page.loadAsignaciones();
    expect(repository.listAssignments).not.toHaveBeenCalled();
    expect(page.userRole).toBeNull();
    expect(page.errorCarga).toBeTrue();
  });

  it('shows a recoverable error instead of reporting an empty class list', async () => {
    repository.listAssignments.and.rejectWith(new Error('permission-denied'));
    await page.loadAsignaciones();
    expect(page.errorCarga).toBeTrue();
    expect(page.cargando).toBeFalse();
    repository.listAssignments.and.resolveTo([]);
    await page.loadAsignaciones();
    expect(page.errorCarga).toBeFalse();
  });

  it('does not publish class data after switching accounts', async () => {
    repository.listAssignments.and.resolveTo([{ id: 'class-1' }]);
    session.isCurrentUser.and.returnValue(false);
    await page.loadAsignaciones();
    expect(await firstValueFrom(page.asignaciones$)).toEqual([]);
    expect(page.userRole).toBeNull();
    expect(page.errorCarga).toBeTrue();
  });

  it('discards a load completed after leaving the cached Ionic view', async () => {
    let resolve!: (assignments: AccessibleAssignment[]) => void;
    repository.listAssignments.and.returnValue(new Promise(done => { resolve = done; }));
    const loading = page.loadAsignaciones();
    await Promise.resolve();
    page.ionViewWillLeave();
    resolve([{ id: 'old-class' }]);
    await loading;
    expect(await firstValueFrom(page.asignaciones$)).toEqual([]);
    expect(page.userRole).toBeNull();
  });

  it('reloads classes when returning to a cached Ionic view', async () => {
    await page.ionViewWillEnter();
    page.ionViewWillLeave();
    await page.ionViewWillEnter();
    expect(repository.listAssignments).toHaveBeenCalledTimes(2);
  });
});
