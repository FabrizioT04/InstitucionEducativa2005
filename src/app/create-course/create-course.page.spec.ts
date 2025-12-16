import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CreateCoursePage } from './create-course.page';
import { IonicModule } from '@ionic/angular';
import { NavController } from '@ionic/angular/standalone';
// Importamos el servicio que necesita la página
import { Firestore } from '@angular/fire/firestore';

// Describimos el conjunto de pruebas
describe('CreateCoursePage', () => {
  let component: CreateCoursePage;
  let fixture: ComponentFixture<CreateCoursePage>;

  // Creamos espías para las dependencias
  let firestoreSpy: jasmine.SpyObj<Firestore>;
  let navControllerSpy: jasmine.SpyObj<NavController>;

  beforeEach(waitForAsync(() => {
    // Inicializamos los espías
    firestoreSpy = jasmine.createSpyObj('Firestore', ['collection', 'addDoc']);
    navControllerSpy = jasmine.createSpyObj('NavController', ['back']);

    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), CreateCoursePage],
      // Proporcionamos las versiones falsas (espías)
      providers: [
        { provide: Firestore, useValue: firestoreSpy },
        { provide: NavController, useValue: navControllerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CreateCoursePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  // Esta prueba ahora debería pasar
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});