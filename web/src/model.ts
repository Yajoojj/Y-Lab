import type { Agent, Delta, LabState, Status } from "../../hub/src/types";

export type Change = "agents" | "activity" | "usage" | "routines" | "teams" | "finished" | "focus";
type Listener = (changed: Set<Change>) => void;

const ACTIVITY_MAX = 200;

const empty = (): LabState => ({ agents: {}, teams: [], routines: [], activity: [], finished: [] });

/** Andares só aparecem quando alguém neles está trabalhando, esperando pelo usuário ou com erro. */
export const ATIVOS: ReadonlySet<Status> = new Set<Status>(["working", "waiting_user", "error"]);

export class ClientModel {
  state: LabState = empty();
  /** Todos os andares que o hub conhece; `state.teams` guarda só os visíveis. */
  allTeams: LabState["teams"] = [];
  showAllFloors = false;
  focusTeam?: string;
  selected?: string;
  private listeners: Listener[] = [];

  on(fn: Listener): void {
    this.listeners.push(fn);
  }

  private notify(changed: Set<Change>): void {
    if (!changed.size) return;
    for (const fn of this.listeners) fn(changed);
  }

  applySnapshot(s: LabState): void {
    this.state = { ...empty(), ...s, agents: { ...s.agents } };
    this.allTeams = s.teams ?? [];
    this.refilter();
    if (this.selected && !this.state.agents[this.selected]) this.selected = undefined;
    if (this.focusTeam && !this.state.teams.some((t) => t.name === this.focusTeam)) this.focusTeam = undefined;
    this.notify(new Set<Change>(["agents", "activity", "usage", "routines", "teams", "finished", "focus"]));
  }

  applyDelta(d: Delta): void {
    const changed = new Set<Change>();
    if (d.agents) {
      for (const [id, a] of Object.entries(d.agents)) {
        if (a === null) {
          delete this.state.agents[id];
          if (this.selected === id) { this.selected = undefined; changed.add("focus"); }
        } else {
          this.state.agents[id] = a;
        }
      }
      changed.add("agents");
    }
    if (d.activity) {
      this.state.activity = [...this.state.activity, ...d.activity].slice(-ACTIVITY_MAX);
      changed.add("activity");
    }
    if (d.usage) { this.state.usage = d.usage; changed.add("usage"); }
    if (d.routines) { this.state.routines = d.routines; changed.add("routines"); }
    if (d.teams) { this.allTeams = d.teams; changed.add("teams"); }
    if (d.finished) { this.state.finished = d.finished; changed.add("finished"); }
    if ((d.agents || d.teams) && this.refilter()) changed.add("teams");
    if (this.focusTeam && !this.state.teams.some((t) => t.name === this.focusTeam)) {
      this.focusTeam = undefined;
      changed.add("focus");
    }
    this.notify(changed);
  }

  /** Liga/desliga a exibição dos andares parados. */
  toggleAllFloors(): void {
    this.showAllFloors = !this.showAllFloors;
    this.refilter();
    this.notify(new Set<Change>(["teams", "agents"]));
  }

  /** Recalcula os andares visíveis; devolve true se mudou. */
  private refilter(): boolean {
    const ativos = new Set<string>();
    for (const a of Object.values(this.state.agents)) if (ATIVOS.has(a.status)) ativos.add(a.team);
    const visiveis = this.allTeams
      .filter((t) => this.showAllFloors || ativos.has(t.name))
      .sort((a, b) => a.order - b.order)
      .map((t, order) => ({ ...t, order }));
    if (JSON.stringify(visiveis) === JSON.stringify(this.state.teams)) return false;
    this.state.teams = visiveis;
    return true;
  }

  setFocus(team?: string): void {
    this.focusTeam = team;
    this.notify(new Set<Change>(["focus"]));
  }

  select(id?: string): void {
    this.selected = id;
    this.notify(new Set<Change>(["focus"]));
  }

  /** Agentes dos andares visíveis. */
  agents(): Agent[] {
    const visiveis = new Set(this.state.teams.map((t) => t.name));
    return Object.values(this.state.agents).filter((a) => visiveis.has(a.team));
  }

  counts(): Record<Status, number> {
    const c: Record<Status, number> = { working: 0, idle: 0, waiting_user: 0, error: 0, done: 0 };
    for (const a of Object.values(this.state.agents)) c[a.status]++;
    return c;
  }

  waiting(): Agent[] {
    return Object.values(this.state.agents).filter((a) => a.status === "waiting_user");
  }
}
