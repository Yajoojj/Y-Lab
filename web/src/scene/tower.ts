import * as THREE from "three";
import type { Team } from "../../../hub/src/types";

export const FLOOR_W = 26;
export const FLOOR_D = 18;
export const FLOOR_H = 4;
export const BASE_Y = 2;

const DESK_COLS = 6;
const DESK_ROWS = 2;
const DESK_DX = 3.4;
const DESK_X0 = -11.5;
const DESK_ZS = [-4.2, 1.8];

// Shared geometries — reused across all floors for performance
const geo = {
  slab: new THREE.BoxGeometry(FLOOR_W, 0.35, FLOOR_D),
  edgeX: new THREE.BoxGeometry(FLOOR_W, 0.08, 0.08),
  edgeZ: new THREE.BoxGeometry(0.08, 0.08, FLOOR_D),
  wallBack: new THREE.PlaneGeometry(FLOOR_W, FLOOR_H - 0.35),
  wallSide: new THREE.PlaneGeometry(FLOOR_D, FLOOR_H - 0.35),
  mullion: new THREE.BoxGeometry(0.08, FLOOR_H - 0.35, 0.08),
  desk: new THREE.BoxGeometry(2.6, 0.12, 1.2),
  deskLeg: new THREE.BoxGeometry(2.4, 0.7, 0.9),
  monitor: new THREE.PlaneGeometry(1.1, 0.62),
  sofa: new THREE.BoxGeometry(4.2, 0.6, 1.3),
  sofaBack: new THREE.BoxGeometry(4.2, 0.9, 0.35),
  table: new THREE.CylinderGeometry(0.7, 0.7, 0.45, 24),
  label: new THREE.PlaneGeometry(9, 1.4),
  // Arasaka ambient details
  ceilingLight: new THREE.BoxGeometry(3.5, 0.06, 0.3),
  serverRack: new THREE.BoxGeometry(0.8, 2.2, 0.6),
  holoPanel: new THREE.PlaneGeometry(1.8, 1.0),
  floorStrip: new THREE.BoxGeometry(FLOOR_W - 2, 0.02, 0.15),
};

const mat = {
  slab: new THREE.MeshStandardMaterial({ color: "#0d0a0c", roughness: 0.5, metalness: 0.7 }),
  floorTop: new THREE.MeshStandardMaterial({ color: "#151012", roughness: 0.25, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({
    color: "#1a0e12", roughness: 0.05, metalness: 0.95,
    transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false,
  }),
  mullion: new THREE.MeshStandardMaterial({ color: "#2a2326", roughness: 0.3, metalness: 0.85 }),
  desk: new THREE.MeshStandardMaterial({ color: "#1a1518", roughness: 0.3, metalness: 0.7 }),
  deskBase: new THREE.MeshStandardMaterial({ color: "#0e0a0c", roughness: 0.5, metalness: 0.6 }),
  sofa: new THREE.MeshStandardMaterial({ color: "#2a0810", roughness: 0.7, metalness: 0.2 }),
  table: new THREE.MeshStandardMaterial({ color: "#1a1518", roughness: 0.3, metalness: 0.6 }),
  strip: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff1f33").multiplyScalar(2.2), toneMapped: false }),
  // Arasaka ambient materials
  ceilingLight: new THREE.MeshBasicMaterial({
    color: new THREE.Color("#ede6dc").multiplyScalar(1.8), toneMapped: false,
  }),
  serverRack: new THREE.MeshStandardMaterial({ color: "#0a0809", roughness: 0.4, metalness: 0.8 }),
  serverLed: new THREE.MeshBasicMaterial({
    color: new THREE.Color("#ff1f33").multiplyScalar(2), toneMapped: false,
  }),
  holoPanel: new THREE.MeshBasicMaterial({
    color: new THREE.Color("#4de8ff").multiplyScalar(1.5), toneMapped: false,
    transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
  }),
  floorStrip: new THREE.MeshBasicMaterial({
    color: new THREE.Color("#ff1f33").multiplyScalar(0.8), toneMapped: false,
    transparent: true, opacity: 0.4,
  }),
};

/** Monitor texture with scrolling Arasaka-style data streams */
function monitorTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0a0408";
  g.fillRect(0, 0, 128, 256);
  for (let y = 4; y < 256; y += 7) {
    const w = 15 + Math.random() * 100;
    // Arasaka palette: crimson, bone, steel blue, ember
    const colors = ["#ff1f33", "#ede6dc", "#4de8ff", "#ff8a3d"];
    g.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    g.globalAlpha = 0.4 + Math.random() * 0.6;
    g.fillRect(6, y, w, 2);
  }
  // Corporate logo placeholder: horizontal bars
  g.globalAlpha = 0.9;
  g.fillStyle = "#ff1f33";
  g.fillRect(40, 100, 48, 4);
  g.fillRect(44, 108, 40, 3);
  g.fillRect(48, 115, 32, 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 0.5);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const monTex = monitorTexture();
const monitorMat = new THREE.MeshBasicMaterial({
  map: monTex, color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false, side: THREE.DoubleSide,
});

function textTexture(text: string, color: string, sub?: string, width = 1024): THREE.CanvasTexture {
  const center = width !== 1024;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.font = "700 104px Rajdhani, 'Segoe UI', sans-serif";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 18;
  if (center) g.textAlign = "center";
  g.fillText(text, center ? width / 2 : 16, 70);
  if (sub) {
    g.font = "600 34px 'JetBrains Mono', monospace";
    g.shadowBlur = 0;
    g.fillStyle = "#ede6dc";
    g.globalAlpha = 0.7;
    g.fillText(sub, center ? width / 2 : 18, 134);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sanitizeLabel(s: string): string {
  return s.length > 22 ? s.slice(0, 21) + "…" : s;
}

interface Floor {
  team: Team;
  group: THREE.Group;
  edgeMat: THREE.MeshBasicMaterial;
  labelTex: THREE.CanvasTexture;
  labelMat: THREE.MeshBasicMaterial;
  pick: THREE.Mesh;
}

export interface Slots {
  desk: THREE.Vector3[];
  lounge: THREE.Vector3[];
}

export class Tower {
  readonly root = new THREE.Group();
  private floors = new Map<string, Floor>();
  private crown = new THREE.Group();
  private shell = new THREE.Group();
  private signMat: THREE.MeshBasicMaterial;
  private key = "";
  private visibleUpTo = Infinity;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    this.root.add(this.shell, this.crown);

    // Podium with Arasaka-style stepped base
    const podium = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W + 8, 2, FLOOR_D + 8), mat.slab);
    podium.position.y = 0;
    this.root.add(podium);
    const podiumStep = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W + 5, 0.8, FLOOR_D + 5), mat.slab);
    podiumStep.position.y = 1.4;
    this.root.add(podiumStep);
    const podiumStrip = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W + 8.1, 0.12, FLOOR_D + 8.1), mat.strip);
    podiumStrip.position.y = 0.9;
    this.root.add(podiumStrip);
    const podiumStrip2 = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W + 5.1, 0.08, FLOOR_D + 5.1), mat.strip);
    podiumStrip2.position.y = 1.8;
    this.root.add(podiumStrip2);

    this.signMat = new THREE.MeshBasicMaterial({
      map: textTexture("Y-LAB", "#ff1f33", "RESEARCH · OPERATIONS", 560),
      color: new THREE.Color(2.4, 2.4, 2.4), transparent: true, toneMapped: false, depthWrite: false,
    });
  }

  height(): number {
    return BASE_Y + this.floors.size * FLOOR_H;
  }

  sync(teams: Team[]): void {
    const key = JSON.stringify(teams.map((t) => [t.name, t.order, t.color]));
    if (key === this.key) return;
    this.key = key;
    for (const f of this.floors.values()) this.disposeFloor(f);
    this.floors.clear();
    for (const t of teams) this.floors.set(t.name, this.buildFloor(t));
    this.buildShell(teams.length);
    this.applyCut();
  }

  floorY(team: string): number {
    const f = this.floors.get(team);
    return f ? BASE_Y + f.team.order * FLOOR_H : BASE_Y;
  }

  slots(team: string): Slots {
    const y = this.floorY(team) + 0.18;
    const desk: THREE.Vector3[] = [];
    for (let r = 0; r < DESK_ROWS; r++) {
      for (let c = 0; c < DESK_COLS; c++) desk.push(new THREE.Vector3(DESK_X0 + c * DESK_DX, y + 1.15, DESK_ZS[r] + 1.25));
    }
    for (let i = 0; i < 18; i++) desk.push(new THREE.Vector3(-11.5 + (i % 9) * 2.4, y + 1.15, 6.6 + Math.floor(i / 9) * 1.6));
    const lounge: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i++) lounge.push(new THREE.Vector3(9.2 + (i % 3) * 1.4, y + 1.1, -6 + Math.floor(i / 3) * 1.5));
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
    this.applyCut();
  }

  isVisible(team: string): boolean {
    const f = this.floors.get(team);
    return !f || f.team.order <= this.visibleUpTo;
  }

  tick(t: number): void {
    monTex.offset.y = (t * 0.08) % 1;
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
    for (const f of this.floors.values()) f.edgeMat.color.set(f.team.color).multiplyScalar(1.4 + pulse * 0.8);
  }

  private applyCut(): void {
    for (const f of this.floors.values()) f.group.visible = f.team.order <= this.visibleUpTo;
    const cut = this.visibleUpTo !== Infinity;
    this.crown.visible = !cut;
    this.shell.visible = !cut;
  }

  private buildFloor(team: Team): Floor {
    const g = new THREE.Group();
    g.position.y = BASE_Y + team.order * FLOOR_H;

    const slab = new THREE.Mesh(geo.slab, mat.floorTop);
    g.add(slab);

    // Neon edge strips — team-colored
    const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(team.color).multiplyScalar(2), toneMapped: false });
    for (const z of [-FLOOR_D / 2, FLOOR_D / 2]) {
      const e = new THREE.Mesh(geo.edgeX, edgeMat);
      e.position.set(0, 0.2, z);
      g.add(e);
    }
    for (const x of [-FLOOR_W / 2, FLOOR_W / 2]) {
      const e = new THREE.Mesh(geo.edgeZ, edgeMat);
      e.position.set(x, 0.2, 0);
      g.add(e);
    }

    // Glass walls with mullions — back and left side only (camera clearance)
    const wy = (FLOOR_H - 0.35) / 2 + 0.17;
    const back = new THREE.Mesh(geo.wallBack, mat.glass);
    back.position.set(0, wy, -FLOOR_D / 2);
    const side = new THREE.Mesh(geo.wallSide, mat.glass);
    side.rotation.y = Math.PI / 2;
    side.position.set(-FLOOR_W / 2, wy, 0);
    g.add(back, side);
    for (let i = 0; i <= 8; i++) {
      const m = new THREE.Mesh(geo.mullion, mat.mullion);
      m.position.set(-FLOOR_W / 2 + (i * FLOOR_W) / 8, wy, -FLOOR_D / 2);
      g.add(m);
    }
    for (let i = 1; i <= 5; i++) {
      const m = new THREE.Mesh(geo.mullion, mat.mullion);
      m.position.set(-FLOOR_W / 2, wy, -FLOOR_D / 2 + (i * FLOOR_D) / 5);
      g.add(m);
    }

    // Desks, bases and monitors — instanced for performance
    const n = DESK_COLS * DESK_ROWS;
    const desks = new THREE.InstancedMesh(geo.desk, mat.desk, n);
    const bases = new THREE.InstancedMesh(geo.deskLeg, mat.deskBase, n);
    const mons = new THREE.InstancedMesh(geo.monitor, monitorMat, n);
    const m4 = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < DESK_ROWS; r++) {
      for (let c = 0; c < DESK_COLS; c++, i++) {
        const x = DESK_X0 + c * DESK_DX;
        const z = DESK_ZS[r];
        desks.setMatrixAt(i, m4.makeTranslation(x, 0.98, z));
        bases.setMatrixAt(i, m4.makeTranslation(x, 0.55, z));
        mons.setMatrixAt(i, m4.makeTranslation(x, 1.45, z - 0.35));
      }
    }
    g.add(desks, bases, mons);

    // Lounge area
    const sofa = new THREE.Mesh(geo.sofa, mat.sofa);
    sofa.position.set(10.6, 0.5, -7.6);
    const sofaBack = new THREE.Mesh(geo.sofaBack, mat.sofa);
    sofaBack.position.set(10.6, 0.95, -8.2);
    const table = new THREE.Mesh(geo.table, mat.table);
    table.position.set(10.6, 0.4, -3.5);
    g.add(sofa, sofaBack, table);

    // === Arasaka ambient details ===

    // Ceiling light strips (recessed linear lights)
    for (const zOff of [-3, 3]) {
      const light = new THREE.Mesh(geo.ceilingLight, mat.ceilingLight);
      light.position.set(0, FLOOR_H - 0.2, zOff);
      g.add(light);
    }

    // Server rack against back wall
    const rack = new THREE.Mesh(geo.serverRack, mat.serverRack);
    rack.position.set(-10, 1.3, -FLOOR_D / 2 + 0.5);
    g.add(rack);
    // LED indicators on rack
    for (let ly = 0; ly < 4; ly++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), mat.serverLed);
      led.position.set(-9.7, 0.6 + ly * 0.4, -FLOOR_D / 2 + 0.82);
      g.add(led);
    }

    // Holographic status panel on side wall
    const holo = new THREE.Mesh(geo.holoPanel, mat.holoPanel);
    holo.rotation.y = Math.PI / 2;
    holo.position.set(-FLOOR_W / 2 + 0.05, 2.2, 3);
    g.add(holo);

    // Floor guide strips (Arasaka red path lighting)
    const strip = new THREE.Mesh(geo.floorStrip, mat.floorStrip);
    strip.position.set(0, 0.19, 0);
    g.add(strip);

    // Floor label on back wall
    const labelTex = textTexture(`${String(team.order + 1).padStart(2, "0")}  ${sanitizeLabel(team.name.toUpperCase())}`, team.color);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, toneMapped: false, depthWrite: false });
    const label = new THREE.Mesh(geo.label, labelMat);
    label.position.set(-4, FLOOR_H - 1.2, -FLOOR_D / 2 + 0.05);
    g.add(label);

    // Invisible pick volume for floor clicking
    const pick = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, FLOOR_H, FLOOR_D), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = FLOOR_H / 2;
    pick.userData.team = team.name;
    g.add(pick);

    this.root.add(g);
    return { team, group: g, edgeMat, labelTex, labelMat, pick };
  }

  /** Pillars, crown, spire and signage — Arasaka corporate tower aesthetic */
  private buildShell(count: number): void {
    for (const o of [...this.shell.children, ...this.crown.children]) {
      o.removeFromParent();
      if ((o as THREE.Mesh).geometry && !Object.values(geo).includes((o as THREE.Mesh).geometry as never)) (o as THREE.Mesh).geometry.dispose();
    }
    const h = Math.max(1, count) * FLOOR_H;
    const pillar = new THREE.BoxGeometry(0.5, h + 1, 0.5);
    const stripGeo = new THREE.BoxGeometry(0.12, h + 1, 0.12);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const p = new THREE.Mesh(pillar, mat.slab);
      p.position.set((x * FLOOR_W) / 2, BASE_Y + h / 2, (z * FLOOR_D) / 2);
      const s = new THREE.Mesh(stripGeo, mat.strip);
      s.position.set((x * (FLOOR_W + 0.6)) / 2, BASE_Y + h / 2, (z * (FLOOR_D + 0.6)) / 2);
      this.shell.add(p, s);
    }

    const top = BASE_Y + h;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W + 0.6, 0.6, FLOOR_D + 0.6), mat.slab);
    roof.position.y = top + 0.3;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W * 0.6, 5, FLOOR_D * 0.6), mat.slab);
    crown.position.y = top + 3.1;
    const crownStrip = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W * 0.6 + 0.1, 0.18, FLOOR_D * 0.6 + 0.1), mat.strip);
    crownStrip.position.y = top + 5.2;
    const crownBase = crownStrip.clone();
    crownBase.position.y = top + 0.75;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 14, 8), mat.mullion);
    spire.position.y = top + 12.6;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), mat.strip);
    beacon.position.y = top + 19.8;
    beacon.userData.beacon = true;

    // Signage facing camera (+z and +x faces)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(15, 4.3), this.signMat);
    sign.position.set(0, top + 3.0, (FLOOR_D * 0.6) / 2 + 0.05);
    const sign2 = sign.clone();
    sign2.rotation.y = Math.PI / 2;
    sign2.position.set((FLOOR_W * 0.6) / 2 + 0.05, top + 3.0, 0);
    this.crown.add(roof, crown, crownStrip, crownBase, spire, beacon, sign, sign2);
  }

  private disposeFloor(f: Floor): void {
    f.group.removeFromParent();
    f.labelTex.dispose();
    f.labelMat.dispose();
    f.edgeMat.dispose();
    f.pick.geometry.dispose();
    (f.pick.material as THREE.Material).dispose();
    f.group.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
  }
}