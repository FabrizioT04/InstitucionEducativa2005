import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NavController,
  ToastController,
  IonContent,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonInput,
  IonButton
} from '@ionic/angular/standalone';
// Importamos las herramientas de Auth y Firestore
import { Auth, createUserWithEmailAndPassword, sendEmailVerification } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.css'],
  standalone: true,
  imports: [
    IonContent,
    IonButtons,
    IonBackButton,
    IonList,
    IonItem,
    IonInput,
    IonButton,
    CommonModule,
    FormsModule
  ]
})
export class RegisterPage {
  // Variables para enlazar con los campos del formulario
  nombreCompleto = '';
  email = '';
  password = '';
  confirmPassword = '';

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private navController: NavController = inject(NavController);
  private toastController: ToastController = inject(ToastController);

  constructor() { }

  async register() {
    // Validaciones
    if (!this.nombreCompleto || !this.email || !this.password) {
      this.presentToast('Por favor, completa todos los campos.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.presentToast('Las contraseñas no coinciden.');
      return;
    }

    try {
      // 1. Creamos el usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(this.auth, this.email, this.password);
      const user = userCredential.user;

      // 2. Creamos su perfil en la base de datos Firestore
      const userDocRef = doc(this.firestore, `usuarios/${user.uid}`);
      await setDoc(userDocRef, {
        nombreCompleto: this.nombreCompleto,
        email: this.email,
        rol: 'estudiante' // Asignamos el rol por defecto
      });

      // 3. Enviamos el correo de verificación
      await sendEmailVerification(user);
      this.presentToast('¡Registro exitoso! Revisa tu correo para verificar tu cuenta.', 'success');
      this.navController.navigateRoot('/login');

    } catch (error: any) {
      let message = 'Ocurrió un error al registrarse.';
      if (error.code === 'auth/email-already-in-use') {
        message = 'El correo electrónico ya está en uso.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'El correo electrónico no es válido.';
      } else if (error.code === 'auth/weak-password') {
        message = 'La contraseña debe tener al menos 6 caracteres.';
      }
      this.presentToast(message);
    }
  }

  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 4000,
      position: 'bottom',
      color: color
    });
    toast.present();
  }
}

