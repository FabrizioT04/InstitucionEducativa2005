import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, AlertController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, addDoc, query, where, onSnapshot, doc, getDoc, deleteDoc } from '@angular/fire/firestore';
import { Unsubscribe } from '@firebase/util';
// --- IMPORTACIÓN DE ICONOS ---
import { trash, add } from 'ionicons/icons';

// Interfaz para el objeto de horario
interface HorarioItem {
  id: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  aula: string;
}

@Component({
  selector: 'app-manage-schedule',
  templateUrl: './manage-schedule.page.html',
  styleUrls: ['./manage-schedule.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ManageSchedulePage implements OnInit {
  public asignacionId: string | null = null;
  public claseInfo = '';
  public horarios: HorarioItem[] = [];
  public diasSemana = [
    { valor: '1', nombre: 'Lunes' },
    { valor: '2', nombre: 'Martes' },
    { valor: '3', nombre: 'Miércoles' },
    { valor: '4', nombre: 'Jueves' },
    { valor: '5', nombre: 'Viernes' },
  ];
  private unsubscribe: Unsubscribe | null = null;
  
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  private alertCtrl = inject(AlertController);

  constructor() {}

  ngOnInit() {
    this.asignacionId = this.route.snapshot.paramMap.get('id');
    if (this.asignacionId) {
      this.loadClaseInfo();
      this.loadHorarios();
    }
  }

  // --- FUNCIÓN PARA ACCEDER A LOS ICONOS DESDE EL HTML ---
  get icons() {
    return { trash, add };
  }

  ionViewWillLeave() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  public getDiaNombre(valor: string): string {
    const dia = this.diasSemana.find(d => d.valor === valor);
    return dia ? dia.nombre : 'Día desconocido';
  }
  
  async loadClaseInfo() {
    if (!this.asignacionId) return;
    const asignacionRef = doc(this.firestore, 'asignaciones', this.asignacionId);
    const asignacionSnap = await getDoc(asignacionRef);

    if (asignacionSnap.exists()) {
      const data = asignacionSnap.data();
      const cursoRef = doc(this.firestore, 'cursos', data['cursoId']);
      const gradoRef = doc(this.firestore, 'grados', data['gradoId']);
      const [cursoSnap, gradoSnap] = await Promise.all([getDoc(cursoRef), getDoc(gradoRef)]);
      const nombreCurso = cursoSnap.exists() ? cursoSnap.data()['nombre'] : '';
      const nombreGrado = gradoSnap.exists() ? `${gradoSnap.data()['nombre']} - ${gradoSnap.data()['seccion']}` : '';
      this.claseInfo = `${nombreCurso} (${nombreGrado})`;
    }
  }

  loadHorarios() {
    if (!this.asignacionId) return;
    const q = query(collection(this.firestore, 'horarios'), where('asignacionId', '==', this.asignacionId));
    
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      this.horarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HorarioItem));
    });
  }

  async addHorario() {
    const alert = await this.alertCtrl.create({
      header: 'Añadir Nuevo Horario',
      inputs: [
        { name: 'dia', type: 'radio', label: 'Lunes', value: '1', checked: true },
        { name: 'dia', type: 'radio', label: 'Martes', value: '2' },
        { name: 'dia', type: 'radio', label: 'Miércoles', value: '3' },
        { name: 'dia', type: 'radio', label: 'Jueves', value: '4' },
        { name: 'dia', type: 'radio', label: 'Viernes', value: '5' },
        { name: 'horaInicio', type: 'time', placeholder: 'Hora Inicio' },
        { name: 'horaFin', type: 'time', placeholder: 'Hora Fin' },
        { name: 'aula', type: 'text', placeholder: 'Aula o Salón' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: async (data) => {
            if (data && data.horaInicio && data.horaFin && data.aula) {
              const horariosCollection = collection(this.firestore, 'horarios');
              await addDoc(horariosCollection, {
                asignacionId: this.asignacionId,
                dia: data,
                horaInicio: data.horaInicio,
                horaFin: data.horaFin,
                aula: data.aula
              });
              return true;
            }
            return false;
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteHorario(horarioId: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: '¿Estás seguro de que quieres eliminar este bloque de horario?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', handler: async () => {
            const horarioDocRef = doc(this.firestore, 'horarios', horarioId);
            await deleteDoc(horarioDocRef);
          }
        }
      ]
    });
    await alert.present();
  }
}

