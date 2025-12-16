import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  DocumentData,
  collectionData,
} from '@angular/fire/firestore';
import { addIcons } from 'ionicons';
import { personCircleOutline, saveOutline } from 'ionicons/icons';

@Component({
  selector: 'app-manage-attendance',
  templateUrl: './manage-attendance.page.html',
  styleUrls: ['./manage-attendance.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ManageAttendancePage implements OnInit {
  
  public asignaciones: any[] = [];
  public estudiantes: any[] = [];
  public asignacionSeleccionada: string | null = null;

  public cargandoAsignaciones = true;
  public cargandoEstudiantes = false;
  public currentUser: User | null = null;

  // Inyección de dependencias
  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private toastController: ToastController = inject(ToastController);
  private navCtrl: NavController = inject(NavController);
  private route: ActivatedRoute = inject(ActivatedRoute);

  constructor() {
    addIcons({ personCircleOutline, saveOutline });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.currentUser = user;
        // Carga inicial de asignaciones del profesor
        await this.cargarAsignaciones();

        // Verificar si se pasó un ID de asignación por la URL
        const idFromRoute = this.route.snapshot.paramMap.get('id');
        if (idFromRoute) {
          // Si hay ID, lo seleccionamos y cargamos estudiantes
          this.asignacionSeleccionada = idFromRoute;
          this.cdr.detectChanges(); // Forzar detección de cambios para el <ion-select>
          this.cargarEstudiantes(); // Llamada inicial
        }
      } else {
        this.navCtrl.navigateRoot('/login');
      }
    });
  }

  /**
   * Carga la lista de cursos asignados al profesor (para el dropdown).
   */
  async cargarAsignaciones() {
    this.cargandoAsignaciones = true;
    try {
      if (!this.currentUser) return;

      const q = query(
        collection(this.firestore, 'asignaciones'),
        where('profesorId', '==', this.currentUser.uid)
      );
      const asignacionesSnapshot = await getDocs(q);

      const promesas = asignacionesSnapshot.docs.map(async (asignacionDoc) => {
        const asignacionData = asignacionDoc.data();
        
        // Verificación de datos
        if (!asignacionData['cursoId'] || !asignacionData['gradoId']) {
          console.warn('Asignación incompleta encontrada:', asignacionDoc.id);
          return null; // Omitir esta asignación
        }

        const cursoRef = doc(this.firestore, 'cursos', asignacionData['cursoId']);
        const gradoRef = doc(this.firestore, 'grados', asignacionData['gradoId']);

        const [cursoSnap, gradoSnap] = await Promise.all([
          getDoc(cursoRef),
          getDoc(gradoRef)
        ]);

        const nombreCurso = cursoSnap.exists() ? cursoSnap.data()['nombre'] : 'Curso Desconocido';
        const nombreGrado = gradoSnap.exists() ? `${gradoSnap.data()['nombre']} - ${gradoSnap.data()['seccion']}` : '';

        return {
          id: asignacionDoc.id,
          nombreCompleto: `${nombreCurso} ${nombreGrado}`.trim()
        };
      });

      this.asignaciones = (await Promise.all(promesas)).filter(a => a !== null) as any[];

    } catch (error) {
      console.error('Error cargando asignaciones:', error);
      this.presentToast('Error al cargar asignaciones.', 'danger');
    } finally {
      this.cargandoAsignaciones = false;
    }
  }

  /**
   * Se llama cuando el profesor selecciona una clase del dropdown.
   */
  onClaseChange(event: any) {
    this.asignacionSeleccionada = event.detail.value;
    this.estudiantes = []; // Limpiar lista anterior
    this.cargarEstudiantes();
  }

  /**
   * Carga los estudiantes inscritos en la 'asignacionSeleccionada'.
   */
  async cargarEstudiantes() {
    if (!this.asignacionSeleccionada) {
      console.warn('cargarEstudiantes() se llamó sin asignacionSeleccionada. Abortando.');
      return;
    }

    this.cargandoEstudiantes = true;
    this.estudiantes = []; // Limpiar lista
    console.log(`[DEBUG] Iniciando carga de estudiantes para asignacionId: ${this.asignacionSeleccionada}`);

    try {
      // 1. Buscar en 'inscripciones' por el ID de la asignación
      const q = query(
        collection(this.firestore, 'inscripciones'),
        where('asignacionId', '==', this.asignacionSeleccionada)
      );

      console.log('[DEBUG] Ejecutando consulta en Firestore por inscripciones...');
      const inscripcionesSnapshot = await getDocs(q);
      console.log(`[DEBUG] Consulta completada. Encontradas ${inscripcionesSnapshot.docs.length} inscripciones.`);

      if (inscripcionesSnapshot.empty) {
        console.warn('La consulta de inscripciones no devolvió resultados.');
        this.cargandoEstudiantes = false;
        this.cdr.detectChanges();
        return;
      }

      // 2. Procesar cada inscripción para obtener los datos del estudiante
      const promesas = inscripcionesSnapshot.docs.map(async (inscripcionDoc) => {
        const inscripcionData = inscripcionDoc.data();
        
        // --- ¡¡INICIO DE LA CORRECCIÓN!! ---
        
        // 1. Leer el campo 'studentId' (en lugar de 'estudianteId')
        const estudianteId = inscripcionData['studentId']; 

        // 2. Comprobar el campo 'studentId'
        if (!estudianteId) { 
          // 3. Actualizar el mensaje de error para usar 'studentId'
          console.error('[DEBUG] Documento de inscripción dañado, falta studentId: ', inscripcionDoc.id); 
          return null;
        }
        
        // --- ¡¡FIN DE LA CORRECCIÓN!! ---

        const userRef = doc(this.firestore, 'usuarios', estudianteId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          console.warn(`[DEBUG] Estudiante con ID ${estudianteId} no encontrado en 'usuarios'.`);
          return null;
        }

        // 3. Crear el objeto estudiante para la lista
        return {
          id: userSnap.id,
          nombreCompleto: userSnap.data()['nombreCompleto'],
          estadoAsistencia: 'PRESENTE' // Estado por defecto
        };
      });

      this.estudiantes = (await Promise.all(promesas)).filter(e => e !== null) as any[];
      console.log(`[DEBUG] Carga finalizada. ${this.estudiantes.length} estudiantes procesados.`);

    } catch (error) {
      // Si hay un error de ÍNDICE FALTANTE, se mostrará aqui
      console.error("ERROR FATAL cargando estudiantes:", error);
      this.presentToast('Error al cargar estudiantes. Revise la consola (F12).', 'danger');
    } finally {
      this.cargandoEstudiantes = false;
      this.cdr.detectChanges(); // Forzamos la actualización de la vista
    }
  }


  /**
   * Actualiza el estado de asistencia de un estudiante en la lista local.
   */
  marcarAsistencia(estudianteId: string, eventValue: any) {
    const estado = String(eventValue.detail.value);
    const estudiante = this.estudiantes.find(e => e.id === estudianteId);
    if (estudiante) {
      estudiante.estadoAsistencia = estado;
    }
  }

  /**
   * Guarda los registros de asistencia del día en un 'batch' de Firestore.
   */
  async guardarLista() {
    if (!this.asignacionSeleccionada || this.estudiantes.length === 0) {
      this.presentToast('No hay lista de asistencia para guardar.', 'warning');
      return;
    }

    const batch = writeBatch(this.firestore);
    const fecha = new Date(); // Usar la fecha actual del servidor sería mejor con Timestamp.now()

    this.estudiantes.forEach(estudiante => {
      // Crea una referencia para un nuevo documento en 'asistencias'
      const asistenciaRef = doc(collection(this.firestore, 'asistencias')); 
      
      batch.set(asistenciaRef, {
        asignacionId: this.asignacionSeleccionada,
        estudianteId: estudiante.id,
        fecha: fecha,
        estado: estudiante.estadoAsistencia
      });
    });

    try {
      await batch.commit();
      this.presentToast('Asistencia guardada con éxito.', 'success');
      this.navCtrl.back(); // Volver a la página anterior
    } catch (error) {
      console.error("Error guardando asistencia:", error);
      this.presentToast('Ocurrió un error al guardar la asistencia.', 'danger');
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
      position: 'top'
    });
    toast.present();
  }
}



