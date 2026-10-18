import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { NavController } from '@ionic/angular';
import { normalizeGradeRecord } from '../core/models/grade.model';
import { GradesService } from '../core/services/grades.service';
import { MyGradesPage } from './my-grades.page';

describe('MyGradesPage', () => {
  let page: MyGradesPage;
  let grades: jasmine.SpyObj<GradesService>;

  beforeEach(() => {
    grades = jasmine.createSpyObj<GradesService>('GradesService', ['getByStudent']);
    grades.getByStudent.and.resolveTo([]);
    TestBed.configureTestingModule({ providers: [
      { provide: Firestore, useValue: {} },
      { provide: Auth, useValue: { onAuthStateChanged: () => () => {} } },
      { provide: NavController, useValue: {} },
      { provide: GradesService, useValue: grades },
    ] });
    page = TestBed.runInInjectionContext(() => new MyGradesPage());
  });

  it('loads only the requested student and completes an empty result', async () => {
    await page.loadAllMyGrades('student');
    expect(grades.getByStudent).toHaveBeenCalledOnceWith('student');
    expect(page.gruposDeCalificaciones).toEqual([]);
    expect(page.isLoading).toBeFalse();
    expect(page.errorCarga).toBeNull();
  });

  it('clears old results on failure and can recover on retry', async () => {
    spyOn(console, 'error');
    page.gruposDeCalificaciones = [{ id: 'old', nombreCurso: 'Curso anterior', nombreGrado: '', calificaciones: [] }];
    grades.getByStudent.and.rejectWith(new Error('offline'));
    await page.loadAllMyGrades('student');
    expect(page.gruposDeCalificaciones).toEqual([]);
    expect(page.errorCarga).toContain('No se pudieron cargar');
    expect(page.isLoading).toBeFalse();
    grades.getByStudent.and.resolveTo([]);
    await page.loadAllMyGrades('student');
    expect(page.errorCarga).toBeNull();
    expect(page.isLoading).toBeFalse();
  });

  it('renders trimester grades and legacy evaluations through the shared summary', () => {
    const fixture = TestBed.createComponent(MyGradesPage);
    spyOn(fixture.componentInstance, 'ngOnInit');
    fixture.componentInstance.isLoading = false;
    fixture.componentInstance.gruposDeCalificaciones = [{
      id: 'class', nombreCurso: 'Matemática', nombreGrado: 'Primero',
      calificaciones: [
        normalizeGradeRecord('terms', { trimestre1: 0, trimestre2: null, trimestre3: 20 }),
        normalizeGradeRecord('exam', { nota: 0, descripcion: 'Examen anterior' }),
      ],
    }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-grade-summary').length).toBe(2);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Trimestre 1: 0');
    expect(text).toContain('Trimestre 2: Pendiente');
    expect(text).toContain('Promedio actual: 10');
    expect(text).toContain('Examen anterior');
    expect(text).not.toContain('N/A');
  });
});
