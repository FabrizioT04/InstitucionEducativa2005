import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ActionSheetController, LoadingController, ToastController } from '@ionic/angular';
import { Auth, signOut, User } from '@angular/fire/auth';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { AccessRepository } from '../core/auth/access.repository';
import { parseUserRole, UserRole } from '../core/auth/access.models';
import { Storage, ref, uploadString, getDownloadURL } from '@angular/fire/storage';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { bookOutline, camera, checkmarkDoneOutline, layersOutline, logOutOutline, peopleOutline, personCircleOutline, ribbonOutline, schoolOutline } from 'ionicons/icons';

interface ProfileLink {
  label: string;
  path: string;
  icon: string;
}

const PROFILE_LINKS: Record<UserRole, readonly ProfileLink[]> = {
  administrador: [
    { label: 'Gestionar usuarios', path: '/user-list', icon: peopleOutline },
    { label: 'Gestionar cursos', path: '/manage-courses', icon: bookOutline },
    { label: 'Gestionar grados', path: '/grade-management', icon: schoolOutline },
    { label: 'Clases y asignaciones', path: '/tabs/tab2', icon: layersOutline },
  ],
  profesor: [
    { label: 'Mis clases', path: '/tabs/tab2', icon: bookOutline },
  ],
  estudiante: [
    { label: 'Mis Calificaciones', path: '/my-grades', icon: ribbonOutline },
    { label: 'Historial de Asistencia', path: '/attendance-history', icon: checkmarkDoneOutline },
  ],
};

// Interfaz para tipar los datos del usuario
interface UserProfile {
  nombreCompleto: string;
  email: string;
  rol: UserRole;
  photoURL?: string;
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, TitleCasePipe],
})
export class Tab3Page implements OnInit, OnDestroy {
  public currentUser: User | null = null;
  public userProfile: UserProfile | null = null;
  public cargando = true;
  readonly icons = { camera, logOutOutline, personCircleOutline };
  private unsubscribeAuth?: () => void;
  private loadVersion = 0;

  // Inyección de dependencias
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private repository = inject(AccessRepository);
  private storage = inject(Storage);
  private navCtrl = inject(NavController);
  private actionSheetCtrl = inject(ActionSheetController);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);

  constructor() {}

  ngOnInit() {
    this.unsubscribeAuth = this.auth.onAuthStateChanged((user) => {
      this.loadVersion++;
      this.userProfile = null;
      if (user) {
        this.currentUser = user;
        this.loadUserProfile(user.uid);
      } else {
        this.currentUser = null;
        this.userProfile = null;
        this.cargando = false;
      }
    });
  }

  ngOnDestroy() {
    this.loadVersion++;
    this.unsubscribeAuth?.();
  }

  get accountLinks(): readonly ProfileLink[] {
    return this.userProfile ? PROFILE_LINKS[this.userProfile.rol] : [];
  }

  async loadUserProfile(uid: string) {
    const version = ++this.loadVersion;
    this.cargando = true;
    this.userProfile = null;
    try {
      const profile = await this.repository.getProfile(uid);
      if (version !== this.loadVersion || this.currentUser?.uid !== uid) return;
      const role = parseUserRole(profile?.['rol']);
      if (profile && role) {
        this.userProfile = {
          nombreCompleto: String(profile['nombreCompleto'] ?? ''),
          email: String(profile['email'] ?? ''),
          rol: role,
          photoURL: typeof profile['photoURL'] === 'string' ? profile['photoURL'] : undefined,
        };
      }
    } catch (error) {
      console.error("Error al cargar el perfil:", error);
      if (version === this.loadVersion) this.userProfile = null;
    } finally {
      if (version === this.loadVersion) this.cargando = false;
    }
  }

  // 2. NUEVA FUNCIÓN PARA OBTENER EL COLOR DEL ROL
  getRoleColor(role: string): string {
    switch (parseUserRole(role)) {
      case 'administrador': return 'danger';
      case 'profesor': return 'secondary';
      case 'estudiante': return 'primary';
      default: return 'medium';
    }
  }

  // 3. NUEVA FUNCIÓN PARA LA NAVEGACIÓN
  goTo(path: string) {
    this.navCtrl.navigateForward(path);
  }

  // --- FUNCIONALIDAD PARA CAMBIAR FOTO ---

  async changeProfilePicture() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Seleccionar fuente',
      buttons: [
        { text: 'Tomar foto', handler: () => this.selectImage(CameraSource.Camera) },
        { text: 'Elegir de la galería', handler: () => this.selectImage(CameraSource.Photos) },
        { text: 'Cancelar', role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  async selectImage(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source
      });

      if (image && image.dataUrl && this.currentUser) {
        const loading = await this.loadingCtrl.create({ message: 'Subiendo foto...' });
        await loading.present();

        const userId = this.currentUser.uid;
        const storageRef = ref(this.storage, `profile_pictures/${userId}`);

        await uploadString(storageRef, image.dataUrl, 'data_url');

        const downloadUrl = await getDownloadURL(storageRef);

        const userDocRef = doc(this.firestore, `usuarios/${userId}`);
        await updateDoc(userDocRef, { photoURL: downloadUrl });

        if (this.userProfile) {
          this.userProfile.photoURL = downloadUrl;
        }

        loading.dismiss();
        this.presentToast('Foto de perfil actualizada con éxito.', 'success');
      }
    } catch (error) {
      console.error('Error al seleccionar la imagen:', error);
      this.presentToast('No se pudo actualizar la foto.', 'danger');
    }
  }

  // --- FIN DE FUNCIONALIDAD ---

  async logout() {
    try {
      await signOut(this.auth);
      this.navCtrl.navigateRoot('/login', { animated: true });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  async presentToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    toast.present();
  }
}

