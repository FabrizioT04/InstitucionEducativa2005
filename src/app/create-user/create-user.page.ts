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
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSpinner
} from '@ionic/angular/standalone';
import { Auth, createUserWithEmailAndPassword, sendEmailVerification, signOut } from '@angular/fire/auth';
import { Firestore, collection, collectionData, doc, setDoc, query, where, getDocs, writeBatch } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// --- Interfaces ---
interface UserData {
  nombreCompleto: string;
  email: string;
  rol: 'estudiante' | 'profesor' | 'administrador';
  photoURL: string;
  gradoId?: string;
}

interface Grade {
  id: string;
  nombre: string;
  seccion: string;
}

@Component({
  selector: 'app-create-user',
  templateUrl: './create-user.page.html',
  styleUrls: ['./create-user.page.css'],
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
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
    CommonModule,
    FormsModule
  ]
})
export class CreateUserPage implements OnInit {

  // --- Propiedades ---
  usuario: {
    nombreCompleto: string;
    email: string;
    password: string;
    rol: 'estudiante' | 'profesor' | 'administrador' | undefined | string;
    photoURL: string;
    gradoId: string | null;
  } = {
      nombreCompleto: '',
      email: '',
      password: '',
      rol: undefined, // Inicia como undefined
      photoURL: '',
      gradoId: null
    };

  guardando = false;
  public grados$: Observable<Grade[]>;

  // --- Inyección de Dependencias ---
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private navCtrl = inject(NavController);
  private toastCtrl = inject(ToastController);


  constructor() {
    // Cargar grados para el <ion-select>
    const gradosCollection = collection(this.firestore, 'grados');
    this.grados$ = collectionData(gradosCollection, { idField: 'id' }) as Observable<Grade[]>;
  }

  ngOnInit() {
  }

  // --- Función Principal: Crear Usuario ---
  async crearUsuario() {
    // Validaciones
    if (!this.usuario.nombreCompleto || !this.usuario.email || !this.usuario.password || !this.usuario.rol) {
      this.presentToast('Por favor, complete todos los campos requeridos.', 'warning');
      return;
    }
    if (this.usuario.rol === 'estudiante' && !this.usuario.gradoId) {
      this.presentToast('Por favor, seleccione un grado para el estudiante.', 'warning');
      return;
    }

    this.guardando = true;

    try {
      // 1. Crear usuario en Auth
      const userCredential = await createUserWithEmailAndPassword(this.auth, this.usuario.email, this.usuario.password);
      const user = userCredential.user;

      // 2. Enviar email de verificación
      await sendEmailVerification(user);

      // 3. Preparar datos para Firestore
      const userData: UserData = {
        nombreCompleto: this.usuario.nombreCompleto,
        email: this.usuario.email,
        rol: this.usuario.rol as 'estudiante' | 'profesor' | 'administrador',
        photoURL: '', // Opcional
      };

      if (userData.rol === 'estudiante') {
        userData.gradoId = this.usuario.gradoId || undefined;
      }

      // 4. Guardar datos en Firestore
      const userDocRef = doc(this.firestore, `usuarios/${user.uid}`);
      await setDoc(userDocRef, userData);

      // 5. Inscribir automáticamente (si es estudiante)
      if (userData.rol === 'estudiante' && userData.gradoId) {
        // Pasa el ID del usuario, el nuevo gradoId, y 'null' como grado antiguo
        await this.inscribirAutomaticamenteEnCursos(user.uid, userData.gradoId || null, null);
      }

      // 6. Éxito, cerrar sesión y redirigir a login
      this.presentToast('Usuario creado. Revisa tu correo para verificar la cuenta.', 'success');
      await signOut(this.auth); // Forzar cierre de sesión
      this.navCtrl.navigateRoot('/login');

    } catch (error: any) {
      // Manejo de errores
      const errorMessage = this.firebaseErrorToText(error.code);
      this.presentToast(errorMessage, 'danger');
    } finally {
      this.guardando = false;
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
    const toast = await this.toastCtrl.create({ message, duration: 3000, color });
    toast.present();
  }

  private firebaseErrorToText(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'El correo electrónico ya está en uso.';
      case 'auth/invalid-email':
        return 'El correo electrónico no es válido.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      default:
        return 'Ocurrió un error inesperado.';
    }
  }
}

