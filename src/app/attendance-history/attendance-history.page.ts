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
interface AsignacionConAsistencias {
  id: string;
  nombreCurso: string;
  nombreGrado: string;
  asistencias: any[];
}

@Component({
  selector: 'app-attendance-history',
  templateUrl: './attendance-history.page.html',
  styleUrls: ['./attendance-history.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class AttendanceHistoryPage implements OnInit {
  public currentUser: User | null = null;
  public isLoading = true; // <-- Aquí está la propiedad
  public gruposDeAsistencias: AsignacionConAsistencias[] = [];

  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);
  private navCtrl: NavController = inject(NavController);

  constructor() {}

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.loadAllMyAttendance(user.uid);
      } else {
        this.navCtrl.navigateRoot('/login');
      }
    });
  }

  async loadAllMyAttendance(studentId: string) {
    this.isLoading = true;
    try {
      // 1. Obtener todas las asistencias del estudiante
      const qAsistencias = query(
        collection(this.firestore, 'asistencias'),
        where('estudianteId', '==', studentId) // Usamos 'estudianteId' (como en manage-attendance)
      );
      const asistenciasSnap = await getDocs(qAsistencias);

      if (asistenciasSnap.empty) {
        this.isLoading = false;
        return;
      }

      // 2. Agrupar asistencias por 'asignacionId'
      const asistenciasPorAsignacion = new Map<string, any[]>();
      asistenciasSnap.forEach((doc) => {
        const asistencia = doc.data();
        const asignacionId = asistencia['asignacionId'];
        if (!asignacionId) return;

        if (!asistenciasPorAsignacion.has(asignacionId)) {
          asistenciasPorAsignacion.set(asignacionId, []);
        }
        
        // Convertir Timestamp a Date
        const fecha = (asistencia['fecha'] as Timestamp).toDate();
        asistenciasPorAsignacion
          .get(asignacionId)
          ?.push({ id: doc.id, ...asistencia, fecha });
      });

      // 3. Obtener los detalles de cada asignación
      const promesas = Array.from(asistenciasPorAsignacion.keys()).map(
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
          
          // Ordenar asistencias por fecha (más reciente primero)
          const asistencias = (asistenciasPorAsignacion.get(asignacionId) || []).sort(
            (a, b) => b.fecha.getTime() - a.fecha.getTime()
          );

          return {
            id: asignacionId,
            nombreCurso,
            nombreGrado,
            asistencias,
          };
        }
      );

      // 4. Filtrar nulos y asignar
      this.gruposDeAsistencias = (await Promise.all(promesas)).filter(
        (g) => g !== null
      ) as AsignacionConAsistencias[];

    } catch (error) {
      console.error('Error cargando todas las asistencias:', error);
    } finally {
      this.isLoading = false;
    }
  }
  
  // Helper para formatear la fecha
  // <-- Aquí está la función (usada por el .html)
  formatDate(date: Date | undefined): string {
    if (!date) return '';
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
