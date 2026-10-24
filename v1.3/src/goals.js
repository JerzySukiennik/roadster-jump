// Roadster Jump film stunts: the seven things the Roadster does in the film as a first-run checklist (get in, suction, climb to the ceiling, hang 5 s, ceiling launch, kickflip landing, the X), saved per browser, with the current step highlighted and its key shown.
const LIST = [
  ['in', 'Get in the Roadster', 'E'], ['fan', 'Turn on suction', 'F'], ['ceil', 'Drive up to the ceiling', 'W'], ['hang', 'Hang upside down for 5 s', 'S'],
  ['launch', 'Launch off the ceiling lip', 'W'], ['kick', 'Land a kickflip', '← →'], ['bull', 'Land on the X', 'Space'],
];
const TOUCH_KEY = { in: 'Get in', fan: 'F', ceil: 'Go', hang: 'Brake', launch: 'Go', kick: 'Stick', bull: 'Jets' };

export class Goals {
  constructor(show, onDone) {
    this.el = document.getElementById('goals'); this.list = document.getElementById('goalsList'); this.count = document.getElementById('goalsCount'); this.pill = document.getElementById('goalPill');
    this.onDone = onDone;
    try { this.done = new Set(JSON.parse(localStorage.getItem('rj.goals') || '[]')); } catch (e) { this.done = new Set(); }
    this.rows = new Map();
    for (const [id, text, key] of LIST) {
      const r = document.createElement('div'); r.className = 'goal'; r.innerHTML = `<i class="ck"></i><span></span><i class="gk"></i>`;
      r.children[1].textContent = text; r.children[2].textContent = key; this.list.appendChild(r); this.rows.set(id, r);
    }
    this.visible = show; this.render();
  }

  get all() { return this.done.size >= LIST.length; }

  hit(id) {
    if (this.done.has(id)) return;
    this.done.add(id);
    try { localStorage.setItem('rj.goals', JSON.stringify([...this.done])); } catch (e) { /* storage off */ }
    const r = this.rows.get(id); if (r) { r.classList.add('just'); setTimeout(() => r.classList.remove('just'), 800); }
    this.render();
    if (this.onDone) this.onDone(LIST.find((g) => g[0] === id)[1], this.all);
    if (this.all) setTimeout(() => { this.autoHidden = true; this.render(); }, 5000);
  }

  reset() { this.done.clear(); this.autoHidden = false; try { localStorage.removeItem('rj.goals'); } catch (e) { /* storage off */ } this.render(); }

  setVisible(v) { this.visible = v; this.autoHidden = false; this.render(); }

  render(touch) {
    let now = null;
    for (const [id] of LIST) { const r = this.rows.get(id), d = this.done.has(id); r.classList.toggle('done', d); r.classList.toggle('now', !d && !now); if (!d && !now) now = id; }
    this.count.textContent = `${this.done.size}/${LIST.length}`;
    this.el.classList.toggle('off', !this.visible || !!this.autoHidden);
    const g = LIST.find((x) => x[0] === now);
    this.pill.textContent = this.visible && g ? `${g[1]} · ${TOUCH_KEY[g[0]]}` : '';
  }
}
