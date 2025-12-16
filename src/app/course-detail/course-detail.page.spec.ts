import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { IonicModule } from '@ionic/angular';
import { CourseDetailPage } from './course-detail.page';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { NavController } from '@ionic/angular';

// Mocks para los servicios de Firebase y Angular
const firestoreMock = {
  // Simula las funciones de Firestore que usamos
};

const authMock = {
  // Simula el estado de autenticación
  onAuthStateChanged: () => of({ uid: 'testStudentId' }) // Simula un estudiante logueado
};

const activatedRouteMock = {
  paramMap: of({
    get: (key: string) => 'testCourseId' // Simula que la URL tiene el id 'testCourseId'
  })
};

const navControllerMock = {
  navigateForward: jasmine.createSpy('navigateForward')
};


describe('CourseDetailPage', () => {
  let component: CourseDetailPage;
  let fixture: ComponentFixture<CourseDetailPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), CourseDetailPage],
      providers: [
        { provide: Firestore, useValue: firestoreMock },
        { provide: Auth, useValue: authMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: NavController, useValue: navControllerMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CourseDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('debería obtener el ID del curso de la ruta al iniciar', () => {
    // La prueba se ejecuta en el ngOnInit que se llama automáticamente
    // Solo necesitamos verificar que la variable courseId se estableció correctamente
    component.ngOnInit();
    fixture.detectChanges();
    // @ts-ignore: Accediendo a una propiedad privada para la prueba
    expect(component.courseId).toBe('testCourseId');
  });
  
  // Aquí se podrían añadir más pruebas para simular la carga de datos
  // y verificar que las variables (esProfesor, esEstudiante) se establecen correctamente.
  
});