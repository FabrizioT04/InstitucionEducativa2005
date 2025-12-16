import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NavController,
  AlertController,
  IonContent,
  IonButton,
  IonIcon,
  IonDatetime,
  IonFab,
  IonFabButton,
  IonSpinner
} from '@ionic/angular/standalone';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc, collection, query, orderBy, onSnapshot, deleteDoc, Timestamp } from '@angular/fire/firestore';
import { addIcons } from 'ionicons';
import { peopleCircleOutline, schoolOutline, libraryOutline, addCircleOutline, calendarOutline, createOutline, trashOutline, add, chevronBackOutline, chevronForwardOutline, people, school, book, chevronForward } from 'ionicons/icons';

@Component({
  selector: 'app-tab1',
  templateUrl: './tab1.page.html',
  styleUrls: ['tab1.page.css'],
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonIcon,
    IonDatetime,
    IonFab,
    IonFabButton,
    IonSpinner,
    CommonModule,
    FormsModule
  ],
})
export class Tab1Page implements OnInit {
  public userRole: string | null = null;
  public comunicados: any[] = [];
  public eventosDelDia: any[] = [];
  public todosLosEventos: any[] = [];
  public fechaSeleccionada: string = new Date().toISOString();

  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private navCtrl = inject(NavController);
  private alertCtrl = inject(AlertController);

  constructor() {
    addIcons({ peopleCircleOutline, schoolOutline, libraryOutline, addCircleOutline, calendarOutline, createOutline, trashOutline, add, chevronBackOutline, chevronForwardOutline, people, school, book, chevronForward });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.loadUserData(user.uid);
        this.loadComunicados();
        this.loadEventos();
      }
    });
  }

  async loadUserData(uid: string) {
    const userDocRef = doc(this.firestore, `usuarios/${uid}`);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const userData = docSnap.data();
      this.userRole = userData['rol'] ? userData['rol'].toLowerCase() : null;
    }
  }

  loadComunicados() {
    const q = query(collection(this.firestore, 'comunicados'), orderBy('fecha', 'desc'));
    onSnapshot(q, (snapshot) => {
      this.comunicados = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, fecha: (data['fecha'] as Timestamp).toDate() };
      });
    });
  }

  loadEventos() {
    const q = query(collection(this.firestore, 'eventos'), orderBy('fechaInicio', 'asc'));
    onSnapshot(q, (snapshot) => {
      this.todosLosEventos = snapshot.docs.map(doc => {
        const data = doc.data();
        // Verificamos que 'fechaInicio' exista y sea un objeto Timestamp de Firebase
        const fechaInicio = (data['fechaInicio'] instanceof Timestamp) ? data['fechaInicio'].toDate() : new Date();
        return { id: doc.id, ...data, fechaInicio: fechaInicio };
      });
      this.filtrarEventosPorFecha(this.fechaSeleccionada);
    });
  }

  onDateChange(event: any) {
    this.fechaSeleccionada = event.detail.value;
    this.filtrarEventosPorFecha(this.fechaSeleccionada);
  }

  private filtrarEventosPorFecha(fechaISO: string) {
    const fecha = new Date(fechaISO);
    const inicioDelDia = new Date(fecha.setHours(0, 0, 0, 0));
    const finDelDia = new Date(fecha.setHours(23, 59, 59, 999));

    this.eventosDelDia = this.todosLosEventos.filter(e => e.fechaInicio >= inicioDelDia && e.fechaInicio <= finDelDia);
  }

  get icons() {
    return { peopleCircleOutline, schoolOutline, libraryOutline, addCircleOutline, calendarOutline, createOutline, trashOutline, add, chevronBackOutline, chevronForwardOutline, people, school, book, chevronForward };
  }

  // --- FUNCIÓN DE NAVEGACIÓN CORREGIDA ---
  goTo(path: string) {
    this.navCtrl.navigateForward(path);
  }

  goToCreateEvent() {
    this.navCtrl.navigateForward('/create-event');
  }

  goToCreateComunicado() {
    this.navCtrl.navigateForward('/create-comunicado');
  }

  editComunicado(comunicadoId: string, event: Event) {
    event.stopPropagation();
    this.navCtrl.navigateForward(`/edit-comunicado/${comunicadoId}`);
  }

  async deleteComunicado(comunicadoId: string, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: '¿Estás seguro de que quieres eliminar este comunicado?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: async () => {
            await deleteDoc(doc(this.firestore, 'comunicados', comunicadoId));
          }
        }
      ]
    });
    await alert.present();
  }
}




