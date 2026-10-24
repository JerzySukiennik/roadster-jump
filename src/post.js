// Roadster Jump post: the Film14 look in real time: HDR scene target (MSAA on desktop), optional depth of field for photo mode (packed depth pass, golden-angle gather sized by the circle of confusion), bright pass, three-level bloom, anamorphic streak, ACES, grade with contrast, tint and grain for the photo looks, vignette, with a cheaper chain on low quality and resize-aware targets.
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export class Post {
  constructor(renderer, Q) {
    this.r = renderer; this.Q = Q;
    this.fsScene = new THREE.Scene(); this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.fsq.frustumCulled = false; this.fsScene.add(this.fsq);
    this.bright = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { uTex: { value: null }, uTh: { value: 1.2 } }, vertexShader: VS,
      fragmentShader: 'varying vec2 vUv; uniform sampler2D uTex; uniform float uTh; void main(){ vec3 c = texture2D(uTex, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(min(c, vec3(40.0)) * smoothstep(uTh, uTh + 1.5, l), 1.0); }' });
    this.blur = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { uTex: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: VS,
      fragmentShader: `varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir;
void main(){ vec3 c = texture2D(uTex, vUv).rgb * 0.227027; float w[4]; w[0] = 0.1945946; w[1] = 0.1216216; w[2] = 0.054054; w[3] = 0.016216;
  for (int i = 0; i < 4; i++) { vec2 o = uDir * float(i + 1); c += (texture2D(uTex, vUv + o).rgb + texture2D(uTex, vUv - o).rgb) * w[i]; } gl_FragColor = vec4(c, 1.0); }` });
    this.final = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { uTex: { value: null }, uB1: { value: null }, uB2: { value: null }, uB3: { value: null }, uST: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uFlash: { value: 0 }, uExp: { value: 1.0 }, uBloom: { value: 0.27 }, uStreak: { value: Q.low ? 0 : 0.22 }, uT: { value: 0 }, uDim: { value: 0 }, uSat: { value: 1.06 }, uCon: { value: 1.05 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uGrain: { value: 0.02 }, uVig: { value: 2.4 } },
      vertexShader: VS,
      fragmentShader: `precision highp float; varying vec2 vUv;
uniform sampler2D uTex, uB1, uB2, uB3, uST; uniform vec2 uRes; uniform float uFlash, uExp, uBloom, uStreak, uT, uDim, uSat, uCon, uGrain, uVig; uniform vec3 uTint;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec3 col = texture2D(uTex, vUv).rgb;
  col += (texture2D(uB1, vUv).rgb * 0.6 + texture2D(uB2, vUv).rgb * 0.8 + texture2D(uB3, vUv).rgb * 1.0) * uBloom;
  col += texture2D(uST, vUv).rgb * vec3(0.55, 0.75, 1.25) * uStreak;
  col = aces(col * uExp);
  float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, uSat);
  col = mix(col, col * vec3(0.92, 1.0, 1.08), 1.0 - smoothstep(0.0, 0.35, l));
  col = ((col - 0.5) * uCon + 0.5) * uTint;
  col += vec3(1.0, 0.97, 0.94) * uFlash;
  vec2 vv = vUv - 0.5; col *= 1.0 - 0.42 * dot(vv * vec2(1.0, 0.7), vv * vec2(1.0, 0.7)) * uVig;
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col += (hash(vUv * uRes + uT) - 0.5) * uGrain;
  col *= 1.0 - uDim;
  gl_FragColor = vec4(col, 1.0); }` });
    this.dof = { on: false, focus: 8, blur: 0 };
    this.depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    this.dofMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { uTex: { value: null }, uDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 8 }, uBlur: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 1600 } }, vertexShader: VS,
      fragmentShader: `#include <packing>
varying vec2 vUv; uniform sampler2D uTex, uDepth; uniform vec2 uRes; uniform float uFocus, uBlur, uNear, uFar;
float dist(vec2 uv){ return -perspectiveDepthToViewZ(unpackRGBAToDepth(texture2D(uDepth, uv)), uNear, uFar); }
float coc(float z){ return clamp(abs(z - uFocus) / max(z, 0.05) * 2.2, 0.0, 1.0); }
void main(){ float z0 = dist(vUv), c0 = coc(z0), R = 26.0 * uBlur * (uRes.y / 1080.0);
  vec3 acc = texture2D(uTex, vUv).rgb; float ws = 1.0;
  for (int i = 0; i < 56; i++) { float fi = float(i) + 0.5, r = sqrt(fi / 56.0), a = fi * 2.39996;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * R * max(c0, 0.0) / uRes; float zs = dist(uv), cs = coc(zs);
    float w = zs >= z0 - 0.2 ? 1.0 : smoothstep(0.0, 1.0, cs * R / max(r * R * c0, 0.5));
    acc += texture2D(uTex, uv).rgb * w; ws += w; }
  gl_FragColor = vec4(acc / ws, 1.0); }` });
    this.w = 0; this.h = 0;
  }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    for (const k of ['RT', 'BR', 'B1a', 'B1b', 'B2a', 'B2b', 'B3a', 'B3b', 'STa', 'STb', 'DR', 'DF']) if (this[k]) { this[k].dispose(); this[k] = null; }
    this.RT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.Q.msaa || 0 });
    const mk = (a, b) => new THREE.WebGLRenderTarget(Math.max(4, Math.round(a)), Math.max(4, Math.round(b)), { type: THREE.HalfFloatType, depthBuffer: false });
    this.BR = mk(w / 2, h / 2); this.B1a = mk(w / 4, h / 4); this.B1b = mk(w / 4, h / 4); this.B2a = mk(w / 8, h / 8); this.B2b = mk(w / 8, h / 8);
    this.B3a = mk(w / 16, h / 16); this.B3b = mk(w / 16, h / 16); this.STa = mk(w / 4, h / 8); this.STb = mk(w / 4, h / 8);
    const u = this.final.uniforms;
    u.uTex.value = this.RT.texture; u.uB1.value = this.B1a.texture; u.uB2.value = this.B2a.texture; u.uB3.value = this.B3a.texture; u.uST.value = this.STa.texture; u.uRes.value.set(w, h);
  }

  pass(mat, target) { this.fsq.material = mat; this.r.setRenderTarget(target); this.r.render(this.fsScene, this.fsCam); }

  render(scene, camera, t) {
    const r = this.r, B = this.blur.uniforms;
    r.setRenderTarget(this.RT); r.setClearColor(0x000000, 1); r.clear(); r.render(scene, camera);
    let src = this.RT;
    if (this.dof.on && this.dof.blur > 0.005) {
      if (!this.DR) { this.DR = new THREE.WebGLRenderTarget(this.w, this.h); this.DF = new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.HalfFloatType, depthBuffer: false }); }
      const hidden = []; scene.traverse((o) => { if (o.visible && o.material && (o.isPoints || o.isLine || o.material.transparent || o.material.blending === THREE.AdditiveBlending)) { hidden.push(o); o.visible = false; } });
      const bg = scene.background; scene.background = null; scene.overrideMaterial = this.depthMat;
      r.setRenderTarget(this.DR); r.setClearColor(0xffffff, 1); r.clear(); r.render(scene, camera);
      scene.overrideMaterial = null; scene.background = bg; for (const o of hidden) o.visible = true;
      const U = this.dofMat.uniforms; U.uTex.value = this.RT.texture; U.uDepth.value = this.DR.texture; U.uRes.value.set(this.w, this.h); U.uFocus.value = this.dof.focus; U.uBlur.value = this.dof.blur; U.uNear.value = camera.near; U.uFar.value = camera.far;
      this.pass(this.dofMat, this.DF); src = this.DF;
    }
    this.final.uniforms.uTex.value = src.texture;
    this.bright.uniforms.uTex.value = src.texture; this.pass(this.bright, this.BR);
    const chain = [[this.BR, this.B1a, this.B1b], [this.B1a, this.B2a, this.B2b], [this.B2a, this.B3a, this.B3b]];
    for (const [src, a, b] of chain) { B.uTex.value = src.texture; B.uDir.value.set(1 / a.width, 0); this.pass(this.blur, b); B.uTex.value = b.texture; B.uDir.value.set(0, 1 / a.height); this.pass(this.blur, a); }
    if (!this.Q.low) {
      B.uTex.value = this.B1a.texture; let src = this.STa, dst = this.STb; B.uDir.value.set(2 / this.STa.width, 0); this.pass(this.blur, this.STa);
      for (const k of [6, 18, 48]) { B.uTex.value = src.texture; B.uDir.value.set(k / this.STa.width, 0); this.pass(this.blur, dst); [src, dst] = [dst, src]; }
      this.final.uniforms.uST.value = src.texture;
    }
    this.final.uniforms.uT.value = t;
    r.setRenderTarget(null); this.fsq.material = this.final; r.render(this.fsScene, this.fsCam);
  }
}
