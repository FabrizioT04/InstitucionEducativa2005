import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ManageAssignmentsPage } from './manage-assignments.page';
import { IonicModule } from '@ionic/angular';
import { Firestore } from '@angular/fire/firestore';
import { NavController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';

describe('ManageAssignmentsPage', () => {
  let component: ManageAssignmentsPage;
  let fixture: ComponentFixture<ManageAssignmentsPage>;

  const firestoreMock = {};
  const navControllerMock = { back: jasmine.createSpy('back') };
  const toastControllerMock = { create: jasmine.createSpy('create').and.returnValue(Promise.resolve({ present: () => {} })) };
  const activatedRouteMock = {
    snapshot: {
      paramMap: {
        get: (key: string) => 'testCourseId',
      },
    },
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), ManageAssignmentsPage],
      providers: [
        { provide: Firestore, useValue: firestoreMock },
        { provide: NavController, useValue: navControllerMock },
        { provide: ToastController, useValue: toastControllerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManageAssignmentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
