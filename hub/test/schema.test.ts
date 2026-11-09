import { describe, it, expect } from "vitest";
import { parseEvent } from "../src/schema";

describe("parseEvent", () => {
  it("parses a status event and truncates step to 80 chars", () => {
    const e = parseEvent({ bot: "X Writer", status: "working", step: "a".repeat(120) });
    expect(e).toMatchObject({ kind: "status", bot: "X Writer", status: "working" });
    if (e.kind !== "status") throw new Error("kind");
    expect(e.step.length).toBe(80);
  });

  it("keeps quotes, apostrophes and emoji in bot names", () => {
    const e = parseEvent({ bot: "O'Brien \"Q\" 🤖", status: "idle", step: "ok" });
    if (e.kind !== "status") throw new Error("kind");
    expect(e.bot).toBe("O'Brien \"Q\" 🤖");
  });

  it("rejects unknown status", () => {
    expect(() => parseEvent({ bot: "A", status: "sleeping", step: "" })).toThrow();
  });

  it("parses looks and validates color and shape", () => {
    expect(parseEvent({ looks: { A: { shape: "star6", color: "#2D84F5", accessory: "bow" } } }).kind).toBe("looks");
    expect(() => parseEvent({ looks: { A: { shape: "star6", color: "2D84F5", accessory: "bow" } } })).toThrow();
    expect(() => parseEvent({ looks: { A: { shape: "blob", color: "#2D84F5", accessory: "bow" } } })).toThrow();
  });

  it("parses roster, groups, chat, routines and usage", () => {
    expect(parseEvent({ roster: ["A", "B"] }).kind).toBe("roster");
    expect(parseEvent({ groups: { A: "Content" } }).kind).toBe("groups");
    expect(parseEvent({ chat: { A: "grokbot://app/v1/agent?id=1" } }).kind).toBe("chat");
    expect(parseEvent({ routines: { bot: "A", items: [{ name: "r", schedule: "daily", next_run: "2026-11-09T08:00:00Z" }] } }).kind).toBe("routines");
    expect(parseEvent({ type: "usage", total_used_pct: 37, bots: { A: 4.1 } }).kind).toBe("usage");
  });

  it("drops extra fields", () => {
    const e = parseEvent({ bot: "A", status: "done", step: "x", secret: "nope" }) as Record<string, unknown>;
    expect(e.secret).toBeUndefined();
  });

  it("rejects bodies that match no format", () => {
    expect(() => parseEvent({ hello: 1 })).toThrow();
    expect(() => parseEvent(null)).toThrow();
  });
});
