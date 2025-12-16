import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from '@angular/fire/firestore';

// Interface para agrupar
interface AsignacionConCalificaciones {
  id: string;
  nombreCurso: string;
  nombreGrado: string;
  calificaciones: any[];
}

@Component({
  selector: 'app-my-grades',
  templateUrl: './my-grades.page.html',
  styleUrls: ['./my-grades.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class MyGradesPage implements OnInit {
  public currentUser: User | null = null;
  public isLoading = true; // <-- Aquí está la propiedad
  public gruposDeCalificaciones: AsignacionConCalificaciones[] = []; // <-- Aquí está la propiedad

  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);
  private navCtrl: NavController = inject(NavController);

  constructor() {}

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.loadAllMyGrades(user.uid);
      } else {
        this.navCtrl.navigateRoot('/login');
      }
    });
  }

  async loadAllMyGrades(studentId: string) {
    this.isLoading = true;
    try {
      // 1. Obtener todas las calificaciones del estudiante
      const qCalificaciones = query(
        collection(this.firestore, 'calificaciones'),
        where('studentId', '==', studentId) // Asumiendo que se guardan con 'studentId'
      );
      const calificacionesSnap = await getDocs(qCalificaciones);

      if (calificacionesSnap.empty) {
        this.isLoading = false;
        return;
      }

      // 2. Agrupar calificaciones por 'asignacionId'
      const calificacionesPorAsignacion = new Map<string, any[]>();
      calificacionesSnap.forEach((doc) => {
        const calificacion = doc.data();
        const asignacionId = calificacion['asignacionId'];
        if (!asignacionId) return;

        if (!calificacionesPorAsignacion.has(asignacionId)) {
          calificacionesPorAsignacion.set(asignacionId, []);
        }
        calificacionesPorAsignacion
          .get(asignacionId)
          ?.push({ id: doc.id, ...calificacion });
      });

      // 3. Obtener los detalles de cada asignación
      const promesas = Array.from(calificacionesPorAsignacion.keys()).map(
        async (asignacionId) => {
          const asignacionRef = doc(this.firestore, 'asignaciones', asignacionId);
          const asignacionSnap = await getDoc(asignacionRef);
          if (!asignacionSnap.exists()) return null;

          const asignacionData = asignacionSnap.data();

          // Cargar nombres de curso y grado
          const cursoRef = doc(this.firestore, 'cursos', asignacionData['cursoId']);
          const gradoRef = doc(this.firestore, 'grados', asignacionData['gradoId']);
          const [cursoSnap, gradoSnap] = await Promise.all([
            getDoc(cursoRef),
            getDoc(gradoRef),
          ]);

          const nombreCurso = cursoSnap.exists()
            ? cursoSnap.data()['nombre']
            : 'Curso Desconocido';
          const nombreGrado = gradoSnap.exists()
            ? `${gradoSnap.data()['nombre']} - ${gradoSnap.data()['seccion']}`
            : '';

          return {
            id: asignacionId,
            nombreCurso,
            nombreGrado,
            calificaciones: calificacionesPorAsignacion.get(asignacionId) || [],
          };
        }
      );

      // 4. Filtrar nulos y asignar
      this.gruposDeCalificaciones = (await Promise.all(promesas)).filter(
        (g) => g !== null
      ) as AsignacionConCalificaciones[];

    } catch (error) {
      console.error('Error cargando todas las calificaciones:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Helper para formatear la fecha
  // <-- Aquí está la función
  formatTimestamp(timestamp: Timestamp | undefined): string {
    if (!timestamp) return 'Sin fecha';
    return timestamp.toDate().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
