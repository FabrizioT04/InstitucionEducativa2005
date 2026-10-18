import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { GradeRecord } from '../../core/models/grade.model';

@Component({
  selector: 'app-grade-summary',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <ion-item>
      <ion-label class="ion-text-wrap">
        @if (grade.esTrimestral) {
          <h3>Calificaciones trimestrales</h3>
          <p>Trimestre 1: {{ grade.trimestre1 ?? 'Pendiente' }}</p>
          <p>Trimestre 2: {{ grade.trimestre2 ?? 'Pendiente' }}</p>
          <p>Trimestre 3: {{ grade.trimestre3 ?? 'Pendiente' }}</p>
          <p><strong>Promedio actual: {{ grade.promedioFinal ?? 'Pendiente' }}</strong></p>
          <p>El promedio incluye únicamente los trimestres calificados.</p>
        }
        @if (!grade.esTrimestral || grade.nota !== null) {
          <p>{{ grade.descripcion || 'Evaluación' }}</p>
          <h3>{{ grade.nota ?? 'Pendiente' }}</h3>
        }
        @if (grade.fecha) {
          <p>Actualizado: {{ grade.fecha | date:'dd/MM/yyyy' }}</p>
        }
      </ion-label>
    </ion-item>
  `,
})
export class GradeSummaryComponent {
  @Input({ required: true }) grade!: GradeRecord;
}
