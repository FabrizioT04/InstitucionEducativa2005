import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { EnrollStudentsPage } from './enroll-students.page';
import { IonicModule } from '@ionic/angular';
import { NavController } from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { Firestore } from '@angular/fire/firestore';
import { of } from 'rxjs'; // Necesario para simular ActivatedRoute

describe('EnrollStudentsPage', () => {
  let component: EnrollStudentsPage;
  let fixture: ComponentFixture<EnrollStudentsPage>;

  // Creamos espías para las dependencias
  let firestoreSpy: jasmine.SpyObj<Firestore>;
  let navControllerSpy: jasmine.SpyObj<NavController>;
  // Espía para ActivatedRoute
  let activatedRouteSpy: any;

  beforeEach(waitForAsync(() => {
    // Inicializamos los espías
    firestoreSpy = jasmine.createSpyObj('Firestore', ['collection', 'doc', 'getDoc', 'query', 'where', 'getDocs', 'writeBatch']);
    navControllerSpy = jasmine.createSpyObj('NavController', ['back']);
    // Configuramos el espía de ActivatedRoute para que devuelva un ID de curso
    activatedRouteSpy = {
      snapshot: {
        paramMap: {
          get: (key: string) => 'testCourseId', // Simulamos que la URL tiene un ID
        },
      },
    };

    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), EnrollStudentsPage],
      // Proporcionamos las versiones falsas (espías)
      providers: [
        { provide: Firestore, useValue: firestoreSpy },
        { provide: NavController, useValue: navControllerSpy },
        { provide: ActivatedRoute, useValue: activatedRouteSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EnrollStudentsPage);
    component = fixture.componentInstance;
    
    // Configuramos los mocks de Firestore para que devuelvan promesas vacías
    (firestoreSpy.getDoc as any).and.returnValue(Promise.resolve({ exists: () => true, data: () => ({ nombre: 'Curso de Prueba' }) }));
    (firestoreSpy.getDocs as any).and.returnValue(Promise.resolve({ docs: [] }));

    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});