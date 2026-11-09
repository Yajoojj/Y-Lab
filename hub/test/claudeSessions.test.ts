import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { collectClaudeSessions } from "../src/collectors/claudeSessions";
import { readTail } from "../src/collectors/jsonl";
import { NOW, assistantTool, makeProjects, toolResult, writeSession } from "./helpers/fakeProjects";

const opts = (projectsDir: string, extra = {}) => ({ projectsDir, maxAgeH: 6, now: NOW, ...extra });

describe("readTail", () => {
  it("skips a partial last line", () => {
    const root = makeProjects();
    const f = writeSession(root, "p", "s", assistantTool("Read", { file_path: "a.ts" }) + '{"type":"assist', 0);
    expect(readTail(f).length).toBe(1);
  });
  it("drops the first line when the read starts mid-file", () => {
    const root = makeProjects();
    const body = assistantTool("Read", { file_path: "a.ts" }).repeat(50);
    const f = writeSession(root, "p", "s", body, 0);
    expect(readTail(f, 300).length).toBeLessThan(50);
    expect(readTail(f, 300).every((r) => typeof r === "object")).toBe(true);
  });
});

describe("collectClaudeSessions", () => {
  it("reports a session writing now as working with its last action", () => {
    const root = makeProjects();
    writeSession(root, "D--proj-demo", "s1abcdef", assistantTool("Edit", { file_path: "src/x.ts" }) + '{"type":"assist', 10_000);
    const [p] = collectClaudeSessions(opts(root));
    expect(p).toMatchObject({ id: "claude:s1abcdef", source: "claude", status: "working", step: "editando x.ts", team: "demo", name: "demo #s1ab" });
    expect(p.action).toBe("editando x.ts");
  });

  it("derives idle, done and hidden from file age", () => {
    const root = makeProjects();
    writeSession(root, "D--proj-demo", "idle", assistantTool("Read", { file_path: "a" }), 10 * 60_000);
    writeSession(root, "D--proj-demo", "done", assistantTool("Read", { file_path: "a" }), 40 * 60_000);
    writeSession(root, "D--proj-demo", "old", assistantTool("Read", { file_path: "a" }), 7 * 3600_000);
    const byId = Object.fromEntries(collectClaudeSessions(opts(root)).map((p) => [p.id, p]));
    expect(byId["claude:idle"].status).toBe("idle");
    expect(byId["claude:done"].status).toBe("done");
    expect(byId["claude:old"]).toBeUndefined();
  });

  it("reports error when the last entry is a failed tool result", () => {
    const root = makeProjects();
    writeSession(root, "D--proj-demo", "e", assistantTool("Bash", { command: "x" }) + toolResult(true), 5_000);
    expect(collectClaudeSessions(opts(root))[0].status).toBe("error");
  });

  it("reports subagents with parent and role", () => {
    const root = makeProjects();
    writeSession(root, "D--proj-demo", "s1", assistantTool("Read", { file_path: "a" }), 5_000);
    const sub = path.join(root, "D--proj-demo", "s1", "subagents");
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, "a1.meta.json"), JSON.stringify({ description: "Review task 1" }));
    writeSession(root, path.join("D--proj-demo", "s1", "subagents"), "a1", assistantTool("Read", { file_path: "b.ts" }), 5_000);
    const p = collectClaudeSessions(opts(root)).find((x) => x.id === "claude:s1/a1");
    expect(p).toMatchObject({ parentId: "claude:s1", role: "revisor", status: "working", name: "Review task 1" });
  });

  it("prefers the cwd that matches the project folder over a later cd", () => {
    const root = makeProjects();
    const rec = (cwd: string) => JSON.stringify({ type: "assistant", cwd, message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "a" } }] } }) + "\n";
    writeSession(root, "D--proj-demo", "s1", rec("D:/proj/demo") + rec("D:/proj/demo/hub"), 5_000);
    expect(collectClaudeSessions(opts(root))[0]).toMatchObject({ team: "demo", link: "D:/proj/demo" });
  });

  it("walks up from a subfolder cwd to the project folder", () => {
    const root = makeProjects();
    const rec = (cwd: string) => JSON.stringify({ type: "assistant", cwd, message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "a" } }] } }) + "\n";
    writeSession(root, "D--proj-demo", "s1", rec("D:\\proj\\demo\\web\\src"), 5_000);
    expect(collectClaudeSessions(opts(root))[0]).toMatchObject({ team: "demo", name: "demo #s1" });
  });

  it("never exposes raw assistant text", () => {
    const root = makeProjects();
    const text = JSON.stringify({ type: "assistant", cwd: "D:/proj/demo", message: { content: [{ type: "text", text: "Your key is sk-live-123" }] } }) + "\n";
    writeSession(root, "D--proj-demo", "s1", text, 5_000);
    const [p] = collectClaudeSessions(opts(root));
    expect(p.step).toBe("respondendo");
    expect(JSON.stringify(p)).not.toContain("sk-live");
  });

  it("keeps team and step when the read window holds no complete line", () => {
    const root = makeProjects();
    const f = writeSession(root, "D--proj-demo", "big", assistantTool("Edit", { file_path: "x.ts" }), 5_000);
    expect(collectClaudeSessions(opts(root))[0].team).toBe("demo");
    fs.appendFileSync(f, JSON.stringify({ type: "user", blob: "z".repeat(300_000) }) + "\n");
    const t = (NOW - 5_000) / 1000;
    fs.utimesSync(f, t, t);
    const [p] = collectClaudeSessions(opts(root));
    expect(p.team).toBe("demo");
    expect(p.step).toBeUndefined();
  });

  it("lets teamFor override the team", () => {
    const root = makeProjects();
    writeSession(root, "D--proj-demo", "s1", assistantTool("Read", { file_path: "a" }), 5_000);
    const [p] = collectClaudeSessions(opts(root, { teamFor: (d: string) => (d === "D--proj-demo" ? "interface" : undefined) }));
    expect(p.team).toBe("interface");
  });

  it("returns nothing when the projects dir does not exist", () => {
    expect(collectClaudeSessions(opts(path.join(makeProjects(), "missing")))).toEqual([]);
  });
});
