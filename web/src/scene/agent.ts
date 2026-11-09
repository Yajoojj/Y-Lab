import * as THREE from "three";
import type { Agent, Shape } from "../../../hub/src/types";
import { MOTION, REDUCED_MOTION } from "./motion";

/*
 * SYNTHS — a família de agentes do Y-Lab.
 * Anatomia comum: núcleo de luz, casco de cerâmica em placas (com frestas por onde a luz vaza),
 * visor escuro com traço de luz, anel de levitação e sombra suave.
 * `look.shape` escolhe uma das 12 variações de casco; `look.accessory` adiciona um módulo;
 * `look.color` tinge só o núcleo e o anel — o casco é sempre cerâmica, para a cena não virar carnaval.
 * API mantida: constructor(agent), object, pickTarget, id, hidden, update(agent, target), tick(dt, t), dispose().
 */

const AMBER = new THREE.Color("#ffb547");
const ICE = new THREE.Color("#4de8ff");
const BONE = new THREE.Color("#ede6dc");
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- materiais compartilhados
const ceramic = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.3, metalness: 0.05 });
const eyeMat = new THREE.MeshBasicMaterial({ color: BONE.clone().multiplyScalar(2.2), toneMapped: false });
const amberMat = new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.9 });
const iceMat = new THREE.MeshBasicMaterial({ color: ICE.clone().multiplyScalar(2.2), toneMapped: false });
const pickMat = new THREE.MeshBasicMaterial({ visible: false });

function blobShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(0,0,0,0.65)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const shadowMat = new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false });

// ---------------------------------------------------------------- geometrias compartilhadas
const coreGeo = new THREE.SphereGeometry(0.3, 24, 16);
const pickGeo = new THREE.SphereGeometry(0.8, 8, 6);
const shadowGeo = new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2);
const ringGeo = new THREE.TorusGeometry(0.62, 0.025, 8, 48).rotateX(Math.PI / 2);
const crownRingGeo = new THREE.TorusGeometry(0.42, 0.018, 6, 40).rotateX(Math.PI / 2);
const visorGeo = new THREE.BoxGeometry(0.5, 0.17, 0.04);
const eyeGeo = (() => {
  const a = new THREE.CapsuleGeometry(0.022, 0.12, 2, 6).rotateZ(Math.PI / 2).translate(-0.11, 0, 0.03).toNonIndexed();
  const b = new THREE.CapsuleGeometry(0.022, 0.12, 2, 6).rotateZ(Math.PI / 2).translate(0.11, 0, 0.03).toNonIndexed();
  const g = new THREE.BufferGeometry();
  const join = (n: string) => {
    const x = a.attributes[n].array as Float32Array, y = b.attributes[n].array as Float32Array;
    const out = new Float32Array(x.length + y.length); out.set(x); out.set(y, x.length);
    return new THREE.BufferAttribute(out, 3);
  };
  g.setAttribute("position", join("position"));
  g.setAttribute("normal", join("normal"));
  return g;
})();
const moteGeo = new THREE.OctahedronGeometry(0.06, 0);
const queryGeo = new THREE.OctahedronGeometry(0.16, 0);
const sparkGeo = new THREE.TetrahedronGeometry(0.07, 0);

interface Plate { geo: THREE.BufferGeometry; dir: THREE.Vector3; rot: THREE.Euler; pos: THREE.Vector3 }
/** front: z da superfície frontal na altura do visor; seam: costura de luz (anel, caixa ou nenhuma) */
interface ShellDef { plates: Plate[]; visorY: number; height: number; front: number; seam?: THREE.BufferGeometry; merged?: THREE.BufferGeometry }

/** junta as placas de um casco numa geometria só (uma draw call por agente) */
function mergePlates(plates: Plate[]): THREE.BufferGeometry {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const parts = plates.map((p) => {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone());
    g.applyMatrix4(m.compose(p.pos, q.setFromEuler(p.rot), one));
    return g;
  });
  const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}

const shellCache = new Map<Shape, ShellDef>();

/** N placas esféricas em gomos verticais (com fresta), em volta do núcleo */
function gomos(n: number, r: number, gap: number, squashY = 1): Plate[] {
  const phiLen = (Math.PI * 2) / n - gap;
  const g = new THREE.SphereGeometry(r, Math.max(8, Math.round(48 / n)), 20, -phiLen / 2, phiLen, 0.18, Math.PI - 0.36);
  g.scale(1, squashY, 1);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { geo: g, dir: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), rot: new THREE.Euler(0, a, 0), pos: new THREE.Vector3() };
  });
}

/** duas cúpulas (topo e base) separadas por uma fresta horizontal */
function domes(r: number, gap: number, squashY = 1): Plate[] {
  const topG = new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2 - gap).scale(1, squashY, 1);
  const botG = new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, Math.PI / 2 + gap, Math.PI / 2 - gap).scale(1, squashY, 1);
  return [
    { geo: topG, dir: UP.clone(), rot: new THREE.Euler(), pos: new THREE.Vector3() },
    { geo: botG, dir: UP.clone().negate(), rot: new THREE.Euler(), pos: new THREE.Vector3() },
  ];
}

/** pétalas inclinadas (variações estrela) */
function petals(n: number, flare: number): Plate[] {
  const g = new THREE.SphereGeometry(0.5, 12, 16, -0.32, 0.64, 0.25, Math.PI - 0.5);
  g.scale(1, 1.15, 1);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { geo: g, dir: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), rot: new THREE.Euler(flare * 0.2, a, 0, "YXZ"), pos: new THREE.Vector3() };
  });
}

/** casulos ao redor do núcleo (trevo / trio) */
function pods(n: number, r: number, dist: number): Plate[] {
  const g = new THREE.SphereGeometry(r, 20, 14);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    return { geo: g, dir, rot: new THREE.Euler(), pos: dir.clone().multiplyScalar(dist) };
  });
}

/** casco de caixa arredondada com fresta frontal (variações cúbicas) */
function boxShell(w: number, h: number, d: number): Plate[] {
  const half = new THREE.BoxGeometry(w, h / 2 - 0.04, d, 2, 2, 2);
  // arredonda os vértices projetando em direção a um elipsoide
  const p = half.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 0.55;
    const sx = w / 2, sy = h / 4, sz = d / 2;
    const e = v.clone().multiply(new THREE.Vector3(1 / sx, 1 / sy, 1 / sz)).normalize().multiply(new THREE.Vector3(sx, sy, sz));
    v.lerp(e, k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  half.computeVertexNormals();
  return [
    { geo: half, dir: UP.clone(), rot: new THREE.Euler(), pos: new THREE.Vector3(0, h / 4 + 0.02, 0) },
    { geo: half, dir: UP.clone().negate(), rot: new THREE.Euler(), pos: new THREE.Vector3(0, -h / 4 - 0.02, 0) },
  ];
}

function seamRing(r: number): THREE.BufferGeometry {
  return new THREE.TorusGeometry(r, 0.018, 6, 48).rotateX(Math.PI / 2);
}
function seamBox(w: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, 0.03, d);
}

function shellFor(shape: Shape): ShellDef {
  let s = shellCache.get(shape);
  if (s) return s;
  switch (shape) {
    case "sphere": s = { plates: domes(0.5, 0.09), visorY: 0.16, height: 1, front: 0.47, seam: seamRing(0.49) }; break;
    case "rounded_cube": s = { plates: boxShell(0.95, 0.95, 0.95), visorY: 0.2, height: 1, front: 0.49, seam: seamBox(0.93, 0.93) }; break;
    case "pill": s = { plates: domes(0.42, 0.08, 1.45), visorY: 0.24, height: 1.25, front: 0.4, seam: seamRing(0.41) }; break;
    case "triangle": s = { plates: gomos(3, 0.5, 0.22), visorY: 0.12, height: 1, front: 0.5 }; break;
    case "cone": {
      const lathe = new THREE.LatheGeometry(
        [new THREE.Vector2(0.02, -0.55), new THREE.Vector2(0.28, -0.42), new THREE.Vector2(0.44, -0.1), new THREE.Vector2(0.46, 0.12), new THREE.Vector2(0.34, 0.38), new THREE.Vector2(0.02, 0.5)],
        32, 0.35, Math.PI * 2 - 0.7,
      );
      s = { plates: [{ geo: lathe, dir: new THREE.Vector3(0, 0, -1), rot: new THREE.Euler(), pos: new THREE.Vector3() }], visorY: 0.14, height: 1.05, front: 0.44 };
      break;
    }
    case "pentagon": s = { plates: gomos(5, 0.5, 0.14), visorY: 0.12, height: 1, front: 0.5 }; break;
    case "hexagon": s = { plates: gomos(6, 0.5, 0.12, 0.92), visorY: 0.11, height: 0.95, front: 0.5 }; break;
    case "star4": s = { plates: petals(4, 1), visorY: 0.12, height: 1.1, front: 0.5 }; break;
    case "star6": s = { plates: petals(6, 1.4), visorY: 0.12, height: 1.1, front: 0.5 }; break;
    case "clover": s = { plates: pods(4, 0.24, 0.4), visorY: 0.04, height: 0.8, front: 0.33 }; break;
    case "rounded_square": s = { plates: boxShell(1.15, 0.7, 0.8), visorY: 0.17, height: 0.75, front: 0.41, seam: seamBox(1.13, 0.78) }; break;
    case "trio": s = { plates: pods(3, 0.22, 0.42), visorY: 0.04, height: 0.8, front: 0.33 }; break;
  }
  s.merged = mergePlates(s.plates);
  shellCache.set(shape, s);
  return s;
}

// ---------------------------------------------------------------- lotes compartilhados (anel e sombra)
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const tmpColor = new THREE.Color();

class InstBatch {
  readonly mesh: THREE.InstancedMesh;
  private free: number[] = [];
  constructor(geo: THREE.BufferGeometry, material: THREE.Material, cap: number, colored: boolean) {
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    for (let i = 0; i < cap; i++) { this.mesh.setMatrixAt(i, ZERO); this.free.push(cap - 1 - i); }
    if (colored) this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.mesh.frustumCulled = false;
  }
  alloc(): number { return this.free.pop() ?? -1; }
  release(i: number): void {
    if (i < 0) return;
    this.mesh.setMatrixAt(i, ZERO);
    this.dirty();
    this.free.push(i);
  }
  dirty(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

let batches: { ring: InstBatch; shadow: InstBatch } | undefined;

/** cria (uma vez) os lotes de anel e sombra e coloca na cena */
export function attachSynthBatches(scene: THREE.Scene, cap = 256): void {
  if (batches) return;
  batches = {
    ring: new InstBatch(ringGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), cap, true),
    shadow: new InstBatch(shadowGeo, shadowMat, cap, false),
  };
  batches.shadow.mesh.renderOrder = 1;
  scene.add(batches.ring.mesh, batches.shadow.mesh);
}

// ---------------------------------------------------------------- casco completo (placas + visor + acessório) numa geometria
const COL_CERAMIC = new THREE.Color("#e6e0d6");
const COL_VISOR = new THREE.Color("#060608");
const COL_GRAPHITE = new THREE.Color("#2a2930");

const accGeo = {
  mast: new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6).translate(0, 0.21, 0),
  tip: new THREE.SphereGeometry(0.045, 10, 8),
  armA: new THREE.BoxGeometry(0.06, 0.06, 0.34).translate(0, 0, 0.17),
  armB: new THREE.BoxGeometry(0.05, 0.22, 0.05).translate(0, -0.11, 0),
  fin: new THREE.BoxGeometry(0.03, 0.34, 0.26),
  brow: new THREE.BoxGeometry(0.42, 0.05, 0.04),
};

interface Built { geo: THREE.BufferGeometry; tip?: THREE.Vector3 }
const builtCache = new Map<string, Built>();

/** casco + visor + acessório com cor por vértice: uma draw call por agente */
function buildSynth(shape: Shape, acc: Agent["look"]["accessory"]): Built {
  const key = shape + "|" + acc;
  const hit = builtCache.get(key);
  if (hit) return hit;
  const def = shellFor(shape);
  const parts: { g: THREE.BufferGeometry; m: THREE.Matrix4; c: THREE.Color }[] = [];
  const I = new THREE.Matrix4();
  parts.push({ g: def.merged!, m: I, c: COL_CERAMIC });
  parts.push({ g: visorGeo, m: new THREE.Matrix4().makeTranslation(0, def.visorY, def.front + 0.01), c: COL_VISOR });
  const top = def.height / 2;
  let tip: THREE.Vector3 | undefined;
  switch (acc) {
    case "antenna":
      parts.push({ g: accGeo.mast, m: new THREE.Matrix4().makeTranslation(0.16, top, -0.05), c: COL_GRAPHITE });
      tip = new THREE.Vector3(0.16, top + 0.44, -0.05);
      break;
    case "glasses":
      parts.push({ g: accGeo.brow, m: new THREE.Matrix4().makeTranslation(0, def.visorY + 0.13, def.front + 0.005), c: COL_VISOR });
      break;
    case "stem":
      parts.push({ g: accGeo.armA, m: new THREE.Matrix4().makeRotationY(0.9).setPosition(0.42, -0.05, 0), c: COL_GRAPHITE });
      parts.push({ g: accGeo.armB, m: new THREE.Matrix4().makeTranslation(0.42 + Math.sin(0.9) * 0.34, -0.05, Math.cos(0.9) * 0.34), c: COL_GRAPHITE });
      break;
    case "bow":
      for (const sx of [-1, 1]) {
        const m = new THREE.Matrix4().makeRotationZ(sx * -0.35).setPosition(sx * 0.52, 0.05, -0.05);
        parts.push({ g: accGeo.fin, m, c: COL_GRAPHITE });
      }
      break;
  }
  const flat = parts.map(({ g, m, c }) => {
    const x = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    return { x, c };
  });
  const count = flat.reduce((n, { x }) => n + x.attributes.position.count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let o = 0;
  for (const { x, c } of flat) {
    const n = x.attributes.position.count;
    pos.set(x.attributes.position.array as Float32Array, o * 3);
    nor.set(x.attributes.normal.array as Float32Array, o * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], (o + i) * 3);
    o += n;
    x.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  const built = { geo, tip };
  builtCache.set(key, built);
  return built;
}

/** Avatar SYNTH de um agente; anima conforme o status. */
export class AgentView {
  readonly object = new THREE.Group();
  /** escondido pelo corte da torre */
  hidden = false;

  private agent: Agent;
  private body = new THREE.Group();
  private shellGroup = new THREE.Group();
  private shellMesh?: THREE.Mesh;
  private coreMat: THREE.MeshBasicMaterial;
  private ringMat: THREE.MeshBasicMaterial;
  private core: THREE.Mesh;
  /** anel e sombra são desenhados em lote (InstancedMesh); aqui só guardam a posição */
  private ring = new THREE.Object3D();
  private ringIdx: number;
  private shadowIdx: number;
  private crownRing?: THREE.Mesh;
  private eyes: THREE.Mesh;
  private mote: THREE.Mesh;
  private query: THREE.Mesh;
  private spark: THREE.Mesh;
  private tip: THREE.Mesh;
  private seam?: THREE.Mesh;
  private pick: THREE.Mesh;
  private shadow = new THREE.Object3D();
  private target = new THREE.Vector3();
  private base = new THREE.Color();
  private tint = new THREE.Color();
  private scale = 1;
  private phase = Math.random() * Math.PI * 2;
  private open = 0;
  private doneAt = -1;
  private fade = 1;
  private placed = false;
  private glitchUntil = 0;
  private nextGlitch = 2 + Math.random() * 2;
  private blinkAt = 2 + Math.random() * 4;

  constructor(agent: Agent) {
    this.agent = agent;
    this.coreMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.ringMat = new THREE.MeshBasicMaterial({ toneMapped: false });

    this.core = new THREE.Mesh(coreGeo, this.coreMat);
    this.body.add(this.core, this.shellGroup);

    this.eyes = new THREE.Mesh(eyeGeo, eyeMat);
    this.tip = new THREE.Mesh(accGeo.tip, eyeMat);
    this.body.add(this.eyes, this.tip);

    this.ring.position.y = -0.72;
    this.ringIdx = batches?.ring.alloc() ?? -1;
    this.shadowIdx = batches?.shadow.alloc() ?? -1;

    this.mote = new THREE.Mesh(moteGeo, eyeMat);
    this.query = new THREE.Mesh(queryGeo, amberMat);
    this.query.position.y = 1.05;
    this.spark = new THREE.Mesh(sparkGeo, iceMat);

    this.shadow.position.y = -1.18;

    this.pick = new THREE.Mesh(pickGeo, pickMat);
    this.pick.userData.agentId = agent.id;

    this.object.add(this.body, this.ring, this.mote, this.query, this.spark, this.shadow, this.pick);
    this.object.rotation.y = Math.PI / 4; // de frente para a câmera isométrica
    this.build(agent);
    this.apply(agent);
  }

  get pickTarget(): THREE.Object3D {
    return this.pick;
  }

  get id(): string {
    return this.agent.id;
  }

  /** monta casco, visor e acessório para o formato atual */
  private build(a: Agent): void {
    if (this.shellMesh) this.shellMesh.removeFromParent();
    const def = shellFor(a.look.shape);
    const built = buildSynth(a.look.shape, a.look.accessory);
    this.shellMesh = new THREE.Mesh(built.geo, ceramic);
    this.shellGroup.add(this.shellMesh);
    this.eyes.position.set(0, def.visorY, def.front + 0.01);
    this.tip.visible = !!built.tip;
    if (built.tip) this.tip.position.copy(built.tip);
    if (this.seam) this.body.remove(this.seam);
    this.seam = def.seam ? new THREE.Mesh(def.seam, this.ringMat) : undefined;
    if (this.seam) this.body.add(this.seam);

    this.scale = a.role === "lider" ? 1.4 : a.parentId ? 0.95 : 1.2;
    if (a.role === "lider" && !this.crownRing) {
      this.crownRing = new THREE.Mesh(crownRingGeo, this.ringMat);
      this.crownRing.position.y = def.height / 2 + 0.18;
      this.object.add(this.crownRing);
    } else if (a.role !== "lider" && this.crownRing) {
      this.object.remove(this.crownRing);
      this.crownRing = undefined;
    }
  }

  private apply(a: Agent): void {
    const prev = this.agent;
    if (prev.look.shape !== a.look.shape || prev.look.accessory !== a.look.accessory || prev.role !== a.role || !!prev.parentId !== !!a.parentId) this.build(a);
    this.base.set(a.look.color);
    if (a.status === "done" && prev.status !== "done") this.doneAt = 0;
    if (a.status !== "done") { this.doneAt = -1; this.fade = 1; }
    this.query.visible = a.status === "waiting_user";
    this.spark.visible = false;
    this.mote.visible = a.status === "working";
    this.agent = a;
  }

  update(a: Agent, target: THREE.Vector3): void {
    this.apply(a);
    this.target.copy(target);
    if (!this.placed) {
      this.object.position.copy(target);
      this.placed = true;
      if (a.status === "done") this.fade = 0;
    }
  }

  tick(dt: number, t: number): void {
    const a = this.agent;
    this.object.position.lerp(this.target, 1 - Math.exp(-dt * 2.5));
    const ph = t + this.phase;
    const bobAmp = REDUCED_MOTION ? 0 : 1;

    let coreK = 1.6;
    let openTarget = 0;
    let bob = 0;
    let ringK = 1.2;
    this.tint.copy(this.base);

    switch (a.status) {
      case "working":
        openTarget = 0.06;
        coreK = 1.6 + 0.5 * Math.sin(ph * 2 * Math.PI * 0.8);
        bob = Math.sin(ph * 1.4) * 0.06 * bobAmp;
        this.mote.position.set(Math.cos(ph * 1.6) * 0.75, 0.2 + Math.sin(ph * 2.3) * 0.15, Math.sin(ph * 1.6) * 0.75);
        this.mote.rotation.y = ph * 2;
        break;
      case "waiting_user":
        openTarget = 0.02;
        coreK = 1.8;
        this.tint.copy(this.base).lerp(AMBER, 0.65);
        ringK = 2.0;
        this.ring.rotation.y = t * 1.6 * MOTION;
        this.query.rotation.y = t * 1.2 * MOTION;
        this.query.position.y = 1.05 + Math.sin(ph * 2) * 0.05 * bobAmp;
        bob = Math.sin(ph * 1.1) * 0.04 * bobAmp;
        break;
      case "error": {
        openTarget = -0.02;
        this.tint.copy(ICE);
        coreK = 1.4;
        ringK = 1.0;
        if (t > this.nextGlitch) {
          this.glitchUntil = t + 0.18;
          this.nextGlitch = t + 2 + Math.random();
        }
        const glitching = t < this.glitchUntil && !REDUCED_MOTION;
        this.body.position.x = glitching ? (Math.random() - 0.5) * 0.12 : 0;
        coreK = glitching ? 2.6 : coreK;
        this.spark.visible = glitching;
        if (glitching) this.spark.position.set((Math.random() - 0.5) * 1.2, -0.7, (Math.random() - 0.5) * 1.2);
        break;
      }
      case "idle":
        coreK = 0.55;
        ringK = 0.45;
        bob = Math.sin(ph * 0.6) * 0.03 * bobAmp;
        break;
      case "done":
        this.tint.copy(BONE);
        if (this.doneAt >= 0) {
          this.doneAt += dt;
          coreK = Math.max(0.4, 2.4 - this.doneAt);
          bob = Math.min(1, this.doneAt * 0.6);
          if (this.doneAt > 1.2) this.fade = Math.max(0, this.fade - dt * 1.2);
        }
        break;
    }
    if (a.status !== "error") this.body.position.x = 0;

    // placas abrem/fecham suavemente
    this.open += (openTarget - this.open) * (1 - Math.exp(-dt * 4));
    // casco "respira": abre um pouco trabalhando, fecha no erro
    this.shellGroup.scale.setScalar(1 + this.open * 1.4);

    // piscar: o traço de luz do visor fecha por um instante a cada poucos segundos
    let eyeY = 1;
    if (t > this.blinkAt) {
      const k = (t - this.blinkAt) / 0.14;
      eyeY = k < 1 ? Math.abs(1 - 2 * k) : 1;
      if (k >= 1) this.blinkAt = t + 3 + Math.random() * 4;
    }
    this.eyes.scale.y = Math.max(0.15, eyeY);

    this.coreMat.color.copy(this.tint).multiplyScalar(coreK);
    this.ringMat.color.copy(this.tint).multiplyScalar(ringK);
    this.body.position.y = bob;
    this.body.rotation.y = Math.sin(ph * 0.35) * 0.18 * bobAmp;
    const s = this.scale * Math.max(0.001, this.fade);
    this.object.scale.setScalar(s);
    this.object.visible = !this.hidden && this.fade > 0.01;
    this.writeBatches(ringK);
  }

  private writeBatches(ringK: number): void {
    if (!batches) return;
    const show = this.object.visible && !!this.object.parent;
    if (show) this.object.updateMatrixWorld(true);
    if (this.ringIdx >= 0) {
      batches.ring.mesh.setMatrixAt(this.ringIdx, show ? this.ring.matrixWorld : ZERO);
      batches.ring.mesh.setColorAt(this.ringIdx, tmpColor.copy(this.tint).multiplyScalar(ringK));
      batches.ring.dirty();
    }
    if (this.shadowIdx >= 0) {
      batches.shadow.mesh.setMatrixAt(this.shadowIdx, show ? this.shadow.matrixWorld : ZERO);
      batches.shadow.dirty();
    }
  }

  dispose(): void {
    batches?.ring.release(this.ringIdx);
    batches?.shadow.release(this.shadowIdx);
    this.object.removeFromParent();
    this.coreMat.dispose();
    this.ringMat.dispose();
  }
}
