import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  NavController,
  ToastController,
  LoadingController, // Necesitarás LoadingController
} from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  setDoc, // Importar setDoc
} from '@angular/fire/firestore';
import { addIcons } from 'ionicons';
import { saveOutline } from 'ionicons/icons';

@Component({
  selector: 'app-manage-grades',
  templateUrl: './manage-grades.page.html',
  styleUrls: ['./manage-grades.page.css'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ManageGradesPage implements OnInit {
  public estudiantesConNotas: any[] = [];
  public asignacionId: string | null = null;
  public cursoId: string | null = null;
  public tituloClase = 'Gestionar Notas';

  public cargando = true;
  public guardando = false;

  private firestore: Firestore = inject(Firestore);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private navCtrl: NavController = inject(NavController); // Inyectar NavController
  private toastCtrl: ToastController = inject(ToastController);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private loadingCtrl: LoadingController = inject(LoadingController); // Inyectar LoadingController

  constructor() {
    addIcons({ saveOutline });
  }

  ngOnInit() {
    this.asignacionId = this.route.snapshot.paramMap.get('id');
    if (this.asignacionId) {
      this.loadStudentGrades();
    }
  }

  // Carga los estudiantes y sus notas
  async loadStudentGrades() {
    this.cargando = true;
    try {
      // 1. Cargar datos de la asignación (para el título)
      const asignacionRef = doc(
        this.firestore,
        'asignaciones',
        this.asignacionId!
      );
      const asignacionSnap = await getDoc(asignacionRef);
      if (asignacionSnap.exists()) {
        const asignacionData = asignacionSnap.data();
        this.cursoId = asignacionData['cursoId'];
        const cursoRef = doc(this.firestore, 'cursos', this.cursoId!);
        const cursoSnap = await getDoc(cursoRef);
        if (cursoSnap.exists()) {
          this.tituloClase = `Notas de ${cursoSnap.data()['nombre']}`;
        }
      }

      // 2. Buscar inscripciones de esta asignación
      const qInscripciones = query(
        collection(this.firestore, 'inscripciones'),
        where('asignacionId', '==', this.asignacionId)
      );
      const inscripcionesSnapshot = await getDocs(qInscripciones);

      // 3. Procesar cada estudiante
      const promesas = inscripcionesSnapshot.docs.map(async (inscripcionDoc) => {
        // Usamos 'studentId' como lo corregimos en manage-attendance
        const estudianteId = inscripcionDoc.data()['studentId'];
        if (!estudianteId) return null;

        const userRef = doc(this.firestore, 'usuarios', estudianteId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return null;

        // 4. Buscar calificaciones existentes para este estudiante
        const qCalificaciones = query(
          collection(this.firestore, 'calificaciones'),
          where('asignacionId', '==', this.asignacionId),
          where('studentId', '==', estudianteId) // Corregido: era 'estudianteId'
        );
        const calificacionSnap = await getDocs(qCalificaciones);

        // --- INICIO DE CORRECCIÓN: 3 Trimestres ---
        // Se define el tipo de 'notas' para que calificacionId acepte string
        let notas: {
          trimestre1: number;
          trimestre2: number;
          trimestre3: number;
          promedioFinal: number;
          calificacionId: string | null;
        } = {
          trimestre1: 0,
          trimestre2: 0,
          trimestre3: 0,
          promedioFinal: 0,
          calificacionId: null, // ID del documento de calificación si existe
        };

        if (!calificacionSnap.empty) {
          const calificacionData = calificacionSnap.docs[0].data();
          notas.trimestre1 = calificacionData['trimestre1'] || 0;
          notas.trimestre2 = calificacionData['trimestre2'] || 0;
          notas.trimestre3 = calificacionData['trimestre3'] || 0;
          notas.promedioFinal = calificacionData['promedioFinal'] || 0;
          notas.calificacionId = calificacionSnap.docs[0].id; // <-- Esta línea ahora es válida
        }
        // --- FIN DE CORRECCIÓN ---

        return {
          id: userSnap.id,
          nombreCompleto: userSnap.data()['nombreCompleto'],
          notas: notas,
        };
      });

      this.estudiantesConNotas = (await Promise.all(promesas)).filter(
        (e) => e !== null
      ) as any[];
    } catch (error) {
      console.error('Error al cargar datos de estudiantes:', error);
      this.presentToast(
        'Error fatal al cargar los datos. Revise la consola.',
        'danger'
      );
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // --- Se actualiza el cálculo para 3 notas ---
  calcularPromedio(item: any) {
    const nota1 = Number(item.notas.trimestre1) || 0;
    const nota2 = Number(item.notas.trimestre2) || 0;
    const nota3 = Number(item.notas.trimestre3) || 0;

    // Contar solo las notas ingresadas para el promedio (o dividir por 3 si prefieres)
    let notasIngresadas = 0;
    if (nota1 > 0) notasIngresadas++;
    if (nota2 > 0) notasIngresadas++;
    if (nota3 > 0) notasIngresadas++;

    const promedio = (nota1 + nota2 + nota3) / (notasIngresadas || 1); // Evitar dividir por 0

    item.notas.promedioFinal = Math.round(promedio * 100) / 100;
  }

  // --- Se guardan los 3 trimestres ---
  async saveGrades() {
    this.guardando = true;
    const batch = writeBatch(this.firestore);

    this.estudiantesConNotas.forEach((item) => {
      // Decide si crear un doc nuevo o actualizar uno existente
      const calificacionRef = item.notas.calificacionId
        ? doc(this.firestore, 'calificaciones', item.notas.calificacionId)
        : doc(collection(this.firestore, 'calificaciones')); // Crea una nueva referencia

      // Guardamos la nota
      batch.set(
        calificacionRef,
        {
          asignacionId: this.asignacionId,
          studentId: item.id, // Corregido: era 'estudianteId'
          trimestre1: Number(item.notas.trimestre1) || 0,
          trimestre2: Number(item.notas.trimestre2) || 0,
          trimestre3: Number(item.notas.trimestre3) || 0,
          promedioFinal: item.notas.promedioFinal,
          fecha: new Date(), // Guardar la fecha de la última modificación
        },
        { merge: true } // 'merge: true' es útil si actualizas
      );
    });

    try {
      await batch.commit();
      this.presentToast('Notas guardadas con éxito.', 'success');
      this.navCtrl.back(); // Volver atrás después de guardar
    } catch (error) {
      console.error('Ocurrió un error al guardar las notas:', error);
      this.presentToast('Ocurrió un error al guardar las notas.', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  // Función utilitaria para mostrar mensajes
  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
    });
    toast.present();
  }
}
