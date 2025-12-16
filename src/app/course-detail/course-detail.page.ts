import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  query,
  where,
  collection,
  getDocs,
  DocumentData,
  Timestamp, // Importar Timestamp
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import {
  personCircleOutline,
  schoolOutline,
  timeOutline,
  statsChartOutline,
  checkmarkDoneOutline,
  createOutline,
  personAddOutline, // Asumo que lo tenías
  trashOutline, // Asumo que lo tenías
} from 'ionicons/icons';

// --- Interfaces ---
interface ClaseDetalle {
  nombreCurso: string;
  nombreGrado: string;
  nombreProfesor: string;
}

@Component({
  selector: 'app-course-detail',
  templateUrl: './course-detail.page.html',
  styleUrls: ['./course-detail.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class CourseDetailPage implements OnInit {
  // --- Propiedades Existentes ---
  public asignacionId: string | null = null;
  public userRole: string | null = null;
  public esProfesorDeEstaClase = false;
  public esEstudianteInscrito = false;
  public claseDetalles$: Observable<ClaseDetalle | null> = of(null);
  public currentUser: User | null = null;

  // --- NUEVAS PROPIEDADES ---
  public misCalificaciones$: Observable<any[]> = of([]);
  public misAsistencias$: Observable<any[]> = of([]);
  public cargandoCalificaciones = false;
  public cargandoAsistencias = false;

  // --- Inyección de Dependencias ---
  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);
  private navCtrl: NavController = inject(NavController);
  private route: ActivatedRoute = inject(ActivatedRoute);

  constructor() {
    // Reconstruido de capturas anteriores
    addIcons({
      personCircleOutline,
      schoolOutline,
      timeOutline,
      statsChartOutline,
      checkmarkDoneOutline,
      createOutline,
      personAddOutline,
      trashOutline,
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      if (!this.currentUser) {
        this.navCtrl.navigateRoot('/login');
        return;
      }

      this.asignacionId = this.route.snapshot.paramMap.get('id');
      if (this.asignacionId) {
        this.loadRoleAndPageData(this.currentUser.uid, this.asignacionId);
      } else {
        console.error('No se encontró ID de asignación en la URL');
        this.navCtrl.back();
      }
    });
  }

  async loadRoleAndPageData(uid: string, asignacionId: string) {
    // 1. Cargar Rol
    const userDocRef = doc(this.firestore, 'usuarios', uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      this.userRole = userSnap.data()['rol']?.toLowerCase() || null;
      console.log('ROL CARGADO PARA MOSTRAR BOTONES:', this.userRole);
      // 2. Cargar Detalles de Página
      this.loadPageDetails(uid, asignacionId);
    } else {
      console.error('No se encontró documento de perfil para el usuario.');
    }
  }

  async loadPageDetails(uid: string, asignacionId: string) {
    // 2. Cargar los detalles de la clase (asignacion)
    this.claseDetalles$ = from(
      getDoc(doc(this.firestore, 'asignaciones', asignacionId))
    ).pipe(
      switchMap(async (asignacionSnap) => {
        if (!asignacionSnap.exists()) {
          return null;
        }
        const data = asignacionSnap.data();

        // Verificar si es profesor
        if (this.userRole === 'profesor' && data['profesorId'] === uid) {
          this.esProfesorDeEstaClase = true;
        }

        // Cargar datos referenciados
        const cursoRef = doc(this.firestore, 'cursos', data['cursoId']);
        const gradoRef = doc(this.firestore, 'grados', data['gradoId']);
        const profesorRef = doc(this.firestore, 'usuarios', data['profesorId']);

        const [cursoSnap, gradoSnap, profesorSnap] = await Promise.all([
          getDoc(cursoRef),
          getDoc(gradoRef),
          getDoc(profesorRef),
        ]);

        const nombreCurso = cursoSnap.exists()
          ? cursoSnap.data()['nombre']
          : 'Curso Desconocido';
        const nombreGrado = gradoSnap.exists()
          ? `${gradoSnap.data()['nombre']} - ${gradoSnap.data()['seccion']}`
          : '';
        const nombreProfesor = profesorSnap.exists()
          ? profesorSnap.data()['nombreCompleto']
          : 'Profesor no asignado';

        return { nombreCurso, nombreGrado, nombreProfesor };
      })
    );

    // 3. Verificar si el estudiante está inscrito Y CARGAR SUS DATOS
    if (this.userRole === 'estudiante') {
      const inscripcionesQuery = query(
        collection(this.firestore, 'inscripciones'),
        where('studentId', '==', uid), // Usamos 'studentId' (de create-user)
        where('asignacionId', '==', asignacionId)
      );
      const inscripcionesSnap = await getDocs(inscripcionesQuery);
      this.esEstudianteInscrito = !inscripcionesSnap.empty;

      // --- ¡¡INICIO DE LA NUEVA LÓGICA!! ---
      if (this.esEstudianteInscrito) {
        // Si está inscrito, cargamos sus notas y asistencias
        this.loadMisCalificaciones(uid, asignacionId);
        this.loadMisAsistencias(uid, asignacionId);
      }
      // --- ¡¡FIN DE LA NUEVA LÓGICA!! ---
    }
  }

  // --- ¡¡NUEVA FUNCIÓN!! ---
  loadMisCalificaciones(studentId: string, asignacionId: string) {
    this.cargandoCalificaciones = true;
    // Asumimos que las calificaciones se guardan con 'studentId'
    const q = query(
      collection(this.firestore, 'calificaciones'),
      where('studentId', '==', studentId),
      where('asignacionId', '==', asignacionId)
    );

    this.misCalificaciones$ = from(getDocs(q)).pipe(
      map((snapshot) => {
        this.cargandoCalificaciones = false;
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      })
    );
  }

  // --- ¡¡NUEVA FUNCIÓN!! ---
  loadMisAsistencias(studentId: string, asignacionId: string) {
    this.cargandoAsistencias = true;
    const q = query(
      collection(this.firestore, 'asistencias'),
      // Importante: manage-attendance guarda 'estudianteId'
      where('estudianteId', '==', studentId),
      where('asignacionId', '==', asignacionId)
    );

    this.misAsistencias$ = from(getDocs(q)).pipe(
      map((snapshot) => {
        this.cargandoAsistencias = false;
        return snapshot.docs.map((doc) => {
          const data = doc.data();
          // Convertir Timestamp de Firestore a Date de JS
          const fecha = (data['fecha'] as Timestamp).toDate();
          return { id: doc.id, ...data, fecha };
        });
      })
    );
  }

  // --- ¡¡NUEVA FUNCIÓN!! ---
  // Helper para formatear la fecha
  formatDate(date: Date | undefined): string {
    if (!date) return '';
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  
  // Helper para convertir timestamp de calificacion (si existe)
  formatTimestamp(timestamp: Timestamp | undefined): string {
    if (!timestamp) return '';
    return this.formatDate(timestamp.toDate());
  }

  // --- Funciones de Navegación Existentes ---
  // (Reconstruidas de capturas anteriores)
  goToManageAttendance() {
    this.navCtrl.navigateForward(`/manage-attendance/${this.asignacionId}`);
  }
  goToManageGrades() {
    this.navCtrl.navigateForward(`/manage-grades/${this.asignacionId}`);
  }
  goToEnrollStudents() {
    this.navCtrl.navigateForward(`/enroll-students/${this.asignacionId}`);
  }
  goToMyGrades() {
    this.navCtrl.navigateForward(`/my-grades`);
  }
  goToMyAttendance() {
    this.navCtrl.navigateForward(`/attendance-history`);
  }
  // Asumo que esta existe para el admin
  goToEditAssignment() {
    // Lógica para editar asignación
  }
}

