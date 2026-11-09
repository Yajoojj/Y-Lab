import { deriveLook, teamColor } from "./look";
import type { EventInput } from "./schema";
import { LIMITS, type ActivityItem, type Agent, type AgentPatch, type Delta, type LabState, type Routine, type Team, type Usage } from "./types";

export interface StoreOptions {
  file?: string;
  now?: () => number;
}

type Listener = (d: Delta) => void;

const COMPARED: (keyof Agent)[] = ["name", "team", "source", "role", "status", "step", "look", "parentId", "link", "history"];

function defaultTeam(p: AgentPatch): string {
  if (p.source === "k9" && p.name) return p.name;
  return "Ops";
}

function defaultName(id: string): string {
  const i = id.indexOf(":");
  return i >= 0 ? id.slice(i + 1) : id;
}

export class Store {
  private agents: Record<string, Agent> = {};
  private teams: Team[] = [];
  private routines: Routine[] = [];
  private usage?: Usage;
  private activity: ActivityItem[] = [];
  private finishedList: Agent[] = [];
  private listeners = new Set<Listener>();
  private readonly now: () => number;
  private readonly file?: string;

  constructor(opts: StoreOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.file = opts.file;
  }

  state(): LabState {
    return {
      agents: this.agents,
      teams: this.teams,
      routines: this.routines,
      usage: this.usage,
      activity: this.activity,
      finished: this.finishedList,
    };
  }

  finished(): Agent[] {
    return this.finishedList;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(d: Delta): void {
    if (Object.keys(d).length === 0) return;
    for (const fn of this.listeners) {
      try { fn(d); } catch { /* um assinante quebrado não derruba os outros */ }
    }
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }

  applyPatches(patches: AgentPatch[]): void {
    const changed: Record<string, Agent> = {};
    const newActivity: ActivityItem[] = [];
    let finishedChanged = false;
    const at = this.iso();

    for (const p of patches) {
      const prev = this.agents[p.id];
      const { action, ...fields } = p;
      const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Partial<Agent>;
      const next: Agent = prev
        ? { ...prev, ...clean, history: prev.history }
        : {
            name: defaultName(p.id),
            team: defaultTeam(p),
            source: p.source ?? "http",
            status: "idle",
            step: "",
            look: deriveLook(p.id, p.role),
            updatedAt: at,
            history: [],
            ...clean,
            id: p.id,
          };
      if (!next.look) next.look = deriveLook(p.id, next.role);
      if (!next.team) next.team = defaultTeam({ ...p, name: next.name });
      next.step = (next.step ?? "").slice(0, LIMITS.step);

      const text = action?.slice(0, 120);
      if (text && next.history.at(-1)?.text !== text) {
        next.history = [...next.history, { at, text }].slice(-LIMITS.history);
        newActivity.push({ at, agentId: p.id, text });
      }

      const differs = !prev || COMPARED.some((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
      if (!differs) continue;
      next.updatedAt = at;
      this.agents[p.id] = next;
      changed[p.id] = next;

      if (next.status === "done" && prev?.status !== "done") {
        this.finishedList = [next, ...this.finishedList.filter((a) => a.id !== next.id)].slice(0, LIMITS.finished);
        finishedChanged = true;
      }
    }

    const delta: Delta = {};
    if (Object.keys(changed).length) delta.agents = changed;
    if (newActivity.length) {
      this.activity = [...this.activity, ...newActivity].slice(-LIMITS.activity);
      delta.activity = newActivity;
    }
    if (finishedChanged) delta.finished = this.finishedList;
    if (delta.agents && this.recomputeTeams()) delta.teams = this.teams;
    this.emit(delta);
  }

  applyEvent(e: EventInput): void {
    const id = (bot: string) => `bot:${bot}`;
    switch (e.kind) {
      case "status":
        this.applyPatches([{ id: id(e.bot), name: e.bot, source: "http", status: e.status, step: e.step, action: e.step || undefined }]);
        return;
      case "roster":
        this.applyPatches(e.roster.filter((b) => !this.agents[id(b)]).map((b) => ({ id: id(b), name: b, source: "http" as const })));
        return;
      case "groups":
        this.applyPatches(Object.entries(e.groups).map(([b, team]) => ({ id: id(b), name: b, source: "http" as const, team })));
        return;
      case "looks":
        this.applyPatches(Object.entries(e.looks).map(([b, look]) => ({ id: id(b), name: b, source: "http" as const, look })));
        return;
      case "chat":
        this.applyPatches(Object.entries(e.chat).map(([b, link]) => ({ id: id(b), name: b, source: "http" as const, link })));
        return;
      case "usage":
        this.usage = { total_used_pct: e.total_used_pct, resets_at: e.resets_at, bots: e.bots, at: this.iso() };
        this.emit({ usage: this.usage });
        return;
      case "routines": {
        const bot = e.routines.bot;
        this.routines = [
          ...this.routines.filter((r) => r.bot !== bot),
          ...e.routines.items.map((it) => ({ bot, ...it })),
        ];
        this.emit({ routines: this.routines });
        return;
      }
    }
  }

  sweep(): void {
    const now = this.now();
    const removed: Record<string, null> = {};
    for (const a of Object.values(this.agents)) {
      if (a.status === "done" && now - Date.parse(a.updatedAt) > LIMITS.removeDoneAfterMs) {
        delete this.agents[a.id];
        removed[a.id] = null;
      }
    }
    if (!Object.keys(removed).length) return;
    const delta: Delta = { agents: removed };
    if (this.recomputeTeams()) delta.teams = this.teams;
    this.emit(delta);
  }

  private recomputeTeams(): boolean {
    const names = [...new Set(Object.values(this.agents).map((a) => a.team))];
    names.sort((a, b) => (a === "Ops" ? -1 : b === "Ops" ? 1 : a.localeCompare(b)));
    const teams = names.map((name, order) => ({ name, color: teamColor(name), order }));
    if (JSON.stringify(teams) === JSON.stringify(this.teams)) return false;
    this.teams = teams;
    return true;
  }

  load(): void {
    /* Task 3 */
  }

  save(): void {
    /* Task 3 */
  }
}
