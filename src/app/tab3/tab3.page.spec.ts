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
  let navigation: jasmine.SpyObj<NavController>;
  let unsubscribe: jasmine.Spy;
  let authObserver: (user: User | null) => void;

  beforeEach(() => {
    repository = jasmine.createSpyObj('AccessRepository', ['getProfile']);
    navigation = jasmine.createSpyObj('NavController', ['navigateForward']);
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
        { provide: NavController, useValue: navigation },
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

  const roleMenus = [
    {
      role: ' Administrador ',
      labels: ['Gestionar usuarios', 'Gestionar cursos', 'Gestionar grados', 'Clases y asignaciones'],
      paths: ['/user-list', '/manage-courses', '/grade-management', '/tabs/tab2'],
    },
    {
      role: 'Profesor',
      labels: ['Mis clases'],
      paths: ['/tabs/tab2'],
    },
    {
      role: 'Estudiante',
      labels: ['Mis Calificaciones', 'Historial de Asistencia'],
      paths: ['/my-grades', '/attendance-history'],
    },
  ];

  for (const { role, labels, paths } of roleMenus) {
    it(`renders only the ${role.trim()} menu and navigates to its destinations`, async () => {
      repository.getProfile.and.resolveTo({ rol: role });
      await page.loadUserProfile('student-1');
      fixture.detectChanges();

      const items = Array.from(fixture.nativeElement.querySelectorAll('ion-list[aria-label="Mi cuenta"] ion-item')) as HTMLElement[];
      expect(items.map(item => item.querySelector('ion-label')?.textContent?.trim())).toEqual(labels);
      items.forEach((item, index) => {
        item.click();
        expect(navigation.navigateForward).toHaveBeenCalledWith(paths[index]);
      });
      expect(navigation.navigateForward).toHaveBeenCalledTimes(paths.length);
    });
  }

  it('replaces administrator links when a different role is loaded', async () => {
    repository.getProfile.and.resolveTo({ rol: 'administrador' });
    await page.loadUserProfile('student-1');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Gestionar usuarios');

    repository.getProfile.and.resolveTo({ rol: 'profesor' });
    await page.loadUserProfile('student-1');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Gestionar usuarios');
    expect(fixture.nativeElement.textContent).toContain('Mis clases');
  });

  it('does not accept an unknown profile role', async () => {
    repository.getProfile.and.resolveTo({ rol: 'owner' });
    await page.loadUserProfile('student-1');
    expect(page.userProfile).toBeNull();
    expect(page.accountLinks).toEqual([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ion-list[aria-label="Mi cuenta"]')).toBeNull();
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
