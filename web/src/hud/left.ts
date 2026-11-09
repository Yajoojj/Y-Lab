import type { ClientModel } from "../model";
import type { Agent } from "../../../hub/src/types";
import { ago, dot, h, section } from "./dom";

function agentRow(model: ClientModel, a: Agent, sub: string, meta?: string): HTMLElement {
  const row = h("div", "row", undefined, { role: "button", tabindex: "0" });
  if (model.selected === a.id) row.classList.add("active");
  const grow = h("div", "grow");
  grow.append(h("span", "name", a.name), h("span", "sub", sub));
  row.append(dot(a.status), grow);
  if (meta) row.append(h("span", "meta", meta));
  const pick = () => { model.setFocus(a.team); model.select(a.id); };
  row.onclick = pick;
  row.onkeydown = (e) => { if (e.key === "Enter") pick(); };
  return row;
}

export function mountLeft(root: HTMLElement, model: ClientModel): void {
  const col = h("aside", "left", undefined, { "aria-label": "Andares e filas" });
  const floors = section("floors", "Andares", "var(--cyan)");
  const waiting = section("waiting", "Esperando por mim", "var(--yellow)");
  waiting.root.classList.add("waiting");
  const finished = section("finished", "Concluídos", "var(--green)");
  const routines = section("routines", "Rotinas", "var(--violet)");
  col.append(floors.root, waiting.root, finished.root, routines.root);
  root.append(col);

  const renderFloors = () => {
    const teams = [...model.state.teams].sort((a, b) => b.order - a.order);
    floors.count.textContent = String(teams.length);
    floors.body.replaceChildren();
    if (!teams.length) floors.body.append(h("div", "empty", "Nenhum agente ainda"));
    const agents = model.agents();
    for (const t of teams) {
      const members = agents.filter((a) => a.team === t.name);
      const row = h("div", "row", undefined, { role: "button", tabindex: "0" });
      row.style.setProperty("--fc", t.color);
      row.style.setProperty("--accent", t.color);
      if (model.focusTeam === t.name) row.classList.add("active");
      const grow = h("div", "grow");
      const dots = h("div", "dots");
      for (const m of members.slice(0, 24)) dots.append(dot(m.status));
      grow.append(h("span", "name", t.name), dots);
      row.append(h("span", "floor-num", String(t.order + 1)), grow, h("span", "meta", String(members.length)));
      const toggle = () => { model.select(undefined); model.setFocus(model.focusTeam === t.name ? undefined : t.name); };
      row.onclick = toggle;
      row.onkeydown = (e) => { if (e.key === "Enter") toggle(); };
      floors.body.append(row);
    }
  };

  const renderWaiting = () => {
    const list = model.waiting();
    waiting.count.textContent = String(list.length);
    waiting.body.replaceChildren(...(list.length ? list.map((a) => agentRow(model, a, a.step || "precisa de você", ago(a.updatedAt))) : [h("div", "empty", "Ninguém esperando")]));
  };

  const renderFinished = () => {
    const list = model.state.finished;
    finished.count.textContent = String(list.length);
    finished.body.replaceChildren(...(list.length ? list.map((a) => agentRow(model, a, a.step || "concluído", ago(a.updatedAt))) : [h("div", "empty", "Nada concluído ainda")]));
  };

  const renderRoutines = () => {
    const list = model.state.routines;
    routines.count.textContent = String(list.length);
    routines.body.replaceChildren(...(list.length
      ? list.map((r) => {
          const row = h("div", "row");
          const grow = h("div", "grow");
          grow.append(h("span", "name", r.name), h("span", "sub", `${r.bot} · ${r.schedule}`));
          row.append(grow);
          if (r.next_run) row.append(h("span", "meta", new Date(r.next_run).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })));
          return row;
        })
      : [h("div", "empty", "Sem rotinas")]));
  };

  model.on((c) => {
    if (c.has("teams") || c.has("agents") || c.has("focus")) renderFloors();
    if (c.has("agents") || c.has("focus")) renderWaiting();
    if (c.has("finished") || c.has("focus")) renderFinished();
    if (c.has("routines")) renderRoutines();
  });
  renderFloors(); renderWaiting(); renderFinished(); renderRoutines();
}
