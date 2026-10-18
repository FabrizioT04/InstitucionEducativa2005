import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { AccessibleAssignment, AuthorizedUser } from './access.models';
import { enrollmentStudentId } from '../models/enrollment.model';

/** Firebase reads isolated from navigation policy so policy can be tested in isolation. */
@Injectable({ providedIn: 'root' })
export class AccessRepository {
  private readonly firestore = inject(Firestore);

  async getProfile(uid: string): Promise<Record<string, unknown> | null> {
    const snapshot = await getDoc(doc(this.firestore, 'usuarios', uid));
    return snapshot.exists() ? snapshot.data() : null;
  }

  async getAssignment(id: string): Promise<Record<string, unknown> | null> {
    const snapshot = await getDoc(doc(this.firestore, 'asignaciones', id));
    return snapshot.exists() ? snapshot.data() : null;
  }

  async listAssignments(user: AuthorizedUser): Promise<AccessibleAssignment[]> {
    const assignments = collection(this.firestore, 'asignaciones');
    if (user.role !== 'estudiante') {
      const snapshot = await getDocs(user.role === 'profesor'
        ? query(assignments, where('profesorId', '==', user.uid))
        : assignments);
      return snapshot.docs.map(item => this.assignmentReference(item.id, item.data()));
    }

    const enrollments = await Promise.all(['studentId', 'estudianteId'].map(field =>
      getDocs(query(collection(this.firestore, 'inscripciones'), where(field, '==', user.uid))),
    ));
    const ids = new Set<string>();
    for (const snapshot of enrollments) {
      for (const enrollment of snapshot.docs) {
        if (enrollmentStudentId(enrollment.data()) !== user.uid) continue;
        const id = enrollment.data()['asignacionId'];
        if (typeof id === 'string' && id && !id.includes('/')) ids.add(id);
      }
    }
    const snapshots = await Promise.all([...ids].map(id => getDoc(doc(assignments, id))));
    return snapshots.filter(item => item.exists())
      .map(item => this.assignmentReference(item.id, item.data()!));
  }

  private assignmentReference(id: string, data: Record<string, unknown>): AccessibleAssignment {
    const reference: AccessibleAssignment = { id };
    for (const field of ['cursoId', 'gradoId', 'profesorId'] as const) {
      const value = data[field];
      if (typeof value === 'string' && value && !value.includes('/')) reference[field] = value;
    }
    return reference;
  }

  async isStudentEnrolled(uid: string, assignmentId: string): Promise<boolean> {
    // Existing enrollment writers use both field names. Keep legacy records readable.
    for (const studentField of ['studentId', 'estudianteId']) {
      const snapshot = await getDocs(query(
        collection(this.firestore, 'inscripciones'),
        where(studentField, '==', uid),
        where('asignacionId', '==', assignmentId),
        ...(studentField === 'studentId' ? [limit(1)] : []),
      ));
      if (snapshot.docs.some(item => enrollmentStudentId(item.data()) === uid)) return true;
    }
    return false;
  }
}
