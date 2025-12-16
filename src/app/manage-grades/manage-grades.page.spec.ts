import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManageGradesPage } from './manage-grades.page';

describe('ManageGradesPage', () => {
  let component: ManageGradesPage;
  let fixture: ComponentFixture<ManageGradesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageGradesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
