const base = (p: unknown): string => String(p ?? "").split(/[\\/]+/).filter(Boolean).pop() ?? "";

/** Frase curta sobre uma chamada de ferramenta. Nunca devolve o comando completo. */
export function describeTool(name: string, input: Record<string, unknown>): string {
  if (name === "Bash" || name === "PowerShell") {
    const c = String(input.command ?? "");
    if (/unittest|pytest|vitest|executar_postgresql|npm (run )?test|playwright test/.test(c)) return "rodando os testes";
    if (/git commit/.test(c)) return "fazendo commit";
    if (/gh pr/.test(c)) return "abrindo/atualizando PR";
    const d = String(input.description ?? "").replace(/\s+/g, " ").trim();
    return d ? d.slice(0, 60) : "rodando um comando";
  }
  switch (name) {
    case "Read": return `lendo ${base(input.file_path)}`;
    case "Edit":
    case "MultiEdit": return `editando ${base(input.file_path)}`;
    case "Write": return `escrevendo ${base(input.file_path)}`;
    case "Grep": return `procurando “${String(input.pattern ?? "").slice(0, 30)}”`;
    case "Glob": return `procurando arquivos ${String(input.pattern ?? "").slice(0, 30)}`;
    case "Agent":
    case "Task": return `delegou: ${String(input.description ?? "").slice(0, 50)}`;
    case "Skill": return `consultando a skill ${String(input.skill ?? "")}`;
    case "SendMessage": return "conversando com um colega";
    case "TodoWrite": return "atualizando a lista de tarefas";
    default: return name;
  }
}

export function roleOf(description: string): string {
  const d = description.toLowerCase();
  if (/re-review|re-revis|review|revis/.test(d)) return "revisor";
  if (/plan/.test(d)) return "planejador";
  if (/implement|fix|corre/.test(d)) return "implementador";
  if (/relat|report/.test(d)) return "relator";
  return "ajudante";
}
