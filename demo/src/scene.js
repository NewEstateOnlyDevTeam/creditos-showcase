// The Tri-Merge Orrery: score core + three bureau rings + one glass crystal per
// account per reporting bureau, joined by spokes that glitch where bureaus disagree.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { B, BUREAU, money, negOn } from './engine.js';

export const RINGS = {
  TU: { r: 6.8, y: 0.62 },
  EX: { r: 9.0, y: 0.0 },
  EQ: { r: 11.2, y: -0.62 },
};
const TINT = { pos: '#5eead4', neg: '#ff2d55', corrected: '#fbbf24', verified: '#ff7a45' };
const HOME = { pos: new THREE.Vector3(0, 12.5, 29.5), target: new THREE.Vector3(0, -1.1, 0) };
const HOME_NARROW = { pos: new THREE.Vector3(0, 26, 40), target: new THREE.Vector3(0, -3.2, 0) };
const home = () => (window.innerWidth < 700 ? HOME_NARROW : HOME);

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));

const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float fbm(vec3 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*snoise(p);p*=2.02;a*=.5;}return f;}
`;

export function scoreColor(score) {
  const stops = [[300, '#ff2d55'], [560, '#ff7a45'], [640, '#ffd479'], [720, '#5eead4'], [800, '#7dd3fc']];
  for (let i = 1; i < stops.length; i++) {
    if (score <= stops[i][0]) {
      const [s0, c0] = stops[i - 1], [s1, c1] = stops[i];
      return new THREE.Color(c0).lerp(new THREE.Color(c1), (score - s0) / (s1 - s0));
    }
  }
  return new THREE.Color(stops.at(-1)[1]);
}

export class Orrery {
  constructor({ canvas, labelHost, model, hooks }) {
    this.model = model;
    this.hooks = hooks;
    this.clock = new THREE.Timer();
    this.crystals = [];      // one per account × reporting bureau
    this.byAccount = new Map();
    this.bursts = [];
    this.hovered = null;
    this.selected = null;
    this.timeMi = null;
    this.health = 0;
    this.introT = 0;
    this.introStarted = false; // the intro waits for the boot overlay to finish (startIntro)
    this.introCam = true;
    this.fly = null;

    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = this.scene = new THREE.Scene();
    // Reflections come from a PMREM env map; three.js doesn't rebuild it after a
    // WebGL context loss (GPU switch, sleep/wake), so rebuild it ourselves.
    const makeEnv = () => {
      const pm = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
      scene.environment?.dispose();
      scene.environment = pm.fromScene(room, 0.035).texture;
      pm.dispose(); room.dispose();
    };
    makeEnv();
    canvas.addEventListener('webglcontextrestored', makeEnv);
    scene.environmentIntensity = 0.9;

    const camera = this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
    camera.position.set(0, 46, 96);

    const controls = this.controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 7;
    controls.maxDistance = Infinity; // set to 70 once the intro fly-in is done
    controls.maxPolarAngle = Math.PI * 0.62;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = motion.matches;
    motion.addEventListener('change', () => { this.reducedMotion = motion.matches; this.setSpin(this.spin !== false); });
    controls.autoRotate = !this.reducedMotion;
    // A user drag takes over from any scripted camera move.
    controls.addEventListener('start', () => { this.introCam = false; this.fly = null; });
    controls.autoRotateSpeed = 0.28;
    controls.target.copy(home().target);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    labelHost.appendChild(this.labelRenderer.domElement);

    this.world = new THREE.Group();
    scene.add(this.world);

    this.buildBackdrop();
    this.buildCore();
    this.buildRings();
    this.buildCrystals();
    this.buildDust();

    // Multisampled target: without it EffectComposer renders with no anti-aliasing and
    // every thin ring, spoke and crystal edge shimmers as the scene rotates.
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = this.composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.95);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(9, 9);
    this.bindPointer(canvas);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    renderer.setAnimationLoop(() => this.tick());
  }

  // ------------------------------------------------------------ backdrop
  buildBackdrop() {
    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(400, 64, 32),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
        fragmentShader: NOISE + /* glsl */`
          varying vec3 vP; uniform float uTime;
          void main(){
            vec3 p = vP * 2.2 + vec3(0., uTime*0.004, 0.);
            float n = fbm(p);
            float m = fbm(p*1.7 + 4.2);
            vec3 base = vec3(0.008, 0.01, 0.024);
            vec3 indigo = vec3(0.09, 0.05, 0.24);
            vec3 teal = vec3(0.01, 0.12, 0.16);
            vec3 rose = vec3(0.2, 0.02, 0.12);
            vec3 c = base;
            c += indigo * smoothstep(0.0, 0.8, n) * 0.9;
            c += teal * smoothstep(0.1, 0.9, m) * 0.8;
            c += rose * smoothstep(0.45, 1.0, n*m*2.) * 0.7;
            c *= 0.55 + 0.45 * smoothstep(-0.6, 0.4, vP.y);
            gl_FragColor = vec4(c, 1.);
          }`,
      }),
    );
    this.scene.add(nebula);
    this.nebula = nebula;

    const N = 4200, pos = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = 90 + Math.random() * 260, u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
      size[i] = Math.pow(Math.random(), 3) * 3.2 + 0.6;
      seed[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.stars = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPR: { value: this.renderer.getPixelRatio() } },
      vertexShader: /* glsl */`attribute float aSize; attribute float aSeed; uniform float uTime; uniform float uPR; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
          vA = 0.82 + 0.18 * sin(uTime * (0.3 + fract(aSeed) * 0.8) + aSeed);
          gl_PointSize = max(1.6, aSize * uPR * (260. / -mv.z)); }`,
      fragmentShader: /* glsl */`varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d);
          gl_FragColor = vec4(vec3(.75,.85,1.) * a * vA, a * vA); }`,
    }));
    this.scene.add(this.stars);
  }

  // ------------------------------------------------------------ score core
  buildCore() {
    const { scores } = this.model.report;
    const avg = B.reduce((s, b) => s + scores[b], 0) / 3;
    this.coreColor = scoreColor(avg);
    this.healthyColor = new THREE.Color('#5eead4');

    this.plasma = new THREE.Mesh(
      new THREE.SphereGeometry(1.32, 128, 128),
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: this.coreColor.clone() }, uTurb: { value: 1 } },
        vertexShader: NOISE + /* glsl */`
          uniform float uTime; uniform float uTurb; varying float vN; varying vec3 vNorm; varying vec3 vView;
          void main(){
            float n = fbm(normal * 1.6 + uTime * 0.18);
            vN = n;
            vec3 p = position + normal * n * (0.1 + 0.16 * uTurb);
            vec4 mv = modelViewMatrix * vec4(p, 1.);
            vNorm = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */`
          uniform vec3 uColor; varying float vN; varying vec3 vNorm; varying vec3 vView;
          void main(){
            float fres = pow(clamp(1. - dot(normalize(vNorm), normalize(vView)), 0., 1.), 2.2);
            vec3 hot = mix(uColor * 0.8, vec3(1., .95, .9), smoothstep(0.35, 0.95, vN));
            vec3 c = hot * (0.55 + 1.5 * smoothstep(0.0, 0.9, vN)) + uColor * fres * 1.6;
            gl_FragColor = vec4(c, 1.);
          }`,
      }),
    );
    this.world.add(this.plasma);

    this.coreGlass = new THREE.Mesh(
      new THREE.SphereGeometry(2.05, 128, 96),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 1, thickness: 2.6, ior: 1.42,
        iridescence: 0.55, iridescenceIOR: 1.28, iridescenceThicknessRange: [180, 820],
        clearcoat: 1, clearcoatRoughness: 0.05, dispersion: 1.2, specularIntensity: 0.9,
        attenuationColor: new THREE.Color('#bfe6ff'), attenuationDistance: 7, envMapIntensity: 1.6,
      }),
    );
    this.coreGlass.userData.core = true;
    this.world.add(this.coreGlass);

    const tex = radialTexture();
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: this.coreColor.clone(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.scale.setScalar(9);
    this.world.add(this.halo);
  }

  // ------------------------------------------------------------ rings
  buildRings() {
    this.rings = {};
    for (const b of B) {
      const { r, y } = RINGS[b];
      const color = new THREE.Color(BUREAU[b].color);
      const g = new THREE.Group();
      g.position.y = y;
      const line = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 10, 480),
        new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.2), toneMapped: false }));
      line.rotation.x = Math.PI / 2;
      const band = new THREE.Mesh(new THREE.RingGeometry(r - 0.75, r + 0.75, 256, 1),
        new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          uniforms: { uTime: { value: 0 }, uColor: { value: color }, uR: { value: r }, uBoost: { value: 0 } },
          vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
          fragmentShader: /* glsl */`
            varying vec3 vP; uniform float uTime; uniform vec3 uColor; uniform float uR; uniform float uBoost;
            void main(){
              float d = abs(length(vP.xy) - uR);
              float glow = exp(-d * 5.5) * 0.16;
              float ang = atan(vP.y, vP.x);
              float sweep = pow(max(0., 0.5 + 0.5 * sin(ang - uTime * 0.35)), 10.) * 0.22;
              float a = (glow + sweep * exp(-d * 3.)) * (1. + uBoost * 1.6);
              gl_FragColor = vec4(uColor * a, a);
            }`,
        }));
      band.rotation.x = -Math.PI / 2;
      g.add(line, band);
      this.world.add(g);

      const el = document.createElement('div');
      el.className = 'ring-label';
      el.style.setProperty('--c', BUREAU[b].color);
      el.innerHTML = `<b>${BUREAU[b].name}</b><span>${this.model.report.scores[b]}</span>`;
      const lab = new CSS2DObject(el);
      lab.position.set(0, 0.2, r + 0.1);
      g.add(lab);
      this.rings[b] = { group: g, line, band, color, label: lab };
      g.scale.setScalar(0.001);
    }
  }

  // ------------------------------------------------------------ crystals + spokes
  buildCrystals() {
    const accounts = [...this.model.accounts].sort((a, b) =>
      (a.neg - b.neg) || (a.neg ? b.balance - a.balance : a.balance - b.balance));
    const N = accounts.length;
    const GEO = {
      revolving: new THREE.OctahedronGeometry(1, 0),
      installment: new THREE.IcosahedronGeometry(1, 0),
      collection: new THREE.TetrahedronGeometry(1.15, 0),
      open: new THREE.DodecahedronGeometry(0.95, 0),
    };
    const coreGeo = new THREE.SphereGeometry(0.3, 20, 20);
    const ghostGeo = new THREE.TorusGeometry(0.2, 0.012, 6, 40);

    accounts.forEach((a, idx) => {
      const theta = (idx / N) * Math.PI * 2 + 0.35;
      const s = 0.3 + 0.11 * Math.log10((a.balance || 0) + 10);
      const entry = { account: a, theta, crystals: [], spokes: [], ghosts: [], label: null, idx };
      for (const b of B) {
        const { r, y } = RINGS[b];
        const pos = new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r);
        if (!a.bureaus[b]) {
          const ghost = new THREE.Mesh(ghostGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }));
          ghost.position.copy(pos);
          ghost.rotation.x = Math.PI / 2;
          this.world.add(ghost);
          entry.ghosts.push(ghost);
          continue;
        }
        const neg = negOn(a, b);
        const tint = new THREE.Color(neg ? TINT.neg : TINT.pos);
        const mat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff, roughness: 0.2, metalness: 0, transmission: 1, thickness: 0.9, ior: 1.5,
          attenuationColor: tint.clone(), attenuationDistance: neg ? 0.28 : 0.5, flatShading: true,
          iridescence: 0.3, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 520],
          clearcoat: 0.2, clearcoatRoughness: 0.25, envMapIntensity: 0.6, specularIntensity: 0.3,
        });
        const mesh = new THREE.Mesh(GEO[a.kind], mat);
        mesh.position.copy(pos);
        mesh.scale.set(s, s * 1.35, s);
        mesh.rotation.y = Math.random() * Math.PI;
        const heart = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(2), toneMapped: false }));
        mesh.add(heart);
        this.world.add(mesh);
        const c = {
          mesh, heart, bureau: b, key: a.key, base: s, tint, target: 1, life: 0, gone: false,
          seed: Math.random() * 10, neg, hov: 1,
        };
        mesh.userData.crystal = c;
        mesh.scale.setScalar(0.0001);
        entry.crystals.push(c);
        this.crystals.push(c);
      }
      // spokes between consecutive reporting rings
      const ordered = entry.crystals.slice().sort((x, y) => RINGS[x.bureau].r - RINGS[y.bureau].r);
      const glitch = Math.min(1, a.heat / 14);
      for (let i = 1; i < ordered.length; i++) {
        const p0 = ordered[i - 1].mesh.position, p1 = ordered[i].mesh.position;
        const spoke = makeSpoke(p0, p1, glitch, a.neg);
        spoke.userData.ends = [ordered[i - 1], ordered[i]];
        this.world.add(spoke);
        entry.spokes.push(spoke);
      }
      // floating label above outermost crystal
      const outer = ordered.at(-1) || null;
      const el = document.createElement('button');
      el.className = `acct-label ${a.neg ? 'neg' : 'pos'}`;
      el.innerHTML = `<i></i><span>${displayName(a)}</span><em>${a.balance ? money(a.balance) : '$0'}</em>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); this.hooks.onSelect?.(a.key); });
      el.addEventListener('pointerenter', () => { this.labelHover = a.key; this.setHover(a.key); });
      el.addEventListener('pointerleave', () => { this.labelHover = null; this.setHover(null); });
      const lab = new CSS2DObject(el);
      const lp = outer ? outer.mesh.position.clone() : new THREE.Vector3(Math.cos(theta) * 11.2, 0, Math.sin(theta) * 11.2);
      lp.multiplyScalar(1.1).setY(lp.y + 1.0 + (idx % 2) * 0.75);
      lab.position.copy(lp);
      this.world.add(lab);
      entry.label = lab;
      this.byAccount.set(a.key, entry);
    });
  }

  buildDust() {
    const inq = this.model.report.inquiries;
    const n = inq.length;
    this.dust = inq.map((q) => ({
      b: q.bureau, phase: Math.random() * Math.PI * 2, speed: 0.05 + Math.random() * 0.08,
      dr: (Math.random() - 0.5) * 0.9, dy: 0.25 + Math.random() * 0.6,
    }));
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    this.dust.forEach((d, i) => { const c = new THREE.Color(BUREAU[d.b].color); col.set([c.r, c.g, c.b], i * 3); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.dustPoints = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.3, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
      blending: THREE.AdditiveBlending, map: radialTexture(), sizeAttenuation: true,
    }));
    this.world.add(this.dustPoints);
  }

  // ------------------------------------------------------------ interaction
  bindPointer(canvas) {
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pointerDirty = true;
    });
    canvas.addEventListener('pointerleave', () => { this.pointer.set(9, 9); this.pointerDirty = true; });
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = canvas.getBoundingClientRect(); // taps have no pointermove before them
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const hit = this.pick();
      if (hit === 'core') this.hooks.onSelect?.('__core');
      else this.hooks.onSelect?.(hit);
    });
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.crystals.filter((c) => !c.gone).map((c) => c.mesh);
    targets.push(this.coreGlass);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    if (hit.object.userData.core) return 'core';
    return hit.object.userData.crystal.key;
  }

  setHover(key) {
    if (this.hovered === key) return;
    this.hovered = key;
    for (const [k, e] of this.byAccount) e.label.element.classList.toggle('hover', k === key);
    this.renderer.domElement.style.cursor = key ? 'pointer' : '';
    this.hooks.onHover?.(key);
  }

  select(key) {
    if (key === this.selected) return; // re-renders must not re-fly the camera
    this.selected = key;
    for (const [k, e] of this.byAccount) {
      e.label.element.classList.toggle('selected', k === key);
      e.label.element.classList.toggle('dim', !!key && key !== '__core' && k !== key);
    }
    for (const b of B) this.rings[b].boost = 0;
    if (key && key !== '__core') {
      const e = this.byAccount.get(key);
      for (const c of e.crystals) this.rings[c.bureau].boost = 1;
      // Frame the account's crystals left of centre so they sit in the open
      // space between the dials and the inspector panel.
      const dir = new THREE.Vector3(Math.cos(e.theta), 0, Math.sin(e.theta));
      const mid = dir.clone().multiplyScalar(RINGS.EX.r);
      const right = new THREE.Vector3(dir.z, 0, -dir.x);
      const pos = mid.clone().addScaledVector(dir, 15).addScaledVector(right, -3).add(new THREE.Vector3(0, 8.5, 0));
      const target = mid.clone().addScaledVector(right, 5.2).add(new THREE.Vector3(0, -0.6, 0));
      this.flyTo(pos, target);
      this.controls.autoRotate = false;
    } else if (key === '__core') {
      this.flyTo(new THREE.Vector3(0, 3.2, 9.5), new THREE.Vector3(0, 0, 0));
      this.controls.autoRotate = false;
    } else {
      this.flyTo(home().pos.clone(), home().target.clone());
      this.controls.autoRotate = this.spin !== false && !this.reducedMotion;
    }
  }

  flyTo(pos, target, dur = 1.5) {
    this.introCam = false;
    if (this.reducedMotion) dur = 0.01;
    this.fly = { t: 0, dur, p0: this.camera.position.clone(), p1: pos, t0: this.controls.target.clone(), t1: target };
  }

  /** Start the fly-in once the boot overlay is gone, so it isn't played unseen. */
  startIntro() { this.introStarted = true; }

  /** Stop rendering while a full-screen sheet covers the scene. */
  setPaused(paused) {
    if (paused === this.paused) return;
    this.paused = paused;
    this.renderer.setAnimationLoop(paused ? null : () => this.tick());
  }

  setSpin(on) { this.spin = on; if (!this.selected) this.controls.autoRotate = on && !this.reducedMotion; }

  /** Crystal visual state per account/bureau: 'deleted' | 'corrected' | 'verified' | null */
  setBureauState(key, bureau, status) {
    const e = this.byAccount.get(key);
    const c = e?.crystals.find((x) => x.bureau === bureau);
    if (!c) return;
    c.status = status;
    this.refreshCrystal(c, true);
  }

  setTime(mi) {
    this.timeMi = mi;
    for (const c of this.crystals) this.refreshCrystal(c, false, true);
    this.updateHealth();
  }

  refreshCrystal(c, userAction, batch = false) {
    const e = this.byAccount.get(c.key);
    const a = e.account;
    const aged = a.fall?.falloff != null && this.timeMi != null && this.timeMi >= a.fall.falloff;
    const deleted = c.status === 'deleted';
    const wasGone = c.gone;
    c.gone = aged || deleted;
    c.target = c.gone ? 0 : 1;
    let tint = c.neg ? TINT.neg : TINT.pos;
    if (c.neg && c.status === 'corrected') tint = TINT.corrected;
    if (c.neg && c.status === 'verified') tint = TINT.verified;
    c.tint.set(tint);
    c.mesh.material.attenuationColor.copy(c.tint);
    c.heart.material.color.copy(c.tint).multiplyScalar(3);
    if (c.gone && !wasGone && this.introT >= 1) {
      const p = c.mesh.getWorldPosition(new THREE.Vector3());
      this.burst(p, deleted ? new THREE.Color('#ffd479') : c.tint.clone(), deleted ? 1 : 0.6);
      if (userAction) this.hooks.onShatter?.(c.key, c.bureau);
    }
    const allGone = e.crystals.every((x) => x.gone);
    e.label.element.classList.toggle('gone', allGone);
    e.label.element.inert = allGone;
    // The label dot follows what is still on file: red only while a negative entry remains.
    const stillNeg = e.crystals.some((x) => x.neg && !x.gone && x.status !== 'corrected');
    e.label.element.classList.toggle('neg', stillNeg);
    e.label.element.classList.toggle('pos', !stillNeg);
    for (const sp of e.spokes) sp.userData.target = sp.userData.ends.every((x) => !x.gone) ? 1 : 0;
    if (!batch) this.updateHealth();
  }

  updateHealth() {
    const neg = this.crystals.filter((c) => c.neg); // per bureau: a bureau reporting it positively doesn't count
    const alive = neg.filter((c) => !c.gone && c.status !== 'corrected').length;
    this.health = neg.length ? 1 - alive / neg.length : 1;
    this.hooks.onHealth?.(this.health);
  }

  burst(pos, color, power = 1) {
    const N = Math.round(220 * power);
    const p = new Float32Array(N * 3), v = [];
    for (let i = 0; i < N; i++) {
      p.set([pos.x, pos.y, pos.z], i * 3);
      const d = new THREE.Vector3().randomDirection().multiplyScalar(1.2 + Math.random() * 3.8 * power);
      v.push(d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ size: 0.14, color: color.clone().multiplyScalar(2.2), transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, map: radialTexture(), toneMapped: false });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false; // its bounding sphere is computed while every point is at the origin
    this.scene.add(pts);
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 72), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    wave.position.copy(pos);
    this.scene.add(wave);
    this.bursts.push({ pts, wave, v, t: 0, life: 1.9 });
  }

  // ------------------------------------------------------------ loop
  resize() {
    // On desktop the canvas is 280px wider than the window (overflow is clipped),
    // which shifts the orrery's center right so it clears the left-hand dials.
    const h = window.innerHeight, w = window.innerWidth + (window.innerWidth > 900 ? 280 : 0);
    const pr = Math.min(window.devicePixelRatio, 1.75); // re-read: browser zoom / other monitor
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr); // also sizes the bloom pass at device resolution
    this.stars.material.uniforms.uPR.value = pr;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = window.innerWidth < 700 ? 60 : 40;
    this.camera.updateProjectionMatrix();
  }

  tick() {
    this.clock.update();
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.getElapsed();

    // intro: camera sweeps in, rings unfold, crystals pop in
    if (this.introT < 1 && this.introStarted) {
      this.introT = Math.min(1, this.introT + dt / (this.reducedMotion ? 0.05 : 3.6));
      const k = easeInOut(this.introT);
      if (this.introCam && !this.fly) { this.camera.position.lerpVectors(new THREE.Vector3(0, 46, 96), home().pos, k); this.controls.target.copy(home().target); }
      if (this.introT >= 1) this.controls.maxDistance = 70;
      B.forEach((b, i) => this.rings[b].group.scale.setScalar(Math.max(0.001, easeOutBack(clamp01(this.introT * 2.2 - i * 0.22)))));
    }
    if (this.fly) {
      const f = this.fly; f.t += dt;
      const k = easeInOut(Math.min(1, f.t / f.dur));
      this.camera.position.lerpVectors(f.p0, f.p1, k);
      this.controls.target.lerpVectors(f.t0, f.t1, k);
      if (f.t >= f.dur) this.fly = null;
    }
    this.controls.update();

    this.nebula.material.uniforms.uTime.value = t;
    this.stars.material.uniforms.uTime.value = t;
    this.stars.rotation.y = t * 0.004;

    const h = this.health;
    const pu = this.plasma.material.uniforms;
    pu.uTime.value = t;
    pu.uColor.value.copy(this.coreColor).lerp(this.healthyColor, h);
    pu.uTurb.value = 1.2 - h;
    this.halo.material.color.copy(pu.uColor.value);
    this.halo.material.opacity = 0.26 + 0.06 * Math.sin(t * 1.3);
    this.coreGlass.rotation.y = t * 0.08;

    for (const b of B) {
      const bu = this.rings[b].band.material.uniforms;
      bu.uTime.value = t + B.indexOf(b) * 1.7;
      bu.uBoost.value += ((this.rings[b].boost || 0) - bu.uBoost.value) * Math.min(1, dt * 6);
    }

    for (const c of this.crystals) {
      const e = this.byAccount.get(c.key);
      const appear = this.introT >= 1 ? 1 : clamp01(this.introT * 1.9 - 0.45 - e.idx * 0.035);
      c.life += (c.target * appear - c.life) * Math.min(1, dt * (c.target ? 5 : 9));
      const focus = this.hovered === c.key || this.selected === c.key ? 1.18
        : this.selected && this.selected !== '__core' ? 0.82 : 1;
      c.hov += (focus - c.hov) * Math.min(1, dt * 9); // ease, never snap
      const sc = c.base * easeOutBack(clamp01(c.life)) * c.hov;
      c.mesh.scale.set(Math.max(sc, 0.0001), Math.max(sc * 1.35, 0.0001), Math.max(sc, 0.0001));
      c.mesh.visible = c.life > 0.01;
      if (!this.reducedMotion) c.mesh.rotation.y += dt * (0.07 + (c.seed % 1) * 0.08);
      c.mesh.position.y = RINGS[c.bureau].y + Math.sin(t * 0.9 + c.seed) * 0.08;
      const neg = c.neg && c.status !== 'corrected';
      const beat = this.reducedMotion ? 0 : (neg ? 0.3 : 0.12) * (0.5 + 0.5 * Math.sin(t * 1.1 + c.seed));
      c.heart.material.color.copy(c.tint).multiplyScalar((neg ? 1.5 : 1.15) + beat);
    }
    for (const [, e] of this.byAccount) {
      for (const sp of e.spokes) {
        const u = sp.material.uniforms;
        u.uTime.value = t;
        u.uAlpha.value += ((sp.userData.target ?? 1) * clamp01(this.introT * 2 - 1) - u.uAlpha.value) * Math.min(1, dt * 4);
        const focus = this.selected === e.account.key || this.hovered === e.account.key ? 1 : 0;
        u.uFocus.value += (focus - u.uFocus.value) * Math.min(1, dt * 8);
        sp.visible = u.uAlpha.value > 0.003 || (sp.userData.target ?? 1) > 0;
      }
    }

    const dp = this.dustPoints.geometry.attributes.position;
    this.dust.forEach((d, i) => {
      d.phase += d.speed * dt;
      const { r, y } = RINGS[d.b];
      dp.setXYZ(i, Math.cos(d.phase) * (r + d.dr), y + d.dy + Math.sin(t + i) * 0.05, Math.sin(d.phase) * (r + d.dr));
    });
    dp.needsUpdate = true;
    this.dustPoints.material.opacity = clamp01(this.introT * 2 - 1) * 0.95;

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const bst = this.bursts[i];
      bst.t += dt;
      const k = bst.t / bst.life;
      const pa = bst.pts.geometry.attributes.position;
      for (let j = 0; j < bst.v.length; j++) {
        bst.v[j].multiplyScalar(Math.pow(0.965, dt * 60)); // same spread at 60 or 120 Hz
        pa.setXYZ(j, pa.getX(j) + bst.v[j].x * dt, pa.getY(j) + bst.v[j].y * dt, pa.getZ(j) + bst.v[j].z * dt);
      }
      pa.needsUpdate = true;
      bst.pts.material.opacity = 1 - k;
      bst.wave.scale.setScalar(1 + k * 5);
      bst.wave.material.opacity = 0.9 * (1 - k);
      bst.wave.lookAt(this.camera.position);
      if (k >= 1) {
        this.scene.remove(bst.pts, bst.wave);
        bst.pts.geometry.dispose(); bst.wave.geometry.dispose();
        bst.pts.material.dispose(); bst.wave.material.dispose(); // the radial texture is shared — keep it
        this.bursts.splice(i, 1);
      }
    }

    if (this.pointerDirty && !this.labelHover) {
      this.pointerDirty = false;
      const hit = this.pick();
      this.setHover(hit === 'core' ? null : hit);
      this.renderer.domElement.style.cursor = hit ? 'pointer' : '';
    }

    this.composer.render();
    this.labelRenderer.render(this.scene, this.camera);
  }
}

function makeSpoke(p0, p1, glitch, neg) {
  const len = p0.distanceTo(p1);
  const g = new THREE.CylinderGeometry(0.03, 0.03, len, 8, 1, true);
  g.translate(0, len / 2, 0);
  g.rotateX(Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uGlitch: { value: glitch }, uAlpha: { value: 0 }, uFocus: { value: 0 },
      uCalm: { value: new THREE.Color(neg ? '#ff8fa3' : '#bfe9ff') }, uHot: { value: new THREE.Color('#ff4fd8') },
      uSeed: { value: Math.random() * 100 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uTime, uGlitch, uAlpha, uFocus, uSeed; uniform vec3 uCalm, uHot;
      void main(){
        // Smooth, slow light travelling along the spoke. Bureaus that disagree tint it
        // magenta and it breathes gently — no random flicker.
        float flow = 0.6 + 0.4 * sin(vUv.y * 9. - uTime * 1.4 + uSeed);
        float breathe = 0.5 + 0.5 * sin(uTime * 0.9 + uSeed);
        vec3 c = mix(uCalm, uHot, clamp(uGlitch * (0.55 + 0.3 * breathe), 0., 1.));
        float a = (0.2 + 0.25 * flow) * (1. + uGlitch * 0.4 * breathe) * uAlpha * (1. + uFocus * 1.3);
        gl_FragColor = vec4(c * 1.1, a);
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(p0);
  mesh.lookAt(p1);
  mesh.userData.target = 1;
  return mesh;
}

let _radial;
function radialTexture() {
  if (_radial) return _radial;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c);
  return _radial;
}

// Several accounts from one creditor get a suffix (see engine.js analyze → a.tag).
export const displayName = (a) => prettyName(a.creditor) + (a.tag ? ` · ${a.tag}` : '');

// Bureau creditor names are truncated abbreviations ("BK OF AMER", "JPMCB CARD").
// Expand the common national ones; title-case everything else.
const KNOWN = {
  'BK OF AMER': 'Bank of America', 'BANK OF AMERICA': 'Bank of America', 'JPMCB CARD': 'Chase', 'JPMCB AUTO': 'Chase Auto',
  'CHASE CARD': 'Chase', 'CAPITAL ONE': 'Capital One', 'CAP ONE': 'Capital One', 'CITICARDS CBNA': 'Citi', 'CBNA': 'Citi',
  'DISCOVERCARD': 'Discover', 'DISCOVER BANK': 'Discover', 'AMEX': 'American Express', 'WF CRD SVC': 'Wells Fargo',
  'WELLS FARGO': 'Wells Fargo', 'CREDITONEBNK': 'Credit One', 'CREDIT ONE BANK': 'Credit One', 'SYNCB/AMAZON': 'Synchrony · Amazon',
  'SYNCB/PPC': 'Synchrony · PayPal', 'COMENITY BANK': 'Comenity', 'TD BANK N.A.': 'TD Bank', 'US BANK': 'U.S. Bank',
  'NAVY FCU': 'Navy Federal', 'NAVY FEDERAL CR UNION': 'Navy Federal', 'DEPT OF EDUCATION/NELN': 'Dept. of Education · Nelnet',
  'NAVIENT': 'Navient', 'MOHELA/DOFED': 'MOHELA', 'PORTFOLIO RECOVERY ASSOC': 'Portfolio Recovery', 'PORTFOLIO RECOV ASSOC': 'Portfolio Recovery',
  'MIDLAND CREDIT MGMT': 'Midland Credit Mgmt', 'LVNV FUNDING LLC': 'LVNV Funding', 'JEFFERSON CAPITAL SYST': 'Jefferson Capital',
  'CAVALRY PORTFOLIO SERV': 'Cavalry Portfolio', 'TAB/SUNBIT': 'Sunbit', 'CRB/CKCB': 'Credit Karma', 'SELFINC/LEAD': 'Self · Lead Bank',
  'AFFIRM INC': 'Affirm', 'SANTANDER CONSUMER USA': 'Santander Consumer', 'ALLY FINCL': 'Ally', 'ALLY FINANCIAL': 'Ally',
};
const KEEP_UPPER = new Set(['FCU', 'CU', 'NA', 'LLC', 'USA', 'US', 'TD', 'PNC', 'BMO', 'HSBC', 'USAA', 'FSB', 'II', 'III']);
const WORD = { BK: 'Bank', BNK: 'Bank', FED: 'Fed', FIN: 'Fin', FINL: 'Financial', SVC: 'Svc', SVCS: 'Svcs', MGMT: 'Mgmt', ASSOC: 'Assoc' };

export function prettyName(s) {
  if (!s) return 'Unknown creditor';
  if (KNOWN[s]) return KNOWN[s];
  return s.replace(/\s+(INC|LLC|CORP|CO)\.?$/, '').replace(/\//g, ' / ').split(/\s+/).map((w) => {
    if (KEEP_UPPER.has(w) || /\d/.test(w)) return w;
    if (WORD[w]) return WORD[w];
    if (w === '/' || w === '&') return w;
    return w.charAt(0) + w.slice(1).toLowerCase();
  }).join(' ').replace(/ \/ /g, ' / ');
}
