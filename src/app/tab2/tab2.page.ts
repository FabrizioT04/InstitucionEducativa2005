import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, AlertController, ToastController } from '@ionic/angular';
import { Firestore } from '@angular/fire/firestore';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { Observable, of } from 'rxjs';
import { AccessService } from '../core/auth/access.service';
import { AccessRepository } from '../core/auth/access.repository';
import { SessionService } from '../core/auth/session.service';
import { UserRole } from '../core/auth/access.models';
import { addIcons } from 'ionicons';
import { book, timeOutline, createOutline, trashOutline, add, school, chevronForward, people } from 'ionicons/icons';

export interface AsignacionCompleta {
  id: string;
  nombreCurso: string;
  nombreGrado: string;
  nombreProfesor: string;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class Tab2Page implements OnDestroy {
  public userRole: UserRole | null = null;
  public asignaciones$: Observable<AsignacionCompleta[]> = of([]);
  public cargando = false;
  public errorCarga = false;
  private loadVersion = 0;

  private firestore = inject(Firestore);
  private access = inject(AccessService);
  private repository = inject(AccessRepository);
  private session = inject(SessionService);
  private navCtrl = inject(NavController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  constructor() {
    addIcons({ book, timeOutline, createOutline, trashOutline, add, school, chevronForward, people });
  }

  ionViewWillEnter() {
    return this.loadAsignaciones();
  }

  ionViewWillLeave() {
    this.loadVersion++;
    this.userRole = null;
    this.asignaciones$ = of([]);
  }

  ngOnDestroy() {
    this.ionViewWillLeave();
  }

  get icons() {
    return { book, timeOutline, createOutline, trashOutline, add, school, chevronForward, people };
  }

  async loadAsignaciones() {
    const version = ++this.loadVersion;
    this.cargando = true;
    this.errorCarga = false;
    this.userRole = null;
    this.asignaciones$ = of([]);
    try {
      const user = await this.access.getCurrentUser();
      if (version !== this.loadVersion) return;
      if (!user) {
        this.errorCarga = true;
        return;
      }
      const assignments = await this.repository.listAssignments(user);
      // Reuse lookups for classes sharing a course, grade, or professor.
      const references = new Map<string, Promise<Record<string, unknown> | null>>();
      const readReference = (collectionName: string, id?: string) => {
        if (!id) return Promise.resolve(null);
        const path = `${collectionName}/${id}`;
        if (!references.has(path)) {
          references.set(path, getDoc(doc(this.firestore, path))
            .then(snapshot => snapshot.exists() ? snapshot.data() : null));
        }
        return references.get(path)!;
      };
      const classes = await Promise.all(assignments.map(async assignment => {
        const [course, grade, professor] = await Promise.all([
          readReference('cursos', assignment.cursoId),
          readReference('grados', assignment.gradoId),
          readReference('usuarios', assignment.profesorId),
        ]);
        return {
          id: assignment.id,
          nombreCurso: String(course?.['nombre'] ?? 'Curso no disponible'),
          nombreGrado: grade ? `${grade['nombre'] ?? ''} - ${grade['seccion'] ?? ''}` : 'Grado no disponible',
          nombreProfesor: String(professor?.['nombreCompleto'] ?? 'Profesor no disponible'),
        };
      }));
      if (version !== this.loadVersion) return;
      if (!this.session.isCurrentUser(user.uid)) {
        this.errorCarga = true;
        return;
      }
      this.userRole = user.role;
      this.asignaciones$ = of(classes);
    } catch {
      if (version === this.loadVersion) this.errorCarga = true;
    } finally {
      if (version === this.loadVersion) this.cargando = false;
    }
  }

  // --- FUNCIONES DE GESTIÓN ---

  goToCreateAssignment() {
    this.navCtrl.navigateForward('/manage-assignments');
  }

  goToEditAssignment(asignacionId: string, event: Event) {
    event.stopPropagation();
    this.navCtrl.navigateForward(`/manage-assignments/${asignacionId}`);
  }

  async deleteAssignment(asignacion: AsignacionCompleta, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de que quieres eliminar la clase de ${asignacion.nombreCurso} (${asignacion.nombreGrado})?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: async () => {
            try {
              if (await this.access.authorize({ roles: ['administrador'], classAccess: 'manage' }, asignacion.id) !== 'allowed') {
                await this.presentToast('No tienes permiso para eliminar esta clase.', 'danger');
                return;
              }
              await deleteDoc(doc(this.firestore, 'asignaciones', asignacion.id));
              await this.loadAsignaciones();
              this.presentToast('Clase eliminada con éxito', 'success');
            } catch (error) {
              this.presentToast('Error al eliminar la clase', 'danger');
              console.error(error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async presentToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    toast.present();
  }

  // --- FUNCIONES DE NAVEGACIÓN ---

  goToCourseDetail(asignacionId: string) {
    this.navCtrl.navigateForward(`/course-detail/${asignacionId}`);
  }

  goToManageSchedule(asignacionId: string, event: Event) {
    event.stopPropagation();
    this.navCtrl.navigateForward(`/manage-schedule/${asignacionId}`);
  }
}

