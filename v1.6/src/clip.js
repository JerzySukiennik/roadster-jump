// Roadster Jump replay clips: records one pass of the TV replay straight from the WebGL canvas (captureStream) with the game's own mix (a MediaStream tap after the master compressor) into MP4 where the browser can, WebM otherwise, at a wide 16:9 or a vertical 9:16 size, then shows a looping preview card to save the file or send it through the share sheet.
const $ = (id) => document.getElementById(id);
const TYPES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export class Clips {
  constructor({ canvas, audio, touch, toast }) {
    this.canvas = canvas; this.audio = audio; this.touch = touch; this.toast = toast; this.mr = null; this.last = null;
    this.card = $('clip'); this.video = $('clipVideo');
    $('clipSave').addEventListener('click', () => this.save());
    $('clipDrop').addEventListener('click', () => this.hide());
    for (const ev of ['pointerdown', 'wheel', 'touchstart']) this.card.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  get supported() { return typeof MediaRecorder === 'function' && typeof this.canvas.captureStream === 'function'; }
  get recording() { return !!this.mr; }

  mime() { for (const t of TYPES) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) { /* unsupported */ } } return ''; }

  start(w, h) {
    this.hide();
    const vs = this.canvas.captureStream(60), tracks = [...vs.getVideoTracks()], as = this.audio.tap ? this.audio.tap() : null;
    if (as) tracks.push(...as.getAudioTracks());
    this.stream = new MediaStream(tracks); this.type = this.mime(); this.chunks = []; this.size = [w, h];
    const opts = { videoBitsPerSecond: Math.round(w * h * 60 * 0.11), audioBitsPerSecond: 160000 }; if (this.type) opts.mimeType = this.type;
    this.mr = new MediaRecorder(this.stream, opts);
    this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.mr.start(500); this.t0 = performance.now();
  }

  stop(keep = true) {
    return new Promise((res) => {
      const mr = this.mr; if (!mr) { res(null); return; }
      mr.onstop = () => {
        for (const t of this.stream.getVideoTracks()) t.stop();
        const type = (mr.mimeType || this.type || 'video/webm').split(';')[0], blob = new Blob(this.chunks, { type });
        this.chunks = []; this.mr = null;
        const r = keep && blob.size ? { blob, type, ext: type.includes('mp4') ? 'mp4' : 'webm', dur: (performance.now() - this.t0) / 1000, w: this.size[0], h: this.size[1] } : null;
        if (r) this.show(r);
        res(r);
      };
      try { mr.stop(); } catch (e) { this.mr = null; res(null); }
    });
  }

  show(r) {
    this.last = r; if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(r.blob); this.video.src = this.url;
    this.card.classList.toggle('tall', r.h > r.w);
    $('clipMeta').textContent = `${r.w > r.h ? '16:9' : '9:16'} · ${r.dur.toFixed(1)} s · ${(r.blob.size / 1048576).toFixed(1)} MB · ${r.ext.toUpperCase()}`;
    this.card.classList.remove('hidden'); void this.card.offsetWidth; this.card.classList.add('on');
    const p = this.video.play(); if (p && p.catch) p.catch(() => {});
  }

  hide() {
    if (!this.card.classList.contains('on')) return;
    this.card.classList.remove('on'); this.video.pause();
    setTimeout(() => { if (!this.card.classList.contains('on')) { this.card.classList.add('hidden'); this.video.removeAttribute('src'); this.video.load(); if (this.url) { URL.revokeObjectURL(this.url); this.url = null; } } }, 400);
  }

  async save() {
    const r = this.last; if (!r) return;
    const d = new Date(), p2 = (n) => String(n).padStart(2, '0'), name = `roadster-jump-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.${r.ext}`;
    const file = typeof File === 'function' ? new File([r.blob], name, { type: r.type }) : null;
    if (this.touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Roadster Jump' }); this.toast('Clip shared'); this.hide(); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    this.toast('Clip saved'); this.hide();
  }
}
