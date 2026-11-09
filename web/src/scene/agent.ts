import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Agent, Shape } from "../../../hub/src/types";

const AMBER = new THREE.Color("#ffb547");
const ICE = new THREE.Color("#4de8ff");
const BONE = new THREE.Color("#ede6dc");
const CRIMSON = new THREE.Color("#ff1f33");

/** Cyberpunk android/drone body shapes — Arasaka universe aesthetic */
function starShape(points: number, outer: number, inner: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

function extrude(shape: THREE.Shape): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.45, bevelEnabled: true, bevelThickness: 0.12,
    bevelSize: 0.08, bevelSegments: 3, curveSegments: 12,
  });
  g.center();
  return g;
}

function blobs(offsets: [number, number, number][], r: number): THREE.BufferGeometry {
  return mergeGeometries(
    offsets.map(([x, y, z]) => new THREE.SphereGeometry(r, 20, 14).translate(x, y, z))
      .map((g) => g.toNonIndexed()),
  )!;
}

/** Android torso: segmented cylinder with shoulder plates */
function androidBody(): THREE.BufferGeometry {
  const torso = new THREE.CylinderGeometry(0.38, 0.32, 0.9, 8);
  const shoulderL = new THREE.BoxGeometry(0.28, 0.18, 0.22).translate(-0.42, 0.3, 0);
  const shoulderR = new THREE.BoxGeometry(0.28, 0.18, 0.22).translate(0.42, 0.3, 0);
  const head = new THREE.SphereGeometry(0.28, 12, 10).translate(0, 0.65, 0);
  const visor = new THREE.BoxGeometry(0.36, 0.08, 0.15).translate(0, 0.68, 0.2);
  return mergeGeometries([torso, shoulderL, shoulderR, head, visor].map(g => g.toNonIndexed()))!;
}

/** Drone body: hovering disc with sensor array */
function droneBody(): THREE.BufferGeometry {
  const disc = new THREE.CylinderGeometry(0.5, 0.45, 0.2, 12);
  const dome = new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.1, 0);
  const sensorL = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6).translate(-0.35, -0.15, 0);
  const sensorR = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6).translate(0.35, -0.15, 0);
  const antenna = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 4).translate(0, 0.35, 0);
  return mergeGeometries([disc, dome, sensorL, sensorR, antenna].map(g => g.toNonIndexed()))!;
}

/** Mech body: bulky armored frame */
function mechBody(): THREE.BufferGeometry {
  const torso = new THREE.BoxGeometry(0.7, 0.8, 0.5);
  const head = new THREE.BoxGeometry(0.35, 0.3, 0.3).translate(0, 0.6, 0);
  const armL = new THREE.BoxGeometry(0.2, 0.6, 0.2).translate(-0.5, 0.1, 0);
  const armR = new THREE.BoxGeometry(0.2, 0.6, 0.2).translate(0.5, 0.1, 0);
  const legL = new THREE.BoxGeometry(0.22, 0.5, 0.22).translate(-0.2, -0.6, 0);
  const legR = new THREE.BoxGeometry(0.22, 0.5, 0.22).translate(0.2, -0.6, 0);
  return mergeGeometries([torso, head, armL, armR, legL, legR].map(g => g.toNonIndexed()))!;
}

const shapeCache = new Map<Shape, THREE.BufferGeometry>();
function shapeGeometry(shape: Shape): THREE.BufferGeometry {
  let g = shapeCache.get(shape);
  if (g) return g;
  switch (shape) {
    case "sphere": g = androidBody(); break;
    case "rounded_cube": g = mechBody(); break;
    case "pill": g = droneBody(); break;
    case "triangle": g = new THREE.ConeGeometry(0.72, 1.15, 3, 1); break;
    case "cone": g = droneBody(); break;
    case "pentagon": g = new THREE.CylinderGeometry(0.62, 0.62, 0.95, 5); break;
    case "hexagon": g = androidBody(); break;
    case "star4": g = extrude(starShape(4, 0.72, 0.3)); break;
    case "star6": g = extrude(starShape(6, 0.7, 0.4)); break;
    case "clover": g = blobs([[0.3, 0, 0], [-0.3, 0, 0], [0, 0.3, 0], [0, -0.3, 0]], 0.36); break;
    case "rounded_square": g = mechBody(); break;
    case "trio": g = blobs([[-0.36, -0.2, 0], [0.36, -0.2, 0], [0, 0.38, 0]], 0.34); break;
  }
  g.computeBoundingSphere();
  shapeCache.set(shape, g);
  return g;
}

// Shared materials — Arasaka cyberpunk palette
const eyeGeo = new THREE.BoxGeometry(0.22, 0.04, 0.06); // Visor slit instead of round eyes
const eyeMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color("#ff1f33").multiplyScalar(3), toneMapped: false,
});
const darkMat = new THREE.MeshStandardMaterial({ color: "#151012", metalness: 0.8, roughness: 0.2 });
const glowRed = new THREE.MeshBasicMaterial({
  color: new THREE.Color("#ff1f33").multiplyScalar(2.5), toneMapped: false,
});
const glowBlue = new THREE.MeshBasicMaterial({
  color: new THREE.Color("#4de8ff").multiplyScalar(2), toneMapped: false,
});
const beaconGeo = new THREE.ConeGeometry(0.42, 0.9, 4, 1, true);
const beaconMat = new THREE.MeshBasicMaterial({
  color: AMBER.clone().multiplyScalar(2.4), toneMapped: false,
  transparent: true, opacity: 0.85, side: THREE.DoubleSide,
});
const ringGeo = new THREE.TorusGeometry(0.85, 0.04, 8, 40);
const errorRingMat = new THREE.MeshBasicMaterial({
  color: ICE.clone().multiplyScalar(2.5), toneMapped: false,
});
const shadowGeo = new THREE.CircleGeometry(0.6, 24);
const shadowMat = new THREE.MeshBasicMaterial({
  color: "#000", transparent: true, opacity: 0.45, depthWrite: false,
});

/** Cyberpunk accessories: neural links, HUD visors, data ports */
function accessory(kind: Agent["look"]["accessory"]): THREE.Object3D | undefined {
  const g = new THREE.Group();
  switch (kind) {
    case "glasses": {
      // Neural visor band across forehead
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.08), glowRed);
      band.position.set(0, 0.72, 0.22);
      const nodeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glowBlue);
      nodeL.position.set(-0.22, 0.72, 0.26);
      const nodeR = nodeL.clone();
      nodeR.position.set(0.22, 0.72, 0.26);
      g.add(band, nodeL, nodeR);
      return g;
    }
    case "antenna": {
      // Comm array: dual prongs with blinking tips
      const rodL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), darkMat);
      rodL.position.set(-0.12, 0.9, 0);
      rodL.rotation.z = 0.15;
      const rodR = rodL.clone();
      rodR.position.set(0.12, 0.9, 0);
      rodR.rotation.z = -0.15;
      const tipL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), glowRed);
      tipL.position.set(-0.15, 1.12, 0);
      const tipR = tipL.clone();
      tipR.position.set(0.15, 1.12, 0);
      g.add(rodL, rodR, tipL, tipR);
      return g;
    }
    case "stem": {
      // Data port spike on neck
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.25, 6), darkMat);
      stem.position.y = 0.78;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glowBlue);
      cap.position.y = 0.92;
      g.add(stem, cap);
      return g;
    }
    case "bow": {
      // Shoulder-mounted winglets
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.12), glowRed);
        wing.position.set(s * 0.35, 0.45, -0.1);
        wing.rotation.z = s * 0.4;
        g.add(wing);
      }
      return g;
    }
    default:
      return undefined;
  }
}

/** Holographic cyberpunk avatar with status-driven animations */
export class AgentView {
  readonly object = new THREE.Group();
  private body: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  private beacon: THREE.Mesh;
  private ring: THREE.Mesh;
  private target = new THREE.Vector3();
  private base = new THREE.Color();
  private agent: Agent;
  private phase = Math.random() * Math.PI * 2;
  private doneAt = -1;
  private fade = 1;
  private placed = false;
  private acc?: THREE.Object3D;
  /** Hidden by tower floor cut */
  hidden = false;

  constructor(agent: Agent) {
    this.agent = agent;
    this.mat = new THREE.MeshStandardMaterial({
      roughness: 0.2, metalness: 0.6, emissiveIntensity: 0.6,
    });
    this.mat.onBeforeCompile = (shader) => {
      // Holographic fresnel rim glow — Arasaka red tint
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.5);
         totalEmissiveRadiance += emissive * fres * 2.5;
         // Scanline effect for hologram feel
         float scan = sin(vViewPosition.y * 40.0 + vNormal.x * 10.0) * 0.5 + 0.5;
         totalEmissiveRadiance *= 0.85 + scan * 0.15;`,
      );
    };
    this.body = new THREE.Mesh(shapeGeometry(agent.look.shape), this.mat);
    this.body.userData.agentId = agent.id;
    this.object.add(this.body);

    // Visor eyes (single slit for cyberpunk look)
    const visor = new THREE.Mesh(eyeGeo, eyeMat);
    visor.position.set(0, 0.12, 0.55);
    this.body.add(visor);

    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.95;
    this.object.add(shadow);

    this.beacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.beacon.position.y = 1.6;
    this.beacon.rotation.x = Math.PI;
    this.object.add(this.beacon);

    this.ring = new THREE.Mesh(ringGeo, errorRingMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = -0.9;
    this.object.add(this.ring);

    this.object.rotation.y = Math.PI / 4;
    this.apply(agent);
  }

  get pickTarget(): THREE.Object3D { return this.body; }
  get id(): string { return this.agent.id; }

  private apply(a: Agent): void {
    const prev = this.agent;
    if (prev.look.shape !== a.look.shape) this.body.geometry = shapeGeometry(a.look.shape);
    if (!this.acc || prev.look.accessory !== a.look.accessory) {
      if (this.acc) this.body.remove(this.acc);
      this.acc = accessory(a.look.accessory);
      if (this.acc) this.body.add(this.acc);
    }
    this.base.set(a.look.color);
    this.mat.color.copy(this.base);
    this.mat.emissive.copy(this.base);
    if (a.status === "done" && prev.status !== "done") this.doneAt = 0;
    if (a.status !== "done") { this.doneAt = -1; this.fade = 1; }
    this.beacon.visible = a.status === "waiting_user";
    this.ring.visible = a.status === "error";
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
    const p = this.object.position;
    p.lerp(this.target, 1 - Math.exp(-dt * 3));
    const ph = t * 2 + this.phase;

    let emissive = 0.6;
    let bob = 0;
    switch (a.status) {
      case "working":
        bob = Math.sin(ph * 1.6) * 0.12;
        emissive = 0.7 + Math.sin(ph * 3) * 0.35;
        this.mat.emissive.copy(this.base);
        // Subtle rotation while working
        this.body.rotation.y = Math.sin(ph * 0.8) * 0.1;
        break;
      case "waiting_user":
        bob = Math.abs(Math.sin(ph * 2.2)) * 0.25;
        emissive = 0.9;
        this.mat.emissive.copy(this.base).lerp(AMBER, 0.5 + 0.5 * Math.sin(ph * 4));
        this.beacon.rotation.y = t * 3;
        break;
      case "error": {
        const glitch = Math.random() > 0.85;
        this.body.position.x = glitch ? (Math.random() - 0.5) * 0.25 : 0;
        emissive = glitch ? 1.6 : 0.5;
        this.mat.emissive.copy(glitch ? ICE : this.base);
        this.ring.scale.setScalar(1 + 0.12 * Math.sin(ph * 6));
        break;
      }
      case "idle":
        bob = Math.sin(ph * 0.6) * 0.05;
        emissive = 0.12;
        this.mat.emissive.copy(this.base);
        this.body.rotation.y = 0;
        break;
      case "done":
        if (this.doneAt >= 0) {
          this.doneAt += dt;
          this.mat.emissive.copy(BONE);
          emissive = Math.max(0, 2.2 - this.doneAt);
          if (this.doneAt > 1.5) this.fade = Math.max(0, this.fade - dt * 1.5);
        }
        break;
    }
    if (a.status !== "error") this.body.position.x = 0;
    this.body.position.y = bob;
    this.mat.emissiveIntensity = emissive;
    this.object.scale.setScalar(Math.max(0.001, this.fade));
    this.object.visible = !this.hidden && this.fade > 0.01;
  }

  dispose(): void {
    this.object.removeFromParent();
    this.mat.dispose();
  }
}