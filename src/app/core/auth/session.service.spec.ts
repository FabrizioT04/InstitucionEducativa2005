import { Auth } from '@angular/fire/auth';
import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let auth: { currentUser: { uid: string; emailVerified: boolean } | null; authStateReady: jasmine.Spy };
  let session: SessionService;

  beforeEach(() => {
    auth = { currentUser: null, authStateReady: jasmine.createSpy().and.resolveTo() };
    TestBed.configureTestingModule({ providers: [{ provide: Auth, useValue: auth }] });
    session = TestBed.inject(SessionService);
  });

  it('waits for persisted authentication before reading the user', async () => {
    auth.authStateReady.and.callFake(async () => {
      auth.currentUser = { uid: 'restored', emailVerified: true };
    });
    expect(await session.getVerifiedUser()).toEqual({ uid: 'restored' });
  });

  it('rejects a signed-out user', async () => {
    expect(await session.getVerifiedUser()).toBeNull();
  });

  it('rejects an unverified email', async () => {
    auth.currentUser = { uid: 'user', emailVerified: false };
    expect(await session.getVerifiedUser()).toBeNull();
    expect(session.isCurrentUser('user')).toBeFalse();
  });

  it('fails closed when session restoration fails', async () => {
    auth.authStateReady.and.rejectWith(new Error('unavailable'));
    expect(await session.getVerifiedUser()).toBeNull();
  });

  it('does not accept a previous account after switching users', () => {
    auth.currentUser = { uid: 'new-user', emailVerified: true };
    expect(session.isCurrentUser('old-user')).toBeFalse();
    expect(session.isCurrentUser('new-user')).toBeTrue();
  });
});
