import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManageSchedulePage } from './manage-schedule.page';

describe('ManageSchedulePage', () => {
  let component: ManageSchedulePage;
  let fixture: ComponentFixture<ManageSchedulePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageSchedulePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
