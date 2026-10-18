import { TestBed } from '@angular/core/testing';
import { Auth, User } from '@angular/fire/auth';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { AccessService } from '../core/auth/access.service';
import { AttendanceService } from '../core/attendance/attendance.service';
import { AttendanceStudent, attendanceDay } from '../core/attendance/attendance.model';
import { ManageAttendancePage } from './manage-attendance.page';

describe('ManageAttendancePage', () => {
  let page: ManageAttendancePage;
  let attendance: jasmine.SpyObj<AttendanceService>;
  let access: jasmine.SpyObj<AccessService>;
  let toast: jasmine.Spy;
  const student: AttendanceStudent = { id: 'student-1', nombreCompleto: 'Ana', estadoAsistencia: 'PRESENTE' };

  beforeEach(() => {
    attendance = jasmine.createSpyObj<AttendanceService>('AttendanceService', ['loadAssignments', 'loadStudents', 'saveDaily']);
    access = jasmine.createSpyObj<AccessService>('AccessService', ['getCurrentUser', 'authorize']);
    attendance.loadAssignments.and.resolveTo([{ id: 'class-1', nombreCompleto: 'Matemática' }]);
    attendance.loadStudents.and.resolveTo([{ ...student }]);
    attendance.saveDaily.and.resolveTo();
    access.getCurrentUser.and.resolveTo({ uid: 'teacher-1', role: 'profesor' });
    access.authorize.and.resolveTo('allowed');
    TestBed.configureTestingModule({ providers: [
      { provide: AttendanceService, useValue: attendance },
      { provide: AccessService, useValue: access },
      { provide: Auth, useValue: {} },
      { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['navigateRoot']) },
      { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'class-1' }) } } },
    ] });
    // Exercise page behavior without opening an actual Firebase auth subscription.
    page = TestBed.runInInjectionContext(() => new ManageAttendancePage());
    toast = spyOn(page, 'presentToast').and.resolveTo();
    spyOn(console, 'error');
    page.currentUser = { uid: 'teacher-1' } as User;
    page.asignaciones = [{ id: 'class-1', nombreCompleto: 'Matemática' }, { id: 'class-2', nombreCompleto: 'Historia' }];
    page.asignacionSeleccionada = 'class-1';
    page.cargandoAsignaciones = false;
    page.estudiantes = [{ ...student }];
  });

  it('loads a teacher class list and the requested class after checking authorization', async () => {
    await page.cargarAsignaciones();
    expect(attendance.loadAssignments).toHaveBeenCalledOnceWith('teacher-1');
    expect(access.authorize).toHaveBeenCalledWith({ roles: ['administrador', 'profesor'], classAccess: 'manage' }, 'class-1');
    expect(attendance.loadStudents).toHaveBeenCalledWith('class-1', attendanceDay());
  });

  it('lets administrators load all classes', async () => {
    access.getCurrentUser.and.resolveTo({ uid: 'teacher-1', role: 'administrador' });
    await page.cargarAsignaciones();
    expect(attendance.loadAssignments).toHaveBeenCalledOnceWith(null);
  });

  it('clears a previous class and roster when the profile loses permission', async () => {
    access.getCurrentUser.and.resolveTo({ uid: 'teacher-1', role: 'estudiante' });
    await page.cargarAsignaciones();
    expect(attendance.loadAssignments).not.toHaveBeenCalled();
    expect(page.asignaciones).toEqual([]);
    expect(page.asignacionSeleccionada).toBeNull();
    expect(page.estudiantes).toEqual([]);
  });

  it('does not request assignments after the page was destroyed during profile lookup', async () => {
    let resolveProfile!: (value: { uid: string; role: 'profesor' }) => void;
    access.getCurrentUser.and.returnValue(new Promise(resolve => { resolveProfile = resolve; }));
    const loading = page.cargarAsignaciones();
    page.ngOnDestroy();
    resolveProfile({ uid: 'teacher-1', role: 'profesor' });
    await loading;
    expect(attendance.loadAssignments).not.toHaveBeenCalled();
  });

  it('binds class selection to an allowed ID and ignores stale authorization responses', async () => {
    let resolveFirst!: (value: 'allowed') => void;
    access.authorize.and.returnValues(new Promise(resolve => { resolveFirst = resolve; }), Promise.resolve('allowed'));
    page.onClaseChange('class-1');
    page.onClaseChange('class-2');
    await Promise.resolve();
    await Promise.resolve();
    resolveFirst('allowed');
    await Promise.resolve();
    await Promise.resolve();
    expect(page.asignacionSeleccionada).toBe('class-2');
    expect(attendance.loadStudents).toHaveBeenCalledOnceWith('class-2', attendanceDay());
    page.onClaseChange('forged-class');
    expect(page.asignacionSeleccionada).toBeNull();
    expect(page.estudiantes).toEqual([]);
  });

  it('discards an older roster response when another class was selected', async () => {
    let resolveOld!: (value: AttendanceStudent[]) => void;
    attendance.loadStudents.and.callFake(assignmentId => assignmentId === 'class-1'
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve([{ ...student, id: 'new-student' }]));
    const first = page.cargarEstudiantes();
    await Promise.resolve();
    page.asignacionSeleccionada = 'class-2';
    await page.cargarEstudiantes();
    resolveOld([{ ...student, id: 'old-student' }]);
    await first;
    expect(page.estudiantes.map(value => value.id)).toEqual(['new-student']);
    expect(page.cargandoEstudiantes).toBeFalse();
  });

  it('does not load a roster for a forbidden class or preserve stale student data', async () => {
    access.authorize.and.resolveTo('forbidden');
    await page.cargarEstudiantes();
    expect(attendance.loadStudents).not.toHaveBeenCalled();
    expect(page.estudiantes).toEqual([]);
    expect(page.errorCarga).toBeTrue();
    expect(page.cargandoEstudiantes).toBeFalse();
  });

  it('updates only the specified student and accepts the legacy absence spelling', () => {
    page.marcarAsistencia(student.id, 'FALTA');
    expect(page.estudiantes[0].estadoAsistencia).toBe('AUSENTE');
    page.marcarAsistencia(student.id, 'INVALID');
    page.marcarAsistencia('missing-student', 'TARDANZA');
    expect(page.estudiantes[0].estadoAsistencia).toBe('AUSENTE');
  });

  it('prevents duplicate submissions and changes to a roster being saved', async () => {
    let finishSave!: () => void;
    attendance.saveDaily.and.returnValue(new Promise(resolve => { finishSave = resolve; }));
    const first = page.guardarLista();
    await Promise.resolve();
    await page.guardarLista();
    page.onClaseChange('class-2');
    page.marcarAsistencia(student.id, 'AUSENTE');
    expect(attendance.saveDaily).toHaveBeenCalledTimes(1);
    expect(page.asignacionSeleccionada).toBe('class-1');
    expect(page.estudiantes[0].estadoAsistencia).toBe('PRESENTE');
    finishSave();
    await first;
    expect(page.guardando).toBeFalse();
    expect(toast).toHaveBeenCalledWith('Asistencia guardada con éxito.', 'success');
  });

  it('rechecks permission before saving and refuses revoked access', async () => {
    access.authorize.and.resolveTo('forbidden');
    await page.guardarLista();
    expect(attendance.saveDaily).not.toHaveBeenCalled();
    expect(page.guardando).toBeFalse();
    expect(toast).toHaveBeenCalledWith('Ya no tienes permiso para modificar esta clase.', 'warning');
  });

  it('requires correcting unknown states before saving', async () => {
    page.estudiantes[0].estadoAsistencia = null;
    await page.guardarLista();
    expect(attendance.saveDaily).not.toHaveBeenCalled();
    expect(access.authorize).not.toHaveBeenCalled();
  });

  it('refreshes the roster instead of saving yesterday attendance', async () => {
    page.dia = '2000-01-01';
    await page.guardarLista();
    expect(attendance.saveDaily).not.toHaveBeenCalled();
    expect(attendance.loadStudents).toHaveBeenCalledWith('class-1', attendanceDay());
    expect(page.dia).toBe(attendanceDay());
  });

  it('keeps edits and permits retrying after a failed save', async () => {
    attendance.saveDaily.and.rejectWith(new Error('unavailable'));
    page.estudiantes[0].estadoAsistencia = 'TARDANZA';
    await page.guardarLista();
    expect(page.guardando).toBeFalse();
    expect(page.estudiantes[0].estadoAsistencia).toBe('TARDANZA');
    expect(toast).toHaveBeenCalledWith('No se completó el guardado. Puedes volver a intentarlo.', 'danger');
  });
});
