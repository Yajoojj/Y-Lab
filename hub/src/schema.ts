import { z } from "zod";
import { ACCESSORIES, SHAPES, STATUSES, type Look, type Status } from "./types";

const name = z.string().trim().min(1).max(120);
const step = z.string().transform((s) => s.replace(/\s+/g, " ").trim().slice(0, 80));
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const look = z.object({
  shape: z.enum(SHAPES as [string, ...string[]]),
  color,
  accessory: z.enum(ACCESSORIES as [string, ...string[]]).default("none"),
});

const status = z.object({ bot: name, status: z.enum(STATUSES as [string, ...string[]]), step: step.default("") })
  .transform((v) => ({ kind: "status" as const, ...v }));
const roster = z.object({ roster: z.array(name).max(500) })
  .transform((v) => ({ kind: "roster" as const, ...v }));
const looks = z.object({ looks: z.record(name, look) })
  .transform((v) => ({ kind: "looks" as const, ...v }));
const groups = z.object({ groups: z.record(name, z.string().trim().min(1).max(40)) })
  .transform((v) => ({ kind: "groups" as const, ...v }));
const chat = z.object({ chat: z.record(name, z.string().max(500)) })
  .transform((v) => ({ kind: "chat" as const, ...v }));
const routines = z.object({
  routines: z.object({
    bot: name,
    items: z.array(z.object({
      name: z.string().min(1).max(120),
      schedule: z.string().max(120),
      next_run: z.string().max(40).optional(),
    })).max(100),
  }),
}).transform((v) => ({ kind: "routines" as const, ...v }));
const usage = z.object({
  type: z.literal("usage"),
  total_used_pct: z.number().min(0).max(1000),
  resets_at: z.string().max(40).optional(),
  bots: z.record(name, z.number().min(0).max(100)).default({}),
}).transform(({ type: _t, ...v }) => ({ kind: "usage" as const, ...v }));

const event = z.union([usage, status, roster, looks, groups, chat, routines]);

export type EventInput =
  | { kind: "status"; bot: string; status: Status; step: string }
  | { kind: "roster"; roster: string[] }
  | { kind: "looks"; looks: Record<string, Look> }
  | { kind: "groups"; groups: Record<string, string> }
  | { kind: "chat"; chat: Record<string, string> }
  | { kind: "routines"; routines: { bot: string; items: { name: string; schedule: string; next_run?: string }[] } }
  | { kind: "usage"; total_used_pct: number; resets_at?: string; bots: Record<string, number> };

export function parseEvent(body: unknown): EventInput {
  return event.parse(body) as EventInput;
}
