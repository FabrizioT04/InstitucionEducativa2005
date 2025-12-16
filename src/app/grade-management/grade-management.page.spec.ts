import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GradeManagementPage } from './grade-management.page';

describe('GradeManagementPage', () => {
  let component: GradeManagementPage;
  let fixture: ComponentFixture<GradeManagementPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(GradeManagementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
