import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { AttendanceHistoryPage } from './attendance-history.page';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AttendanceHistoryPage', () => {
  let component: AttendanceHistoryPage;
  let fixture: ComponentFixture<AttendanceHistoryPage>;

  // Creamos espías para las dependencias
  let authSpy: jasmine.SpyObj<Auth>;
  let firestoreSpy: jasmine.SpyObj<Firestore>;
  let activatedRouteSpy: any;

  beforeEach(waitForAsync(() => {
    // Inicializamos los espías
    authSpy = jasmine.createSpyObj('Auth', ['onAuthStateChanged']);
    firestoreSpy = jasmine.createSpyObj('Firestore', ['collection', 'query', 'where', 'getDocs', 'doc', 'getDoc', 'orderBy']);
    activatedRouteSpy = {
      snapshot: { paramMap: { get: (key: string) => 'testCourseId' } },
    };

    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), AttendanceHistoryPage],
      // Proporcionamos las versiones falsas (espías)
      providers: [
        { provide: Auth, useValue: authSpy },
        { provide: Firestore, useValue: firestoreSpy },
        { provide: ActivatedRoute, useValue: activatedRouteSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AttendanceHistoryPage);
    component = fixture.componentInstance;
    
    // Configuramos los mocks de Firestore
    (firestoreSpy.getDoc as any).and.returnValue(Promise.resolve({ exists: () => true, data: () => ({}) }));
    (firestoreSpy.getDocs as any).and.returnValue(Promise.resolve({ docs: [] }));

    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});