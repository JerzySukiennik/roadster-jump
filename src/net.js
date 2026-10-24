// Roadster Jump multiplayer link: puts every player into one shared arena (rooms of up to eight fill in order) through the leaderboard's Firebase app (anonymous auth, RTDB roadsterJump/rooms and roadsterJump/live), sends this player's packed state up to ten times a second (once a second when still), listens for everyone else in the room and removes the entry on disconnect; ?mp=local swaps in a BroadcastChannel so tabs of one browser can play together for testing without the database.
const ROOM_MAX = 8, STALE_MS = 20000;

export class Net {
  constructor(online, opts = {}) {
    this.online = online; this.local = !!opts.local; this.uid = null; this.room = null; this.on = false; this.peers = new Map();
    this.onState = null; this.onLeave = null; this.lastSent = ''; this.lastT = 0; this.err = null;
  }

  async join(name) {
    if (this.on) return true;
    this.name = (name || 'Guest').slice(0, 16);
    if (this.local) {
      this.uid = 'L' + Math.random().toString(36).slice(2, 9); this.room = 'local';
      this.ch = new BroadcastChannel('roadster-jump-mp');
      this.ch.onmessage = (e) => { const m = e.data; if (!m || m.u === this.uid) return; if (m.bye) this.drop(m.u); else this.got(m.u, m.n, m.s); };
      addEventListener('pagehide', () => this.leave());
      this.on = true; this.watchdog(); return true;
    }
    if (!(await this.online.connect())) { this.err = this.online.err; return false; }
    const { ref, get, set, onDisconnect, serverTimestamp, onChildAdded, onChildChanged, onChildRemoved, remove } = this.online.db, d = this.online.d;
    this.uid = this.online.uid; this.fb = { ref, set, remove };
    try {
      const snap = await get(ref(d, 'roadsterJump/rooms')), rooms = snap.exists() ? snap.val() : {}, now = Date.now();
      let k = 1;
      for (; k < 100; k++) { const r = rooms['r' + k] || {}, n = Object.entries(r).filter(([u, t]) => u !== this.uid && now - t < 120000).length; if (n < ROOM_MAX) break; }
      this.room = 'r' + k;
      const me = ref(d, `roadsterJump/rooms/${this.room}/${this.uid}`), live = ref(d, `roadsterJump/live/${this.room}/${this.uid}`);
      await onDisconnect(me).remove(); await onDisconnect(live).remove();
      await set(me, serverTimestamp());
      this.meRef = me; this.liveRef = live; this.serverTs = serverTimestamp;
      const list = ref(d, `roadsterJump/live/${this.room}`), take = (c) => { if (c.key === this.uid) return; const v = c.val(); if (v && typeof v.s === 'string') this.got(c.key, v.n, v.s); };
      onChildAdded(list, take); onChildChanged(list, take); onChildRemoved(list, (c) => this.drop(c.key));
      this.beat = setInterval(() => { set(me, serverTimestamp()).catch(() => {}); }, 30000);
      addEventListener('pagehide', () => this.leave());
      this.on = true; this.watchdog(); return true;
    } catch (e) { this.err = e; return false; }
  }

  watchdog() { this.wd = setInterval(() => { const now = performance.now(); for (const [u, p] of this.peers) if (now - p.t > STALE_MS) this.drop(u); }, 5000); }

  got(u, n, s) {
    let p = this.peers.get(u);
    if (!p) { p = { u, n: '', t: 0 }; this.peers.set(u, p); }
    p.n = (n || 'Guest').slice(0, 16); p.t = performance.now();
    if (this.onState) this.onState(u, p.n, s, p.t);
  }

  drop(u) { if (!this.peers.has(u)) return; this.peers.delete(u); if (this.onLeave) this.onLeave(u); }

  send(s, moving) {
    if (!this.on) return;
    const now = performance.now(), gap = moving ? 100 : 1000, stopped = this.wasMoving && !moving;
    this.wasMoving = moving;
    if (!stopped && (now - this.lastT < gap || (s === this.lastSent && now - this.lastT < 3000))) return;
    this.lastT = now; this.lastSent = s;
    if (this.local) { this.ch.postMessage({ u: this.uid, n: this.name, s }); return; }
    this.fb.set(this.liveRef, { n: this.name, s, t: this.serverTs() }).catch((e) => { this.err = e; });
  }

  rename(name) { this.name = (name || 'Guest').slice(0, 16); this.lastSent = ''; }

  leave() {
    if (!this.on) return;
    this.on = false; clearInterval(this.wd); clearInterval(this.beat);
    if (this.local) { try { this.ch.postMessage({ u: this.uid, bye: true }); this.ch.close(); } catch (e) { /* closed */ } return; }
    try { this.fb.remove(this.liveRef); this.fb.remove(this.meRef); } catch (e) { /* offline */ }
  }

  get count() { return this.on ? this.peers.size + 1 : 0; }
}
