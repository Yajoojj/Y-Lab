import type { Status } from "../../../hub/src/types";

/** Cria um elemento; texto sempre via textContent (nunca innerHTML com dados). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export const STATUS_LABEL: Record<Status, string> = {
  working: "trabalhando",
  idle: "ocioso",
  waiting_user: "esperando você",
  error: "erro",
  done: "concluído",
};

export function hhmm(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (Number.isNaN(s)) return "";
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  return `há ${Math.round(s / 3600)} h`;
}

export function dot(status: Status): HTMLElement {
  return h("i", `dot st-${status}`, undefined, { "aria-hidden": "true" });
}

/** Seção recolhível; o estado recolhido fica no localStorage (com try/catch). */
export function section(key: string, title: string, accent?: string): { root: HTMLElement; body: HTMLElement; count: HTMLElement } {
  const root = h("section", "panel section");
  if (accent) root.style.setProperty("--accent", accent);
  const head = h("div", "title", undefined, { role: "button", tabindex: "0", "aria-expanded": "true" });
  const label = h("span", "", title);
  const count = h("span", "count", "0");
  head.append(label, count);
  const body = h("div", "body");
  root.append(head, body);
  const storeKey = `ylab.collapsed.${key}`;
  const apply = (collapsed: boolean) => {
    root.classList.toggle("collapsed", collapsed);
    head.setAttribute("aria-expanded", String(!collapsed));
  };
  try { apply(localStorage.getItem(storeKey) === "1"); } catch { /* sem storage */ }
  const toggle = () => {
    const c = !root.classList.contains("collapsed");
    apply(c);
    try { localStorage.setItem(storeKey, c ? "1" : "0"); } catch { /* sem storage */ }
  };
  head.addEventListener("click", toggle);
  head.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  return { root, body, count };
}

/** Liga clique, Enter e Espaço num elemento com role="button". */
export function activate(el: HTMLElement, fn: () => void): void {
  el.onclick = fn;
  el.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

/** Re-renderiza um container sem perder o foco do teclado (pelo data-key do elemento focado). */
export function keepFocus(container: HTMLElement, render: () => void): void {
  const active = document.activeElement as HTMLElement | null;
  const key = active && container.contains(active) ? active.dataset.key : undefined;
  render();
  if (!key) return;
  const again = [...container.querySelectorAll<HTMLElement>("[data-key]")].find((el) => el.dataset.key === key);
  again?.focus();
}
