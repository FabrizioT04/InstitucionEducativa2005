import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ManageAttendancePage } from './manage-attendance.page';
import { IonicModule } from '@ionic/angular';
import { NavController, ToastController } from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { Firestore } from '@angular/fire/firestore';

describe('ManageAttendancePage', () => {
  let component: ManageAttendancePage;
  let fixture: ComponentFixture<ManageAttendancePage>;

  let firestoreSpy: jasmine.SpyObj<Firestore>;
  let navControllerSpy: jasmine.SpyObj<NavController>;
  let activatedRouteSpy: any;
  let toastControllerSpy: jasmine.SpyObj<ToastController>;

  beforeEach(waitForAsync(() => {
    // ¡CORRECCIÓN! Se añade 'getDoc' a los métodos espiados
    firestoreSpy = jasmine.createSpyObj('Firestore', ['collection', 'doc', 'getDoc', 'query', 'where', 'getDocs', 'writeBatch']);
    navControllerSpy = jasmine.createSpyObj('NavController', ['back']);
    toastControllerSpy = jasmine.createSpyObj('ToastController', ['create']);
    activatedRouteSpy = {
      snapshot: { paramMap: { get: (key: string) => 'testCourseId' } },
    };

    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), ManageAttendancePage],
      providers: [
        { provide: Firestore, useValue: firestoreSpy },
        { provide: NavController, useValue: navControllerSpy },
        { provide: ActivatedRoute, useValue: activatedRouteSpy },
        { provide: ToastController, useValue: toastControllerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManageAttendancePage);
    component = fixture.componentInstance;

    (firestoreSpy.getDoc as any).and.returnValue(Promise.resolve({ exists: () => true, data: () => ({}) }));
    (firestoreSpy.getDocs as any).and.returnValue(Promise.resolve({ docs: [] }));
    (toastControllerSpy.create as any).and.returnValue(Promise.resolve({ present: () => {} }));

    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

