import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { AccessService } from '../auth/access.service';
import { GradesService } from './grades.service';

describe('GradesService write validation', () => {
  let service: GradesService;
  let access: jasmine.SpyObj<AccessService>;

  beforeEach(() => {
    access = jasmine.createSpyObj<AccessService>('AccessService', ['authorize']);
    access.authorize.and.resolveTo('allowed');
    TestBed.configureTestingModule({ providers: [
      { provide: Firestore, useValue: {} },
      { provide: AccessService, useValue: access },
    ] });
    service = TestBed.inject(GradesService);
  });

  it('rechecks class access before constructing any Firestore write', async () => {
    access.authorize.and.resolveTo('forbidden');
    await expectAsync(service.saveForAssignment('class', [])).toBeRejectedWithError(/permiso/);
    expect(access.authorize).toHaveBeenCalledWith({ roles: ['administrador', 'profesor'], classAccess: 'manage' }, 'class');
  });

  it('rejects invalid grades before any writes', async () => {
    await expectAsync(service.saveForAssignment('class', [{
      studentId: 'student', documentId: null,
      grades: { trimestre1: 21, trimestre2: null, trimestre3: null },
    }])).toBeRejectedWithError(/entre 0 y 20/);
  });

  it('rejects duplicate students before any writes', async () => {
    const update = { studentId: 'student', documentId: null, grades: { trimestre1: 10, trimestre2: null, trimestre3: null } };
    await expectAsync(service.saveForAssignment('class', [update, update])).toBeRejectedWithError(/duplicados/);
  });
});
