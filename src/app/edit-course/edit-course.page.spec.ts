import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { EditCoursePage } from './edit-course.page';
import { IonicModule } from '@ionic/angular';
import { Firestore } from '@angular/fire/firestore';
import { NavController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('EditCoursePage', () => {
  let component: EditCoursePage;
  let fixture: ComponentFixture<EditCoursePage>;

  const firestoreMock = {};
  const navControllerMock = { back: jasmine.createSpy('back') };
  const toastControllerMock = { create: jasmine.createSpy('create').and.returnValue(Promise.resolve({ present: () => {} })) };
  const activatedRouteMock = {
    snapshot: {
      paramMap: {
        get: (key: string) => 'testId',
      },
    },
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), EditCoursePage],
      providers: [
        { provide: Firestore, useValue: firestoreMock },
        { provide: NavController, useValue: navControllerMock },
        { provide: ToastController, useValue: toastControllerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EditCoursePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
