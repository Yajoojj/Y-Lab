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

export function mountHud(root: HTMLElement, model: ClientModel, actions?: HudActions): Hud {
  const top = mountTopbar(root, model, actions);
  mountLeft(root, model);
  mountRight(root, model);
  mountFooter(root, model);

  const banner = h("div", "panel banner", "SINAL PERDIDO — reconectando", { role: "status", hidden: "" });
  const hoverLabel = h("div", "hover-label", "", { hidden: "" });
  root.append(banner, hoverLabel);

  return {
    hoverLabel,
    setOnline(online) {
      banner.hidden = online;
      top.setOnline(online);
    },
  };
}
