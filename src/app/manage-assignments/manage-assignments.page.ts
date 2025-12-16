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
  IonSelect,
  IonSelectOption,
  IonButton
} from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, doc, getDoc, collectionData, query, where, setDoc, addDoc, updateDoc } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-manage-assignments',
  templateUrl: './manage-assignments.page.html',
  styleUrls: ['./manage-assignments.page.css'],
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
    CommonModule,
    FormsModule
  ],
})
export class ManageAssignmentsPage implements OnInit {
  public pageTitle = 'Crear Asignación';
  public asignacionId: string | null = null;
  public asignacion = {
    cursoId: '',
    gradoId: '',
    profesorId: '',
  };

  public cursos$: Observable<any[]> = of([]);
  public grados$: Observable<any[]> = of([]);
  public profesores$: Observable<any[]> = of([]);

  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  private toastCtrl = inject(ToastController);

  constructor() { }

  ngOnInit() {
    this.asignacionId = this.route.snapshot.paramMap.get('id');
    this.loadDropdownData();
    if (this.asignacionId) {
      this.pageTitle = 'Editar Asignación';
      this.loadAssignmentData(this.asignacionId);
    }
  }

  loadDropdownData() {
    // Cargar Cursos
    this.cursos$ = collectionData(collection(this.firestore, 'cursos'), { idField: 'id' });
    // Cargar Grados
    this.grados$ = collectionData(collection(this.firestore, 'grados'), { idField: 'id' });
    // Cargar Profesores
    const q = query(collection(this.firestore, 'usuarios'), where('rol', '==', 'profesor'));
    this.profesores$ = collectionData(q, { idField: 'id' });
  }

  async loadAssignmentData(id: string) {
    const docRef = doc(this.firestore, 'asignaciones', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      this.asignacion = {
        cursoId: data['cursoId'],
        gradoId: data['gradoId'],
        profesorId: data['profesorId'],
      };
    }
  }

  async saveAssignment() {
    if (!this.asignacion.cursoId || !this.asignacion.gradoId || !this.asignacion.profesorId) {
      this.presentToast('Por favor, complete todos los campos.', 'warning');
      return;
    }

    try {
      if (this.asignacionId) {
        // Editar
        const docRef = doc(this.firestore, 'asignaciones', this.asignacionId);
        await updateDoc(docRef, this.asignacion);
        this.presentToast('Asignación actualizada con éxito.', 'success');
      } else {
        // Crear
        await addDoc(collection(this.firestore, 'asignaciones'), this.asignacion);
        this.presentToast('Asignación creada con éxito.', 'success');
      }
      this.navCtrl.back();
    } catch (error) {
      this.presentToast('Error al guardar la asignación.', 'danger');
      console.error(error);
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    toast.present();
  }
}


