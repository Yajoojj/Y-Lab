import type { ClientModel } from "../model";
import type { Status } from "../../../hub/src/types";
import { h } from "./dom";

export interface HudActions {
  zoom(delta: number): void;
  setLight(light: boolean): void;
  isLight(): boolean;
}

const COUNTERS: [Status, string][] = [
  ["working", "trabalhando"],
  ["waiting_user", "esperando"],
  ["error", "erros"],
  ["idle", "ociosos"],
];

export function mountTopbar(root: HTMLElement, model: ClientModel, actions?: HudActions): { setOnline(online: boolean): void } {
  const bar = h("header", "topbar");

  const brand = h("div", "panel brand");
  const logo = h("span", "logo", "Y-LAB");
  const live = h("span", "live");
  const liveDot = h("i", "dot", undefined, { "aria-hidden": "true" });
  const liveText = h("span", "", "Live");
  live.append(liveDot, liveText);
  brand.append(logo, live);

  const counters = h("div", "panel counters", undefined, { "aria-live": "polite" });
  const values = new Map<Status, HTMLElement>();
  for (const [st, label] of COUNTERS) {
    const c = h("span", `counter st-${st}`);
    const b = h("b", "", "0");
    values.set(st, b);
    c.append(b, h("span", "", label));
    counters.append(c);
  }

  bar.append(brand, counters);

  if (actions) {
    const tools = h("div", "panel tools");
    const minus = h("button", "", "−", { "aria-label": "Afastar" });
    const plus = h("button", "", "+", { "aria-label": "Aproximar" });
    const light = h("button", "", "Modo leve", { "aria-pressed": String(actions.isLight()) });
    minus.onclick = () => actions.zoom(-1);
    plus.onclick = () => actions.zoom(1);
    light.onclick = () => {
      const next = !actions.isLight();
      actions.setLight(next);
      light.setAttribute("aria-pressed", String(next));
    };
    // o modo leve pode ser ligado sozinho (máquina lenta): mantém o botão em sincronia
    window.addEventListener("ylab:light", (e) => light.setAttribute("aria-pressed", String((e as CustomEvent<boolean>).detail)));
    tools.append(minus, plus, light);
    bar.append(tools);
  }

  root.append(bar);

  const clock = () => { liveText.textContent = `Live · ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`; };
  clock();
  setInterval(clock, 15_000);

  model.on((changed) => {
    if (!changed.has("agents")) return;
    const c = model.counts();
    for (const [st, el] of values) el.textContent = String(c[st]);
  });

  return {
    setOnline(online) {
      brand.classList.toggle("offline", !online);
    },
  };
}
