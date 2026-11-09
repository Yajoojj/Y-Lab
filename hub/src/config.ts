import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Config {
  port: number;
  token?: string;
  sessionsMaxAgeH: number;
  claudeProjectsDir: string;
  k9?: { path: string };
}

export function loadConfig(file: string): Config {
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(fs.readFileSync(file, "utf-8")); } catch { /* sem arquivo: padrões */ }
  const k9 = raw.k9 as { path?: unknown } | undefined;
  return {
    port: typeof raw.port === "number" ? raw.port : 7077,
    token: typeof raw.token === "string" && raw.token ? raw.token : undefined,
    sessionsMaxAgeH: typeof raw.sessionsMaxAgeH === "number" ? raw.sessionsMaxAgeH : 6,
    claudeProjectsDir: typeof raw.claudeProjectsDir === "string" ? raw.claudeProjectsDir : path.join(os.homedir(), ".claude", "projects"),
    k9: k9 && typeof k9.path === "string" ? { path: k9.path } : undefined,
  };
}
