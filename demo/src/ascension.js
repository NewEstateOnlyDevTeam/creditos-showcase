// The Ascension: a ~10-second scripted cinematic for the moment every house is won
// (or as a preview of it). Cut like a trailer: the houses ignite up the stair, the
// knight races past them, Athena erupts, the knight rises through rings of light
// into a golden heaven, white-out to the title. Time comes from the wall clock, so
// picture, score and on-screen titles stay in sync even when frames drop.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { outward, spot, spark } from './sanctuary.js';

export const CUT = { climb: 2.3, athena: 4.7, erupt: 5.3, rise: 7.0, white: 8.2, title: 8.9, end: 9.9 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = THREE.MathUtils.lerp;
const GOLD = new THREE.Color('#ffb238');
const HEAVEN_FOG = new THREE.Color('#ffe2a8');
const UP = new THREE.Vector3(0, 1, 0);
const CALM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; // no roll or shake

// Film grade on top of the final image: lens fringing, anamorphic streaks,
// teal/orange split-tone, vignette and grain.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 1 }, uTime: { value: 0 }, uCA: { value: 0.006 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmt, uTime, uCA; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r = length(d);
      vec2 off = d * r * uCA;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      vec3 st = vec3(0.);
      for (int i = 1; i <= 14; i++) {
        float o = float(i) * 0.0065, w = 1. - float(i) / 15.;
        st += (max(texture2D(tDiffuse, vUv + vec2(o, 0.)).rgb - 0.82, 0.) + max(texture2D(tDiffuse, vUv - vec2(o, 0.)).rgb - 0.82, 0.)) * w;
      }
      c += st * vec3(0.45, 0.65, 1.0) * 0.22 * uAmt;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c *= mix(vec3(1.), mix(vec3(0.92, 1.0, 1.06), vec3(1.07, 1.0, 0.9), smoothstep(0.15, 0.75, l)), uAmt);
      c *= mix(1., 1. - smoothstep(0.35, 0.85, r) * 0.55, uAmt);
      c += (rnd(vUv * 997. + fract(uTime * 13.7)) - 0.5) * 0.05 * uAmt;
      gl_FragColor = vec4(c, 1.);
    }`,
};

export class Ascension {
  constructor(s) {
    this.s = s;
    this.playing = false;
    this.flying = 0; // read by the Sanctuary for the knight's lean and wing beat
    this.spread = 0; // wings thrown wide
    this.grade = new ShaderPass(GradeShader);
    this.grade.enabled = false;
    s.composer.addPass(this.grade);
    this.build();
  }

  build() {
    const s = this.s, A = s.athena.position;
    const add = (hex, k) => ({ color: new THREE.Color(hex).multiplyScalar(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.group = new THREE.Group();
    this.group.visible = false;
    s.scene.add(this.group);
    // rings of light stacked up Athena's axis: the gate to heaven
    this.rings = [];
    const ringMat = new THREE.MeshBasicMaterial(add('#ffcf5a', 3));
    for (let i = 0; i < 18; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(6 + (i % 3) * 0.9, 0.08, 8, 120), ringMat);
      r.rotation.x = Math.PI / 2;
      r.position.set(A.x, A.y + 16 + i * 9, A.z);
      this.group.add(r);
      this.rings.push(r);
    }
    this.ringMat = ringMat;
    // warp streaks around the axis
    const W = 800, wp = new Float32Array(W * 6);
    for (let i = 0; i < W; i++) {
      const a = Math.random() * Math.PI * 2, rad = 3 + Math.random() * 24, y = A.y - 10 + Math.random() * 220, len = 2 + Math.random() * 7;
      const x = A.x + Math.cos(a) * rad, z = A.z + Math.sin(a) * rad;
      wp.set([x, y, z, x, y + len, z], i * 6);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
    this.warp = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ ...add('#ffe6a0', 2), opacity: 0 }));
    this.warp.frustumCulled = false;
    this.group.add(this.warp);
    // comet trail behind the knight
    const T = this.trailN = 150;
    const tg = new THREE.BufferGeometry(), tc = new Float32Array(T * 3);
    for (let i = 0; i < T; i++) { const k = Math.pow(1 - i / T, 1.6) * 2.6; tc.set([GOLD.r * k, GOLD.g * k, GOLD.b * k], i * 3); }
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    this.trail = new THREE.Points(tg, new THREE.PointsMaterial({ size: 0.5, map: spark(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.trail.frustumCulled = false;
    this.group.add(this.trail);
  }

  /** Play the cinematic. Resolves when it ends (or is skipped). */
  play({ preview = false } = {}) {
    if (this.playing) return this.done;
    const s = this.s, A = s.athena.position, cam = s.camera;
    this.preview = preview;
    this.saved = {
      exposure: s.renderer.toneMappingExposure, bloom: s.bloom.strength, fog: s.scene.fog.color.clone(),
      density: s.scene.fog.density, fov: cam.fov, path: s.pathMat.color.clone(),
    };
    // Flight line: every house in order, then Athena's feet (approached from the last house).
    const lastSpot = spot(s.last);
    const dir = new THREE.Vector3(lastSpot.x - A.x, 0, lastSpot.z - A.z).normalize();
    this.front = A.clone().addScaledVector(dir, 7.5).add(new THREE.Vector3(0, 1.4, 0));
    this.face = Math.atan2(-dir.x, -dir.z); // knight turned toward Athena
    const pts = s.temples.map((_, i) => spot(i));
    pts.push(this.front);
    this.path = new THREE.CatmullRomCurve3(pts);
    s.knight.position.copy(spot(0));
    const tp = this.trail.geometry.attributes.position;
    for (let i = 0; i < this.trailN; i++) tp.setXYZ(i, s.knight.position.x, s.knight.position.y + 1.4, s.knight.position.z);
    tp.needsUpdate = true;
    this.fired = new Set();
    this.shot = null;
    this.group.visible = true;
    this.grade.enabled = true;
    if (s.athenaLabel) s.athenaLabel.visible = false; // HUD text doesn't belong in the film
    this.start = performance.now();
    this.playing = true;
    this.done = new Promise((r) => { this.resolve = r; });
    return this.done;
  }

  time() { return (performance.now() - this.start) / 1000; }

  /** Jump to the end (title fades out). */
  skip() { if (this.playing) this.start = Math.min(this.start, performance.now() - CUT.end * 1000); }

  update(dt) {
    const s = this.s, t = this.time();
    s.hooks.onCine?.(t);
    if (t >= CUT.end) { this.finish(); return; }
    const A = s.athena.position, K = s.knight, cam = s.camera;

    // --- houses: dark, then igniting one by one up the stair
    const n = s.temples.length;
    // a light column the camera is about to fly through fades out instead of filling the frame
    const near = (p) => smooth(3, 10, Math.hypot(cam.position.x - p.x, cam.position.z - p.z));
    s.temples.forEach((tp, i) => {
      const ti = 0.25 + (i / n) * 1.75;
      const ig = smooth(ti, ti + 0.35, t), fl = t > ti ? Math.exp(-(t - ti) * 3.5) : 0;
      if (t > ti && !this.fired.has(i)) { this.fired.add(i); s.burst(tp.group.position.clone().add(new THREE.Vector3(0, 2, 0)), { n: 180, speed: 7, life: 1.4, k: 1.4 }); }
      tp.flame.material.color.copy(GOLD).multiplyScalar(0.25 + 2.2 * ig + 1.5 * fl);
      tp.flame.scale.setScalar(1 + fl * 1.6);
      tp.light.color.copy(GOLD);
      tp.light.intensity = 3 + 30 * ig + 45 * fl;
      tp.beam.material.uniforms.uColor.value.copy(GOLD);
      tp.beam.material.uniforms.uPower.value = (0.04 + 0.9 * ig + 1.1 * fl) * near(tp.group.position);
      tp.rim.material.color.copy(GOLD).multiplyScalar(0.3 + 2.7 * ig);
    });
    s.pathMat.color.copy(this.saved.path).lerp(new THREE.Color(GOLD).multiplyScalar(3), smooth(CUT.climb, CUT.athena, t));

    // --- Athena erupts
    const er = smooth(CUT.erupt, CUT.erupt + 0.5, t);
    s.athenaMat.emissive.copy(GOLD);
    s.athenaMat.emissiveIntensity = 0.05 + 0.15 * er;
    s.athenaHalo.material.color.copy(GOLD).multiplyScalar(0.6 + 1.6 * er);
    s.athenaHalo.scale.setScalar(1 + 0.6 * er);
    const settle = t > CUT.erupt ? 0.3 + 0.9 * Math.exp(-(t - CUT.erupt) * 2.5) : 1; // flash, then a column the camera can look through
    s.athenaBeam.material.uniforms.uPower.value = (0.05 + 1.2 * er * settle) * near(A);
    if (t >= CUT.erupt && !this.fired.has('erupt')) {
      this.fired.add('erupt');
      s.burst(A.clone().add(new THREE.Vector3(0, 6, 0)), { n: 1000, speed: 26, life: 3.2, size: 0.26, k: 1.3 });
      s.shake = 0.9;
    }

    // --- the heavens open
    const up = smooth(CUT.rise + 0.3, CUT.white + 0.4, t);
    const flash = t > CUT.erupt ? Math.exp(-(t - CUT.erupt) * 5) : 0;
    s.dome.material.uniforms.uAscend.value = up;
    s.scene.fog.color.copy(this.saved.fog).lerp(HEAVEN_FOG, up);
    s.scene.fog.density = this.saved.density * (1 - 0.75 * up);
    s.renderer.toneMappingExposure = this.saved.exposure * (1 + 0.15 * er + 0.9 * up + 0.35 * flash);
    s.bloom.strength = this.saved.bloom * (1 - 0.3 * er * (1 - up)) + 1.2 * up + 0.5 * flash; // eased off for the close hero shot
    this.grade.uniforms.uTime.value = t;
    this.grade.uniforms.uCA.value = 0.005 + 0.02 * up + 0.03 * flash;
    const gate = smooth(CUT.rise - 0.2, CUT.rise + 0.4, t);
    this.warp.material.opacity = gate * 0.9;
    this.ringMat.opacity = gate;
    this.rings.forEach((r, i) => { r.scale.setScalar(1 + 0.08 * Math.sin(t * 6 + i)); });

    // --- shots: knight + camera
    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    let fov = 45, roll = 0, shot;
    if (t < CUT.climb) { // 1 · Ignition: slow crane up the spiral
      shot = 1;
      const u = easeIO(t / CUT.climb), bottom = spot(0).y, ang = lerp(-0.2, 0.45, u), R = lerp(46, 40, u);
      K.position.copy(spot(0));
      K.rotation.y = Math.atan2(K.position.x, K.position.z) - 0.35;
      this.flying = 0; this.spread = 0;
      pos.set(Math.cos(ang) * R, lerp(bottom - 14, bottom + 12, u), Math.sin(ang) * R);
      look.set(0, lerp(bottom + 2, (bottom + A.y) / 2 + 2, u), 0);
    } else if (t < CUT.athena) { // 2 · The climb: chase cam racing past every house
      shot = 2;
      const u = easeIO((t - CUT.climb) / (CUT.athena - CUT.climb));
      const p = this.path.getPointAt(u), tan = this.path.getTangentAt(Math.min(0.999, Math.max(0.001, u)));
      K.position.copy(p).add(new THREE.Vector3(0, Math.sin(u * Math.PI) * 1.5, 0));
      K.rotation.y = Math.atan2(tan.x, tan.z);
      this.flying = 1; this.spread = 0;
      pos.copy(K.position).addScaledVector(tan, -7).add(new THREE.Vector3(0, 2.4, 0)).addScaledVector(outward(K.position), 2.5);
      look.copy(K.position).addScaledVector(tan, 5).add(new THREE.Vector3(0, 1, 0));
      fov = 55 + 20 * Math.sin(u * Math.PI);
      roll = -0.15 * Math.sin(u * Math.PI * 2);
    } else if (t < CUT.rise) { // 3 · Athena: low hero angle, slow orbit; she erupts
      shot = 3;
      const k = easeIO((t - CUT.athena) / (CUT.rise - CUT.athena));
      K.position.copy(this.front).add(new THREE.Vector3(0, 0.3 * Math.sin(t * 2) + 1.5 * k, 0));
      K.rotation.y = this.face;
      this.flying = 1 - smooth(CUT.athena, CUT.athena + 0.5, t);
      this.spread = smooth(CUT.erupt - 0.3, CUT.erupt + 0.3, t);
      const M = this.front.clone().lerp(A.clone().add(new THREE.Vector3(0, 5, 0)), 0.45);
      const base = Math.atan2(this.front.z - A.z, this.front.x - A.x), ang = base + lerp(0.9, 0.35, k), R = lerp(17, 13, k);
      pos.copy(M).add(new THREE.Vector3(Math.cos(ang) * R, lerp(-3.5, 0.5, k), Math.sin(ang) * R));
      look.copy(M).add(new THREE.Vector3(0, 1.2, 0));
      fov = 38;
    } else { // 4 · Transcend: up the beam, through the rings, into the light
      shot = 4;
      const sr = Math.min(1.15, (t - CUT.rise) / (CUT.title - CUT.rise)), m = easeIO(Math.min(1, sr * 2.2));
      K.position.set(lerp(this.front.x, A.x, m), this.front.y + 1.5 + 3 * sr + 150 * Math.pow(sr, 2.4), lerp(this.front.z, A.z, m));
      K.rotation.y = this.face + sr * 2;
      this.flying = 1; this.spread = 1;
      // starts level with the knight and clear of Athena's platform, then drops beneath
      // them once they're airborne, looking up the ring stack
      const out = Math.atan2(this.front.z - A.z, this.front.x - A.x), oa = out + 0.9 + sr * 1.2, orad = lerp(9, 4, m), dy = lerp(-1, -10, smooth(0.12, 0.6, sr));
      pos.copy(K.position).add(new THREE.Vector3(Math.cos(oa) * orad, dy, Math.sin(oa) * orad));
      look.copy(K.position).add(new THREE.Vector3(0, 6, 0));
      fov = 60 + 40 * Math.min(1, sr);
    }
    if (shot !== this.shot) { this.shot = shot; s.hooks.onCineShot?.(shot); }

    // comet trail
    const tp = this.trail.geometry.attributes.position, arr = tp.array;
    arr.copyWithin(3, 0, arr.length - 3);
    arr[0] = K.position.x; arr[1] = K.position.y + 1.4; arr[2] = K.position.z;
    tp.needsUpdate = true;
    this.trail.visible = shot > 1;

    if (CALM) roll = 0;
    else if (s.shake > 0) pos.add(new THREE.Vector3().randomDirection().multiplyScalar(s.shake * 0.45));
    cam.position.copy(pos);
    cam.up.copy(UP);
    cam.lookAt(look);
    if (roll) cam.rotateZ(roll);
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  /** Put the world back exactly as it was and hand control back to the Sanctuary. */
  finish() {
    if (!this.playing) return;
    const s = this.s, cam = s.camera, sv = this.saved;
    this.playing = false;
    this.flying = 0; this.spread = 0;
    this.group.visible = false;
    this.grade.enabled = false;
    if (s.athenaLabel) s.athenaLabel.visible = true;
    s.renderer.toneMappingExposure = sv.exposure;
    s.bloom.strength = sv.bloom;
    s.scene.fog.color.copy(sv.fog);
    s.scene.fog.density = sv.density;
    s.dome.material.uniforms.uAscend.value = 0;
    s.pathMat.color.copy(sv.path);
    s.athenaHalo.scale.setScalar(1);
    s.temples.forEach((tp) => tp.flame.scale.setScalar(1));
    cam.fov = sv.fov; cam.updateProjectionMatrix();
    if (s.prevStates) s.setStates(s.prevStates);
    s.fly = null;
    s.knight.position.copy(spot(s.index));
    s.placeCamera(true);
    s.hooks.onCineEnd?.();
    this.resolve();
  }
}
