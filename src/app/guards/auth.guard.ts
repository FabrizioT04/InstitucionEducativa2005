import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { ToastController } from '@ionic/angular';

/**
 * Guardia de autenticación para proteger las rutas.
 * Esta función se ejecuta ANTES de cargar la página.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const toastCtrl = inject(ToastController); // 1. Inyectamos ToastController

  // Creamos una Promesa que se resuelve con el estado de autenticación
  return new Promise((resolve) => {
    // onAuthStateChanged devuelve una función para desuscribirse
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Nos desuscribimos de inmediato. Solo necesitamos saber el estado una vez.
      unsubscribe();

      if (user) {
        // --- ¡¡INICIO DE LA LÓGICA DE VERIFICACIÓN!! ---

        if (user.emailVerified) {
          // 1. Hay un usuario logueado Y VERIFICADO. Permitir el acceso.
          resolve(true);
        } else {
          // 2. Hay un usuario logueado PERO NO VERIFICADO. Rechazar.
          console.log('AuthGuard: Acceso denegado. Email no verificado.');
          // Mostramos un aviso al usuario
          presentVerificationToast(toastCtrl);
          // Redirigir al login y bloquear la ruta.
          router.navigate(['/login']);
          resolve(false);
        }
        // --- FIN DE LA LÓGICA DE VERIFICACIÓN!! ---

      } else {
        // 3. No hay usuario. Redirigir al login y bloquear la ruta.
        console.log('AuthGuard: Acceso denegado. No hay usuario.');
        router.navigate(['/login']); // Usamos router.navigate
        resolve(false);
      }
    });
  });
};

// Función helper para mostrar el Toast (debe estar fuera del guard)
async function presentVerificationToast(toastCtrl: ToastController) {
  const toast = await toastCtrl.create({
    message: 'Acceso denegado. Debes verificar tu correo electrónico primero.',
    duration: 3000,
    color: 'warning'
  });
  toast.present();
}