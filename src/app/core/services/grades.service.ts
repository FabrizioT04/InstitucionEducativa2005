import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, doc, getDocs, query, serverTimestamp, where, writeBatch,
} from '@angular/fire/firestore';
import {
  GradeInput, GradeRecord, calculateGradeAverage, gradeDocumentId,
  normalizeGradeRecord, normalizeTrimesterGrades,
} from '../models/grade.model';
import { AccessService } from '../auth/access.service';

export interface GradeUpdate {
  studentId: string;
  documentId: string | null;
  grades: GradeInput;
}

@Injectable({ providedIn: 'root' })
export class GradesService {
  private readonly firestore = inject(Firestore);
  private readonly access = inject(AccessService);

  async getByAssignment(asignacionId: string): Promise<GradeRecord[]> {
    const snapshot = await getDocs(query(
      collection(this.firestore, 'calificaciones'), where('asignacionId', '==', asignacionId),
    ));
    return snapshot.docs.map((item) => normalizeGradeRecord(item.id, item.data()));
  }

  async getByStudent(studentId: string, asignacionId?: string): Promise<GradeRecord[]> {
    const constraints = [where('studentId', '==', studentId)];
    if (asignacionId) constraints.push(where('asignacionId', '==', asignacionId));
    const snapshot = await getDocs(query(collection(this.firestore, 'calificaciones'), ...constraints));
    return snapshot.docs.map((item) => normalizeGradeRecord(item.id, item.data()));
  }

  async saveForAssignment(asignacionId: string, updates: GradeUpdate[]): Promise<void> {
    if (!asignacionId) throw new Error('No se ha seleccionado una clase.');
    const access = await this.access.authorize({ roles: ['administrador', 'profesor'], classAccess: 'manage' }, asignacionId);
    if (access !== 'allowed') throw new Error('No tienes permiso para modificar las notas de esta clase.');
    if (new Set(updates.map((item) => item.studentId)).size !== updates.length) {
      throw new Error('Hay estudiantes duplicados en la lista de notas.');
    }
    // Validate every entry before committing anything. Existing document IDs are retained.
    const records = updates.map((update) => {
      const grades = normalizeTrimesterGrades(update.grades);
      return {
        id: update.documentId ?? gradeDocumentId(asignacionId, update.studentId),
        data: {
          asignacionId, studentId: update.studentId, ...grades,
          promedioFinal: calculateGradeAverage(grades),
          fecha: serverTimestamp(),
        },
      };
    });
    // Keep each batch below Firestore's write limit. Retrying updates is idempotent.
    for (let offset = 0; offset < records.length; offset += 450) {
      const batch = writeBatch(this.firestore);
      for (const record of records.slice(offset, offset + 450)) {
        batch.set(doc(this.firestore, 'calificaciones', record.id), record.data, { merge: true });
      }
      await batch.commit();
    }
  }
}
