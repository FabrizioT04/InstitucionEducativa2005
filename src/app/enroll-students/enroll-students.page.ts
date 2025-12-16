import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  WriteBatch,
  DocumentData,
  CollectionReference,
  Query,
  QuerySnapshot,
} from '@angular/fire/firestore';
import { addIcons } from 'ionicons';
import { saveOutline } from 'ionicons/icons';

// Interfaz para el estudiante en la lista
interface EstudianteCheck {
  id: string;
  docId?: string; // ID del documento de inscripción (si existe)
  nombreCompleto: string;
  inscrito: boolean;
}

@Component({
  selector: 'app-enroll-students',
  templateUrl: './enroll-students.page.html',
  styleUrls: ['./enroll-students.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class EnrollStudentsPage implements OnInit {
  
  public listaEstudiantes: EstudianteCheck[] = [];
  public cargando = true;
  public guardando = false;
  public asignacionId: string | null = null;
  
  // CORRECCIÓN: Usaremos un Map para guardar el estado original
  // Guarda: <estudianteId, inscripcionDocId>
  private inscripcionesMap: Map<string, string> = new Map();

  // Inyección de dependencias
  private firestore: Firestore = inject(Firestore);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private navCtrl: NavController = inject(NavController);
  private toastController: ToastController = inject(ToastController);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

  constructor() {
    addIcons({ saveOutline });
  }

  ngOnInit() {
    // Obtenemos el ID de la asignación (clase) desde la URL
    const idFromRoute = this.route.snapshot.paramMap.get('id');
    if (idFromRoute) {
      this.asignacionId = idFromRoute;
      this.cargarEstudiantes();
    } else {
      console.error('No se proveyó ID de asignación');
      this.presentToast('Error: No se encontró la clase.', 'danger');
      this.navCtrl.back();
    }
  }

  /**
   * Carga TODOS los estudiantes y marca los que ya están inscritos en esta clase.
   */
  async cargarEstudiantes() {
    this.cargando = true;
    try {
      // 1. Obtener TODOS los estudiantes de la escuela
      const qEstudiantes: Query<DocumentData> = query(
        collection(this.firestore, 'usuarios'),
        where('rol', '==', 'estudiante')
      );
      const estudiantesSnapshot: QuerySnapshot<DocumentData> = await getDocs(qEstudiantes);
      const todosLosEstudiantes = estudiantesSnapshot.docs.map(doc => ({
        id: doc.id,
        nombreCompleto: doc.data()['nombreCompleto'],
        inscrito: false, // Por defecto no están inscritos
      }));

      // 2. Obtener los que YA están inscritos en esta asignación
      if (!this.asignacionId) return;
      
      const qInscritos: Query<DocumentData> = query(
        collection(this.firestore, 'inscripciones'),
        where('asignacionId', '==', this.asignacionId)
      );
      const inscritosSnapshot: QuerySnapshot<DocumentData> = await getDocs(qInscritos);

      // 3. CORRECCIÓN: Llenamos el Map de inscripciones
      // Guardamos el ID del estudiante y el ID del *documento de inscripción*
      this.inscripcionesMap.clear();
      inscritosSnapshot.docs.forEach(doc => {
        this.inscripcionesMap.set(doc.data()['estudianteId'], doc.id);
      });

      // 4. Marcar los estudiantes que ya están inscritos
      this.listaEstudiantes = todosLosEstudiantes.map(estudiante => {
        if (this.inscripcionesMap.has(estudiante.id)) {
          estudiante.inscrito = true;
        }
        return estudiante;
      });

    } catch (error) {
      console.error("Error al cargar la lista de estudiantes:", error);
      this.presentToast('Error al cargar la lista de estudiantes', 'danger');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // Forzar actualización de la vista
    }
  }

  /**
   * Guarda los cambios (inscripciones y desinscripciones) en un batch.
   */
  async guardarInscripciones() {
    if (!this.asignacionId) {
      this.presentToast('Error: No se pudo identificar la clase.', 'danger');
      return;
    }

    this.guardando = true;
    const batch: WriteBatch = writeBatch(this.firestore);
    const anoActual: number = new Date().getFullYear();
    const inscripcionesRef: CollectionReference<DocumentData> = collection(this.firestore, 'inscripciones');

    try {
      // Iteramos sobre CADA estudiante de la lista
      for (const estudiante of this.listaEstudiantes) {
        
        const estabaInscrito: boolean = this.inscripcionesMap.has(estudiante.id);
        const quiereEstarInscrito: boolean = estudiante.inscrito;

        if (quiereEstarInscrito && !estabaInscrito) {
          // --- ACCIÓN: INSCRIBIR (Crear nuevo documento) ---
          const nuevaInscripcionRef = doc(inscripcionesRef); // Nuevo doc con ID aleatorio
          batch.set(nuevaInscripcionRef, {
            asignacionId: this.asignacionId,
            estudianteId: estudiante.id,
            año: anoActual,
            // (puedes añadir notas: {} aquí si lo necesitas)
          });

        } else if (!quiereEstarInscrito && estabaInscrito) {
          // --- ACCIÓN: DESINSCRIBIR (Borrar documento existente) ---
          const inscripcionDocId = this.inscripcionesMap.get(estudiante.id);
          if (inscripcionDocId) {
            const inscripcionRef = doc(this.firestore, 'inscripciones', inscripcionDocId);
            batch.delete(inscripcionRef);
          }
        }
        // Si (quiereEstarInscrito && estabaInscrito) -> No hacer nada
        // Si (!quiereEstarInscrito && !estabaInscrito) -> No hacer nada
      }

      // 5. Ejecutamos todas las operaciones
      await batch.commit();
      
      this.presentToast('Inscripciones actualizadas con éxito.', 'success');
      this.navCtrl.back(); // Volver a la página anterior

    } catch (error) {
      console.error("Error al guardar inscripciones:", error);
      this.presentToast('Ocurrió un error al guardar los cambios.', 'danger');
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Muestra un mensaje Toast (popup).
   */
  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top',
    });
    toast.present();
  }
}


