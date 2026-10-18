import { TestBed } from '@angular/core/testing';
import { ATTENDANCE_DATA_SOURCE, AttendanceDataSource, AttendanceService } from './attendance.service';
import { AttendanceDocument, AttendanceStudent, attendanceDay, attendanceDocumentId } from './attendance.model';

describe('AttendanceService', () => {
  let source: jasmine.SpyObj<AttendanceDataSource>;
  let service: AttendanceService;
  const now = new Date('2026-10-17T13:00:00Z');
  const day = attendanceDay(now);
  const student: AttendanceStudent = { id: 'student-1', nombreCompleto: 'Ana', estadoAsistencia: 'PRESENTE' };

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(now);
    source = jasmine.createSpyObj<AttendanceDataSource>('AttendanceDataSource', ['assignments', 'enrollments', 'document', 'daily', 'save']);
    source.assignments.and.resolveTo([]);
    source.enrollments.and.resolveTo([]);
    source.document.and.resolveTo(null);
    source.daily.and.resolveTo([]);
    source.save.and.resolveTo();
    TestBed.configureTestingModule({ providers: [
      AttendanceService, { provide: ATTENDANCE_DATA_SOURCE, useValue: source },
    ] });
    service = TestBed.inject(AttendanceService);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('filters assignments for a teacher and supports the administrator class list', async () => {
    await service.loadAssignments('teacher-1');
    expect(source.assignments).toHaveBeenCalledWith('teacher-1');
    await service.loadAssignments(null);
    expect(source.assignments).toHaveBeenCalledWith(null);
  });

  it('joins valid assignment labels and skips records without course or grade IDs', async () => {
    source.assignments.and.resolveTo([
      { id: 'class-1', data: { cursoId: 'course-1', gradoId: 'grade-1' } },
      { id: 'broken', data: { cursoId: 'course-2' } },
    ]);
    source.document.and.callFake(async collectionName => collectionName === 'cursos'
      ? { nombre: 'Matemática' } : { nombre: 'Primero', seccion: 'A' });
    expect(await service.loadAssignments('teacher-1')).toEqual([
      { id: 'class-1', nombreCompleto: 'Matemática - Primero - A' },
    ]);
  });

  it('deduplicates enrollments, restores previous attendance and omits missing profiles', async () => {
    source.enrollments.and.resolveTo([
      { id: 'e1', data: { studentId: 'student-1' } },
      { id: 'duplicate', data: { estudianteId: 'student-1' } },
      { id: 'e2', data: { estudianteId: 'student-2' } },
      { id: 'deleted', data: { studentId: 'deleted-student' } },
      { id: 'invalid', data: { studentId: null } },
    ]);
    source.document.and.callFake(async (_collection, id) => id === 'deleted-student'
      ? null : { nombreCompleto: id === 'student-1' ? 'Ana' : 'Beatriz' });
    source.daily.and.resolveTo([{ id: 'legacy-id', data: {
      asignacionId: 'class-1', estudianteId: 'student-1', fecha: now, estado: 'FALTA',
    } }]);
    expect(await service.loadStudents('class-1', day)).toEqual([
      { ...student, estadoAsistencia: 'AUSENTE' },
      { id: 'student-2', nombreCompleto: 'Beatriz', estadoAsistencia: 'PRESENTE' },
    ]);
    expect(source.document.calls.allArgs().filter(args => args[1] === 'student-1').length).toBe(1);
  });

  it('retains an invalid existing status for explicit correction', async () => {
    source.enrollments.and.resolveTo([{ id: 'e1', data: { studentId: student.id } }]);
    source.document.and.resolveTo({ nombreCompleto: 'Ana' });
    source.daily.and.resolveTo([{ id: 'legacy-id', data: {
      asignacionId: 'class-1', estudianteId: student.id, fecha: now, estado: 'UNKNOWN',
    } }]);
    expect((await service.loadStudents('class-1', day))[0].estadoAsistencia).toBeNull();
  });

  it('keeps one daily document after repeated saves and a later correction', async () => {
    const documents = new Map<string, AttendanceDocument>();
    source.daily.and.callFake(async () => Array.from(documents.values()));
    source.save.and.callFake(async writes => {
      for (const write of writes) documents.set(write.id, { id: write.id, data: { ...write.data } });
    });
    await service.saveDaily('class-1', day, [student]);
    await service.saveDaily('class-1', day, [{ ...student, estadoAsistencia: 'TARDANZA' }]);
    expect(documents.size).toBe(1);
    expect(documents.get(attendanceDocumentId('class-1', student.id, day))?.data['estado']).toBe('TARDANZA');
    expect(source.daily).toHaveBeenCalledTimes(2);
  });

  it('re-reads legacy records before saving and updates one existing ID without deleting duplicates', async () => {
    const originalTime = new Date('2026-10-17T12:00:00Z');
    source.daily.and.resolveTo([
      { id: 'old-duplicate', data: { asignacionId: 'class-1', estudianteId: student.id, fecha: new Date('2026-10-17T11:00:00Z'), estado: 'FALTA' } },
      { id: 'latest-legacy', data: { asignacionId: 'class-1', estudianteId: student.id, fecha: originalTime, estado: 'FALTA' } },
    ]);
    await service.saveDaily('class-1', day, [student]);
    expect(source.save).toHaveBeenCalledOnceWith([{
      id: 'latest-legacy', data: {
        asignacionId: 'class-1', estudianteId: student.id, dia: day, fecha: originalTime, estado: 'PRESENTE',
      },
    }]);
  });

  it('does not write when reading existing records fails', async () => {
    source.daily.and.rejectWith(new Error('permission-denied'));
    await expectAsync(service.saveDaily('class-1', day, [student])).toBeRejectedWithError('permission-denied');
    expect(source.save).not.toHaveBeenCalled();
  });

  it('propagates failed writes so the page can offer a retry', async () => {
    source.save.and.rejectWith(new Error('unavailable'));
    await expectAsync(service.saveDaily('class-1', day, [student])).toBeRejectedWithError('unavailable');
  });
});
