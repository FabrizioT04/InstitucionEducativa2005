import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController, ActionSheetController } from '@ionic/angular';
import { Auth, signOut, updateProfile, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadString, getDownloadURL } from '@angular/fire/storage';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ProfilePage implements OnInit {

  public usuario: any = null;
  public cargando = true;
  private currentUser: User | null = null;

  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.auth.onAuthStateChanged(user => {
      if (user) {
        this.currentUser = user;
        this.cargarDatosUsuario();
      } else {
        this.navController.navigateRoot('/login');
      }
    });
  }

  async cargarDatosUsuario() {
    this.cargando = true;
    if (!this.currentUser) return;

    const userDocRef = doc(this.firestore, `usuarios/${this.currentUser.uid}`);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      this.usuario = userDocSnap.data();
      // Aseguramos que la URL de la foto esté sincronizada con Auth
      this.usuario.photoURL = this.currentUser.photoURL; 
    }
    this.cargando = false;
    this.cdr.detectChanges();
  }

  async cambiarFotoPerfil() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos, // O CameraSource.Camera para usar la cámara
      });

      if (image && image.dataUrl && this.currentUser) {
        this.cargando = true;
        const filePath = `profile_pictures/${this.currentUser.uid}`;
        const storageRef = ref(this.storage, filePath);
        
        await uploadString(storageRef, image.dataUrl, 'data_url');
        const photoURL = await getDownloadURL(storageRef);

        // Actualizar en Firebase Authentication
        await updateProfile(this.currentUser, { photoURL });

        // Actualizar en Firestore
        const userDocRef = doc(this.firestore, `usuarios/${this.currentUser.uid}`);
        await updateDoc(userDocRef, { photoURL });

        this.presentToast('Foto de perfil actualizada con éxito', 'success');
        this.cargarDatosUsuario(); // Recargar datos para mostrar nueva foto
      }
    } catch (error) {
      console.error('Error al cambiar la foto de perfil:', error);
      this.presentToast('Error al subir la imagen', 'danger');
      this.cargando = false;
    }
  }

  async cerrarSesion() {
    await signOut(this.auth);
    this.navController.navigateRoot('/login');
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
    });
    toast.present();
  }
}
