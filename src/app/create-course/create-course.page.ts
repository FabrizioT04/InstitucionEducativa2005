import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
// ¡AQUÍ ESTÁ LA SOLUCIÓN! Se añade 'doc' a la lista de importaciones.
import { Firestore, collection, getDocs, query, where, writeBatch, doc } from '@angular/fire/firestore';

// Interfaces para organizar los datos
interface UserData {
  id: string;
  nombreCompleto: string;
}

interface StudentCheck extends UserData {
  inscrito: boolean;
}

@Component({
  selector: 'app-create-course',
  templateUrl: './create-course.page.html',
  styleUrls: ['./create-course.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class CreateCoursePage implements OnInit {
  
  curso = {
    nombre: '',
    area: ''
  };
  asignacion = {
    profesorId: null,
    gradoId: null,
  };
  
  public profesores: UserData[] = [];
  public grados: any[] = [];
  public estudiantes: StudentCheck[] = [];

  public cargando = true;
  public guardando = false;

  private firestore = inject(Firestore);
  private navController = inject(NavController);
  private toastController = inject(ToastController);

  constructor() { }

  ngOnInit() {
    this.loadInitialData();
  }

  async loadInitialData() {
    this.cargando = true;
    try {
      const [profesoresSnap, gradosSnap, estudiantesSnap] = await Promise.all([
        getDocs(query(collection(this.firestore, 'usuarios'), where('rol', '==', 'profesor'))),
        getDocs(collection(this.firestore, 'grados')),
        getDocs(query(collection(this.firestore, 'usuarios'), where('rol', '==', 'estudiante')))
      ]);

      this.profesores = profesoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
      this.grados = gradosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.estudiantes = estudiantesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), inscrito: false } as StudentCheck));

    } catch (error) {
      console.error("Error cargando datos iniciales:", error);
      this.presentToast('Error al cargar los datos necesarios.', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  async guardarCursoCompleto() {
    if (!this.curso.nombre || !this.asignacion.gradoId || !this.asignacion.profesorId) {
      this.presentToast('Por favor, complete el nombre, grado y profesor.', 'warning');
      return;
    }

    this.guardando = true;
    try {
      const batch = writeBatch(this.firestore);

      // 1. Crear el nuevo curso
      const cursosCollection = collection(this.firestore, 'cursos');
      const nuevoCursoRef = doc(cursosCollection);
      batch.set(nuevoCursoRef, { nombre: this.curso.nombre, area: this.curso.area });
      const nuevoCursoId = nuevoCursoRef.id;

      // 2. Crear la nueva asignación
      const asignacionesCollection = collection(this.firestore, 'asignaciones');
      const nuevaAsignacionRef = doc(asignacionesCollection);
      batch.set(nuevaAsignacionRef, {
        cursoId: nuevoCursoId,
        gradoId: this.asignacion.gradoId,
        profesorId: this.asignacion.profesorId
      });
      const nuevaAsignacionId = nuevaAsignacionRef.id;
      
      // 3. Crear las inscripciones para los estudiantes seleccionados
      const estudiantesAInscribir = this.estudiantes.filter(e => e.inscrito);
      if (estudiantesAInscribir.length > 0) {
        const inscripcionesCollection = collection(this.firestore, 'inscripciones');
        const añoActual = new Date().getFullYear();
        
        estudiantesAInscribir.forEach(estudiante => {
          const nuevaInscripcionRef = doc(inscripcionesCollection);
          batch.set(nuevaInscripcionRef, {
            asignacionId: nuevaAsignacionId,
            estudianteId: estudiante.id,
            año: añoActual
          });
        });
      }

      await batch.commit();
      this.presentToast('Clase creada y configurada con éxito.', 'success');
      this.navController.back();

    } catch (error) {
      console.error('Error al guardar la clase completa:', error);
      this.presentToast('Ocurrió un error al guardar los datos.', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({ message, duration: 3000, color });
    toast.present();
  }
}





