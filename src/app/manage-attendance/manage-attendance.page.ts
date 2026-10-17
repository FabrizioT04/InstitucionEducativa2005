import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { addIcons } from 'ionicons';
import { personCircleOutline, saveOutline } from 'ionicons/icons';
import { AttendanceService } from '../core/attendance/attendance.service';
import { AccessService } from '../core/auth/access.service';
import {
  AttendanceClass, AttendanceStudent, attendanceDay, normalizeAttendanceStatus,
} from '../core/attendance/attendance.model';

@Component({
  selector: 'app-manage-attendance',
  templateUrl: './manage-attendance.page.html',
  styleUrls: ['./manage-attendance.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ManageAttendancePage implements OnInit, OnDestroy {
  public asignaciones: AttendanceClass[] = [];
  public estudiantes: AttendanceStudent[] = [];
  public asignacionSeleccionada: string | null = null;
  public dia = attendanceDay();
  public cargandoAsignaciones = true;
  public cargandoEstudiantes = false;
  public guardando = false;
  public errorCarga = false;
  public currentUser: User | null = null;

  private readonly attendance = inject(AttendanceService);
  private readonly access = inject(AccessService);
  private readonly auth = inject(Auth);
  private readonly toastController = inject(ToastController);
  private readonly navCtrl = inject(NavController);
  private readonly route = inject(ActivatedRoute);
  private unsubscribeAuth?: () => void;
  private loadVersion = 0;
  private assignmentVersion = 0;
  private destroyed = false;

  constructor() {
    addIcons({ personCircleOutline, saveOutline });
  }

  ngOnInit(): void {
    this.unsubscribeAuth = onAuthStateChanged(this.auth, user => {
      this.currentUser = user;
      this.loadVersion++;
      this.estudiantes = [];
      if (!user) {
        this.assignmentVersion++;
        this.asignaciones = [];
        void this.navCtrl.navigateRoot('/login');
        return;
      }
      void this.cargarAsignaciones();
    });
  }

  // Ionic retains pages in its navigation stack; refresh saved attendance on return.
  ionViewWillEnter(): void {
    if (this.currentUser && !this.cargandoAsignaciones && !this.guardando) {
      void this.cargarEstudiantes();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.loadVersion++;
    this.assignmentVersion++;
    this.unsubscribeAuth?.();
  }

  async cargarAsignaciones(): Promise<void> {
    const userId = this.currentUser?.uid;
    if (!userId) return;
    const version = ++this.assignmentVersion;
    this.cargandoAsignaciones = true;
    try {
      const profile = await this.access.getCurrentUser();
      if (this.destroyed || version !== this.assignmentVersion || userId !== this.currentUser?.uid) return;
      if (!profile || profile.uid !== userId || !['administrador', 'profesor'].includes(profile.role)) {
        throw new Error('No tienes permiso para registrar asistencia.');
      }
      const assignments = await this.attendance.loadAssignments(profile.role === 'administrador' ? null : userId);
      if (this.destroyed || version !== this.assignmentVersion || userId !== this.currentUser?.uid) return;
      this.asignaciones = assignments;
      const requestedId = this.asignacionSeleccionada ?? this.route.snapshot.paramMap.get('id');
      this.asignacionSeleccionada = assignments.some(item => item.id === requestedId) ? requestedId : null;
      if (requestedId && !this.asignacionSeleccionada) {
        await this.presentToast('No tienes acceso a esta clase.', 'warning');
      }
      if (this.asignacionSeleccionada) await this.cargarEstudiantes();
    } catch (error) {
      if (!this.destroyed && version === this.assignmentVersion) {
        this.asignaciones = [];
        this.asignacionSeleccionada = null;
        this.estudiantes = [];
        console.error('Error cargando asignaciones:', error);
        await this.presentToast('No se pudieron cargar las clases.', 'danger');
      }
    } finally {
      if (!this.destroyed && version === this.assignmentVersion) this.cargandoAsignaciones = false;
    }
  }

  onClaseChange(value: unknown): void {
    if (this.guardando) return;
    this.asignacionSeleccionada = typeof value === 'string' && this.asignaciones.some(item => item.id === value) ? value : null;
    void this.cargarEstudiantes();
  }

  async cargarEstudiantes(): Promise<void> {
    if (this.guardando) return;
    const version = ++this.loadVersion;
    const assignmentId = this.asignacionSeleccionada;
    const userId = this.currentUser?.uid;
    this.estudiantes = [];
    this.errorCarga = false;
    this.cargandoEstudiantes = false;
    if (!assignmentId || !userId || !this.asignaciones.some(item => item.id === assignmentId)) return;
    this.dia = attendanceDay();
    const day = this.dia;
    this.cargandoEstudiantes = true;
    try {
      const decision = await this.access.authorize({ roles: ['administrador', 'profesor'], classAccess: 'manage' }, assignmentId);
      if (this.destroyed || version !== this.loadVersion || userId !== this.currentUser?.uid) return;
      if (decision !== 'allowed') throw new Error('No tienes acceso a esta clase.');
      const students = await this.attendance.loadStudents(assignmentId, day);
      if (this.destroyed || version !== this.loadVersion || userId !== this.currentUser?.uid) return;
      this.estudiantes = students;
    } catch (error) {
      if (!this.destroyed && version === this.loadVersion) {
        this.errorCarga = true;
        console.error('Error cargando asistencia:', error);
        await this.presentToast('No se pudo cargar la asistencia. Verifica tu acceso e intenta nuevamente.', 'danger');
      }
    } finally {
      if (!this.destroyed && version === this.loadVersion) this.cargandoEstudiantes = false;
    }
  }

  marcarAsistencia(estudianteId: string, value: unknown): void {
    if (this.guardando || this.cargandoEstudiantes) return;
    const status = normalizeAttendanceStatus(value);
    const student = this.estudiantes.find(item => item.id === estudianteId);
    if (student && status) student.estadoAsistencia = status;
  }

  async guardarLista(): Promise<void> {
    if (this.guardando || this.cargandoEstudiantes || this.cargandoAsignaciones || this.errorCarga) return;
    const assignmentId = this.asignacionSeleccionada;
    const userId = this.currentUser?.uid;
    if (!assignmentId || !userId || !this.asignaciones.some(item => item.id === assignmentId) || !this.estudiantes.length) {
      await this.presentToast('No hay lista de asistencia para guardar.', 'warning');
      return;
    }
    if (this.dia !== attendanceDay()) {
      await this.presentToast('La fecha cambió. Vuelve a cargar la lista antes de guardar.', 'warning');
      await this.cargarEstudiantes();
      return;
    }
    if (this.estudiantes.some(student => !student.estadoAsistencia)) {
      await this.presentToast('Selecciona un estado para todos los estudiantes.', 'warning');
      return;
    }
    this.guardando = true;
    const students = this.estudiantes.map(student => ({ ...student }));
    try {
      const decision = await this.access.authorize({ roles: ['administrador', 'profesor'], classAccess: 'manage' }, assignmentId);
      if (this.destroyed || userId !== this.currentUser?.uid) return;
      if (decision !== 'allowed') {
        await this.presentToast('Ya no tienes permiso para modificar esta clase.', 'warning');
        return;
      }
      await this.attendance.saveDaily(assignmentId, this.dia, students);
      if (!this.destroyed && userId === this.currentUser?.uid) {
        await this.presentToast('Asistencia guardada con éxito.', 'success');
      }
    } catch (error) {
      if (!this.destroyed && userId === this.currentUser?.uid) {
        console.error('Error guardando asistencia:', error);
        await this.presentToast('No se completó el guardado. Puedes volver a intentarlo.', 'danger');
      }
    } finally {
      this.guardando = false;
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }
}
