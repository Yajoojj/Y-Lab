import type { ClientModel } from "../model";
import { ago, h, hhmm } from "./dom";

export function mountFooter(root: HTMLElement, model: ClientModel): void {
  const foot = h("footer", "footer");
  const activity = h("section", "panel activity", undefined, { "aria-label": "Atividade" });
  activity.style.setProperty("--accent", "var(--cyan)");
  const actBody = h("div", "body");
  activity.append(h("div", "title", "Atividade"), actBody);

  const usage = h("section", "panel usage", undefined, { "aria-label": "Uso" });
  usage.style.setProperty("--accent", "var(--magenta)");
  usage.hidden = true;
  const usageTitle = h("div", "title");
  const usagePct = h("span", "count", "");
  usageTitle.append(h("span", "", "Uso semanal"), usagePct);
  const meter = h("div", "meter");
  const fill = h("i");
  meter.append(fill);
  const usageSub = h("div", "sub", "");
  usage.append(usageTitle, meter, usageSub);

  foot.append(activity, usage);
  root.append(foot);

  const renderActivity = () => {
    const items = model.state.activity.slice(-6).reverse();
    actBody.replaceChildren(...(items.length
      ? items.map((it) => {
          const row = h("div");
          const who = model.state.agents[it.agentId]?.name ?? it.agentId;
          row.append(h("time", "", hhmm(it.at)), h("b", "", who), h("span", "", it.text));
          return row;
        })
      : [h("div", "empty", "Aguardando sinais…")]));
  };

  const renderUsage = () => {
    const u = model.state.usage;
    usage.hidden = !u;
    if (!u) return;
    const pct = Math.min(100, Math.max(0, u.total_used_pct));
    usagePct.textContent = `${Math.round(u.total_used_pct)}%`;
    fill.style.width = `${pct}%`;
    usageSub.textContent = u.resets_at ? `renova ${new Date(u.resets_at).toLocaleString("pt-BR")}` : `atualizado ${ago(u.at)}`;
  };

  model.on((c) => {
    if (c.has("activity") || c.has("agents")) renderActivity();
    if (c.has("usage")) renderUsage();
  });
  renderActivity();
  renderUsage();
}
