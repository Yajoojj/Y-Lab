export type Status = "working" | "idle" | "waiting_user" | "error" | "done";
export const STATUSES: Status[] = ["working", "idle", "waiting_user", "error", "done"];

export type Shape =
  | "sphere" | "rounded_cube" | "pill" | "triangle" | "cone" | "pentagon"
  | "hexagon" | "star4" | "star6" | "clover" | "rounded_square" | "trio";
export const SHAPES: Shape[] = [
  "sphere", "rounded_cube", "pill", "triangle", "cone", "pentagon",
  "hexagon", "star4", "star6", "clover", "rounded_square", "trio",
];

export type Accessory = "none" | "glasses" | "stem" | "antenna" | "bow";
export const ACCESSORIES: Accessory[] = ["none", "glasses", "stem", "antenna", "bow"];

export type Source = "claude" | "k9" | "http";

export interface Look { shape: Shape; color: string; accessory: Accessory }

export interface HistoryItem { at: string; text: string }

export interface Agent {
  id: string;
  name: string;
  team: string;
  source: Source;
  role?: string;
  status: Status;
  step: string;
  look: Look;
  parentId?: string;
  link?: string;
  updatedAt: string;
  history: HistoryItem[];
}

export interface Team { name: string; color: string; order: number }
export interface Routine { bot: string; name: string; schedule: string; next_run?: string }
export interface Usage { total_used_pct: number; resets_at?: string; bots: Record<string, number>; at: string }
export interface ActivityItem { at: string; agentId: string; text: string }

export interface LabState {
  agents: Record<string, Agent>;
  teams: Team[];
  routines: Routine[];
  usage?: Usage;
  activity: ActivityItem[];
  finished: Agent[];
}

export type AgentPatch = { id: string } & Partial<Omit<Agent, "id" | "history">> & { action?: string };

export interface Delta {
  agents?: Record<string, Agent | null>;
  activity?: ActivityItem[];
  usage?: Usage;
  routines?: Routine[];
  teams?: Team[];
  finished?: Agent[];
}

export const LIMITS = {
  step: 80,
  history: 10,
  activity: 200,
  finished: 20,
  activeMs: 150_000,
  doneAfterMs: 30 * 60_000,
  removeDoneAfterMs: 30 * 60_000,
} as const;
