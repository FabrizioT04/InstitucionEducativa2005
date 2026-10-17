import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Auth, User } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Storage } from '@angular/fire/storage';
import { ActionSheetController, LoadingController, NavController, ToastController } from '@ionic/angular';
import { AccessRepository } from '../core/auth/access.repository';
import { Tab3Page } from './tab3.page';

describe('Tab3Page profile permissions', () => {
  let fixture: ComponentFixture<Tab3Page>;
  let page: Tab3Page;
  let repository: jasmine.SpyObj<AccessRepository>;
  let unsubscribe: jasmine.Spy;
  let authObserver: (user: User | null) => void;

  beforeEach(() => {
    repository = jasmine.createSpyObj('AccessRepository', ['getProfile']);
    repository.getProfile.and.resolveTo({ nombreCompleto: 'Estudiante', email: 'student@example.test', rol: 'Estudiante' });
    unsubscribe = jasmine.createSpy('unsubscribeAuth');
    TestBed.configureTestingModule({
      imports: [Tab3Page],
      providers: [
        { provide: AccessRepository, useValue: repository },
        { provide: Auth, useValue: {
          onAuthStateChanged: (observer: (user: User | null) => void) => {
            authObserver = observer;
            return unsubscribe;
          },
        } },
        { provide: Firestore, useValue: {} },
        { provide: Storage, useValue: {} },
        { provide: NavController, useValue: {} },
        { provide: ActionSheetController, useValue: {} },
        { provide: LoadingController, useValue: {} },
        { provide: ToastController, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(Tab3Page);
    page = fixture.componentInstance;
    fixture.detectChanges();
    page.currentUser = { uid: 'student-1' } as User;
  });

  it('shows grade and attendance links for the canonical student role', async () => {
    await page.loadUserProfile('student-1');
    fixture.detectChanges();
    expect(page.userProfile?.rol).toBe('estudiante');
    expect(page.getRoleColor(' Estudiante ')).toBe('primary');
    expect(fixture.nativeElement.textContent).toContain('Mis Calificaciones');
    expect(fixture.nativeElement.textContent).toContain('Historial de Asistencia');
  });

  it('does not show student links to professors', async () => {
    repository.getProfile.and.resolveTo({ rol: 'profesor' });
    await page.loadUserProfile('student-1');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Mis Calificaciones');
    expect(fixture.nativeElement.textContent).not.toContain('Historial de Asistencia');
  });

  it('does not accept an unknown profile role', async () => {
    repository.getProfile.and.resolveTo({ rol: 'owner' });
    await page.loadUserProfile('student-1');
    expect(page.userProfile).toBeNull();
  });

  it('does not restore an old profile when its read completes after logout', async () => {
    let resolve!: (profile: Record<string, unknown>) => void;
    repository.getProfile.and.returnValue(new Promise(done => { resolve = done; }));
    const loading = page.loadUserProfile('student-1');
    authObserver(null);
    resolve({ rol: 'estudiante' });
    await loading;
    expect(page.userProfile).toBeNull();
    expect(page.currentUser).toBeNull();
    expect(page.cargando).toBeFalse();
  });

  it('unsubscribes from authentication when destroyed', () => {
    fixture.destroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
