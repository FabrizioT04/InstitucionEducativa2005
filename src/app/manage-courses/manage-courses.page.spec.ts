import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManageCoursesPage } from './manage-courses.page';

describe('ManageCoursesPage', () => {
  let component: ManageCoursesPage;
  let fixture: ComponentFixture<ManageCoursesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageCoursesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
