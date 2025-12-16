import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore'; // 1. Importar serverTimestamp

@Component({
  selector: 'app-create-comunicado',
  templateUrl: './create-comunicado.page.html',
  styleUrls: ['./create-comunicado.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class CreateComunicadoPage {
  comunicado = {
    titulo: '',
    mensaje: '' // Cambiado de 'contenido' a 'mensaje' para consistencia
  };
  guardando = false;

  // Se inyectan los servicios en el constructor
  constructor(
    private firestore: Firestore,
    private navController: NavController,
    private toastController: ToastController
  ) { }

  async saveComunicado() {
    if (!this.comunicado.titulo || !this.comunicado.mensaje) {
      this.presentToast('Por favor, completa todos los campos.', 'warning');
      return;
    }

    this.guardando = true;
    try {
      const comunicadosCollection = collection(this.firestore, 'comunicados');
      await addDoc(comunicadosCollection, {
        titulo: this.comunicado.titulo,
        mensaje: this.comunicado.mensaje,
        fecha: serverTimestamp() // 2. Usar la fecha del servidor para consistencia
      });
      this.presentToast('Comunicado publicado con éxito.', 'success');
      this.navController.back(); // Regresa a la página anterior
    } catch (error) {
      console.error('Error al guardar el comunicado:', error);
      this.presentToast('Hubo un error al publicar el comunicado.', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    toast.present();
  }
}
