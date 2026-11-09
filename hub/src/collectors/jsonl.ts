import fs from "node:fs";

/** Lê só o fim do arquivo JSONL; ignora a linha cortada no início e linhas que não parseiam. */
export function readTail(file: string, bytes = 250_000): unknown[] {
  let raw: string;
  let size: number;
  try {
    const fd = fs.openSync(file, "r");
    try {
      size = fs.fstatSync(fd).size;
      const start = Math.max(0, size - bytes);
      const buf = Buffer.alloc(size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      raw = buf.toString("utf-8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return [];
  }
  const lines = raw.split(/\r?\n/);
  if (size > bytes) lines.shift();
  const out: unknown[] = [];
  for (const ln of lines) {
    if (!ln.trim()) continue;
    try { out.push(JSON.parse(ln)); } catch { /* linha parcial ou corrompida */ }
  }
  return out;
}
