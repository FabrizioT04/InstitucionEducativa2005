import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MyGradesPage } from './my-grades.page';
import { IonicModule } from '@ionic/angular';
// Importamos los servicios que necesita la página
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('MyGradesPage', () => {
  let component: MyGradesPage;
  let fixture: ComponentFixture<MyGradesPage>;

  // Creamos espías para las dependencias
  let authSpy: jasmine.SpyObj<Auth>;
  let firestoreSpy: jasmine.SpyObj<Firestore>;

  beforeEach(waitForAsync(() => {
    // Inicializamos los espías
    authSpy = jasmine.createSpyObj('Auth', ['onAuthStateChanged']);
    firestoreSpy = jasmine.createSpyObj('Firestore', ['collection', 'query', 'where', 'getDocs', 'doc', 'getDoc']);

    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), MyGradesPage],
      // Proporcionamos las versiones falsas (espías)
      providers: [
        { provide: Auth, useValue: authSpy },
        { provide: Firestore, useValue: firestoreSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MyGradesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});