import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, AlertController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, query, where, onSnapshot, doc, deleteDoc, collectionData } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { addIcons } from 'ionicons';
import { createOutline, trashOutline, add, peopleOutline, people } from 'ionicons/icons';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.page.html',
  styleUrls: ['./user-list.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, TitleCasePipe],
})
export class UserListPage implements OnInit {
  public users: any[] = [];
  private allUsers: any[] = [];
  public pageTitle = 'Todos los Usuarios';
  public isLoading = true;
  public searchTerm = '';
  public userRoleFilter: string | null = null;

  public grados$: Observable<any[]> = of([]);
  public selectedGradeId: string = 'all';

  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  constructor() {
    addIcons({ createOutline, trashOutline, add, peopleOutline, people });
  }

  ngOnInit() {
    this.userRoleFilter = this.route.snapshot.paramMap.get('role');
    if (this.userRoleFilter === 'estudiante') {
      this.pageTitle = 'Lista de Estudiantes';
      this.loadGrados();
    } else if (this.userRoleFilter) {
      this.pageTitle = `Lista de ${this.userRoleFilter}s`;
    }
    this.loadUsers();
  }

  get icons() {
    return { createOutline, trashOutline, add, peopleOutline, people };
  }

  loadGrados() {
    this.grados$ = collectionData(collection(this.firestore, 'grados'), { idField: 'id' });
  }

  loadUsers() {
    this.isLoading = true;
    let usersQuery;
    const usersCollection = collection(this.firestore, 'usuarios');

    if (this.userRoleFilter === 'estudiante' && this.selectedGradeId !== 'all') {
      usersQuery = query(usersCollection, where('rol', '==', 'estudiante'), where('gradoId', '==', this.selectedGradeId));
    } else if (this.userRoleFilter) {
      usersQuery = query(usersCollection, where('rol', '==', this.userRoleFilter));
    } else {
      usersQuery = query(usersCollection);
    }

    onSnapshot(usersQuery, (snapshot) => {
      this.allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.filterUsers();
      this.isLoading = false;
    });
  }

  filterUsers() {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.users = [...this.allUsers];
    } else {
      this.users = this.allUsers.filter(user =>
        user.nombreCompleto.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      );
    }
  }

  handleSearch(event: any) {
    this.searchTerm = event.target.value || '';
    this.filterUsers();
  }

  handleGradeFilterChange(event: any) {
    this.selectedGradeId = event.detail.value;
    this.loadUsers();
  }

  goToCreateUser() {
    this.navCtrl.navigateForward('/create-user');
  }

  // 1. MODIFICADO: Acepta un evento opcional y detiene la propagación si existe.
  goToEditUser(userId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.navCtrl.navigateForward(`/edit-user/${userId}`);
  }

  // 2. MODIFICADO: Acepta el evento y detiene la propagación.
  async deleteUser(userId: string, userName: string, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de que quieres eliminar a ${userName}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: async () => {
            try {
              await deleteDoc(doc(this.firestore, 'usuarios', userId));
              this.presentToast('Usuario eliminado con éxito.', 'success');
            } catch (error) {
              this.presentToast('Error al eliminar el usuario.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async presentToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    toast.present();
  }

  getRoleColor(role: string): string {
    switch (role?.toLowerCase()) {
      case 'administrador': return 'danger';
      case 'profesor': return 'secondary';
      case 'estudiante': return 'primary';
      default: return 'medium';
    }
  }

  getUserImage(user: any): string {
    return user.photoURL || 'assets/icon/favicon.png';
  }
}

