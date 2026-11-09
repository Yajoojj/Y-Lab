import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../src/store";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "ylab-"));

describe("Store persistence", () => {
  it("round-trips state through save/load", () => {
    const dir = tmp();
    const file = path.join(dir, "state.json");
    const a = new Store({ file });
    a.applyPatches([{ id: "bot:A", source: "http", status: "working", step: "x", action: "x" }]);
    a.applyEvent({ kind: "usage", total_used_pct: 12, bots: {} });
    a.save();
    const b = new Store({ file });
    b.load();
    expect(b.state()).toEqual(a.state());
  });

  it("starts empty and renames a corrupt file", () => {
    const dir = tmp();
    const file = path.join(dir, "state.json");
    fs.writeFileSync(file, '{"agents":');
    const s = new Store({ file });
    expect(() => s.load()).not.toThrow();
    expect(s.state().agents).toEqual({});
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.readdirSync(dir).some((f) => /^state\.corrupt-.*\.json$/.test(f))).toBe(true);
  });

  it("does nothing when the file is missing", () => {
    const s = new Store({ file: path.join(tmp(), "nope", "state.json") });
    expect(() => s.load()).not.toThrow();
  });
});
