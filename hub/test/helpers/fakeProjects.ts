import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const NOW = Date.parse("2026-11-09T12:00:00Z");

export function line(o: unknown): string {
  return JSON.stringify(o) + "\n";
}

export function assistantTool(name: string, input: Record<string, unknown>, ts = "2026-11-09T11:59:50Z") {
  return line({ type: "assistant", timestamp: ts, cwd: "D:/proj/demo", message: { content: [{ type: "tool_use", name, input }] } });
}

export function toolResult(isError: boolean, ts = "2026-11-09T11:59:55Z") {
  return line({ type: "user", timestamp: ts, message: { content: [{ type: "tool_result", is_error: isError, content: "x" }] } });
}

export function makeProjects(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ylab-proj-"));
}

export function writeSession(root: string, projectDir: string, id: string, body: string, ageMs: number): string {
  const dir = path.join(root, projectDir);
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${id}.jsonl`);
  fs.writeFileSync(f, body);
  const t = (NOW - ageMs) / 1000;
  fs.utimesSync(f, t, t);
  return f;
}
