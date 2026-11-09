import * as THREE from "three";
import type { Team } from "../../../hub/src/types";
import { MOTION } from "./motion";

/*
 * Y-LAB SPIRE — torre de pesquisa corporativa.
 * Núcleo de concreto nas costas (-x / -z), fachada de vidro fumê nas faces da frente (+x / +z),
 * treliça diagonal de aço por fora, costura vermelha no canto da frente (a assinatura),
 * coroa em degraus com lâmina "Y-LAB", luz de aviação e holofotes.
 * API pública mantida: sync, height, floorY, slots, floorMeshes, teamOf, setCut, isVisible, tick, root.
 */

export const FLOOR_W = 26;
export const FLOOR_D = 18;
export const FLOOR_H = 4;
/** altura do térreo (pódio + lobby) até o primeiro andar */
export const BASE_Y = 6.5;

const HW = FLOOR_W / 2;
const HD = FLOOR_D / 2;
const PLINTH_H = 1.2;

const DESK_COLS = 6;
const DESK_ROWS = 2;
const DESK_DX = 3.4;
const DESK_X0 = -11;
const DESK_ZS = [-4.6, 1.4];

const BONE = new THREE.Color("#ede6dc");
const RED = new THREE.Color("#ff1f33");

/** cor emissiva para MeshBasicMaterial; >1 entra no bloom, <1 não */
const glow = (c: THREE.Color | string, k: number) => new THREE.Color(c).multiplyScalar(k);

// ---------------------------------------------------------------- materiais compartilhados
const mat = {
  concrete: new THREE.MeshStandardMaterial({ color: "#3a383c", roughness: 0.88, metalness: 0.05 }),
  roof: new THREE.MeshStandardMaterial({ color: "#1f1e22", roughness: 0.95, metalness: 0.0 }),
  concreteLight: new THREE.MeshStandardMaterial({ color: "#4a474b", roughness: 0.8, metalness: 0.05 }),
  stone: new THREE.MeshStandardMaterial({ color: "#35323a", roughness: 0.62, metalness: 0.1 }),
  steel: new THREE.MeshStandardMaterial({ color: "#6a6d76", roughness: 0.34, metalness: 0.85 }),
  fascia: new THREE.MeshStandardMaterial({ color: "#2c2c32", roughness: 0.45, metalness: 0.55 }),
  floor: new THREE.MeshStandardMaterial({ color: "#2e2b31", roughness: 0.5, metalness: 0.15, emissive: "#3a2a1c", emissiveIntensity: 0.55 }),
  glass: new THREE.MeshStandardMaterial({
    color: "#26303a", roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.12,
    side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4, forceSinglePass: true,
  }),
  lobbyGlass: new THREE.MeshStandardMaterial({
    color: "#2a2620", roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.22,
    side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true,
  }),
  water: new THREE.MeshStandardMaterial({ color: "#040506", roughness: 0.04, metalness: 1, envMapIntensity: 1.6 }),
  deskTop: new THREE.MeshStandardMaterial({ color: "#d8d1c7", roughness: 0.42, metalness: 0.05 }),
  deskBase: new THREE.MeshStandardMaterial({ color: "#1d1c20", roughness: 0.4, metalness: 0.7 }),
  chair: new THREE.MeshStandardMaterial({ color: "#26232a", roughness: 0.7, metalness: 0.2 }),
  sofa: new THREE.MeshStandardMaterial({ color: "#2f2a2c", roughness: 0.92 }),
  wood: new THREE.MeshStandardMaterial({ color: "#3a2c24", roughness: 0.6 }),
  foliage: new THREE.MeshStandardMaterial({ color: "#1a2621", roughness: 0.9, flatShading: true }),
  pot: new THREE.MeshStandardMaterial({ color: "#2b2a2e", roughness: 0.7 }),
  lightBone: new THREE.MeshBasicMaterial({ color: glow(BONE, 1.6), toneMapped: false }),
  lightBoneSoft: new THREE.MeshBasicMaterial({ color: glow(BONE, 0.9), toneMapped: false }),
  lightWarm: new THREE.MeshBasicMaterial({ color: glow("#ffd9b0", 0.75), toneMapped: false }),
  ceilingGlow: new THREE.MeshBasicMaterial({ color: glow("#f4dcc0", 0.32), toneMapped: false }),
  seam: new THREE.MeshBasicMaterial({ color: glow(RED, 2.4), toneMapped: false }),
  aviation: new THREE.MeshBasicMaterial({ color: glow(RED, 3), toneMapped: false }),
  pickHidden: new THREE.MeshBasicMaterial({ visible: false }),
};

// ---------------------------------------------------------------- geometrias compartilhadas
const geo = {
  slab: new THREE.BoxGeometry(FLOOR_W + 0.4, 0.42, FLOOR_D + 0.4),
  floorTop: new THREE.PlaneGeometry(FLOOR_W - 0.2, FLOOR_D - 0.2).rotateX(-Math.PI / 2),
  edgeLineX: new THREE.BoxGeometry(FLOOR_W + 0.42, 0.05, 0.05),
  edgeLineZ: new THREE.BoxGeometry(0.05, 0.05, FLOOR_D + 0.42),
  backWall: new THREE.BoxGeometry(FLOOR_W, FLOOR_H - 0.42, 0.5),
  sideWall: new THREE.BoxGeometry(0.5, FLOOR_H - 0.42, FLOOR_D),
  glassX: new THREE.PlaneGeometry(FLOOR_W, FLOOR_H - 0.42),
  glassZ: new THREE.PlaneGeometry(FLOOR_D, FLOOR_H - 0.42),
  mullion: new THREE.BoxGeometry(0.07, FLOOR_H - 0.42, 0.14),
  ceilingBar: new THREE.BoxGeometry(FLOOR_W - 6, 0.05, 0.16),
  ceilingPanel: new THREE.PlaneGeometry(FLOOR_W - 1.2, FLOOR_D - 1.2).rotateX(Math.PI / 2),
  wallWash: new THREE.BoxGeometry(FLOOR_W - 1, 0.05, 0.05),
  deskTop: new THREE.BoxGeometry(2.6, 0.08, 1.15),
  deskBase: new THREE.BoxGeometry(0.12, 0.72, 1.0),
  monitor: new THREE.BoxGeometry(1.15, 0.66, 0.04),
  chair: (() => {
    const seat = new THREE.BoxGeometry(0.62, 0.1, 0.6).translate(0, 0.48, 0);
    const back = new THREE.BoxGeometry(0.62, 0.62, 0.08).translate(0, 0.84, 0.28);
    const stem = new THREE.CylinderGeometry(0.04, 0.04, 0.42, 6).translate(0, 0.23, 0);
    const base = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 10).translate(0, 0.02, 0);
    const g = mergeAll([seat, back, stem, base]);
    return g;
  })(),
  sofa: (() => {
    const seat = new THREE.BoxGeometry(4.2, 0.45, 1.1).translate(0, 0.3, 0);
    const back = new THREE.BoxGeometry(4.2, 0.6, 0.28).translate(0, 0.75, -0.42);
    const arm1 = new THREE.BoxGeometry(0.28, 0.55, 1.1).translate(-2.0, 0.5, 0);
    const arm2 = new THREE.BoxGeometry(0.28, 0.55, 1.1).translate(2.0, 0.5, 0);
    return mergeAll([seat, back, arm1, arm2]);
  })(),
  table: new THREE.CylinderGeometry(0.75, 0.75, 0.08, 28),
  tableLeg: new THREE.CylinderGeometry(0.06, 0.2, 0.4, 10),
  lampPole: new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6),
  lampShade: new THREE.CylinderGeometry(0.22, 0.3, 0.32, 16, 1, true),
  pot: new THREE.CylinderGeometry(0.32, 0.26, 0.55, 12),
  bush: new THREE.IcosahedronGeometry(0.55, 0),
  partition: new THREE.PlaneGeometry(8, FLOOR_H - 0.42),
  label: new THREE.PlaneGeometry(8, 2),
  accent: new THREE.BoxGeometry(0.06, 1.6, 0.06),
  pick: new THREE.BoxGeometry(FLOOR_W, FLOOR_H, FLOOR_D),
};

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // junta geometrias simples sem depender de BufferGeometryUtils (todas não indexadas)
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const count = flat.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}

// ---------------------------------------------------------------- texturas
function monitorTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0d0b0e";
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 256; y += 10) {
    const w = 18 + Math.random() * 84;
    const r = Math.random();
    g.fillStyle = r > 0.92 ? "#ff6a5c" : r > 0.8 ? "#9fd6e0" : "#d9d2c6";
    g.globalAlpha = 0.35 + Math.random() * 0.4;
    g.fillRect(10, y, w, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 0.5);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const monTex = monitorTexture();
const monitorMat = new THREE.MeshBasicMaterial({ map: monTex, color: new THREE.Color(0.85, 0.85, 0.85), toneMapped: false });

function labelTexture(num: string, name: string, accent: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = accent;
  g.fillRect(0, 40, 10, 176);
  g.fillStyle = "#ede6dc";
  g.font = "700 150px Rajdhani, 'Segoe UI', sans-serif";
  g.textBaseline = "alphabetic";
  g.fillText(num, 40, 190);
  g.font = "600 52px 'JetBrains Mono', ui-monospace, monospace";
  g.globalAlpha = 0.78;
  const label = name.length > 22 ? name.slice(0, 21) + "…" : name;
  g.fillText(label.toUpperCase(), 270, 175);
  g.globalAlpha = 0.4;
  g.font = "600 26px 'JetBrains Mono', ui-monospace, monospace";
  g.fillText("Y-LAB · DIVISÃO DE PESQUISA", 272, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function signTexture(vertical: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = vertical ? 256 : 1024;
  c.height = vertical ? 1024 : 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ff1f33";
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (vertical) {
    g.font = "700 170px Rajdhani, 'Segoe UI', sans-serif";
    "Y-LAB".split("").forEach((ch, i) => g.fillText(ch, 128, 140 + i * 190));
  } else {
    g.font = "700 150px Rajdhani, 'Segoe UI', sans-serif";
    g.fillText("Y-LAB", 512, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** cone de holofote com alfa que some ao longo do comprimento */
function searchlightMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color("#f3e8dc") }, strength: { value: 0.07 } },
    vertexShader: /* glsl */ `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 color; uniform float strength; varying float vY;
      void main(){ float a = strength * pow(vY, 2.2); gl_FragColor = vec4(color * a, a); }`,
  });
}

interface Floor {
  team: Team;
  /** placa, acento e volume de clique (o resto do andar é instanciado para a torre toda) */
  group: THREE.Group;
  labelTex: THREE.CanvasTexture;
  labelMat: THREE.MeshBasicMaterial;
  accentMat: THREE.MeshBasicMaterial;
  pick: THREE.Mesh;
  label: THREE.Mesh;
}

type PartGroup = "body" | "wall" | "ceiling";
/** lado da planta em que a peça fica; no andar em foco, o lado virado para a câmera some */
type Side = "px" | "nx" | "pz" | "nz";
interface PartDef { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4[]; group: PartGroup; side?: Side }
interface Part { mesh: THREE.InstancedMesh; local: THREE.Matrix4[]; group: PartGroup; side?: Side }
const SIDE_NORMAL: Record<Side, [number, number]> = { px: [1, 0], nx: [-1, 0], pz: [0, 1], nz: [0, -1] };

const ZERO4 = new THREE.Matrix4().makeScale(0, 0, 0);

/** peças de um andar (coordenadas locais); cada uma vira um InstancedMesh para todos os andares */
let partDefsCache: PartDef[] | undefined;
function floorPartDefs(): PartDef[] {
  if (partDefsCache) return partDefsCache;
  const T = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
  const RY = (r: number, x: number, y: number, z: number) => new THREE.Matrix4().makeRotationY(r).setPosition(x, y, z);
  const wy = 0.21 + (FLOOR_H - 0.42) / 2;
  const mullX: THREE.Matrix4[] = [];
  const mullZ: THREE.Matrix4[] = [];
  const nX = 10;
  const nZ = 7;
  for (let i = 1; i <= nX; i++) mullX.push(T(-HW + (i * FLOOR_W) / (nX + 1), wy, HD + 0.02));
  for (let i = 1; i <= nZ; i++) mullZ.push(RY(Math.PI / 2, HW + 0.02, wy, -HD + (i * FLOOR_D) / (nZ + 1)));
  const tops: THREE.Matrix4[] = [];
  const legs: THREE.Matrix4[] = [];
  const mons: THREE.Matrix4[] = [];
  const chairs: THREE.Matrix4[] = [];
  let i = 0;
  for (let r = 0; r < DESK_ROWS; r++) {
    for (let c = 0; c < DESK_COLS; c++, i++) {
      const x = DESK_X0 + c * DESK_DX;
      const z = DESK_ZS[r];
      tops.push(T(x, 0.21 + 0.76, z));
      legs.push(T(x - 1.15, 0.21 + 0.36, z), T(x + 1.15, 0.21 + 0.36, z));
      mons.push(T(x, 0.21 + 1.18, z - 0.38));
      chairs.push(RY(Math.PI + (((i * 37) % 7) - 3) * 0.06, x, 0.21, z + 0.95));
    }
  }
  partDefsCache = [
    { geo: geo.slab, mat: mat.fascia, local: [T(0, 0, 0)], group: "body" },
    { geo: geo.floorTop, mat: mat.floor, local: [T(0, 0.215, 0)], group: "body" },
    { geo: geo.edgeLineX, mat: mat.lightBone, local: [T(0, -0.2, HD + 0.21)], group: "body" },
    { geo: geo.edgeLineZ, mat: mat.lightBone, local: [T(HW + 0.21, -0.2, 0)], group: "body" },
    { geo: geo.backWall, mat: mat.concrete, local: [T(0, wy, -HD + 0.25)], group: "wall", side: "nz" },
    { geo: geo.sideWall, mat: mat.concrete, local: [T(-HW + 0.25, wy, 0)], group: "wall", side: "nx" },
    { geo: geo.wallWash, mat: mat.lightBoneSoft, local: [T(0, FLOOR_H - 0.45, -HD + 0.52)], group: "wall", side: "nz" },
    { geo: geo.glassX, mat: mat.glass, local: [T(0, wy, HD)], group: "wall", side: "pz" },
    { geo: geo.glassZ, mat: mat.glass, local: [RY(Math.PI / 2, HW, wy, 0)], group: "wall", side: "px" },
    { geo: geo.mullion, mat: mat.steel, local: mullX, group: "wall", side: "pz" },
    { geo: geo.mullion, mat: mat.steel, local: mullZ, group: "wall", side: "px" },
    { geo: geo.ceilingBar, mat: mat.lightBone, local: [-5, -0.6, 3.8].map((z) => T(-2, FLOOR_H - 0.28, z)), group: "ceiling" },
    { geo: geo.ceilingPanel, mat: mat.ceilingGlow, local: [T(0, FLOOR_H - 0.22, 0)], group: "ceiling" },
    { geo: geo.deskTop, mat: mat.deskTop, local: tops, group: "body" },
    { geo: geo.deskBase, mat: mat.deskBase, local: legs, group: "body" },
    { geo: geo.monitor, mat: monitorMat, local: mons, group: "body" },
    { geo: geo.chair, mat: mat.chair, local: chairs, group: "body" },
    { geo: geo.partition, mat: mat.glass, local: [RY(Math.PI / 2, 7.4, wy, -4.6)], group: "body" },
    { geo: geo.sofa, mat: mat.sofa, local: [T(10.3, 0.21, -7.6)], group: "body" },
    { geo: geo.table, mat: mat.deskTop, local: [T(10.3, 0.21 + 0.44, -4.6)], group: "body" },
    { geo: geo.tableLeg, mat: mat.deskBase, local: [T(10.3, 0.21 + 0.2, -4.6)], group: "body" },
    { geo: geo.lampPole, mat: mat.deskBase, local: [T(12.4, 0.21 + 0.9, -7.9)], group: "body" },
    { geo: geo.lampShade, mat: mat.lightWarm, local: [T(12.4, 0.21 + 1.85, -7.9)], group: "body" },
    { geo: geo.pot, mat: mat.pot, local: [T(8.1, 0.21 + 0.27, -7.9)], group: "body" },
    { geo: geo.bush, mat: mat.foliage, local: [T(8.1, 0.21 + 0.95, -7.9)], group: "body" },
  ];
  return partDefsCache;
}

export interface Slots {
  desk: THREE.Vector3[];
  lounge: THREE.Vector3[];
}

export class Tower {
  readonly root = new THREE.Group();
  private floors = new Map<string, Floor>();
  private parts: Part[] = [];
  /** lados da planta virados para a câmera (atualizado por setView) */
  private facing = new Set<Side>(["px", "pz"]);
  private facingKey = "px,pz";
  private partFloors = 0;
  private shell = new THREE.Group();
  private crown = new THREE.Group();
  private shellGeos: THREE.BufferGeometry[] = [];
  private shellInst: THREE.InstancedMesh[] = [];
  private key = "";
  private visibleUpTo = Infinity;
  private focusOrder = -1;
  private aviationLights: THREE.Mesh[] = [];
  private searchlights: THREE.Object3D[] = [];
  private readonly signVMat = new THREE.MeshBasicMaterial({ map: signTexture(true), color: glow("#ffffff", 2.2), transparent: true, toneMapped: false, depthWrite: false });
  private readonly signHMat = new THREE.MeshBasicMaterial({ map: signTexture(false), color: glow("#ffffff", 1.6), transparent: true, toneMapped: false, depthWrite: false });
  private readonly beamMat = searchlightMaterial();
  /** luz de interior que acompanha o andar em foco */
  private readonly focusLight = new THREE.PointLight("#ffe4c8", 0, 40, 1.2);

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    this.root.add(this.shell, this.crown, this.focusLight);
    this.buildBase();
  }

  height(): number {
    return BASE_Y + this.floors.size * FLOOR_H;
  }

  sync(teams: Team[]): void {
    const key = JSON.stringify(teams.map((t) => [t.name, t.order, t.color]));
    if (key === this.key) return;
    this.key = key;
    this.disposeFloors();
    this.buildParts(teams.length);
    for (const t of teams) this.floors.set(t.name, this.buildFloor(t));
    this.buildShell(teams.length);
    this.applyCut();
  }

  floorY(team: string): number {
    const f = this.floors.get(team);
    return f ? BASE_Y + f.team.order * FLOOR_H : BASE_Y;
  }

  slots(team: string): Slots {
    const y = this.floorY(team) + 0.21;
    const desk: THREE.Vector3[] = [];
    for (let r = 0; r < DESK_ROWS; r++) {
      for (let c = 0; c < DESK_COLS; c++) desk.push(new THREE.Vector3(DESK_X0 + c * DESK_DX, y + 1.25, DESK_ZS[r] + 1.15));
    }
    // excedente: faixa livre junto ao vidro da frente
    for (let i = 0; i < 18; i++) desk.push(new THREE.Vector3(-11 + (i % 9) * 2.3, y + 1.25, 6.4 + Math.floor(i / 9) * 1.4));
    const lounge: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i++) lounge.push(new THREE.Vector3(8.6 + (i % 3) * 1.75, y + 1.25, -5.4 + Math.floor(i / 3) * 1.7));
    return { desk, lounge };
  }

  floorMeshes(): THREE.Object3D[] {
    return [...this.floors.values()].filter((f) => f.group.visible).map((f) => f.pick);
  }

  teamOf(obj: THREE.Object3D): string | undefined {
    return obj.userData.team as string | undefined;
  }

  setCut(team?: string): void {
    const f = team ? this.floors.get(team) : undefined;
    this.visibleUpTo = f ? f.team.order : Infinity;
    this.focusOrder = f ? f.team.order : -1;
    this.applyCut();
  }

  isVisible(team: string): boolean {
    const f = this.floors.get(team);
    return !f || f.team.order <= this.visibleUpTo;
  }

  /**
   * Informa de onde a câmera olha. No andar em foco, paredes e vidros dos lados virados para a câmera
   * somem, então o interior fica visível de qualquer ângulo.
   */
  setView(camera: THREE.Vector3, target: THREE.Vector3): void {
    const dx = camera.x - target.x;
    const dz = camera.z - target.z;
    const len = Math.hypot(dx, dz) || 1;
    let key = "";
    for (const side of ["px", "nx", "pz", "nz"] as Side[]) {
      const [nx, nz] = SIDE_NORMAL[side];
      if ((nx * dx + nz * dz) / len > 0.2) key += (key ? "," : "") + side;
    }
    if (key === this.facingKey) return;
    this.facingKey = key;
    this.facing = new Set(key ? (key.split(",") as Side[]) : []);
    if (this.visibleUpTo !== Infinity) {
      this.writeParts();
      for (const f of this.floors.values()) f.label.visible = !(f.team.order === this.focusOrder && this.facing.has("nz"));
    }
  }

  tick(t: number): void {
    monTex.offset.y = (t * 0.03 * MOTION) % 1;
    // luz de aviação: pulso lento (~0.5 Hz)
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI);
    mat.aviation.color.copy(RED).multiplyScalar(0.6 + pulse * 2.6);
    for (let i = 0; i < this.searchlights.length; i++) {
      const s = this.searchlights[i];
      s.rotation.y = t * 0.06 * MOTION + i * Math.PI;
    }
  }

  // ---------------------------------------------------------------- corte
  private applyCut(): void {
    const cut = this.visibleUpTo !== Infinity;
    for (const f of this.floors.values()) {
      f.group.visible = f.team.order <= this.visibleUpTo;
      f.label.visible = !(cut && f.team.order === this.focusOrder && this.facing.has("nz"));
    }
    this.writeParts();
    this.crown.visible = !cut;
    this.shell.visible = !cut;
    this.focusLight.intensity = cut ? 45 : 0;
    if (cut) this.focusLight.position.set(-1, BASE_Y + this.focusOrder * FLOOR_H + FLOOR_H + 2.5, 0);
  }

  /** escreve as matrizes das peças instanciadas; andar escondido ou fachada aberta = escala zero */
  private writeParts(): void {
    const cut = this.visibleUpTo !== Infinity;
    const m = new THREE.Matrix4();
    for (const p of this.parts) {
      const n = p.local.length;
      for (const f of this.floors.values()) {
        const o = f.team.order;
        if (o < 0 || o >= this.partFloors) continue; // ordem fora da faixa: ignora em vez de estourar o buffer
        const focused = cut && o === this.focusOrder;
        const hideHere = focused && (p.group === "ceiling" || (p.side !== undefined && this.facing.has(p.side)));
        const show = o <= this.visibleUpTo && !hideHere;
        const y = BASE_Y + o * FLOOR_H;
        for (let j = 0; j < n; j++) {
          if (show) {
            m.copy(p.local[j]);
            m.elements[13] += y;
            p.mesh.setMatrixAt(o * n + j, m);
          } else {
            p.mesh.setMatrixAt(o * n + j, ZERO4);
          }
        }
      }
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private buildParts(floors: number): void {
    const count = Math.max(1, floors);
    this.partFloors = count;
    for (const d of floorPartDefs()) {
      const mesh = new THREE.InstancedMesh(d.geo, d.mat, d.local.length * count);
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, ZERO4);
      mesh.frustumCulled = false;
      this.root.add(mesh);
      this.parts.push({ mesh, local: d.local, group: d.group, side: d.side });
    }
  }

  // ---------------------------------------------------------------- térreo
  private buildBase(): void {
    const base = new THREE.Group();

    // pódio de pedra com escadaria voltada para a câmera
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(46, PLINTH_H, 38), mat.stone);
    plinth.position.y = PLINTH_H / 2;
    base.add(plinth);
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(18, PLINTH_H / 3, 1.0), mat.stone);
      step.position.set(-4, (PLINTH_H / 3) * (2 - i) + PLINTH_H / 6, 19 + 0.5 + i);
      base.add(step);
    }
    const plinthEdge = new THREE.Mesh(new THREE.BoxGeometry(46.05, 0.04, 38.05), mat.lightBoneSoft);
    plinthEdge.position.y = PLINTH_H - 0.05;
    base.add(plinthEdge);

    // lobby de vidro recuado sob a torre (efeito pilotis)
    const lobbyH = BASE_Y - PLINTH_H - 0.25;
    const lobby = new THREE.Group();
    lobby.position.y = PLINTH_H;
    const inset = 1.6;
    const lw = FLOOR_W - inset * 2;
    const ld = FLOOR_D - inset * 2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(lw, lobbyH, 0.4), mat.concreteLight);
    back.position.set(0, lobbyH / 2, -ld / 2);
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.4, lobbyH, ld), mat.concreteLight);
    side.position.set(-lw / 2, lobbyH / 2, 0);
    const glassF = new THREE.Mesh(new THREE.PlaneGeometry(lw, lobbyH), mat.lobbyGlass);
    glassF.position.set(0, lobbyH / 2, ld / 2);
    const glassS = new THREE.Mesh(new THREE.PlaneGeometry(ld, lobbyH), mat.lobbyGlass);
    glassS.rotation.y = Math.PI / 2;
    glassS.position.set(lw / 2, lobbyH / 2, 0);
    // parede de luz quente no fundo do lobby e balcão de recepção
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(lw - 2, lobbyH - 1.2), mat.lightWarm);
    wash.position.set(0, lobbyH / 2, -ld / 2 + 0.22);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 1.4), mat.deskTop);
    desk.position.set(-2, 0.55, -ld / 2 + 3);
    const lobbyLogo = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), this.signHMat);
    lobbyLogo.position.set(-2, lobbyH - 1.3, -ld / 2 + 0.25);
    lobby.add(back, side, glassF, glassS, wash, desk, lobbyLogo);
    base.add(lobby);

    // marquise em balanço sobre a entrada, com luz embutida
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 0.35, 6), mat.fascia);
    canopy.position.set(-4, BASE_Y - 0.9, HD + 2.4);
    const canopyLight = new THREE.Mesh(new THREE.BoxGeometry(12, 0.03, 0.12), mat.lightBone);
    canopyLight.position.set(-4, BASE_Y - 1.09, HD + 4.4);
    base.add(canopy, canopyLight);

    // espelho d'água à direita
    const pool = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 22), mat.water);
    pool.position.set(HW + 5.5, PLINTH_H + 0.04, 2);
    const poolEdge = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.18, 22.4), mat.concreteLight);
    poolEdge.position.set(HW + 5.5, PLINTH_H + 0.0, 2);
    base.add(poolEdge, pool);

    // jardineiras com árvores e luz de baixo para cima
    const treeSpots: [number, number][] = [[-19, 15], [-19, 9], [-19, 3], [9, 16.5]];
    for (const [x, z] of treeSpots) {
      const planter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 2.4), mat.concreteLight);
      planter.position.set(x, PLINTH_H + 0.35, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 6), mat.wood);
      trunk.position.set(x, PLINTH_H + 1.8, z);
      const crownA = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), mat.foliage);
      crownA.position.set(x, PLINTH_H + 3.3, z);
      const up = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2), mat.lightBoneSoft);
      up.position.set(x + 0.6, PLINTH_H + 0.71, z + 0.6);
      base.add(planter, trunk, crownA, up);
    }

    // totem de entrada
    const totem = new THREE.Mesh(new THREE.BoxGeometry(1.0, 5.2, 2.6), mat.fascia);
    totem.position.set(-17, PLINTH_H + 2.6, 18.2);
    const totemSign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.6), this.signVMat);
    totemSign.rotation.y = Math.PI / 2;
    totemSign.position.set(-16.48, PLINTH_H + 2.7, 18.2);
    base.add(totem, totemSign);

    // pilares do térreo nos cantos
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, BASE_Y - PLINTH_H, 0.8), mat.steel);
      p.position.set(x * (HW - 0.4), PLINTH_H + (BASE_Y - PLINTH_H) / 2, z * (HD - 0.4));
      base.add(p);
    }
    this.root.add(base);
  }

  // ---------------------------------------------------------------- andar
  /** só o que muda por andar: placa com número e nome, acento na cor do time e volume de clique */
  private buildFloor(team: Team): Floor {
    const g = new THREE.Group();
    g.position.y = BASE_Y + team.order * FLOOR_H;
    const labelTex = labelTexture(String(team.order + 1).padStart(2, "0"), team.name, team.color);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, toneMapped: false, depthWrite: false, color: new THREE.Color(0.95, 0.95, 0.95) });
    const label = new THREE.Mesh(geo.label, labelMat);
    label.position.set(-5, FLOOR_H - 1.45, -HD + 0.52);
    const accentMat = new THREE.MeshBasicMaterial({ color: glow(team.color, 1.3), toneMapped: false });
    const accent = new THREE.Mesh(geo.accent, accentMat);
    accent.position.set(HW + 0.3, 0.21 + 1.1, HD + 0.3);
    const pick = new THREE.Mesh(geo.pick, mat.pickHidden);
    pick.position.y = FLOOR_H / 2;
    pick.userData.team = team.name;
    g.add(label, accent, pick);
    this.root.add(g);
    return { team, group: g, labelTex, labelMat, accentMat, pick, label };
  }

  // ---------------------------------------------------------------- exoesqueleto e coroa
  private buildShell(count: number): void {
    for (const o of [...this.shell.children, ...this.crown.children]) o.removeFromParent();
    for (const g of this.shellGeos) g.dispose();
    for (const m of this.shellInst) m.dispose();
    this.shellGeos = [];
    this.shellInst = [];
    this.aviationLights = [];
    this.searchlights = [];

    const floors = Math.max(1, count);
    const h = floors * FLOOR_H;
    const top = BASE_Y + h;
    const own = <T extends THREE.BufferGeometry>(g: T): T => { this.shellGeos.push(g); return g; };

    // pilares de canto e a costura vermelha (a assinatura) no canto da frente
    const pillar = own(new THREE.BoxGeometry(0.8, h + 0.6, 0.8));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const p = new THREE.Mesh(pillar, mat.steel);
      p.position.set(x * (HW + 0.15), BASE_Y + h / 2, z * (HD + 0.15));
      this.shell.add(p);
    }
    const seam = new THREE.Mesh(own(new THREE.BoxGeometry(0.1, h + 0.6, 0.1)), mat.seam);
    seam.position.set(HW + 0.6, BASE_Y + h / 2, HD + 0.6);
    this.shell.add(seam);

    // treliça diagonal (diagrid) nas faces da frente, módulos de 2 andares
    const bandH = FLOOR_H * 2;
    const bands = Math.ceil(floors / 2);
    const faces: { modules: number; width: number; place: (u: number, y: number) => THREE.Vector3; rotY: number }[] = [
      { modules: 4, width: FLOOR_W, place: (u, y) => new THREE.Vector3(-HW + u, y, HD + 0.75), rotY: 0 },
      { modules: 3, width: FLOOR_D, place: (u, y) => new THREE.Vector3(HW + 0.75, y, HD - u), rotY: Math.PI / 2 },
    ];
    const total = faces.reduce((n, f) => n + f.modules * bands * 2, 0);
    const memberGeo = own(new THREE.BoxGeometry(0.22, 1, 0.22));
    const members = new THREE.InstancedMesh(memberGeo, mat.steel, total);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qy = new THREE.Quaternion();
    const qz = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let k = 0;
    for (const f of faces) {
      const mw = f.width / f.modules;
      for (let b = 0; b < bands; b++) {
        const bh = Math.min(bandH, h - b * bandH);
        const y0 = BASE_Y + b * bandH;
        const len = Math.hypot(mw, bh);
        const ang = Math.atan2(mw, bh);
        for (let m = 0; m < f.modules; m++) {
          for (const dir of [1, -1]) {
            const center = f.place(m * mw + mw / 2, y0 + bh / 2);
            qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.rotY);
            qz.setFromAxisAngle(new THREE.Vector3(0, 0, 1), dir * ang);
            q.copy(qy).multiply(qz);
            s.set(1, len, 1);
            members.setMatrixAt(k++, m4.compose(center, q, s));
          }
        }
      }
    }
    members.count = k;
    this.shell.add(members);
    this.shellInst.push(members);

    // coroa em degraus no núcleo (puxada para trás)
    const roof = new THREE.Mesh(own(new THREE.BoxGeometry(FLOOR_W + 1.2, 0.6, FLOOR_D + 1.2)), mat.roof);
    roof.position.y = top + 0.3;
    const tier1 = new THREE.Mesh(own(new THREE.BoxGeometry(18, 5, 12)), mat.concrete);
    tier1.position.set(-3, top + 3.1, -2.5);
    const tier2 = new THREE.Mesh(own(new THREE.BoxGeometry(11, 4, 8)), mat.concrete);
    tier2.position.set(-5, top + 7.6, -4);
    const band1 = new THREE.Mesh(own(new THREE.BoxGeometry(18.1, 0.05, 12.1)), mat.lightBone);
    band1.position.set(-3, top + 5.55, -2.5);
    const band2 = new THREE.Mesh(own(new THREE.BoxGeometry(11.1, 0.05, 8.1)), mat.lightBone);
    band2.position.set(-5, top + 9.55, -4);
    const roofLine = new THREE.Mesh(own(new THREE.BoxGeometry(FLOOR_W + 1.25, 0.05, FLOOR_D + 1.25)), mat.lightBoneSoft);
    roofLine.position.y = top + 0.57; // só a borda aparece além do telhado

    // lâmina vertical com a assinatura Y-LAB
    const blade = new THREE.Mesh(own(new THREE.BoxGeometry(1.2, 16, 4.2)), mat.fascia);
    blade.position.set(6.6, top + 8, 3.2);
    const bladeSign = new THREE.Mesh(own(new THREE.PlaneGeometry(3.4, 13.6)), this.signVMat);
    bladeSign.rotation.y = Math.PI / 2;
    bladeSign.position.set(7.22, top + 8, 3.2);
    const bladeSign2 = new THREE.Mesh(own(new THREE.PlaneGeometry(1.0, 13.6)), this.signVMat);
    bladeSign2.position.set(6.6, top + 8, 5.32);

    // mastro com luz de aviação
    const mast = new THREE.Mesh(own(new THREE.CylinderGeometry(0.07, 0.22, 12, 8)), mat.steel);
    mast.position.set(-5, top + 15.6, -4);
    const lamp = new THREE.Mesh(own(new THREE.SphereGeometry(0.28, 12, 8)), mat.aviation);
    lamp.position.set(-5, top + 21.7, -4);
    const lamp2 = new THREE.Mesh(own(new THREE.SphereGeometry(0.2, 10, 8)), mat.aviation);
    lamp2.position.set(6.6, top + 16.2, 3.2);
    this.aviationLights.push(lamp, lamp2);

    // dois holofotes varrendo o céu bem devagar
    const beamGeo = own(new THREE.ConeGeometry(4.5, 70, 24, 1, true).translate(0, -35, 0).rotateX(Math.PI));
    for (const [x, z] of [[-9, -6], [3, -6]] as const) {
      const pivot = new THREE.Object3D();
      pivot.position.set(x, top + 5.7, z);
      const beam = new THREE.Mesh(beamGeo, this.beamMat);
      beam.rotation.z = 0.55;
      pivot.add(beam);
      this.crown.add(pivot);
      this.searchlights.push(pivot);
    }

    this.crown.add(roof, roofLine, tier1, tier2, band1, band2, blade, bladeSign, bladeSign2, mast, lamp, lamp2);
  }

  private disposeFloors(): void {
    for (const f of this.floors.values()) {
      f.group.removeFromParent();
      f.labelTex.dispose();
      f.labelMat.dispose();
      f.accentMat.dispose();
    }
    this.floors.clear();
    for (const p of this.parts) {
      p.mesh.removeFromParent();
      p.mesh.dispose();
    }
    this.parts = [];
  }

}
