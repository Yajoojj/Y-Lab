import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectK9Lanes, projectDirName } from "../src/collectors/k9Lanes";

function makeK9(lanes: { nome: string; pasta: string; estado?: Record<string, unknown> }[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ylab-k9-"));
  fs.writeFileSync(path.join(dir, "trilhas.json"), JSON.stringify({ trilhas: lanes.map(({ nome, pasta }) => ({ nome, pasta })) }));
  for (const l of lanes) {
    if (!l.estado) continue;
    fs.mkdirSync(path.join(dir, "trilhas", l.nome), { recursive: true });
    fs.writeFileSync(path.join(dir, "trilhas", l.nome, "estado.json"), JSON.stringify(l.estado));
  }
  return dir;
}

describe("collectK9Lanes", () => {
  it("maps lanes to agents", () => {
    const k9 = makeK9([
      { nome: "dominio", pasta: "C:/p/dominio", estado: { estado: "trabalhando", nota: "Etapa 6", prs: ["https://x/1"] } },
      { nome: "crm", pasta: "C:/p/crm", estado: { estado: "bloqueada", nota: "decisão" } },
    ]);
    const { patches } = collectK9Lanes(k9);
    expect(patches[0]).toMatchObject({ id: "k9:dominio", name: "dominio", source: "k9", team: "dominio", status: "working", step: "Etapa 6", link: "https://x/1", role: "lider", action: "Etapa 6" });
    expect(patches[1]).toMatchObject({ id: "k9:crm", status: "waiting_user" });
  });

  it("maps every state", () => {
    const k9 = makeK9([
      { nome: "a", pasta: "a", estado: { estado: "em_andamento" } },
      { nome: "b", pasta: "b", estado: { estado: "aguardando" } },
      { nome: "c", pasta: "c", estado: { estado: "concluida" } },
      { nome: "d", pasta: "d" },
    ]);
    expect(collectK9Lanes(k9).patches.map((p) => p.status)).toEqual(["idle", "idle", "done", "idle"]);
  });

  it("maps Claude project dirs back to lanes", () => {
    const pasta = "C:/Users/yaoku/OneDrive/Área de Trabalho/x";
    const { teamFor } = collectK9Lanes(makeK9([{ nome: "interface", pasta }]));
    expect(projectDirName(pasta)).toBe("C--Users-yaoku-OneDrive--rea-de-Trabalho-x");
    expect(teamFor("C--Users-yaoku-OneDrive--rea-de-Trabalho-x")).toBe("interface");
    expect(teamFor("other")).toBeUndefined();
  });

  it("throws when trilhas.json is missing", () => {
    expect(() => collectK9Lanes(path.join(os.tmpdir(), "nope-ylab-k9"))).toThrow();
  });
});
