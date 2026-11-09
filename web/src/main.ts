import { ClientModel } from "./model";
import { connect } from "./net/stream";
import { mountHud, type HudActions } from "./hud";
import { createLabScene, type LabScene } from "./scene";
import { createPicking } from "./scene/picking";

const LIGHT_KEY = "ylab.light";
function readLight(): boolean {
  try { return localStorage.getItem(LIGHT_KEY) === "1"; } catch { return false; }
}
function saveLight(on: boolean): void {
  try { localStorage.setItem(LIGHT_KEY, on ? "1" : "0"); } catch { /* sem storage */ }
}

const model = new ClientModel();
const canvas = document.getElementById("scene") as HTMLCanvasElement;

let lab: LabScene | undefined;
try {
  lab = createLabScene(canvas, model, readLight());
} catch (e) {
  console.warn("[ylab] cena 3D indisponível:", e);
  canvas.hidden = true;
  document.getElementById("scene-fallback")!.hidden = false;
}

const actions: HudActions | undefined = lab && {
  zoom: (d) => lab!.stage.zoomBy(d),
  setLight: (on) => { lab!.setLight(on); saveLight(on); },
  isLight: () => lab!.isLight(),
};

const hud = mountHud(document.getElementById("hud")!, model, actions);
if (lab) createPicking(lab.stage, lab.tower, lab.views, model, hud.hoverLabel);
connect("/api/stream", model, (online) => hud.setOnline(online));

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    model.select(undefined);
    model.setFocus(undefined);
  }
  const alvo = e.target as HTMLElement | null;
  const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
  if ((e.key === "t" || e.key === "T") && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey) model.toggleAllFloors();
});

export { lab, hud, model };

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__ylab = { lab, model };
