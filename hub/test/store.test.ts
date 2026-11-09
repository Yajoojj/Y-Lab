import { describe, it, expect } from "vitest";
import { Store } from "../src/store";
import { deriveLook } from "../src/look";
import type { Delta } from "../src/types";

function setup(start = Date.parse("2026-11-09T10:00:00Z")) {
  let t = start;
  const store = new Store({ now: () => t });
  const deltas: Delta[] = [];
  store.subscribe((d) => deltas.push(d));
  return { store, deltas, advance: (ms: number) => { t += ms; } };
}

describe("Store.applyPatches", () => {
  it("creates an agent with derived look and default team, and emits a delta", () => {
    const { store, deltas } = setup();
    store.applyPatches([{ id: "bot:A", name: "A", source: "http", status: "working", step: "x" }]);
    const a = store.state().agents["bot:A"];
    expect(a.look).toEqual(deriveLook("bot:A"));
    expect(a.team).toBe("Ops");
    expect(deltas.at(-1)?.agents?.["bot:A"]?.name).toBe("A");
  });

  it("emits nothing when the patch changes nothing", () => {
    const { store, deltas } = setup();
    const p = { id: "bot:A", name: "A", source: "http" as const, status: "working" as const, step: "x" };
    store.applyPatches([p]);
    const n = deltas.length;
    store.applyPatches([p]);
    expect(deltas.length).toBe(n);
  });

  it("keeps 10 history items and 200 activity items", () => {
    const { store } = setup();
    for (let i = 0; i < 12; i++) store.applyPatches([{ id: "bot:A", source: "http", action: `edit ${i}` }]);
    expect(store.state().agents["bot:A"].history.length).toBe(10);
    for (let i = 0; i < 210; i++) store.applyPatches([{ id: "bot:B", source: "http", action: `a ${i}` }]);
    expect(store.state().activity.length).toBe(200);
  });

  it("does not repeat an action already last in history", () => {
    const { store } = setup();
    store.applyPatches([{ id: "bot:A", source: "http", action: "same" }]);
    store.applyPatches([{ id: "bot:A", source: "http", action: "same" }]);
    expect(store.state().agents["bot:A"].history.length).toBe(1);
  });

  it("truncates step to 80 chars", () => {
    const { store } = setup();
    store.applyPatches([{ id: "bot:A", source: "http", step: "z".repeat(100) }]);
    expect(store.state().agents["bot:A"].step.length).toBe(80);
  });

  it("uses the source to pick the default team", () => {
    const { store } = setup();
    store.applyPatches([{ id: "k9:crm", source: "k9", name: "crm" }]);
    expect(store.state().agents["k9:crm"].team).toBe("crm");
  });
});

describe("Store.applyEvent", () => {
  it("maps every event kind", () => {
    const { store } = setup();
    store.applyEvent({ kind: "status", bot: "A", status: "working", step: "drafting" });
    expect(store.state().agents["bot:A"]).toMatchObject({ source: "http", status: "working", step: "drafting", name: "A" });
    store.applyEvent({ kind: "roster", roster: ["A", "B"] });
    expect(store.state().agents["bot:B"].status).toBe("idle");
    expect(store.state().agents["bot:A"].status).toBe("working");
    store.applyEvent({ kind: "groups", groups: { A: "Content" } });
    expect(store.state().agents["bot:A"].team).toBe("Content");
    store.applyEvent({ kind: "looks", looks: { A: { shape: "star6", color: "#2D84F5", accessory: "bow" } } });
    expect(store.state().agents["bot:A"].look.shape).toBe("star6");
    store.applyEvent({ kind: "chat", chat: { A: "https://x" } });
    expect(store.state().agents["bot:A"].link).toBe("https://x");
    store.applyEvent({ kind: "usage", total_used_pct: 37, bots: { A: 4 } });
    expect(store.state().usage).toMatchObject({ total_used_pct: 37, bots: { A: 4 } });
    expect(store.state().usage?.at).toBeTruthy();
    store.applyEvent({ kind: "routines", routines: { bot: "A", items: [{ name: "r1", schedule: "daily" }] } });
    store.applyEvent({ kind: "routines", routines: { bot: "B", items: [{ name: "r2", schedule: "hourly" }] } });
    store.applyEvent({ kind: "routines", routines: { bot: "A", items: [] } });
    expect(store.state().routines).toEqual([{ bot: "B", name: "r2", schedule: "hourly" }]);
  });
});

describe("teams", () => {
  it("sorts alphabetically with Ops at order 0", () => {
    const { store } = setup();
    store.applyPatches([
      { id: "a", source: "k9", team: "zeta" },
      { id: "b", source: "http" },
      { id: "c", source: "k9", team: "alpha" },
    ]);
    expect(store.state().teams.map((t) => [t.name, t.order])).toEqual([["Ops", 0], ["alpha", 1], ["zeta", 2]]);
  });
});

describe("Store.sweep", () => {
  it("removes done agents after 30 min but keeps them in finished", () => {
    const { store, deltas, advance } = setup();
    store.applyPatches([{ id: "bot:A", source: "http", status: "done", step: "shipped" }]);
    advance(31 * 60_000);
    store.sweep();
    expect(store.state().agents["bot:A"]).toBeUndefined();
    expect(deltas.at(-1)?.agents?.["bot:A"]).toBeNull();
    expect(store.finished().map((a) => a.id)).toEqual(["bot:A"]);
  });

  it("does not resurrect a swept done agent until it works again", () => {
    const { store, advance } = setup();
    store.applyPatches([{ id: "s", source: "claude", status: "done", step: "old" }]);
    store.applyPatches([{ id: "t", source: "http", status: "done" }]);
    advance(31 * 60_000);
    store.sweep();
    store.applyPatches([{ id: "s", source: "claude", status: "done", step: "old" }]);
    expect(store.state().agents.s).toBeUndefined();
    expect(store.finished()[0].id).toBe("t");
    store.applyPatches([{ id: "s", source: "claude", status: "working", step: "back" }]);
    expect(store.state().agents.s.status).toBe("working");
  });

  it("expires silent claude/k9 agents as done and silent http workers as idle", () => {
    const { store, advance } = setup();
    store.applyPatches([
      { id: "claude:s", source: "claude", status: "working", step: "x" },
      { id: "k9:l", source: "k9", status: "waiting_user", step: "x" },
      { id: "bot:W", source: "http", status: "working", step: "x" },
      { id: "bot:Q", source: "http", status: "waiting_user", step: "x" },
    ]);
    advance(20 * 60_000);
    store.applyPatches([{ id: "claude:keep", source: "claude", status: "idle" }]);
    advance(11 * 60_000);
    store.applyPatches([{ id: "claude:keep", source: "claude", status: "idle" }]); // mesmo patch: ainda visto
    store.sweep();
    const s = store.state().agents;
    expect(s["claude:s"].status).toBe("done");
    expect(s["k9:l"].status).toBe("done");
    expect(s["bot:W"].status).toBe("idle");
    expect(s["bot:Q"].status).toBe("waiting_user");
    expect(s["claude:keep"].status).toBe("idle");
  });

  it("caps the number of http bots", () => {
    const { store } = setup();
    store.applyEvent({ kind: "roster", roster: Array.from({ length: 600 }, (_, i) => `b${i}`) });
    expect(Object.keys(store.state().agents).length).toBe(500);
  });

  it("keeps at most 20 finished, newest first", () => {
    const { store, advance } = setup();
    for (let i = 0; i < 25; i++) { store.applyPatches([{ id: `b${i}`, source: "http", status: "done" }]); advance(1000); }
    expect(store.finished().length).toBe(20);
    expect(store.finished()[0].id).toBe("b24");
  });
});
