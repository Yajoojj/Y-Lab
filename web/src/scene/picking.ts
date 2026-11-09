import * as THREE from "three";
import type { ClientModel } from "../model";
import type { AgentView } from "./agent";
import type { Stage } from "./stage";
import type { Tower } from "./tower";

const DRAG_PX = 5;

/** Clique em agente seleciona; clique em andar foca; hover mostra o nome. */
export function createPicking(stage: Stage, tower: Tower, views: Map<string, AgentView>, model: ClientModel, hoverLabel: HTMLElement): void {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canvas = stage.canvas;
  let down: { x: number; y: number } | undefined;
  let pending: PointerEvent | undefined;

  const toNdc = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
  };

  const hitAgent = (): string | undefined => {
    const targets: THREE.Object3D[] = [];
    for (const v of views.values()) if (v.object.visible) targets.push(v.pickTarget);
    const hit = ray.intersectObjects(targets, false)[0];
    return hit?.object.userData.agentId as string | undefined;
  };

  const hitFloor = (): string | undefined => {
    const hit = ray.intersectObjects(tower.floorMeshes(), false)[0];
    return hit ? tower.teamOf(hit.object) : undefined;
  };

  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_PX) return;
    down = undefined;
    toNdc(e);
    const id = hitAgent();
    if (id) {
      const a = model.state.agents[id];
      if (a && model.focusTeam !== a.team) model.setFocus(a.team);
      model.select(id);
      return;
    }
    const team = hitFloor();
    if (team) {
      model.select(undefined);
      model.setFocus(team === model.focusTeam ? undefined : team);
    }
  });

  canvas.addEventListener("pointermove", (e) => { pending = e; });
  canvas.addEventListener("pointerleave", () => { pending = undefined; hoverLabel.hidden = true; canvas.style.cursor = ""; });

  // hover processado no máximo uma vez por quadro
  stage.onFrame(() => {
    if (!pending) return;
    const e = pending;
    pending = undefined;
    toNdc(e);
    const id = hitAgent();
    const a = id ? model.state.agents[id] : undefined;
    if (a) {
      hoverLabel.textContent = `${a.name} · ${a.step || a.status}`;
      hoverLabel.style.left = `${e.clientX}px`;
      hoverLabel.style.top = `${e.clientY}px`;
      hoverLabel.hidden = false;
      canvas.style.cursor = "pointer";
      return;
    }
    hoverLabel.hidden = true;
    canvas.style.cursor = hitFloor() ? "pointer" : "";
  });
}
