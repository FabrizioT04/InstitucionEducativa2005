import { TestBed } from '@angular/core/testing';
import { normalizeGradeRecord } from '../../core/models/grade.model';
import { GradeSummaryComponent } from './grade-summary.component';

describe('GradeSummaryComponent', () => {
  it('renders zero, pending terms and the current average consistently', () => {
    const fixture = TestBed.createComponent(GradeSummaryComponent);
    fixture.componentRef.setInput('grade', normalizeGradeRecord('id', {
      trimestre1: 0, trimestre2: null, trimestre3: 20,
    }));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Trimestre 1: 0');
    expect(text).toContain('Trimestre 2: Pendiente');
    expect(text).toContain('Promedio actual: 10');
    expect(text).not.toContain('N/A');
  });

  it('keeps a legacy zero evaluation visible', () => {
    const fixture = TestBed.createComponent(GradeSummaryComponent);
    fixture.componentRef.setInput('grade', normalizeGradeRecord('legacy', { nota: 0, descripcion: 'Examen' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Examen');
    expect(fixture.nativeElement.querySelector('h3').textContent.trim()).toBe('0');
  });
});
