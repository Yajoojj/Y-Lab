import * as THREE from "three";
import type { ClientModel } from "../model";
import type { Agent } from "../../../hub/src/types";
import { AgentView } from "./agent";
import { createCity } from "./city";
import { createPost } from "./post";
import { createRain } from "./rain";
import { createStage, type Stage } from "./stage";
import { Tower, FLOOR_H } from "./tower";

export interface LabScene {
  stage: Stage;
  tower: Tower;
  views: Map<string, AgentView>;
  setLight(light: boolean): void;
  isLight(): boolean;
}

/** zoom que cabe a torre inteira (altura projetada ~0.82h + coroa) */
function overviewZoom(h: number): number {
  return Math.min(1.4, Math.max(0.3, 70 / ((h + 24) * 0.82 + 26)));
}

/** Monta a cena e a mantém sincronizada com o modelo. Lança Error("webgl") sem WebGL. */
export function createLabScene(canvas: HTMLCanvasElement, model: ClientModel, light: boolean): LabScene {
  const stage = createStage(canvas);
  createCity(stage.scene);
  const rain = createRain(stage.scene);
  const tower = new Tower(stage.scene);
  const post = createPost(stage.renderer, stage.scene, stage.camera);
  stage.onResize((w, h) => post.resize(w, h));
  post.resize(window.innerWidth, window.innerHeight);
  stage.setRender((dt) => post.render(dt));

  const views = new Map<string, AgentView>();
  let lightMode = light;
  const applyLight = () => {
    post.setEnabled(!lightMode);
    rain.mesh.visible = !lightMode;
  };
  applyLight();

  const city = stage.scene.children.find((o) => o instanceof THREE.InstancedMesh) as THREE.InstancedMesh | undefined;
  const cityMat = city?.material as THREE.ShaderMaterial | undefined;

  const place = () => {
    tower.sync(model.state.teams);
    const byTeam = new Map<string, Agent[]>();
    for (const a of model.agents()) {
      const list = byTeam.get(a.team) ?? [];
      list.push(a);
      byTeam.set(a.team, list);
    }
    const seen = new Set<string>();
    for (const [team, list] of byTeam) {
      list.sort((x, y) => x.id.localeCompare(y.id));
      const slots = tower.slots(team);
      let d = 0;
      let l = 0;
      for (const a of list) {
        const toLounge = a.status === "idle";
        const pool = toLounge ? slots.lounge : slots.desk;
        const idx = toLounge ? l++ : d++;
        const target = pool[idx % pool.length].clone();
        if (idx >= pool.length) target.y += Math.floor(idx / pool.length) * 1.4;
        let v = views.get(a.id);
        if (!v) {
          v = new AgentView(a);
          views.set(a.id, v);
          stage.scene.add(v.object);
        }
        v.update(a, target);
        v.hidden = !tower.isVisible(team);
        seen.add(a.id);
      }
    }
    for (const [id, v] of views) {
      if (!seen.has(id)) { v.dispose(); views.delete(id); }
    }
  };

  let framed = false;
  model.on((c) => {
    if (c.has("agents") || c.has("teams")) place();
    if (c.has("teams") && !framed && model.state.teams.length) {
      framed = true;
      const h = tower.height();
      stage.frame(new THREE.Vector3(0, (h + 22) * 0.5, 0), overviewZoom(h));
    }
    if (c.has("focus")) {
      tower.setCut(model.focusTeam);
      for (const [id, v] of views) {
        const a = model.state.agents[id];
        if (a) v.hidden = !tower.isVisible(a.team);
      }
      if (model.focusTeam) {
        const y = tower.floorY(model.focusTeam) + FLOOR_H / 2;
        stage.flyTo(new THREE.Vector3(0, y, 0), 2.1);
      } else {
        const h = tower.height();
        stage.flyTo(new THREE.Vector3(0, (h + 22) * 0.5, 0), overviewZoom(h));
      }
    }
  });

  stage.onFrame((dt, t) => {
    rain.update(t);
    tower.tick(t);
    if (cityMat) cityMat.uniforms.time.value = t;
    for (const v of views.values()) if (v.object.parent) v.tick(dt, t);
  });

  return {
    stage,
    tower,
    views,
    setLight(on) { lightMode = on; applyLight(); },
    isLight: () => lightMode,
  };
}
