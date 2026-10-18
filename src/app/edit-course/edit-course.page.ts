import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-edit-course',
  templateUrl: './edit-course.page.html',
  styleUrls: ['./edit-course.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class EditCoursePage implements OnInit {
  curso = {
    nombre: '',
    area: ''
  };
  courseId: string | null = null;
  cargando = true;
  guardando = false;

  private readonly route = inject(ActivatedRoute);
  private readonly firestore = inject(Firestore);
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

  ngOnInit() {
    this.courseId = this.route.snapshot.paramMap.get('id');
    if (this.courseId) {
      this.loadCourseData();
    }
  }

  async loadCourseData() {
    this.cargando = true;
    try {
      const courseDocRef = doc(this.firestore, 'cursos', this.courseId!);
      const docSnap = await getDoc(courseDocRef);
      if (docSnap.exists()) {
        this.curso = docSnap.data() as any;
      } else {
        this.presentToast('El curso no fue encontrado.', 'danger');
        this.navController.back();
      }
    } catch (error) {
      console.error("Error cargando datos del curso:", error);
    } finally {
      this.cargando = false;
    }
  }

  async guardarCambios() {
    if (!this.curso.nombre || !this.curso.area) {
      this.presentToast('Por favor, complete todos los campos.', 'warning');
      return;
    }
    this.guardando = true;
    try {
      const courseDocRef = doc(this.firestore, 'cursos', this.courseId!);
      await updateDoc(courseDocRef, { ...this.curso });
      this.presentToast('Curso actualizado con éxito.', 'success');
      this.navController.back();
    } catch (error) {
      console.error('Error al actualizar el curso:', error);
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

