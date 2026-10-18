import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { GradeRecord } from '../core/models/grade.model';
import { GradesService } from '../core/services/grades.service';
import { GradeSummaryComponent } from '../shared/grade-summary/grade-summary.component';

interface AsignacionConCalificaciones {
  id: string;
  nombreCurso: string;
  nombreGrado: string;
  calificaciones: GradeRecord[];
}

@Component({
  selector: 'app-my-grades',
  templateUrl: './my-grades.page.html',
  styleUrls: ['./my-grades.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, GradeSummaryComponent],
})
export class MyGradesPage implements OnInit, OnDestroy {
  public currentUser: User | null = null;
  public isLoading = true;
  public errorCarga: string | null = null;
  public gruposDeCalificaciones: AsignacionConCalificaciones[] = [];

  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly navCtrl = inject(NavController);
  private readonly gradesService = inject(GradesService);
  private unsubscribeAuth?: () => void;

  ngOnInit() {
    this.unsubscribeAuth = onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      if (user) {
        void this.loadAllMyGrades(user.uid);
      } else {
        this.gruposDeCalificaciones = [];
        this.navCtrl.navigateRoot('/login');
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribeAuth?.();
  }

  async loadAllMyGrades(studentId: string) {
    this.isLoading = true;
    this.errorCarga = null;
    this.gruposDeCalificaciones = [];
    try {
      const records = await this.gradesService.getByStudent(studentId);
      const calificacionesPorAsignacion = new Map<string, GradeRecord[]>();
      for (const record of records) {
        if (!record.asignacionId) continue;
        const grupo = calificacionesPorAsignacion.get(record.asignacionId) ?? [];
        grupo.push(record);
        calificacionesPorAsignacion.set(record.asignacionId, grupo);
      }
      const grupos = await Promise.all(Array.from(calificacionesPorAsignacion.entries()).map(
        async ([asignacionId, calificaciones]): Promise<AsignacionConCalificaciones> => {
          const asignacionSnap = await getDoc(doc(this.firestore, 'asignaciones', asignacionId));
          // Keep the student's grades visible when an old assignment has been removed.
          if (!asignacionSnap.exists()) {
            return { id: asignacionId, nombreCurso: 'Clase no disponible', nombreGrado: '', calificaciones };
          }
          const asignacionData = asignacionSnap.data();
          const [cursoSnap, gradoSnap] = await Promise.all([
            getDoc(doc(this.firestore, 'cursos', asignacionData['cursoId'])),
            getDoc(doc(this.firestore, 'grados', asignacionData['gradoId'])),
          ]);
          return {
            id: asignacionId,
            nombreCurso: cursoSnap.exists() ? cursoSnap.data()['nombre'] : 'Curso no disponible',
            nombreGrado: gradoSnap.exists() ? `${gradoSnap.data()['nombre']} - ${gradoSnap.data()['seccion']}` : '',
            calificaciones,
          };
        },
      ));
      this.gruposDeCalificaciones = grupos.sort((a, b) => a.nombreCurso.localeCompare(b.nombreCurso, 'es'));
    } catch (error) {
      console.error('Error cargando las calificaciones:', error);
      this.errorCarga = 'No se pudieron cargar tus calificaciones. Vuelve a intentarlo.';
    } finally {
      this.isLoading = false;
    }
  }
}
