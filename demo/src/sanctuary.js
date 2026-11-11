// Santuario: the 12 disputes as the 12 Zodiac Houses on a stair spiralling up
// through space to Athena's temple. A Gold-Cloth knight (the user) flies house to
// house; each house's beam turns gold as its dispute is won.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Ascension } from './ascension.js';

export const ZODIAC = [
  ['♈', 'Aries'], ['♉', 'Tauro'], ['♊', 'Géminis'], ['♋', 'Cáncer'], ['♌', 'Leo'], ['♍', 'Virgo'],
  ['♎', 'Libra'], ['♏', 'Escorpio'], ['♐', 'Sagitario'], ['♑', 'Capricornio'], ['♒', 'Acuario'], ['♓', 'Piscis'],
];
const STATE_COLOR = { todo: '#4a6cff', mailed: '#38bdf8', partial: '#ffd479', won: '#ffb238', verified: '#ff4d6d' };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const glow = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
// Soft round sprite for sparks (bare Points render as squares, which shows up close).
let sparkTex;
export const spark = () => sparkTex || (sparkTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})());

export const housePos = (i) => {
  const a = i * 0.95 - 0.6;
  return new THREE.Vector3(Math.cos(a) * 16, i * 3.4 - 18, Math.sin(a) * 16);
};
export const outward = (p) => new THREE.Vector3(p.x, 0, p.z).normalize();
// Where the knight hovers at house i: on the path, just in front of the temple.
export const spot = (i) => { const h = housePos(i); return h.clone().add(outward(h).multiplyScalar(5.5)).add(new THREE.Vector3(0, 1.2, 0)); };

// Additive vertical light beam, fading upward.
export const beamMat = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: 0.35 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uPower, uTime;
    void main(){
      float fade = pow(1. - vUv.y, 2.2);
      float streak = 0.75 + 0.25 * sin(vUv.x * 62.83 * 3. + uTime * 0.8);
      float a = fade * streak * uPower;
      gl_FragColor = vec4(uColor * a * 2., a);
    }`,
});

export class Sanctuary {
  /** houses: [{ id, title }] in climbing order; hooks.onArrive(index), hooks.onConquer(index) */
  constructor({ canvas, houses, hooks }) {
    this.houses = houses.slice(0, 12); // one house per zodiac sign
    this.last = this.houses.length - 1;
    this.hooks = hooks;
    this.index = 0;
    this.active = false;
    this.timer = new THREE.Timer();
    this.bursts = [];
    this.shake = 0;
    this.prevStates = null;

    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.85;
    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070722, 0.011);
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    pm.dispose();
    scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x2a1240, 0.35));
    const sun = new THREE.DirectionalLight(0xffe2b0, 1.2);
    sun.position.set(20, 40, 10);
    scene.add(sun);
    this.rim = new THREE.PointLight(0x9fc4ff, 30, 12);
    scene.add(this.rim);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 800);

    this.buildSky();
    this.buildPath();
    this.buildHouses();
    this.buildAthena();
    this.buildKnight();

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    // Cap HDR values before bloom: thousands of overlapping additive sparks can overflow
    // half-float (Inf), and the bloom blur then smears that over the whole frame.
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(clamp(c.rgb, 0., 16.), c.a); }',
    }));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.6, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.cine = new Ascension(this); // the ending cinematic (adds its own grade pass)

    this.knight.position.copy(spot(0));
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.placeCamera(true);

    canvas.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // ---------------------------------------------------------------- sky
  buildSky() {
    const N = 6000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(150 + Math.random() * 300);
      pos.set([v.x, v.y, v.z], i * 3);
      c.setHSL(0.55 + Math.random() * 0.25, 0.6, 0.55 + Math.random() * 0.45);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    this.scene.add(this.stars);
    // Nebula dome with a galactic band and a golden cosmos core
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(600, 64, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uAscend: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; uniform float uTime, uAscend;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float fbm(vec3 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
        void main(){
          float band = exp(-pow((vP.y - vP.x*0.35) * 2.6, 2.));
          float cl = fbm(vP * 4. + vec3(0., uTime*0.01, 0.));
          vec3 c = vec3(0.012,0.012,0.045);
          c += vec3(0.20,0.07,0.34) * band * (0.5 + cl);
          c += vec3(0.05,0.12,0.30) * smoothstep(0.45, 0.9, cl) * 0.8;
          c += vec3(0.9,0.55,0.18) * pow(band, 8.) * cl * 0.5;
          vec3 heaven = mix(vec3(1.0,0.72,0.38), vec3(1.0,0.96,0.86), smoothstep(-0.2, 0.9, vP.y)) * (0.75 + 0.5 * cl);
          c = mix(c, heaven, uAscend);
          gl_FragColor = vec4(c, 1.); }`,
    }));
    this.scene.add(this.dome);
    // Drifting cosmos motes across the whole climb
    const M = 900, mp = new Float32Array(M * 3);
    for (let i = 0; i < M; i++) mp.set([(Math.random() - 0.5) * 60, Math.random() * 70 - 25, (Math.random() - 0.5) * 60], i * 3);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.12, color: glow('#ffd98a', 1.4), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.scene.add(this.motes);
  }

  buildPath() {
    const pts = this.houses.map((_, i) => housePos(i));
    const nh = this.houses.length;
    pts.push(new THREE.Vector3(0, nh * 3.4 - 13, 0)); // up to Athena
    const walk = pts.slice(0, nh);
    if (nh === 1) walk.push(housePos(0.35)); // a curve needs two points
    this.curve = new THREE.CatmullRomCurve3(walk);
    this.summitCurve = new THREE.CatmullRomCurve3(pts);
    this.pathMat = new THREE.MeshBasicMaterial({ color: glow('#9ec5ff', 2), toneMapped: false, transparent: true, opacity: 0.6 });
    this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(this.summitCurve, 500, 0.06, 8, false), this.pathMat));
    const stone = new THREE.BoxGeometry(1.5, 0.2, 0.75);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.5 });
    const n = 170, inst = new THREE.InstancedMesh(stone, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const t = i / n, p = this.summitCurve.getPointAt(t), tan = this.summitCurve.getTangentAt(t);
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(tan.x, 0, tan.z).normalize());
      m.compose(p.add(new THREE.Vector3(0, -0.3, 0)), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(i, m);
    }
    this.scene.add(inst);
  }

  // ---------------------------------------------------------------- houses
  buildHouses() {
    const marble = new THREE.MeshPhysicalMaterial({ color: 0xcfc8ba, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: 0x1a1830, emissiveIntensity: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe0b04c, roughness: 0.22, metalness: 1, emissive: 0x3a2400, emissiveIntensity: 0.6 });
    const colGeo = new THREE.CylinderGeometry(0.2, 0.24, 3, 16);
    const capGeo = new THREE.TorusGeometry(0.28, 0.07, 8, 20);
    this.temples = this.houses.map((h, i) => {
      const g = new THREE.Group();
      g.position.copy(housePos(i));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.9, 0.5, 40), marble));
      const step = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.3, 0.3, 40), marble);
      step.position.y = -0.4; g.add(step);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.05, 8, 80), new THREE.MeshBasicMaterial({ color: glow(STATE_COLOR.todo, 2), toneMapped: false }));
      rim.rotation.x = Math.PI / 2; rim.position.y = -0.55; g.add(rim);
      for (let c = 0; c < 10; c++) {
        const a = (c / 10) * Math.PI * 2;
        const col = new THREE.Mesh(colGeo, marble);
        col.position.set(Math.cos(a) * 2.8, 1.75, Math.sin(a) * 2.8);
        g.add(col);
        for (const y of [0.3, 3.2]) {
          const cap = new THREE.Mesh(capGeo, gold);
          cap.rotation.x = Math.PI / 2; cap.position.set(Math.cos(a) * 2.8, y, Math.sin(a) * 2.8);
          g.add(cap);
        }
      }
      const ent = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 0.35, 40), marble);
      ent.position.y = 3.5; g.add(ent);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(3.28, 3.28, 0.1, 40, 1, true), gold);
      band.position.y = 3.5; g.add(band);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.7, 1.7, 10), marble);
      roof.position.y = 4.5; g.add(roof);
      const fin = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), gold);
      fin.position.y = 5.6; fin.scale.y = 1.8; g.add(fin);
      // inner cosmos orb (the house's flame)
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 24), new THREE.MeshBasicMaterial({ color: glow(STATE_COLOR.todo, 1.2), toneMapped: false }));
      flame.position.y = 1.8; g.add(flame);
      const light = new THREE.PointLight(STATE_COLOR.todo, 12, 12);
      light.position.y = 2; g.add(light);
      // beam into the sky
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 0.6, 70, 32, 1, true), beamMat(STATE_COLOR.todo));
      beam.geometry.translate(0, 35, 0); beam.position.y = 5.5; g.add(beam);
      // rotating zodiac ring under the platform
      const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.6, 96), new THREE.MeshBasicMaterial({ map: zodiacRingTexture(i), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -0.9; g.add(ring);
      const glyph = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(ZODIAC[i][0], h.id, ZODIAC[i][1]), transparent: true, depthWrite: false, toneMapped: false }));
      glyph.scale.set(4.2, 2.1, 1); glyph.position.y = 7.4; g.add(glyph);
      g.traverse((o) => { o.userData.house = i; });
      this.scene.add(g);
      return { group: g, flame, light, beam, ring, rim, glyph, state: 'todo' };
    });
  }

  buildAthena() {
    const g = this.athena = new THREE.Group();
    g.position.set(0, this.houses.length * 3.4 - 13, 0);
    const marble = new THREE.MeshPhysicalMaterial({ color: 0xe9e3d6, roughness: 0.3, clearcoat: 0.6 });
    this.athenaMat = new THREE.MeshStandardMaterial({ color: 0xf6e7c1, roughness: 0.3, metalness: 0.4, emissive: 0x000000 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(6, 6.8, 0.8, 48), marble));
    const robe = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(1.6, 0), new THREE.Vector2(1.3, 2), new THREE.Vector2(0.9, 4.5), new THREE.Vector2(1.1, 5.4), new THREE.Vector2(0.6, 6.2), new THREE.Vector2(0.01, 6.3),
    ], 40), this.athenaMat);
    robe.position.y = 0.4; g.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 20), this.athenaMat);
    head.position.y = 7.1; g.add(head);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 8, 10), this.athenaMat);
    staff.position.set(1.6, 4.2, 0.4); g.add(staff);
    const nike = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), this.athenaMat);
    nike.position.set(1.6, 8.4, 0.4); g.add(nike);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.12, 40), this.athenaMat);
    shield.rotation.z = Math.PI / 2; shield.position.set(-1.7, 2.6, 0.3); g.add(shield);
    this.athenaHalo = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 8, 60), new THREE.MeshBasicMaterial({ color: glow('#8899cc', 1), toneMapped: false }));
    this.athenaHalo.position.set(0, 7.2, -0.4); g.add(this.athenaHalo);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture('✦', 'ARCHIVO LIMPIO', 'Atenea'), transparent: true, depthWrite: false, toneMapped: false }));
    label.scale.set(6, 3, 1); label.position.y = 10.5; g.add(label);
    this.athenaLabel = label;
    this.athenaBeam = new THREE.Mesh(new THREE.CylinderGeometry(4, 1.2, 120, 40, 1, true), beamMat('#ffd98a'));
    this.athenaBeam.geometry.translate(0, 60, 0); this.athenaBeam.material.uniforms.uPower.value = 0.05;
    g.add(this.athenaBeam);
    this.scene.add(g);
  }

  // ---------------------------------------------------------------- the Gold Saint
  buildKnight() {
    const k = this.knight = new THREE.Group();
    const body = this.body = new THREE.Group();
    k.add(body);
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xf5c451, metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 2.4, emissive: 0x3d2600, emissiveIntensity: 0.5 });
    const suit = new THREE.MeshStandardMaterial({ color: 0x14163a, roughness: 0.55 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a57f, roughness: 0.6 });
    const hairM = new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 0.7 });
    const gemM = new THREE.MeshBasicMaterial({ color: glow('#ff3b5c', 3), toneMapped: false });
    const add = (geo, mat, [x, y, z], s = [1, 1, 1], r = [0, 0, 0], parent = body) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(...s); m.rotation.set(...r); parent.add(m); return m;
    };
    const plate = (w, h, d = 0.05) => new THREE.BoxGeometry(w, h, d);
    const extrude = (shape, depth = 0.04) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });

    // under-suit
    add(new THREE.CapsuleGeometry(0.3, 0.55, 6, 16), suit, [0, 1.3, 0], [1.05, 1, 0.8]);
    for (const sx of [-1, 1]) {
      add(new THREE.CapsuleGeometry(0.12, 0.62, 6, 12), suit, [sx * 0.16, 0.62, 0]);
      add(new THREE.CapsuleGeometry(0.085, 0.5, 6, 12), suit, [sx * 0.46, 1.3, 0], [1, 1, 1], [0, 0, sx * 0.18]);
    }
    // breastplate + gem + abdominal plates + belt
    const chest = new THREE.LatheGeometry([
      new THREE.Vector2(0.01, 0), new THREE.Vector2(0.3, 0.02), new THREE.Vector2(0.38, 0.18), new THREE.Vector2(0.37, 0.36), new THREE.Vector2(0.28, 0.46), new THREE.Vector2(0.12, 0.5),
    ], 32, -Math.PI / 2 - 1.3, 2.6);
    add(chest, gold, [0, 1.42, 0.02], [1.15, 1, 0.9]);
    add(new THREE.OctahedronGeometry(0.07), gemM, [0, 1.66, 0.33], [1, 1.4, 0.6]);
    for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) add(plate(0.15, 0.09, 0.06), gold, [sx * 0.085, 1.33 - r * 0.1, 0.24], [1, 1, 1], [0.1, 0, 0]);
    add(new THREE.TorusGeometry(0.27, 0.04, 8, 30), gold, [0, 1.02, 0], [1.05, 1, 0.8], [Math.PI / 2, 0, 0]);
    add(new THREE.OctahedronGeometry(0.06), gemM, [0, 1.02, 0.23]);
    // tassets (skirt plates)
    for (let t = 0; t < 6; t++) {
      const a = -1.2 + t * 0.48;
      add(plate(0.16, 0.3, 0.035), gold, [Math.sin(a) * 0.27, 0.85, Math.cos(a) * 0.23], [1, 1, 1], [0.25, a, 0]);
    }
    add(plate(0.5, 0.45, 0.06), gold, [0, 1.55, -0.2], [1, 1, 1], [-0.1, 0, 0]); // back plate
    // layered pauldrons with spikes, bracers, gauntlets, knees, greaves, sabatons
    for (const sx of [-1, 1]) {
      for (let l = 0; l < 3; l++) {
        add(new THREE.SphereGeometry(0.23 - l * 0.03, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold,
          [sx * (0.46 + l * 0.05), 1.72 - l * 0.08, 0], [1.2, 0.7, 1], [0, 0, sx * (0.35 + l * 0.15)]);
      }
      add(new THREE.ConeGeometry(0.05, 0.28, 8), gold, [sx * 0.62, 1.84, 0], [1, 1, 1], [0, 0, -sx * 0.9]);
      add(new THREE.CylinderGeometry(0.1, 0.085, 0.3, 14), gold, [sx * 0.54, 1.05, 0], [1, 1, 1], [0, 0, sx * 0.18]);
      add(new THREE.SphereGeometry(0.09, 12, 10), gold, [sx * 0.58, 0.86, 0.02]);
      add(new THREE.SphereGeometry(0.1, 14, 10), gold, [sx * 0.16, 0.6, 0.05], [1, 1, 0.9]);
      add(new THREE.CylinderGeometry(0.12, 0.1, 0.42, 14), gold, [sx * 0.16, 0.34, 0]);
      add(new THREE.ConeGeometry(0.08, 0.2, 10), gold, [sx * 0.16, 0.44, 0.1], [1, 1, 0.6], [0.2, 0, 0]);
      add(new THREE.BoxGeometry(0.16, 0.1, 0.3), gold, [sx * 0.16, 0.08, 0.06]);
    }
    // head, spiky hair, tiara helmet with crest and side fins
    add(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 12), skin, [0, 1.85, 0]);
    add(new THREE.SphereGeometry(0.19, 24, 18), skin, [0, 2.02, 0], [0.95, 1.08, 1]);
    for (let s = 0; s < 9; s++) {
      const a = (s / 9) * Math.PI * 2;
      add(new THREE.ConeGeometry(0.07, 0.34, 6), hairM, [Math.sin(a) * 0.12, 2.12 + (s % 3) * 0.015, Math.cos(a) * 0.1 - 0.06], [1, 1, 1], [Math.cos(a) * -0.9 - 0.5, 0, Math.sin(a) * 0.9]);
    }
    add(new THREE.TorusGeometry(0.2, 0.035, 8, 30, Math.PI * 1.2), gold, [0, 2.1, 0.01], [1, 1, 1.05], [0, 0, Math.PI * 0.9]);
    const crest = new THREE.Shape();
    crest.moveTo(-0.06, 0); crest.quadraticCurveTo(0, 0.22, 0, 0.32); crest.quadraticCurveTo(0, 0.22, 0.06, 0); crest.closePath();
    add(extrude(crest), gold, [0, 2.1, 0.17], [1, 1, 1], [-0.25, 0, 0]);
    add(new THREE.OctahedronGeometry(0.04), gemM, [0, 2.12, 0.22]);
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0); finShape.quadraticCurveTo(0.22, 0.05, 0.34, 0.22); finShape.quadraticCurveTo(0.15, 0.08, 0, 0.07); finShape.closePath();
    for (const sx of [-1, 1]) add(extrude(finShape, 0.02), gold, [sx * 0.19, 2.08, 0], [sx, 1, 1], [0, sx * 1.3, 0]);

    // wings: two fans of gold feathers with glowing tips
    const feather = new THREE.Shape();
    feather.moveTo(0, 0); feather.quadraticCurveTo(0.14, 0.5, 0.03, 1.1); feather.quadraticCurveTo(-0.06, 0.55, 0, 0);
    const fGeo = extrude(feather, 0.025);
    const tipMat = new THREE.MeshBasicMaterial({ color: glow('#ffe6a0', 2.2), toneMapped: false });
    this.wings = [-1, 1].map((sx) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.15, 1.6, -0.26);
      body.add(pivot);
      for (let f = 0; f < 7; f++) {
        const len = 1 - Math.abs(f - 2) * 0.1;
        const m = new THREE.Mesh(fGeo, gold);
        m.scale.set(sx, len * 1.15, 1);
        m.rotation.z = -sx * (0.35 + f * 0.24);
        m.position.y = -f * 0.02;
        pivot.add(m);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), tipMat);
        tip.position.set(0.03, 1.1, 0); m.add(tip);
      }
      return { pivot, sx };
    });

    // cosmos aura: rising sparks + a fresnel energy shell
    const N = 520, p = new Float32Array(N * 3);
    this.auraSeeds = Array.from({ length: N }, () => ({ a: Math.random() * Math.PI * 2, r: 0.5 + Math.random() * 1.1, y: Math.random() * 3, s: 0.4 + Math.random() * 1.3 }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.aura = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, color: glow('#7cc4ff', 2.2), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    k.add(this.aura);
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1.35, 32, 24), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      uniforms: { uColor: { value: new THREE.Color('#7cc4ff') }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: `varying vec3 vN; varying vec3 vV; uniform vec3 uColor; uniform float uTime;
        void main(){ float f = pow(clamp(1. - abs(dot(vN, vV)), 0., 1.), 3.); float a = f * (0.35 + 0.1*sin(uTime*3.)); gl_FragColor = vec4(uColor * a * 2., a); }`,
    }));
    this.shell.position.y = 1.2; this.shell.scale.set(1, 1.35, 1);
    k.add(this.shell);
    k.scale.setScalar(1.25);
    this.scene.add(k);
  }

  // ---------------------------------------------------------------- state
  /** states: per house 'todo'|'mailed'|'partial'|'won'|'verified' */
  setStates(states) {
    states.forEach((s, i) => {
      const t = this.temples[i];
      const was = this.prevStates?.[i];
      t.state = s;
      const col = STATE_COLOR[s];
      t.flame.material.color.copy(glow(col, s === 'won' ? 3.2 : s === 'todo' ? 1.1 : 2.2));
      t.rim.material.color.copy(glow(col, s === 'won' ? 3 : 1.6));
      t.light.color.set(col); t.light.intensity = s === 'won' ? 60 : s === 'todo' ? 10 : 25;
      t.beam.material.uniforms.uColor.value.set(col);
      t.beam.material.uniforms.uPower.value = s === 'won' ? 1 : s === 'todo' ? 0.22 : 0.5;
      if (was && was !== 'won' && s === 'won') this.conquer(i);
    });
    this.prevStates = [...states];
    const won = states.filter((s) => s === 'won').length;
    const c = new THREE.Color('#7cc4ff').lerp(new THREE.Color('#ffcf5a'), won / this.houses.length);
    this.aura.material.color.copy(c).multiplyScalar(2.2);
    this.shell.material.uniforms.uColor.value.copy(c);
    this.rim.color.copy(c);
    const all = won === this.houses.length;
    this.athenaMat.emissive.set(all ? 0xffc766 : 0x000000);
    this.athenaMat.emissiveIntensity = all ? 1.2 : 0;
    this.athenaHalo.material.color.copy(glow(all ? '#ffd98a' : '#8899cc', all ? 3 : 1));
    this.athenaBeam.material.uniforms.uPower.value = all ? 1 : 0.05 + won * 0.02;
  }

  conquer(i) {
    this.burst(housePos(i).add(new THREE.Vector3(0, 2, 0)));
    this.shake = 0.6;
    this.hooks.onConquer?.(i);
  }

  /** A burst of gold sparks plus a shockwave ring at p. */
  burst(p, { n = 700, speed = 12, life = 2.4, size = 0.22, k = 3 } = {}) {
    const N = n, pos = new Float32Array(N * 3), v = [];
    for (let j = 0; j < N; j++) { pos.set([p.x, p.y, p.z], j * 3); v.push(new THREE.Vector3().randomDirection().multiplyScalar(speed / 3 + Math.random() * speed)); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: size * 1.7, map: spark(), color: glow('#ffcf5a', k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pts.frustumCulled = false;
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), new THREE.MeshBasicMaterial({ color: glow('#ffe6a0', 3), transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    wave.position.copy(p); wave.rotation.x = -Math.PI / 2;
    this.scene.add(pts, wave);
    this.bursts.push({ pts, wave, v, t: 0, life });
  }

  goTo(i) {
    i = Math.max(0, Math.min(this.last, i));
    if (i === this.index) { if (!this.fly) this.hooks.onArrive?.(i); return; } // already there or already flying there
    // Retarget from wherever the knight is now, so clicks mid-flight chain instead of restarting.
    const from = this.fly ? this.fly.u : this.index / (this.last || 1), to = i / (this.last || 1);
    this.fly = { t: 0, dur: 1.1 + Math.abs(to - from) * (this.last || 1) * 0.35, t0: from, t1: to, u: from, to: i };
    this.index = i;
  }

  onClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.temples.map((t) => t.group), true).find((h) => h.object.isMesh && h.object.userData.house != null && h.object.material.blending !== THREE.AdditiveBlending);
    if (hit) this.goTo(hit.object.userData.house);
  }

  placeCamera(snap) {
    const k = this.knight.position;
    const t = this.index / (this.last || 1);
    const tan = this.curve.getTangentAt(Math.min(0.999, Math.max(0.001, t)));
    const out = outward(k);
    const want = k.clone().addScaledVector(out, 8.5).addScaledVector(tan, -4).add(new THREE.Vector3(0, 2.6, 0));
    const look = k.clone().addScaledVector(out, -4).add(new THREE.Vector3(0, 2.2, 0));
    this.camPos.lerp(want, snap ? 1 : 0.05);
    this.camLook.lerp(look, snap ? 1 : 0.08);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) this.camera.position.add(new THREE.Vector3().randomDirection().multiplyScalar(this.shake * 0.35));
    this.camera.lookAt(this.camLook);
  }

  setActive(on) {
    if (!on && this.cine.playing) this.cine.finish(); // leaving the tab ends the cinematic
    this.active = on;
    this.renderer.domElement.style.display = on ? 'block' : 'none';
    this.renderer.setAnimationLoop(on ? () => this.tick() : null);
    if (on) this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight, pr = Math.min(window.devicePixelRatio, 1.75);
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  tick() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05), t = this.timer.getElapsed();
    let flying = 0;
    const cine = this.cine.playing;
    if (cine) flying = this.cine.flying;
    else if (this.fly) {
      const f = this.fly; f.t += dt;
      const k = ease(Math.min(1, f.t / f.dur));
      const u = f.u = Math.min(1, Math.max(0, THREE.MathUtils.lerp(f.t0, f.t1, k)));
      const p = this.curve.getPointAt(u);
      this.knight.position.copy(p).add(outward(p).multiplyScalar(5.5)).add(new THREE.Vector3(0, 1.2 + Math.sin(k * Math.PI) * 3, 0));
      const dir = Math.sign(f.t1 - f.t0 || 1);
      const tan = this.curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)));
      this.knight.rotation.y = Math.atan2(tan.x * dir, tan.z * dir);
      flying = Math.sin(k * Math.PI);
      if (f.t >= f.dur) { this.fly = null; this.hooks.onArrive?.(f.to); }
    } else {
      const base = spot(this.index);
      this.knight.position.y += (base.y + Math.sin(t * 1.6) * 0.18 - this.knight.position.y) * 0.1;
      const face = Math.atan2(this.knight.position.x, this.knight.position.z) - 0.35; // turn to face the viewer, like a Saint's pose
      this.knight.rotation.y += (face - this.knight.rotation.y) * 0.05;
    }
    // flight pose: lean forward, wings beat; at rest the wings breathe
    this.body.rotation.x += ((flying ? 0.55 : 0) - this.body.rotation.x) * 0.1;
    for (const w of this.wings) {
      const beat = flying ? Math.sin(t * 9) * 0.45 : Math.sin(t * 1.4) * 0.08;
      const spread = cine ? this.cine.spread : 0; // wings thrown wide for the ascension
      w.pivot.rotation.y = w.sx * (0.5 + beat - spread * 0.45);
      w.pivot.rotation.z = w.sx * ((flying ? -0.2 : 0.05) - spread * 0.25);
    }
    this.rim.position.copy(this.knight.position).add(new THREE.Vector3(0, 2.5, -2));
    const ap = this.aura.geometry.attributes.position;
    const spd = 1 + flying * 2;
    this.auraSeeds.forEach((s, i) => {
      const y = (s.y + t * s.s * spd) % 3;
      const r = s.r * (1 - y / 3.6);
      ap.setXYZ(i, Math.cos(s.a + t * s.s) * r, y, Math.sin(s.a + t * s.s) * r);
    });
    ap.needsUpdate = true;
    this.shell.material.uniforms.uTime.value = t;
    this.temples.forEach((tp, i) => {
      tp.ring.rotation.z = t * (tp.state === 'won' ? 0.4 : 0.08) + i;
      tp.flame.scale.setScalar(1 + 0.1 * Math.sin(t * 3 + i));
      tp.beam.material.uniforms.uTime.value = t;
      tp.glyph.material.opacity = i === this.index ? 1 : 0.75;
    });
    this.athenaHalo.rotation.z = t * 0.3;
    this.athenaBeam.material.uniforms.uTime.value = t;
    this.dome.material.uniforms.uTime.value = t;
    this.stars.rotation.y = t * 0.003;
    this.motes.rotation.y = t * 0.02;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]; b.t += dt;
      const k = b.t / b.life, pa = b.pts.geometry.attributes.position;
      for (let j = 0; j < b.v.length; j++) {
        b.v[j].multiplyScalar(Math.pow(0.95, dt * 60)); b.v[j].y += dt * 1.5;
        pa.setXYZ(j, pa.getX(j) + b.v[j].x * dt, pa.getY(j) + b.v[j].y * dt, pa.getZ(j) + b.v[j].z * dt);
      }
      pa.needsUpdate = true;
      b.pts.material.opacity = 1 - k;
      b.wave.scale.setScalar(1 + k * 14);
      b.wave.material.opacity = 1 - k;
      if (k >= 1) {
        this.scene.remove(b.pts, b.wave);
        b.pts.geometry.dispose(); b.pts.material.dispose(); b.wave.geometry.dispose(); b.wave.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
    this.shake = Math.max(0, this.shake - dt);
    if (cine) this.cine.update(dt); else this.placeCamera(false);
    this.composer.render();
  }
}

function glyphTexture(sign, id, name) {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 192;
  const x = c.getContext('2d');
  x.textAlign = 'center';
  x.shadowColor = '#ffb238'; x.shadowBlur = 24;
  x.fillStyle = '#fff1c4';
  x.font = '96px "Apple Symbols", "Segoe UI Symbol", serif';
  x.fillText(sign + '︎', 192, 100);
  x.shadowBlur = 8;
  x.font = '700 26px -apple-system, sans-serif';
  x.fillStyle = '#ffe2a0';
  x.fillText(name.toUpperCase(), 192, 146);
  x.shadowBlur = 0;
  x.font = '600 20px -apple-system, sans-serif';
  x.fillStyle = '#cfd8ff';
  x.fillText(id, 192, 176);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function zodiacRingTexture(highlight) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.translate(S / 2, S / 2);
  x.strokeStyle = 'rgba(255,214,140,.55)';
  x.lineWidth = 2;
  for (const r of [196, 250]) { x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  ZODIAC.forEach(([s], i) => {
    const a = (i / 12) * Math.PI * 2;
    x.save(); x.rotate(a);
    x.fillStyle = i === highlight ? 'rgba(255,235,180,1)' : 'rgba(255,214,140,.55)';
    x.font = `${i === highlight ? 40 : 30}px "Apple Symbols", serif`;
    x.fillText(s + '︎', 0, -223);
    x.restore();
    x.save(); x.rotate(a + Math.PI / 12);
    x.fillRect(-1, -250, 2, 12);
    x.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
