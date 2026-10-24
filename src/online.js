// Roadster Jump online leaderboards: lazily loaded Firebase (anonymous auth, shared gzowos-games RTDB under roadsterJump/), one best value per player on three boards (jump score, distance, rotation), top-10 queries and personal bests cached locally.
const SDK = 'https://www.gstatic.com/firebasejs/10.12.5';
const CONFIG = {
  apiKey: 'AIzaSyAaTuELH_mToxH3hRJ4WPIVTECSH7Z8-FY',
  authDomain: 'gzowos-games.firebaseapp.com',
  databaseURL: 'https://gzowos-games-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'gzowos-games',
  storageBucket: 'gzowos-games.firebasestorage.app',
  messagingSenderId: '658227201482',
  appId: '1:658227201482:web:627b44e3c4c2988bc4bb33',
};
export const BOARDS = [
  { id: 'score', label: 'Best jump', unit: 'pts', fmt: (v) => Math.round(v).toLocaleString('en-US') },
  { id: 'dist', label: 'Longest jump', unit: 'm', fmt: (v) => v.toFixed(1) },
  { id: 'spin', label: 'Most rotation', unit: '°', fmt: (v) => Math.round(v).toString() },
];
const LIMITS = { score: 200000, dist: 400, spin: 20000 };

export class Online {
  constructor() { this.p = null; this.ok = false; this.uid = null; this.err = null; this.best = this.loadBest(); }

  loadBest() { try { return JSON.parse(localStorage.getItem('rj.best') || '{}'); } catch (e) { return {}; } }
  saveBest() { try { localStorage.setItem('rj.best', JSON.stringify(this.best)); } catch (e) { /* storage off */ } }

  connect() {
    if (this.p) return this.p;
    this.p = (async () => {
      try {
        const [app, auth, db] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-database.js`)]);
        const a = app.initializeApp(CONFIG, 'roadster-jump');
        const cred = await auth.signInAnonymously(auth.getAuth(a));
        this.uid = cred.user.uid; this.db = db; this.d = db.getDatabase(a); this.ok = true;
      } catch (e) { this.err = e; this.ok = false; }
      return this.ok;
    })();
    return this.p;
  }

  improves(board, v) { return v > 0 && v <= LIMITS[board] && !(this.best[board] >= v); }

  async submit(name, values) {
    const changed = [];
    for (const [b, v] of Object.entries(values)) if (this.improves(b, v)) { this.best[b] = v; changed.push(b); }
    if (!changed.length) return changed;
    this.saveBest();
    if (!name || !(await this.connect())) return changed;
    const { ref, set, serverTimestamp, get } = this.db;
    for (const b of changed) {
      try {
        const r = ref(this.d, `roadsterJump/scores/${b}/${this.uid}`);
        const cur = await get(r);
        if (cur.exists() && cur.val().v >= values[b]) continue;
        await set(r, { n: name.slice(0, 16), v: values[b], t: serverTimestamp() });
      } catch (e) { this.err = e; }
    }
    return changed;
  }

  async rename(name) {
    if (!name || !(await this.connect())) return;
    const { ref, update } = this.db;
    for (const b of BOARDS) if (this.best[b.id]) { try { await update(ref(this.d, `roadsterJump/scores/${b.id}/${this.uid}`), { n: name.slice(0, 16) }); } catch (e) { /* not on that board */ } }
  }

  async top(board, n = 10) {
    if (!(await this.connect())) return null;
    const { ref, query, orderByChild, limitToLast, get } = this.db;
    try {
      const snap = await get(query(ref(this.d, `roadsterJump/scores/${board}`), orderByChild('v'), limitToLast(n)));
      const out = []; snap.forEach((c) => { out.push({ uid: c.key, ...c.val() }); });
      return out.sort((a, b) => b.v - a.v);
    } catch (e) { this.err = e; return null; }
  }
}
