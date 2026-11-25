// testenv：偽 firebase-auth
// ログイン中のユーザーは harness.js（window.__testenv）が ?as=<id> と localStorage から決める。
// ID トークンは "testenv:<email>"。偽 R2（testenv/server.py）だけが受け付ける。
const T = window.__testenv;
const listeners = new Set();

class FakeUser {
  constructor(u) {
    this.uid = 'testenv_' + String(u.email).replace(/[^a-z0-9]/gi, '_');
    this.email = u.email;
    this.displayName = u.displayName || u.email;
    this.photoURL = u.photoURL || null;
    this.emailVerified = true;
    this.isAnonymous = false;
    this.providerData = [{ providerId: 'google.com', email: u.email, displayName: this.displayName }];
  }
  async getIdToken() { return 'testenv:' + this.email; }
  async getIdTokenResult() { return { token: 'testenv:' + this.email, claims: { email: this.email } }; }
  async reload() {}
  toJSON() { return { uid: this.uid, email: this.email, displayName: this.displayName }; }
}

let current = T && T.user ? new FakeUser(T.user) : null;
const auth = {
  get currentUser() { return current; },
  get app() { return null; },
  languageCode: 'ja',
};
function notify() { for (const cb of [...listeners]) { try { cb(current); } catch (e) { console.error(e); } } }

export function getAuth() { return auth; }
export class GoogleAuthProvider {
  addScope() { return this; }
  setCustomParameters() { return this; }
}
export async function signInWithPopup() {
  const u = T ? await T.pickUser() : null; /* キャンセル時は AbortError 相当 */
  if (!u) { const e = new Error('Firebase: Error (auth/popup-closed-by-user).'); e.code = 'auth/popup-closed-by-user'; throw e; }
  current = new FakeUser(u);
  setTimeout(notify, 0);
  return { user: current, providerId: 'google.com', operationType: 'signIn' };
}
export async function signOut() {
  if (T) T.setUser(null);
  current = null;
  setTimeout(notify, 0);
}
export function onAuthStateChanged(_auth, cb) {
  const fn = typeof cb === 'function' ? cb : (cb && cb.next ? cb.next.bind(cb) : () => {});
  listeners.add(fn);
  setTimeout(() => { try { fn(current); } catch (e) { console.error(e); } }, 0);
  return () => listeners.delete(fn);
}
export function browserLocalPersistence() {}
export async function setPersistence() {}
