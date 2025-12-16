import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { Firestore, collection, collectionData, doc, addDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { createOutline, trashOutline, add } from 'ionicons/icons';

// Interfaz para el objeto Curso
export interface Curso {
  id: string;
  nombre: string;
  area: string;
}

@Component({
  selector: 'app-manage-courses',
  templateUrl: './manage-courses.page.html',
  styleUrls: ['./manage-courses.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ManageCoursesPage implements OnInit {
  public cursos$: Observable<Curso[]> = of([]);

  private firestore = inject(Firestore);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  constructor() {}

  ngOnInit() {
    this.loadCourses();
  }

  get icons() {
    return { createOutline, trashOutline, add };
  }

  loadCourses() {
    const coursesCollection = collection(this.firestore, 'cursos');
    this.cursos$ = collectionData(coursesCollection, { idField: 'id' }) as Observable<Curso[]>;
  }

  async addNewCourse() {
    const alert = await this.alertCtrl.create({
      header: 'Añadir Nuevo Curso',
      inputs: [
        { name: 'nombre', type: 'text', placeholder: 'Nombre del curso (ej. Matemáticas)' },
        { name: 'area', type: 'text', placeholder: 'Área académica (ej. Ciencias)' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (!data.nombre || !data.area) {
              this.presentToast('Ambos campos son requeridos.', 'warning');
              return false;
            }
            try {
              await addDoc(collection(this.firestore, 'cursos'), { nombre: data.nombre, area: data.area });
              this.presentToast('Curso añadido con éxito', 'success');
              return true;
            } catch (error) {
              this.presentToast('Error al añadir el curso', 'danger');
              console.error(error);
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async editCourse(curso: Curso) {
    const alert = await this.alertCtrl.create({
      header: 'Editar Curso',
      inputs: [
        { name: 'nombre', type: 'text', value: curso.nombre, placeholder: 'Nombre del curso' },
        { name: 'area', type: 'text', value: curso.area, placeholder: 'Área académica' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Actualizar',
          handler: async (data) => {
            if (!data.nombre || !data.area) {
              this.presentToast('Ambos campos son requeridos.', 'warning');
              return false;
            }
            try {
              const courseRef = doc(this.firestore, 'cursos', curso.id);
              await updateDoc(courseRef, { nombre: data.nombre, area: data.area });
              this.presentToast('Curso actualizado con éxito', 'success');
              return true;
            } catch (error) {
              this.presentToast('Error al actualizar el curso', 'danger');
              console.error(error);
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteCourse(curso: Curso) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de que quieres eliminar el curso "${curso.nombre}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: async () => {
            try {
              await deleteDoc(doc(this.firestore, 'cursos', curso.id));
              this.presentToast('Curso eliminado con éxito', 'success');
            } catch (error) {
              this.presentToast('Error al eliminar el curso', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    toast.present();
  }
}

