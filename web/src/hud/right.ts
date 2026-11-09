import type { ClientModel } from "../model";
import type { Agent } from "../../../hub/src/types";
import { activate, ago, dot, h, hhmm, keepFocus, STATUS_LABEL } from "./dom";

const STATUS_VAR: Record<Agent["status"], string> = {
  working: "var(--s-working)",
  idle: "var(--s-idle)",
  waiting_user: "var(--s-waiting_user)",
  error: "var(--s-error)",
  done: "var(--s-done)",
};

function badge(a: Agent): HTMLElement {
  const b = h("span", "badge");
  b.style.setProperty("--c", STATUS_VAR[a.status]);
  b.append(dot(a.status), h("span", "", STATUS_LABEL[a.status]));
  return b;
}

function inspector(model: ClientModel, a: Agent): HTMLElement {
  const card = h("section", "panel card", undefined, { "aria-label": `Agente ${a.name}` });
  card.style.setProperty("--accent", a.look.color);
  const head = h("div", "card-head");
  const av = h("div", "avatar");
  av.style.setProperty("--c", a.look.color);
  const titles = h("div");
  titles.append(h("h2", "", a.name), h("div", "sub", `${a.team} · ${a.role ?? a.source}`));
  const close = h("button", "", "×", { "aria-label": "Fechar", "data-key": "close" });
  close.onclick = () => model.select(undefined);
  head.append(av, titles, close);

  const stats = h("div", "stats");
  const stat = (v: string, l: string) => { const s = h("div", "stat"); s.append(h("b", "", v), h("span", "", l)); return s; };
  const children = model.agents().filter((x) => x.parentId === a.id).length;
  stats.append(stat(String(a.history.length), "ações"), stat(String(children), "subagentes"), stat(ago(a.updatedAt).replace("há ", ""), "no estado"));

  const hist = h("div", "history");
  for (const it of [...a.history].reverse()) {
    const row = h("div");
    row.append(h("time", "", hhmm(it.at)), h("span", "", it.text));
    hist.append(row);
  }
  if (!a.history.length) hist.append(h("div", "empty", "Sem ações registradas"));

  card.append(head, h("div", "", ""), badge(a), h("div", "step", a.step || "—"), stats, h("div", "title", "Últimas ações"), hist);
  if (a.link) {
    const isUrl = /^https?:\/\//.test(a.link);
    const link = isUrl ? h("a", "link", a.link, { href: a.link, target: "_blank", rel: "noopener noreferrer" }) : h("div", "link", a.link);
    card.append(link);
  }
  return card;
}

function teamCard(model: ClientModel, team?: string): HTMLElement {
  const agents = model.agents().filter((a) => !team || a.team === team);
  const t = model.state.teams.find((x) => x.name === team);
  const card = h("section", "panel card");
  card.style.setProperty("--accent", t?.color ?? "var(--yellow)");
  const working = agents.filter((a) => a.status === "working").length;
  const head = h("div", "title");
  head.append(h("span", "", team ? `Andar ${(t?.order ?? 0) + 1} · ${team}` : "Visão geral"), h("span", "count", `${agents.length} agentes`));
  const big = h("div", "big", String(working));
  const list = h("div", "body");
  const order: Record<Agent["status"], number> = { waiting_user: 0, error: 1, working: 2, idle: 3, done: 4 };
  const shown = [...agents].sort((a, b) => order[a.status] - order[b.status] || b.updatedAt.localeCompare(a.updatedAt)).slice(0, team ? 40 : 14);
  for (const a of shown) {
    const row = h("div", "row", undefined, { role: "button", tabindex: "0", "data-key": `card:${a.id}` });
    const grow = h("div", "grow");
    grow.append(h("span", "name", a.name), h("span", "sub", a.step || STATUS_LABEL[a.status]));
    row.append(dot(a.status), grow);
    activate(row, () => { model.setFocus(a.team); model.select(a.id); });
    list.append(row);
  }
  if (!shown.length) list.append(h("div", "empty", "Nenhum agente"));
  card.append(head, big, h("div", "sub", "trabalhando agora"), list);
  return card;
}

export function mountRight(root: HTMLElement, model: ClientModel): void {
  const col = h("aside", "right", undefined, { "aria-label": "Detalhes" });
  root.append(col);
  const render = () => {
    const sel = model.selected ? model.state.agents[model.selected] : undefined;
    col.replaceChildren(sel ? inspector(model, sel) : teamCard(model, model.focusTeam));
  };
  model.on((c) => { if (c.has("agents") || c.has("focus") || c.has("teams")) keepFocus(col, render); });
  render();
}
