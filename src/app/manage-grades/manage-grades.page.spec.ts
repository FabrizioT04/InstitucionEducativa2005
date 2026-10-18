import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { GradesService } from '../core/services/grades.service';
import { ManageGradesPage } from './manage-grades.page';

describe('ManageGradesPage', () => {
  let page: ManageGradesPage;
  let grades: jasmine.SpyObj<GradesService>;
  let nav: jasmine.SpyObj<NavController>;

  const student = (id: string, first: unknown, documentId: string | null = null): ManageGradesPage['estudiantesConNotas'][number] => ({
    id, nombreCompleto: id, error: null,
    notas: { trimestre1: first, trimestre2: null, trimestre3: null, promedioFinal: null, calificacionId: documentId },
  });

  beforeEach(() => {
    grades = jasmine.createSpyObj<GradesService>('GradesService', ['getByAssignment', 'saveForAssignment']);
    grades.saveForAssignment.and.resolveTo();
    nav = jasmine.createSpyObj<NavController>('NavController', ['back']);
    TestBed.configureTestingModule({ providers: [
      { provide: Firestore, useValue: {} },
      { provide: GradesService, useValue: grades },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      { provide: NavController, useValue: nav },
      { provide: ToastController, useValue: {} },
      { provide: ChangeDetectorRef, useValue: { detectChanges: () => undefined } },
    ] });
    page = TestBed.runInInjectionContext(() => new ManageGradesPage());
    spyOn(page, 'presentToast').and.resolveTo();
    page.asignacionId = 'class';
    page.cargando = false;
  });

  it('reports a missing class instead of leaving the loading indicator active', () => {
    page.ngOnInit();
    expect(page.errorCarga).toContain('seleccionado una clase');
    expect(page.cargando).toBeFalse();
    expect(grades.getByAssignment).not.toHaveBeenCalled();
  });

  it('includes zero when calculating the displayed average', () => {
    const item = student('student', 0);
    const populated = { ...item, notas: { ...item.notas, trimestre2: 15, trimestre3: 15 } };
    page.calcularPromedio(populated);
    expect(populated.notas.promedioFinal).toBe(10);
    expect(populated.error).toBeNull();
  });

  it('saves assessed zero and clearing an existing record, but skips untouched pending students', async () => {
    page.estudiantesConNotas = [
      student('zero', 0), student('pending', null), student('cleared', '', 'historical-id'),
    ];
    await page.saveGrades();
    const [assignmentId, updates] = grades.saveForAssignment.calls.mostRecent().args;
    expect(assignmentId).toBe('class');
    expect(updates.map((update) => update.studentId)).toEqual(['zero', 'cleared']);
    expect(updates[0].grades.trimestre1).toBe(0);
    expect(updates[1].documentId).toBe('historical-id');
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(page.guardando).toBeFalse();
  });

  it('rejects invalid form values before requesting a save', async () => {
    page.estudiantesConNotas = [student('invalid', 21), student('valid', 12)];
    await page.saveGrades();
    expect(page.estudiantesConNotas[0].error).toContain('entre 0 y 20');
    expect(grades.saveForAssignment).not.toHaveBeenCalled();
    expect(nav.back).not.toHaveBeenCalled();
    expect(page.presentToast).toHaveBeenCalledWith('Corrige las notas inválidas antes de guardar.', 'warning');
  });

  it('does not submit while records are loading, failed to load, or another save is pending', async () => {
    page.estudiantesConNotas = [student('student', 12)];
    page.cargando = true;
    await page.saveGrades();
    page.cargando = false;
    page.errorCarga = 'No se pudieron cargar las notas';
    await page.saveGrades();
    page.errorCarga = null;
    page.guardando = true;
    await page.saveGrades();
    expect(grades.saveForAssignment).not.toHaveBeenCalled();
  });

  it('keeps edited grades and allows retry when saving fails', async () => {
    spyOn(console, 'error');
    page.estudiantesConNotas = [student('student', 0, 'existing')];
    grades.saveForAssignment.and.rejectWith(new Error('offline'));
    await page.saveGrades();
    expect(page.guardando).toBeFalse();
    expect(page.estudiantesConNotas[0].notas.trimestre1).toBe(0);
    expect(nav.back).not.toHaveBeenCalled();
    grades.saveForAssignment.and.resolveTo();
    await page.saveGrades();
    expect(grades.saveForAssignment).toHaveBeenCalledTimes(2);
    expect(nav.back).toHaveBeenCalledTimes(1);
  });

  it('does not create empty grade records', async () => {
    page.estudiantesConNotas = [student('pending', null)];
    await page.saveGrades();
    expect(grades.saveForAssignment).not.toHaveBeenCalled();
    expect(page.presentToast).toHaveBeenCalledWith('No hay notas para guardar.', 'warning');
  });
});
