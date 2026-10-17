import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, query, where, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { addIcons } from 'ionicons';
import { saveOutline } from 'ionicons/icons';
import { GradeInput, calculateGradeAverage, findTrimesterRecord, normalizeTrimesterGrades } from '../core/models/grade.model';
import { GradesService } from '../core/services/grades.service';
import { enrollmentStudentId } from '../core/models/enrollment.model';

interface StudentGrades {
  id: string;
  nombreCompleto: string;
  notas: GradeInput & { promedioFinal: number | null; calificacionId: string | null };
  error: string | null;
}

@Component({
  selector: 'app-manage-grades',
  templateUrl: './manage-grades.page.html',
  styleUrls: ['./manage-grades.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ManageGradesPage implements OnInit {
  public estudiantesConNotas: StudentGrades[] = [];
  public asignacionId: string | null = null;
  public tituloClase = 'Gestionar Notas';
  public cargando = true;
  public guardando = false;
  public errorCarga: string | null = null;

  private readonly firestore = inject(Firestore);
  private readonly gradesService = inject(GradesService);
  private readonly route = inject(ActivatedRoute);
  private readonly navCtrl = inject(NavController);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({ saveOutline });
  }

  ngOnInit() {
    this.asignacionId = this.route.snapshot.paramMap.get('id');
    if (this.asignacionId) {
      void this.loadStudentGrades();
    } else {
      this.errorCarga = 'No se ha seleccionado una clase.';
      this.cargando = false;
    }
  }

  async loadStudentGrades() {
    if (!this.asignacionId) return;
    this.cargando = true;
    this.errorCarga = null;
    this.estudiantesConNotas = [];
    try {
      const asignacionSnap = await getDoc(doc(this.firestore, 'asignaciones', this.asignacionId));
      if (!asignacionSnap.exists()) throw new Error('La clase seleccionada ya no existe.');
      const cursoSnap = await getDoc(doc(this.firestore, 'cursos', asignacionSnap.data()['cursoId']));
      if (cursoSnap.exists()) this.tituloClase = `Notas de ${cursoSnap.data()['nombre']}`;

      const [inscripcionesSnapshot, calificaciones] = await Promise.all([
        getDocs(query(collection(this.firestore, 'inscripciones'), where('asignacionId', '==', this.asignacionId))),
        this.gradesService.getByAssignment(this.asignacionId),
      ]);
      const studentIds = Array.from(new Set(inscripcionesSnapshot.docs
        .map((item) => enrollmentStudentId(item.data()))
        .filter((id): id is string => id !== null)));

      const students = await Promise.all(studentIds.map(async (studentId): Promise<StudentGrades | null> => {
        const userSnap = await getDoc(doc(this.firestore, 'usuarios', studentId));
        if (!userSnap.exists()) return null;
        const record = findTrimesterRecord(calificaciones, studentId);
        const grades = normalizeTrimesterGrades(record ?? {
          trimestre1: null, trimestre2: null, trimestre3: null,
        });
        return {
          id: studentId,
          nombreCompleto: userSnap.data()['nombreCompleto'] || 'Estudiante',
          notas: {
            ...grades,
            promedioFinal: calculateGradeAverage(grades),
            calificacionId: record?.id ?? null,
          },
          error: null,
        };
      }));
      this.estudiantesConNotas = students.filter((student): student is StudentGrades => student !== null)
        .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
    } catch (error) {
      console.error('Error al cargar las calificaciones:', error);
      this.errorCarga = error instanceof Error ? error.message : 'No se pudieron cargar las calificaciones.';
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  calcularPromedio(item: StudentGrades) {
    try {
      item.notas.promedioFinal = calculateGradeAverage(item.notas);
      item.error = null;
    } catch {
      item.notas.promedioFinal = null;
      item.error = 'Ingresa notas entre 0 y 20 o deja el trimestre pendiente.';
    }
  }

  async saveGrades() {
    if (this.guardando || this.cargando || this.errorCarga || !this.asignacionId) return;
    this.estudiantesConNotas.forEach((item) => this.calcularPromedio(item));
    if (this.estudiantesConNotas.some((item) => item.error)) {
      await this.presentToast('Corrige las notas inválidas antes de guardar.', 'warning');
      return;
    }
    // Leave ungraded students without a new document; allow clearing existing grades.
    const updates = this.estudiantesConNotas
      .filter((item) => item.notas.calificacionId !== null || item.notas.promedioFinal !== null)
      .map((item) => ({ studentId: item.id, documentId: item.notas.calificacionId, grades: item.notas }));
    if (updates.length === 0) {
      await this.presentToast('No hay notas para guardar.', 'warning');
      return;
    }
    this.guardando = true;
    try {
      await this.gradesService.saveForAssignment(this.asignacionId, updates);
      await this.presentToast('Notas guardadas con éxito.', 'success');
      this.navCtrl.back();
    } catch (error) {
      console.error('Error al guardar las notas:', error);
      await this.presentToast('No se pudieron guardar todas las notas. Puedes volver a intentarlo.', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color });
    await toast.present();
  }
}
