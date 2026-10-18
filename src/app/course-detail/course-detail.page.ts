import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Auth, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc, query, where, collection, getDocs } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { GradeRecord } from '../core/models/grade.model';
import { GradesService } from '../core/services/grades.service';
import { GradeSummaryComponent } from '../shared/grade-summary/grade-summary.component';
import { AttendanceStatus, attendanceDate, normalizeAttendanceStatus } from '../core/attendance/attendance.model';
import { AccessRepository } from '../core/auth/access.repository';
import { parseUserRole } from '../core/auth/access.models';
import { addIcons } from 'ionicons';
import {
  personCircleOutline, schoolOutline, timeOutline, statsChartOutline,
  checkmarkDoneOutline, createOutline, personAddOutline, trashOutline,
} from 'ionicons/icons';

interface ClaseDetalle {
  nombreCurso: string;
  nombreGrado: string;
  nombreProfesor: string;
}

interface AsistenciaResumen {
  id: string;
  fecha: Date;
  estado: AttendanceStatus | null;
}

@Component({
  selector: 'app-course-detail',
  templateUrl: './course-detail.page.html',
  styleUrls: ['./course-detail.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, GradeSummaryComponent],
})
export class CourseDetailPage implements OnInit, OnDestroy {
  public asignacionId: string | null = null;
  public userRole: string | null = null;
  public esProfesorDeEstaClase = false;
  public esEstudianteInscrito = false;
  public claseDetalles$: Observable<ClaseDetalle | null> = of(null);
  public currentUser: User | null = null;
  public errorClase: string | null = null;
  public misCalificaciones$: Observable<GradeRecord[]> = of([]);
  public errorCalificaciones: string | null = null;
  public misAsistencias$: Observable<AsistenciaResumen[]> = of([]);
  public errorAsistencias: string | null = null;
  public cargandoCalificaciones = false;
  public cargandoAsistencias = false;

  private readonly firestore = inject(Firestore);
  private readonly gradesService = inject(GradesService);
  private readonly accessRepository = inject(AccessRepository);
  private readonly auth = inject(Auth);
  private readonly navCtrl = inject(NavController);
  private readonly route = inject(ActivatedRoute);
  private unsubscribeAuth?: () => void;
  private pageRequest = 0;
  private gradeRequest = 0;
  private attendanceRequest = 0;

  constructor() {
    addIcons({
      personCircleOutline, schoolOutline, timeOutline, statsChartOutline,
      checkmarkDoneOutline, createOutline, personAddOutline, trashOutline,
    });
  }

  ngOnInit() {
    this.unsubscribeAuth = this.auth.onAuthStateChanged((user) => {
      this.resetPage();
      this.currentUser = user;
      if (!user) {
        this.navCtrl.navigateRoot('/login');
        return;
      }
      this.asignacionId = this.route.snapshot.paramMap.get('id');
      if (this.asignacionId) {
        void this.loadRoleAndPageData(user.uid, this.asignacionId);
      } else {
        this.navCtrl.back();
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribeAuth?.();
    this.resetPage();
  }

  private resetPage() {
    this.pageRequest++;
    this.gradeRequest++;
    this.attendanceRequest++;
    this.userRole = null;
    this.esProfesorDeEstaClase = false;
    this.esEstudianteInscrito = false;
    this.errorClase = null;
    this.errorCalificaciones = null;
    this.errorAsistencias = null;
    this.cargandoCalificaciones = false;
    this.cargandoAsistencias = false;
    this.claseDetalles$ = of(null);
    this.misCalificaciones$ = of([]);
    this.misAsistencias$ = of([]);
  }

  async loadRoleAndPageData(uid: string, asignacionId: string) {
    const request = ++this.pageRequest;
    try {
      const profile = await this.accessRepository.getProfile(uid);
      if (request !== this.pageRequest) return;
      this.userRole = parseUserRole(profile?.['rol']);
      if (!this.userRole) {
        this.errorClase = 'No se encontró un perfil válido para acceder a la clase.';
        return;
      }
      await this.loadPageDetails(uid, asignacionId, request);
    } catch (error) {
      if (request !== this.pageRequest) return;
      console.error('Error al cargar la clase:', error);
      this.errorClase = 'No se pudieron cargar los detalles de la clase.';
    }
  }

  async loadPageDetails(uid: string, asignacionId: string, request = ++this.pageRequest) {
    this.esProfesorDeEstaClase = false;
    this.esEstudianteInscrito = false;
    this.claseDetalles$ = from(this.accessRepository.getAssignment(asignacionId)).pipe(
      switchMap(async (assignment) => {
        if (request !== this.pageRequest || !assignment) return null;
        this.esProfesorDeEstaClase = this.userRole === 'profesor' && assignment['profesorId'] === uid;
        const [cursoSnap, gradoSnap, profesorSnap] = await Promise.all([
          getDoc(doc(this.firestore, 'cursos', String(assignment['cursoId']))),
          getDoc(doc(this.firestore, 'grados', String(assignment['gradoId']))),
          getDoc(doc(this.firestore, 'usuarios', String(assignment['profesorId']))),
        ]);
        if (request !== this.pageRequest) return null;
        return {
          nombreCurso: cursoSnap.exists() ? cursoSnap.data()['nombre'] : 'Curso no disponible',
          nombreGrado: gradoSnap.exists() ? `${gradoSnap.data()['nombre']} - ${gradoSnap.data()['seccion']}` : '',
          nombreProfesor: profesorSnap.exists() ? profesorSnap.data()['nombreCompleto'] : 'Profesor no asignado',
        };
      }),
      catchError((error) => {
        if (request === this.pageRequest) {
          console.error('Error al cargar los detalles de la clase:', error);
          this.errorClase = 'No se pudieron cargar los detalles de la clase.';
        }
        return of(null);
      }),
    );

    if (this.userRole === 'estudiante') {
      // Use the same enrollment lookup as the guard, including legacy estudianteId records.
      const enrolled = await this.accessRepository.isStudentEnrolled(uid, asignacionId);
      if (request !== this.pageRequest) return;
      this.esEstudianteInscrito = enrolled;
      if (enrolled) {
        this.loadMisCalificaciones(uid, asignacionId);
        this.loadMisAsistencias(uid, asignacionId);
      }
    }
  }

  loadMisCalificaciones(studentId: string, asignacionId: string) {
    const request = ++this.gradeRequest;
    this.cargandoCalificaciones = true;
    this.errorCalificaciones = null;
    this.misCalificaciones$ = from(this.gradesService.getByStudent(studentId, asignacionId)).pipe(
      map((grades) => request === this.gradeRequest ? grades : []),
      catchError((error) => {
        if (request === this.gradeRequest) {
          console.error('Error al cargar las calificaciones:', error);
          this.errorCalificaciones = 'No se pudieron cargar las calificaciones.';
        }
        return of([]);
      }),
      finalize(() => {
        if (request === this.gradeRequest) this.cargandoCalificaciones = false;
      }),
    );
  }

  loadMisAsistencias(studentId: string, asignacionId: string) {
    const request = ++this.attendanceRequest;
    this.cargandoAsistencias = true;
    this.errorAsistencias = null;
    const attendanceQuery = query(
      collection(this.firestore, 'asistencias'),
      where('estudianteId', '==', studentId),
      where('asignacionId', '==', asignacionId),
    );
    this.misAsistencias$ = from(getDocs(attendanceQuery)).pipe(
      map((snapshot) => {
        if (request !== this.attendanceRequest) return [];
        return snapshot.docs.map((item): AsistenciaResumen | null => {
          const data = item.data();
          const fecha = attendanceDate(data['fecha']);
          return fecha ? { id: item.id, fecha, estado: normalizeAttendanceStatus(data['estado']) } : null;
        }).filter((item): item is AsistenciaResumen => item !== null)
          .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
      }),
      catchError((error) => {
        if (request === this.attendanceRequest) {
          console.error('Error al cargar las asistencias:', error);
          this.errorAsistencias = 'No se pudieron cargar las asistencias.';
        }
        return of([]);
      }),
      finalize(() => {
        if (request === this.attendanceRequest) this.cargandoAsistencias = false;
      }),
    );
  }

  formatDate(date: Date | undefined): string {
    if (!date || !Number.isFinite(date.getTime())) return '';
    return date.toLocaleDateString('es-ES', {
      timeZone: 'America/Lima', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  goToManageAttendance() {
    this.navCtrl.navigateForward(`/manage-attendance/${this.asignacionId}`);
  }
  goToManageGrades() {
    this.navCtrl.navigateForward(`/manage-grades/${this.asignacionId}`);
  }
  goToEnrollStudents() {
    this.navCtrl.navigateForward(`/enroll-students/${this.asignacionId}`);
  }
  goToMyGrades() {
    this.navCtrl.navigateForward('/my-grades');
  }
  goToMyAttendance() {
    this.navCtrl.navigateForward('/attendance-history');
  }
  goToEditAssignment() {}
}
