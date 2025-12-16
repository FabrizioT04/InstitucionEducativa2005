import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CreateComunicadoPage } from './create-comunicado.page';
import { IonicModule } from '@ionic/angular';
import { Firestore } from '@angular/fire/firestore';
import { NavController, ToastController } from '@ionic/angular';

describe('CreateComunicadoPage', () => {
  let component: CreateComunicadoPage;
  let fixture: ComponentFixture<CreateComunicadoPage>;

  const firestoreMock = {};
  const navControllerMock = { back: jasmine.createSpy('back') };
  const toastControllerMock = { create: jasmine.createSpy('create').and.returnValue(Promise.resolve({ present: () => {} })) };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), CreateComunicadoPage],
      providers: [
        { provide: Firestore, useValue: firestoreMock },
        { provide: NavController, useValue: navControllerMock },
        { provide: ToastController, useValue: toastControllerMock },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CreateComunicadoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
