import "./hud.css";
import type { ClientModel } from "../model";
import { h } from "./dom";
import { mountFooter } from "./footer";
import { mountLeft } from "./left";
import { mountRight } from "./right";
import { mountTopbar, type HudActions } from "./topbar";

export type { HudActions };

export interface Hud {
  setOnline(online: boolean): void;
  hoverLabel: HTMLElement;
}

type Sheet = "floors" | "detail" | "feed";

/** Em telas estreitas os painéis viram gaveta; no desktop o atributo é ignorado. */
function mountDock(root: HTMLElement, model: ClientModel): HTMLElement {
  const dock = h("nav", "dock", undefined, { "aria-label": "Painéis" });
  const items: [Sheet, string][] = [["floors", "Andares"], ["detail", "Detalhe"], ["feed", "Sinal"]];
  const paint = (sheet: string) => {
    root.dataset.sheet = sheet;
    for (const b of dock.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.sheet === sheet));
  };
  for (const [id, label] of items) {
    const btn = h("button", "", label, { type: "button", "data-sheet": id, "aria-pressed": "false" });
    btn.onclick = () => paint(root.dataset.sheet === id ? "" : id);
    dock.append(btn);
  }
  const narrow = window.matchMedia("(max-width: 1023px)");
  model.on((c) => {
    if (narrow.matches && c.has("focus") && model.selected) paint("detail");
  });
  return dock;
}

export function mountHud(root: HTMLElement, model: ClientModel, actions?: HudActions): Hud {
  const top = mountTopbar(root, model, actions);
  mountLeft(root, model);
  mountRight(root, model);
  mountFooter(root, model);

  const banner = h("div", "panel banner", "SINAL PERDIDO — reconectando", { role: "status", hidden: "" });
  const hoverLabel = h("div", "hover-label", "", { hidden: "" });
  root.append(banner, hoverLabel, mountDock(root, model));

  return {
    hoverLabel,
    setOnline(online) {
      banner.hidden = online;
      top.setOnline(online);
    },
  };
}
