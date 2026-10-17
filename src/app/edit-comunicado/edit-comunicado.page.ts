import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NavController,
  ToastController,
  IonContent,
  IonButtons,
  IonBackButton,
  IonList,
  IonListHeader,
  IonLabel,
  IonItem,
  IonInput,
  IonTextarea,
  IonButton,
  IonSpinner
} from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-edit-comunicado',
  templateUrl: './edit-comunicado.page.html',
  styleUrls: ['./edit-comunicado.page.css'],
  standalone: true,
  imports: [
    IonContent,
    IonButtons,
    IonBackButton,
    IonList,
    IonListHeader,
    IonLabel,
    IonItem,
    IonInput,
    IonTextarea,
    IonButton,
    IonSpinner,
    CommonModule,
    FormsModule
  ]
})
export class EditComunicadoPage implements OnInit {
  comunicado: any = {
    titulo: '',
    mensaje: ''
  };
  comunicadoId: string | null = null;
  cargando = true;
  guardando = false;

  private readonly route = inject(ActivatedRoute);
  private readonly firestore = inject(Firestore);
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

  ngOnInit() {
    this.comunicadoId = this.route.snapshot.paramMap.get('id');
    if (this.comunicadoId) {
      this.loadComunicadoData();
    }
  }

  async loadComunicadoData() {
    this.cargando = true;
    try {
      const docRef = doc(this.firestore, 'comunicados', this.comunicadoId!);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        this.comunicado = docSnap.data();
      } else {
        this.presentToast('El comunicado no fue encontrado.', 'danger');
        this.navController.back();
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      this.cargando = false;
    }
  }

  async guardarCambios() {
    if (!this.comunicado.titulo || !this.comunicado.mensaje) {
      this.presentToast('Por favor, complete todos los campos.', 'warning');
      return;
    }
    this.guardando = true;
    try {
      const docRef = doc(this.firestore, 'comunicados', this.comunicadoId!);
      await updateDoc(docRef, {
        titulo: this.comunicado.titulo,
        mensaje: this.comunicado.mensaje
      });
      this.presentToast('Comunicado actualizado con éxito.', 'success');
      this.navController.back();
    } catch (error) {
      console.error('Error al actualizar:', error);
      this.presentToast('Ocurrió un error al guardar los cambios.', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({ message, duration: 3000, color });
    toast.present();
  }
}
