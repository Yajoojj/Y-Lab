import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config";
import { collectClaudeSessions } from "./collectors/claudeSessions";
import { collectK9Lanes } from "./collectors/k9Lanes";
import { createServer, type HealthReport } from "./server";
import { Store } from "./store";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const config = loadConfig(path.join(ROOT, "ylab.config.json"));
const store = new Store({ file: path.join(ROOT, "data", "state.json") });
store.load();

const health: HealthReport["collectors"] = [
  { name: "claudeSessions" },
  { name: "k9Lanes" },
];

function run(name: string, fn: () => void): void {
  const h = health.find((c) => c.name === name)!;
  try {
    fn();
    delete h.error;
  } catch (e) {
    h.error = e instanceof Error ? e.message : String(e);
  }
  h.lastRunAt = new Date().toISOString();
}

function tick(): void {
  let teamFor: ((dir: string) => string | undefined) | undefined;
  run("k9Lanes", () => {
    if (!config.k9) throw new Error("k9.path não configurado em ylab.config.json");
    const r = collectK9Lanes(config.k9.path);
    teamFor = r.teamFor;
    store.applyPatches(r.patches);
  });
  run("claudeSessions", () => {
    store.applyPatches(collectClaudeSessions({
      projectsDir: config.claudeProjectsDir,
      maxAgeH: config.sessionsMaxAgeH,
      now: Date.now(),
      teamFor,
    }));
  });
  store.sweep();
}

const server = createServer(store, { port: config.port, token: config.token, health: () => ({ ok: true, collectors: health }) });

tick();
setInterval(tick, 3_000);
setInterval(() => { try { store.save(); } catch (e) { console.error("[hub] falha ao salvar", e); } }, 10_000);

function shutdown(): void {
  try { store.save(); } catch { /* saindo mesmo assim */ }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(config.port, "127.0.0.1", () => {
  console.log(`[hub] Y-Lab ouvindo em http://127.0.0.1:${config.port}`);
});
