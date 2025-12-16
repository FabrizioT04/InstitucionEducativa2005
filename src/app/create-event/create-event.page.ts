import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { Firestore, collection, addDoc, Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-create-event',
  templateUrl: './create-event.page.html',
  styleUrls: ['./create-event.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class CreateEventPage implements OnInit {
  evento = {
    titulo: '',
    descripcion: '',
    fechaInicio: new Date().toISOString(),
    fechaFin: new Date().toISOString()
  };
  guardando = false;

  constructor(
    private firestore: Firestore,
    private navController: NavController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
  }

  async guardarEvento() {
    if (!this.evento.titulo || !this.evento.fechaInicio || !this.evento.fechaFin) {
      this.presentToast('Por favor, complete al menos el título y las fechas.', 'warning');
      return;
    }

    this.guardando = true;
    try {
      const eventosCollection = collection(this.firestore, 'eventos');
      await addDoc(eventosCollection, {
        titulo: this.evento.titulo,
        descripcion: this.evento.descripcion,
        fechaInicio: Timestamp.fromDate(new Date(this.evento.fechaInicio)),
        fechaFin: Timestamp.fromDate(new Date(this.evento.fechaFin)),
      });
      this.presentToast('Evento creado con éxito.', 'success');
      this.navController.back();
    } catch (error) {
      console.error('Error al crear el evento:', error);
      this.presentToast('Ocurrió un error al crear el evento.', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({ message, duration: 3000, color });
    toast.present();
  }
}
