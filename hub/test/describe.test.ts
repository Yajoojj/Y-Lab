import { describe, it, expect } from "vitest";
import { describeTool, roleOf } from "../src/describe";

describe("describeTool", () => {
  it("summarizes shell commands without leaking them", () => {
    expect(describeTool("Bash", { command: "python -m pytest", description: "x" })).toBe("rodando os testes");
    expect(describeTool("Bash", { command: "export TOKEN=abc; ./x" })).toBe("rodando um comando");
    expect(describeTool("PowerShell", { command: "git commit -m x" })).toBe("fazendo commit");
    expect(describeTool("Bash", { command: "gh pr create" })).toBe("abrindo/atualizando PR");
    expect(describeTool("Bash", { command: "ls", description: "Lista arquivos" })).toBe("Lista arquivos");
  });
  it("names files by basename", () => {
    expect(describeTool("Read", { file_path: "C:/a/b/app.ts" })).toBe("lendo app.ts");
    expect(describeTool("Edit", { file_path: "C:\\\\a\\\\x.ts" })).toBe("editando x.ts");
    expect(describeTool("Write", { file_path: "/a/y.md" })).toBe("escrevendo y.md");
  });
  it("describes search, delegation and skills", () => {
    expect(describeTool("Grep", { pattern: "foo" })).toBe("procurando “foo”");
    expect(describeTool("Agent", { description: "Review task 1" })).toBe("delegou: Review task 1");
    expect(describeTool("Skill", { skill: "tdd" })).toBe("consultando a skill tdd");
    expect(describeTool("WeirdTool", {})).toBe("WeirdTool");
  });
});

describe("roleOf", () => {
  it("classifies subagent descriptions", () => {
    expect(roleOf("Re-review task 3")).toBe("revisor");
    expect(roleOf("Implement task 2")).toBe("implementador");
    expect(roleOf("Plan etapa")).toBe("planejador");
    expect(roleOf("Write report")).toBe("relator");
    expect(roleOf("Explore code")).toBe("ajudante");
  });
});
