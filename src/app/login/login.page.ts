import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NavController,
  LoadingController,
  ToastController,
  AlertController, // 1. Importar AlertController
  IonContent,
  IonButton,
  IonIcon
} from '@ionic/angular/standalone';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail, // 2. Importar sendPasswordResetEmail
} from '@angular/fire/auth';
import { addIcons } from 'ionicons';
import { mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline, layers } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.css'],
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, CommonModule, FormsModule],
})
export class LoginPage {
  public credentials = {
    email: '',
    password: '',
  };
  public showPassword = false;

  private auth = inject(Auth);
  private navCtrl = inject(NavController);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  constructor() {
    addIcons({ mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline, layers });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async login() {
    // DEBUG: Alert para verificar si el botón responde en Android
    // window.alert('Login presionado'); 

    if (!this.credentials.email || !this.credentials.password) {
      this.presentToast(
        'Por favor, ingresa tu correo y contraseña.',
        'warning'
      );
      return;
    }

    let loading;
    try {
      loading = await this.loadingCtrl.create({
        message: 'Iniciando sesión...',
      });
      await loading.present();
    } catch (err: any) {
      // Si falla la creación del loading, lo mostramos
      window.alert('Error creando loading: ' + JSON.stringify(err));
      console.error(err);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        this.auth,
        this.credentials.email,
        this.credentials.password
      );

      if (userCredential.user.emailVerified) {
        this.navCtrl.navigateRoot('/tabs/tab1', { animated: true });
      } else {
        await signOut(this.auth);
        this.presentToast(
          'Tu cuenta aún no ha sido verificada. Por favor, revisa tu correo.',
          'warning'
        );
      }
    } catch (error: any) {
      console.error('Error de inicio de sesión:', error);
      this.presentToast('Correo o contraseña incorrectos.', 'danger');
    } finally {
      loading.dismiss();
    }
  }

  // --- ¡¡NUEVA FUNCIÓN!! ---
  async forgotPassword() {
    const alert = await this.alertCtrl.create({
      header: 'Recuperar Contraseña',
      message:
        'Ingresa tu correo electrónico para enviarte un enlace de recuperación.',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'tu@correo.com',
          // Pre-rellenamos el campo si el usuario ya escribió su email
          value: this.credentials.email,
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Enviar',
          handler: async (data) => {
            if (data.email) {
              const loading = await this.loadingCtrl.create({
                message: 'Enviando enlace...',
              });
              await loading.present();
              try {
                // 4. Llamar a la función de Firebase
                await sendPasswordResetEmail(this.auth, data.email);
                await loading.dismiss();
                this.presentToast(
                  'Enlace de recuperación enviado. Revisa tu correo (incluida la carpeta de spam).',
                  'success'
                );
                return true; // <-- ¡¡CORRECCIÓN!! Cierra la alerta en éxito.
              } catch (error: any) {
                await loading.dismiss();
                // Mostramos un error genérico para no confirmar si un email existe o no
                this.presentToast(
                  'Si el correo existe, se enviará un enlace de recuperación.',
                  'warning'
                );
                return true; // <-- ¡¡CORRECCIÓN!! Cierra la alerta en error.
              }
            } else {
              this.presentToast('Por favor, ingresa un correo.', 'warning');
              return false; // Evita que la alerta se cierre
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // --- FUNCIÓN PARA NAVEGAR AL REGISTRO ---
  goToRegister() {
    this.navCtrl.navigateForward('/register');
  }

  // --- Función Utilitaria (Modificada) ---
  // 5. Añadimos 'success' a los colores permitidos
  async presentToast(
    message: string,
    color: 'warning' | 'danger' | 'success'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000, // Un poco más de tiempo para el mensaje de éxito
      color,
    });
    await toast.present();
  }
}
