import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NavController,
  ToastController,
  LoadingController,
  IonContent,
  IonButtons,
  IonBackButton,
  IonList,
  IonListHeader,
  IonLabel,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSpinner,
  IonInput
} from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc, collection, collectionData, query, where, getDocs, writeBatch } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';

// --- Interfaces ---
interface Grade {
  id: string;
  nombre: string;
  seccion: string;
}

@Component({
  selector: 'app-edit-user',
  templateUrl: './edit-user.page.html',
  styleUrls: ['./edit-user.page.css'],
  standalone: true,
  imports: [
    IonContent,
    IonButtons,
    IonBackButton,
    IonList,
    IonListHeader,
    IonLabel,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
    IonInput, // Added explicitly in case it's used or needed
    CommonModule,
    FormsModule
  ]
})
export class EditUserPage implements OnInit {

  // --- Propiedades ---
  userId: string | null = null;
  public user: any = {
    nombreCompleto: '',
    email: '',
    rol: 'estudiante',
    gradoId: null,
  };
  private originalGradeId: string | null = null; // Guardar el grado original

  public grados$: Observable<Grade[]> = of([]);
  public isLoading = true;

  // --- Inyección de Dependencias ---
  private firestore: Firestore = inject(Firestore);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private navCtrl: NavController = inject(NavController);
  private toastCtrl: ToastController = inject(ToastController);
  private loadingCtrl: LoadingController = inject(LoadingController);

  constructor() { }

  ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get('id');
    if (this.userId) {
      this.loadUserData(this.userId);
    }
    this.loadGrados();
  }

  // Cargar lista de grados para el <ion-select>
  loadGrados() {
    const gradosCollection = collection(this.firestore, 'grados');
    this.grados$ = collectionData(gradosCollection, { idField: 'id' }) as Observable<Grade[]>;
  }

  // Cargar datos del usuario a editar
  async loadUserData(id: string) {
    this.isLoading = true;
    const userDocRef = doc(this.firestore, `usuarios/${id}`);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      this.user = docSnap.data();
      // Asegurar que gradoId no sea 'undefined'
      if (this.user.gradoId === undefined) {
        this.user.gradoId = null;
      }
      // Guardar el grado original para comparar al guardar
      this.originalGradeId = this.user.gradoId;
    } else {
      this.presentToast('No se pudo encontrar al usuario.', 'danger');
      this.navCtrl.back();
    }
    this.isLoading = false;
  }

  // --- Función Principal: Guardar Cambios ---
  async saveUser() {
    if (!this.userId) return;

    const loading = await this.loadingCtrl.create({ message: 'Guardando cambios...' });
    await loading.present();

    try {
      // 1. Preparar datos a actualizar en Firestore
      const userDocRef = doc(this.firestore, `usuarios/${this.userId}`);
      const dataToUpdate: any = {
        rol: this.user.rol,
      };

      // Asignar o quitar gradoId según el rol
      if (this.user.rol === 'estudiante') {
        dataToUpdate.gradoId = this.user.gradoId || null;
      } else {
        dataToUpdate.gradoId = null; // Quitar grado si no es estudiante
      }

      // 2. Actualizar el documento del usuario
      await updateDoc(userDocRef, dataToUpdate);

      // 3. Llamar a la lógica de inscripción automática
      //    Pasamos el ID, el nuevo grado, y el grado original
      await this.inscribirAutomaticamenteEnCursos(
        this.userId,
        dataToUpdate.gradoId, // El nuevo gradoId
        this.originalGradeId  // El gradoId que tenía antes
      );

      // 4. Éxito y navegación
      this.presentToast('Usuario actualizado con éxito.', 'success');
      this.navCtrl.back();
    } catch (error) {
      this.presentToast('Error al guardar los cambios.', 'danger');
      console.error(error);
    } finally {
      loading.dismiss();
    }
  }

  // --- Función de Inscripción Automática (Corregida) ---
  private async inscribirAutomaticamenteEnCursos(studentId: string, newGradeId: string | null, oldGradeId: string | null) {

    // 1. Evitar duplicados (si no hay cambio)
    if (newGradeId === oldGradeId) {
      console.log('El grado no ha cambiado. No se requieren acciones.');
      return;
    }

    try {
      const batch = writeBatch(this.firestore);
      const enrollmentsRef = collection(this.firestore, 'inscripciones');

      // 2. Borrar inscripciones antiguas (si aplica)
      if (oldGradeId) {
        const qDelete = query(enrollmentsRef,
          where('studentId', '==', studentId),
          where('gradeId', '==', oldGradeId)
        );
        const deleteSnapshot = await getDocs(qDelete);

        deleteSnapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`Eliminadas ${deleteSnapshot.size} inscripciones del grado anterior.`);
      }

      // 3. Añadir nuevas inscripciones (si aplica)
      if (newGradeId) {
        // Buscamos en 'asignaciones' para obtener el 'asignacionId'
        const asignacionesRef = collection(this.firestore, 'asignaciones');
        const qAdd = query(asignacionesRef, where('gradoId', '==', newGradeId));
        const addSnapshot = await getDocs(qAdd);

        if (addSnapshot.empty) {
          console.log('El nuevo grado no tiene asignaciones de cursos. No se añadieron inscripciones.');
        } else {

          addSnapshot.forEach((asigDoc) => {
            const asigData = asigDoc.data();

            // Crear el nuevo documento de inscripción
            const newEnrollment = {
              studentId: studentId,
              gradeId: newGradeId,
              asignacionId: asigDoc.id, // ¡¡La pieza clave!!
              courseId: asigData['cursoId'] || null,
              profesorId: asigData['profesorId'] || null,
              enrollmentDate: new Date()
            };

            const newDocRef = doc(enrollmentsRef); // Auto-genera ID
            batch.set(newDocRef, newEnrollment);
          });
          console.log(`Añadidas ${addSnapshot.size} inscripciones (desde asignaciones) al nuevo grado.`);
        }
      }

      // 4. Ejecutar todas las operaciones
      await batch.commit();
      console.log('Operación de inscripción automática completada.');

    } catch (error) {
      console.error("Error en 'inscribirAutomaticamenteEnCursos': ", error);
      this.presentToast('Error al actualizar las inscripciones del estudiante.', 'danger');
    }
  }

  // --- Funciones Utilitarias ---
  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    toast.present();
  }
}
