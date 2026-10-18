import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { firstValueFrom, of } from 'rxjs';
import { normalizeGradeRecord } from '../core/models/grade.model';
import { GradesService } from '../core/services/grades.service';
import { CourseDetailPage } from './course-detail.page';
import { AccessRepository } from '../core/auth/access.repository';

describe('CourseDetailPage grades', () => {
  let page: CourseDetailPage;
  let grades: jasmine.SpyObj<GradesService>;
  let repository: jasmine.SpyObj<AccessRepository>;

  beforeEach(() => {
    grades = jasmine.createSpyObj<GradesService>('GradesService', ['getByStudent']);
    repository = jasmine.createSpyObj<AccessRepository>('AccessRepository', ['getProfile', 'getAssignment', 'isStudentEnrolled']);
    repository.getAssignment.and.resolveTo({ cursoId: 'course', gradoId: 'grade', profesorId: 'teacher' });
    TestBed.configureTestingModule({ providers: [
      { provide: Firestore, useValue: {} },
      { provide: Auth, useValue: { onAuthStateChanged: () => () => {} } },
      { provide: ActivatedRoute, useValue: {} },
      { provide: NavController, useValue: {} },
      { provide: GradesService, useValue: grades },
      { provide: AccessRepository, useValue: repository },
    ] });
    page = TestBed.runInInjectionContext(() => new CourseDetailPage());
  });

  it('requests grades for both the current student and the selected class', async () => {
    const record = normalizeGradeRecord('terms', { trimestre1: 0, trimestre2: 15, trimestre3: 15 });
    grades.getByStudent.and.resolveTo([record]);
    page.loadMisCalificaciones('student', 'class');
    expect(page.cargandoCalificaciones).toBeTrue();
    expect(await firstValueFrom(page.misCalificaciones$)).toEqual([record]);
    expect(grades.getByStudent).toHaveBeenCalledOnceWith('student', 'class');
    expect(page.cargandoCalificaciones).toBeFalse();
    expect(page.errorCalificaciones).toBeNull();
  });

  it('exposes a failed request as an error and clears it on retry', async () => {
    spyOn(console, 'error');
    grades.getByStudent.and.rejectWith(new Error('offline'));
    page.loadMisCalificaciones('student', 'class');
    expect(await firstValueFrom(page.misCalificaciones$)).toEqual([]);
    expect(page.errorCalificaciones).toContain('No se pudieron cargar');
    expect(page.cargandoCalificaciones).toBeFalse();
    grades.getByStudent.and.resolveTo([]);
    page.loadMisCalificaciones('student', 'class');
    expect(await firstValueFrom(page.misCalificaciones$)).toEqual([]);
    expect(page.errorCalificaciones).toBeNull();
  });

  it('shows the same trimester summary as the all-grades page', () => {
    const fixture = TestBed.createComponent(CourseDetailPage);
    spyOn(fixture.componentInstance, 'ngOnInit');
    fixture.componentInstance.userRole = 'estudiante';
    fixture.componentInstance.esEstudianteInscrito = true;
    fixture.componentInstance.misCalificaciones$ = of([
      normalizeGradeRecord('terms', { trimestre1: 0, trimestre2: null, trimestre3: 20 }),
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-grade-summary').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Trimestre 1: 0');
    expect(fixture.nativeElement.textContent).toContain('Trimestre 2: Pendiente');
    expect(fixture.nativeElement.textContent).toContain('Promedio actual: 10');
  });

  it('uses the shared enrollment decision for legacy student records', async () => {
    page.userRole = 'estudiante';
    repository.isStudentEnrolled.and.resolveTo(true);
    spyOn(page, 'loadMisCalificaciones');
    spyOn(page, 'loadMisAsistencias');
    await page.loadPageDetails('legacy-student', 'class');
    expect(repository.isStudentEnrolled).toHaveBeenCalledOnceWith('legacy-student', 'class');
    expect(page.esEstudianteInscrito).toBeTrue();
    expect(page.loadMisCalificaciones).toHaveBeenCalledOnceWith('legacy-student', 'class');
    expect(page.loadMisAsistencias).toHaveBeenCalledOnceWith('legacy-student', 'class');
  });

  it('formats attendance using the school day in Peru rather than UTC', () => {
    expect(page.formatDate(new Date('2026-10-17T02:00:00Z'))).toContain('16 de octubre de 2026');
    expect(page.formatDate(new Date('invalid'))).toBe('');
  });
});
