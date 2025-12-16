import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { Firestore, collection, collectionData, addDoc, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// --- IMPORTACIÓN DE ICONOS ---
import { add, pencil, trash } from 'ionicons/icons';

// Interfaz para el tipo de dato Grado
interface Grade {
  id: string;
  nombre: string;
  seccion: string;
}

@Component({
  selector: 'app-grade-management',
  templateUrl: './grade-management.page.html',
  styleUrls: ['./grade-management.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class GradeManagementPage {
  public grados$: Observable<Grade[]>;
  public icons: { [key: string]: string };

  private firestore = inject(Firestore);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);

  constructor() {
    const gradosCollection = collection(this.firestore, 'grados');
    this.grados$ = collectionData(gradosCollection, { idField: 'id' }) as Observable<Grade[]>;

    // Hacemos los iconos accesibles en la plantilla
    this.icons = { add, pencil, trash };
  }

  // --- FUNCIÓN PARA AÑADIR UN NUEVO GRADO ---
  async addNewGrade() {
    const alert = await this.alertController.create({
      header: 'Añadir Nuevo Grado',
      inputs: [
        { name: 'nombre', type: 'text', placeholder: 'Ej: Primer Grado' },
        { name: 'seccion', type: 'text', placeholder: 'Ej: A' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (data.nombre && data.seccion) {
              const gradosCollection = collection(this.firestore, 'grados');
              await addDoc(gradosCollection, { nombre: data.nombre, seccion: data.seccion });
              this.presentToast('Grado añadido con éxito', 'success');
              return true; 
            } else {
              this.presentToast('Ambos campos son requeridos', 'danger');
              return false; 
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // --- FUNCIÓN PARA EDITAR UN GRADO EXISTENTE ---
  async editGrade(grade: Grade) {
    const alert = await this.alertController.create({
      header: 'Editar Grado',
      inputs: [
        { name: 'nombre', type: 'text', value: grade.nombre, placeholder: 'Ej: Primer Grado' },
        { name: 'seccion', type: 'text', value: grade.seccion, placeholder: 'Ej: A' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Actualizar',
          handler: async (data) => {
            if (data.nombre && data.seccion) {
              const gradeDocRef = doc(this.firestore, `grados/${grade.id}`);
              await updateDoc(gradeDocRef, { nombre: data.nombre, seccion: data.seccion });
              this.presentToast('Grado actualizado con éxito', 'success');
              return true; 
            } else {
              this.presentToast('Ambos campos son requeridos', 'danger');
              return false;
            }
          },
        },
      ],
    });
    await alert.present();
  }


  // --- FUNCIÓN PARA ELIMINAR UN GRADO ---
  async deleteGrade(gradeId: string) {
    const alert = await this.alertController.create({
      header: 'Confirmar Eliminación',
      message: '¿Estás seguro de que quieres eliminar este grado?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: async () => {
            await deleteDoc(doc(this.firestore, `grados/${gradeId}`));
            this.presentToast('Grado eliminado con éxito', 'success');
          },
        },
      ],
    });
    await alert.present();
  }

  // --- Helper para mostrar notificaciones ---
  async presentToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
    });
    toast.present();
  }
}
