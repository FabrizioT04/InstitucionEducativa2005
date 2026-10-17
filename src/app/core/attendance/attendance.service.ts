import { Injectable, InjectionToken, inject } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, query, where, writeBatch } from '@angular/fire/firestore';
import { enrollmentStudentId } from '../models/enrollment.model';
import {
  AttendanceClass, AttendanceDocument, AttendanceStudent, AttendanceWrite,
  attendanceDayBounds, buildAttendanceWrites, selectDailyAttendance,
} from './attendance.model';

/** Small persistence boundary, also usable by unit tests without a live Firebase project. */
export interface AttendanceDataSource {
  assignments(teacherId: string | null): Promise<AttendanceDocument[]>;
  enrollments(assignmentId: string): Promise<AttendanceDocument[]>;
  document(collectionName: string, id: string): Promise<Record<string, unknown> | null>;
  daily(assignmentId: string, day: string): Promise<AttendanceDocument[]>;
  save(writes: AttendanceWrite[]): Promise<void>;
}

export const ATTENDANCE_DATA_SOURCE = new InjectionToken<AttendanceDataSource>('AttendanceDataSource', {
  providedIn: 'root',
  factory: () => {
    const firestore = inject(Firestore);
    const find = async (collectionName: string, field: string, value: string) => {
      const snapshot = await getDocs(query(collection(firestore, collectionName), where(field, '==', value)));
      return snapshot.docs.map(item => ({ id: item.id, data: item.data() }));
    };
    return {
      assignments: async teacherId => {
        if (teacherId !== null) return find('asignaciones', 'profesorId', teacherId);
        const snapshot = await getDocs(collection(firestore, 'asignaciones'));
        return snapshot.docs.map(item => ({ id: item.id, data: item.data() }));
      },
      enrollments: assignmentId => find('inscripciones', 'asignacionId', assignmentId),
      document: async (collectionName, id) => {
        const snapshot = await getDoc(doc(firestore, collectionName, id));
        return snapshot.exists() ? snapshot.data() : null;
      },
      daily: async (assignmentId, day) => {
        const { start, end } = attendanceDayBounds(day);
        const snapshot = await getDocs(query(collection(firestore, 'asistencias'),
          where('asignacionId', '==', assignmentId),
          where('fecha', '>=', start), where('fecha', '<', end)));
        return snapshot.docs.map(item => ({ id: item.id, data: item.data() }));
      },
      save: async writes => {
        // Each chunk is retryable: deterministic/reused IDs cannot create duplicates.
        for (let offset = 0; offset < writes.length; offset += 450) {
          const batch = writeBatch(firestore);
          for (const write of writes.slice(offset, offset + 450)) {
            batch.set(doc(firestore, 'asistencias', write.id), write.data, { merge: true });
          }
          await batch.commit();
        }
      },
    };
  },
});

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly source = inject(ATTENDANCE_DATA_SOURCE);

  async loadAssignments(teacherId: string | null): Promise<AttendanceClass[]> {
    const assignments = await this.source.assignments(teacherId);
    const classes = await Promise.all(assignments.map(async assignment => {
      const courseId = assignment.data['cursoId'];
      const gradeId = assignment.data['gradoId'];
      if (typeof courseId !== 'string' || !courseId || typeof gradeId !== 'string' || !gradeId) return null;
      const [course, grade] = await Promise.all([
        this.source.document('cursos', courseId), this.source.document('grados', gradeId),
      ]);
      return {
        id: assignment.id,
        nombreCompleto: [course?.['nombre'] ?? 'Curso desconocido', grade?.['nombre'], grade?.['seccion']]
          .filter(value => typeof value === 'string' && value.length > 0).join(' - '),
      };
    }));
    return classes.filter((value): value is AttendanceClass => value !== null)
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
  }

  async loadStudents(assignmentId: string, day: string): Promise<AttendanceStudent[]> {
    const [enrollments, documents] = await Promise.all([
      this.source.enrollments(assignmentId), this.source.daily(assignmentId, day),
    ]);
    const attendance = selectDailyAttendance(documents, assignmentId, day);
    const studentIds = new Set(enrollments.map(enrollment => enrollmentStudentId(enrollment.data))
      .filter((value): value is string => value !== null));
    const students = await Promise.all(Array.from(studentIds).map(async id => {
      const profile = await this.source.document('usuarios', id);
      if (!profile) return null;
      const previous = attendance.get(id);
      return {
        id,
        nombreCompleto: typeof profile['nombreCompleto'] === 'string' ? profile['nombreCompleto'] : 'Estudiante sin nombre',
        // An invalid saved status must be corrected explicitly, never replaced silently.
        estadoAsistencia: previous ? previous.estado : 'PRESENTE',
      } as AttendanceStudent;
    }));
    return students.filter((value): value is AttendanceStudent => value !== null)
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
  }

  async saveDaily(assignmentId: string, day: string, students: AttendanceStudent[]): Promise<void> {
    // Re-read before saving to find legacy IDs created since the roster was opened.
    const documents = await this.source.daily(assignmentId, day);
    const existing = selectDailyAttendance(documents, assignmentId, day);
    await this.source.save(buildAttendanceWrites(assignmentId, day, students, existing));
  }
}
