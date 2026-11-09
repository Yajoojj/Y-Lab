import { describe, it, expect } from "vitest";
import { ClientModel } from "../src/model";
import type { Agent, LabState } from "../../hub/src/types";

const agent = (id: string, status: Agent["status"] = "working"): Agent => ({
  id, name: id, team: "Ops", source: "http", status, step: "", updatedAt: "2026-11-09T00:00:00Z", history: [],
  look: { shape: "sphere", color: "#00F0FF", accessory: "none" },
});

const snap = (agents: Agent[]): LabState => ({
  agents: Object.fromEntries(agents.map((a) => [a.id, a])), teams: [{ name: "Ops", color: "#00F0FF", order: 0 }],
  routines: [], activity: [], finished: [],
});

describe("ClientModel", () => {
  it("applies a snapshot and removes agents on null deltas", () => {
    const m = new ClientModel();
    m.applySnapshot(snap([agent("a"), agent("b")]));
    m.applyDelta({ agents: { a: null } });
    expect(Object.keys(m.state.agents)).toEqual(["b"]);
  });

  it("adds agents and notifies listeners with what changed", () => {
    const m = new ClientModel();
    m.applySnapshot(snap([]));
    const seen: string[][] = [];
    m.on((c) => seen.push([...c]));
    m.applyDelta({ agents: { c: agent("c") } });
    expect(m.state.agents.c.name).toBe("c");
    expect(seen.at(-1)).toContain("agents");
  });

  it("counts by status and lists waiting agents", () => {
    const m = new ClientModel();
    m.applySnapshot(snap([agent("a"), agent("b", "waiting_user"), agent("c", "error"), agent("d", "idle")]));
    expect(m.counts()).toEqual({ working: 1, idle: 1, waiting_user: 1, error: 1, done: 0 });
    expect(m.waiting().map((a) => a.id)).toEqual(["b"]);
  });

  it("appends activity and caps it at 200", () => {
    const m = new ClientModel();
    m.applySnapshot(snap([]));
    for (let i = 0; i < 5; i++) {
      m.applyDelta({ activity: Array.from({ length: 50 }, (_, j) => ({ at: "t", agentId: "a", text: `${i}-${j}` })) });
    }
    expect(m.state.activity.length).toBe(200);
    expect(m.state.activity.at(-1)?.text).toBe("4-49");
  });

  it("replaces everything on a new snapshot (reconnect)", () => {
    const m = new ClientModel();
    m.applySnapshot(snap([agent("a")]));
    m.selected = "a";
    m.applySnapshot(snap([agent("z")]));
    expect(Object.keys(m.state.agents)).toEqual(["z"]);
    expect(m.selected).toBeUndefined();
  });

  it("notifies focus changes", () => {
    const m = new ClientModel();
    const seen: string[][] = [];
    m.on((c) => seen.push([...c]));
    m.setFocus("Ops");
    m.select("a");
    expect(m.focusTeam).toBe("Ops");
    expect(seen.flat()).toEqual(["focus", "focus"]);
  });
});
