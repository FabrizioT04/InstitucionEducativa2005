import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, AlertController, ToastController } from '@ionic/angular';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Firestore, collection, doc, getDoc, collectionData, deleteDoc } from '@angular/fire/firestore';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
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
export class Tab2Page implements OnInit {
  public userRole: string | null = null;
  public asignaciones$: Observable<AsignacionCompleta[]> = of([]);
  private currentUser: User | null = null;

  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private navCtrl = inject(NavController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  constructor() {
    addIcons({ book, timeOutline, createOutline, trashOutline, add, school, chevronForward, people });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.loadUserRole(user.uid);
        this.loadAsignaciones();
      }
    });
  }

  get icons() {
    return { book, timeOutline, createOutline, trashOutline, add, school, chevronForward, people };
  }

  async loadUserRole(uid: string) {
    const userDocRef = doc(this.firestore, `usuarios/${uid}`);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const userData = docSnap.data();
      this.userRole = userData['rol'] ? userData['rol'].toLowerCase() : null;
    }
  }

  loadAsignaciones() {
    const asignacionesCollection = collection(this.firestore, 'asignaciones');
    this.asignaciones$ = (collectionData(asignacionesCollection, { idField: 'id' }) as Observable<any[]>).pipe(
      switchMap(asignaciones => {
        if (asignaciones.length === 0) return of([]);
        const asignacionesCompletasObservables = asignaciones.map(asignacion => {
          const cursoRef = doc(this.firestore, 'cursos', asignacion.cursoId);
          const gradoRef = doc(this.firestore, 'grados', asignacion.gradoId);
          const profesorRef = doc(this.firestore, 'usuarios', asignacion.profesorId);

          return combineLatest([getDoc(cursoRef), getDoc(gradoRef), getDoc(profesorRef)]).pipe(
            map(([cursoSnap, gradoSnap, profesorSnap]) => ({
              id: asignacion.id,
              nombreCurso: cursoSnap.exists() ? cursoSnap.data()['nombre'] : '...',
              nombreGrado: gradoSnap.exists() ? `${gradoSnap.data()['nombre']} - ${gradoSnap.data()['seccion']}` : '...',
              nombreProfesor: profesorSnap.exists() ? profesorSnap.data()['nombreCompleto'] : '...'
            }))
          );
        });
        return combineLatest(asignacionesCompletasObservables);
      })
    );
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
              await deleteDoc(doc(this.firestore, 'asignaciones', asignacion.id));
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

