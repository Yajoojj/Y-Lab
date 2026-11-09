import fs from "node:fs";
import path from "node:path";
import type { AgentPatch, Status } from "../types";

const STATE_MAP: Record<string, Status> = {
  trabalhando: "working",
  em_andamento: "idle",
  aguardando: "idle",
  bloqueada: "waiting_user",
  concluida: "done",
};

/** Mesmo nome de pasta que o Claude Code usa em ~/.claude/projects (regra de `pasta_projeto` do K9). */
export function projectDirName(folder: string): string {
  return folder.replace(/[^A-Za-z0-9]/g, "-");
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, "utf-8")) as T; } catch { return fallback; }
}

interface Lane { nome: string; pasta: string }
interface LaneState { estado?: string; nota?: string; prs?: string[] }

export function collectK9Lanes(k9Path: string): { patches: AgentPatch[]; teamFor: (projectDir: string) => string | undefined } {
  const cfgFile = path.join(k9Path, "trilhas.json");
  if (!fs.existsSync(cfgFile)) throw new Error(`trilhas.json não encontrado em ${k9Path}`);
  const cfg = readJson<{ trilhas?: Lane[] }>(cfgFile, {});
  const lanes = (cfg.trilhas ?? []).filter((l) => l && typeof l.nome === "string");

  const byDir = new Map<string, string>();
  const patches: AgentPatch[] = lanes.map((l) => {
    if (typeof l.pasta === "string") byDir.set(projectDirName(l.pasta), l.nome);
    const e = readJson<LaneState>(path.join(k9Path, "trilhas", l.nome, "estado.json"), {});
    const nota = typeof e.nota === "string" ? e.nota : "";
    return {
      id: `k9:${l.nome}`,
      name: l.nome,
      team: l.nome,
      source: "k9",
      role: "lider",
      status: STATE_MAP[e.estado ?? ""] ?? "idle",
      step: nota,
      action: nota || undefined,
      link: Array.isArray(e.prs) && typeof e.prs[0] === "string" ? e.prs[0] : undefined,
    };
  });
  return { patches, teamFor: (dir) => byDir.get(dir) };
}
