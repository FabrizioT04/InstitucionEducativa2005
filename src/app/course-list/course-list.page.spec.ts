import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CourseListPage } from './course-list.page';

describe('CourseListPage', () => {
  let component: CourseListPage;
  let fixture: ComponentFixture<CourseListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CourseListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
