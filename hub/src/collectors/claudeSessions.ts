import fs from "node:fs";
import path from "node:path";
import { describeTool, roleOf } from "../describe";
import { LIMITS, type AgentPatch, type Status } from "../types";
import { readTail } from "./jsonl";

export interface ClaudeSessionsOptions {
  projectsDir: string;
  maxAgeH: number;
  now: number;
  teamFor?: (projectDir: string) => string | undefined;
}

interface Entry {
  type?: string;
  cwd?: string;
  message?: { content?: unknown };
}

interface Summary { step: string; lastIsError: boolean; cwd?: string }

function summarize(records: unknown[]): Summary {
  let step = "";
  let lastIsError = false;
  let cwd: string | undefined;
  for (const r of records as Entry[]) {
    if (!r || typeof r !== "object") continue;
    if (typeof r.cwd === "string") cwd = r.cwd;
    const content = r.message?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content as Record<string, unknown>[]) {
      if (r.type === "assistant" && c.type === "tool_use") {
        step = describeTool(String(c.name ?? ""), (c.input as Record<string, unknown>) ?? {});
        lastIsError = false;
      } else if (r.type === "assistant" && c.type === "text" && String(c.text ?? "").trim()) {
        step = String(c.text).replace(/\s+/g, " ").trim();
        lastIsError = false;
      } else if (c.type === "tool_result") {
        lastIsError = c.is_error === true;
      }
    }
  }
  return { step: step.slice(0, LIMITS.step), lastIsError, cwd };
}

function statusFor(ageMs: number, lastIsError: boolean): Status {
  if (ageMs > LIMITS.doneAfterMs) return "done";
  if (lastIsError) return "error";
  return ageMs < LIMITS.activeMs ? "working" : "idle";
}

function mtime(file: string): number | undefined {
  try { return fs.statSync(file).mtimeMs; } catch { return undefined; }
}

function projectLabel(dirName: string, cwd?: string): string {
  if (cwd) {
    const b = cwd.split(/[\\/]+/).filter(Boolean).pop();
    if (b) return b;
  }
  return dirName.split("-").filter(Boolean).pop() ?? dirName;
}

function listDir(dir: string): string[] {
  try { return fs.readdirSync(dir); } catch { return []; }
}

export function collectClaudeSessions(opts: ClaudeSessionsOptions): AgentPatch[] {
  const maxAgeMs = opts.maxAgeH * 3600_000;
  const out: AgentPatch[] = [];
  for (const dirName of listDir(opts.projectsDir)) {
    const projDir = path.join(opts.projectsDir, dirName);
    for (const f of listDir(projDir)) {
      if (!f.endsWith(".jsonl")) continue;
      const file = path.join(projDir, f);
      const m = mtime(file);
      if (m === undefined || opts.now - m > maxAgeMs) continue;
      const sid = f.slice(0, -".jsonl".length);
      const s = summarize(readTail(file));
      const label = projectLabel(dirName, s.cwd);
      const team = opts.teamFor?.(dirName) ?? label;
      const id = `claude:${sid}`;
      out.push({
        id,
        name: `${label} #${sid.slice(0, 4)}`,
        team,
        source: "claude",
        role: "lider",
        status: statusFor(opts.now - m, s.lastIsError),
        step: s.step,
        action: s.step || undefined,
        link: s.cwd,
      });

      const subDir = path.join(projDir, sid, "subagents");
      for (const sf of listDir(subDir)) {
        if (!sf.endsWith(".jsonl")) continue;
        const sfile = path.join(subDir, sf);
        const sm = mtime(sfile);
        if (sm === undefined || opts.now - sm > maxAgeMs) continue;
        const aid = sf.slice(0, -".jsonl".length);
        let description = "agente";
        try {
          const meta = JSON.parse(fs.readFileSync(path.join(subDir, `${aid}.meta.json`), "utf-8"));
          if (typeof meta.description === "string" && meta.description.trim()) description = meta.description.trim();
        } catch { /* sem meta: usa o padrão */ }
        const ss = summarize(readTail(sfile));
        out.push({
          id: `${id}/${aid}`,
          name: description.slice(0, 60),
          team,
          source: "claude",
          role: roleOf(description),
          parentId: id,
          status: statusFor(opts.now - sm, ss.lastIsError),
          step: ss.step,
          action: ss.step || undefined,
        });
      }
    }
  }
  return out;
}
