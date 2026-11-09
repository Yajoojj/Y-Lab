import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createServer, type HealthReport } from "../src/server";
import { Store } from "../src/store";

const servers: http.Server[] = [];
afterEach(() => { for (const s of servers.splice(0)) s.close(); });

async function start(opts: { token?: string; health?: () => HealthReport } = {}) {
  const store = new Store();
  const server = createServer(store, {
    port: 0,
    token: opts.token,
    health: opts.health ?? (() => ({ ok: true, collectors: [] })),
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return { store, port, url: `http://127.0.0.1:${port}` };
}

/** fetch não deixa trocar o Host; http.request deixa. */
function raw(port: number, opts: { method?: string; path: string; headers?: Record<string, string>; body?: string }) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method: opts.method ?? "GET", path: opts.path, headers: opts.headers }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${url}/api/events`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("server", () => {
  it("serves the state snapshot", async () => {
    const { url } = await start();
    const res = await fetch(`${url}/api/state`);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("agents");
  });

  it("accepts status events", async () => {
    const { url, store } = await start();
    const res = await post(url, { bot: "A", status: "working", step: "x" });
    expect(res.status).toBe(204);
    expect(store.state().agents["bot:A"]).toBeDefined();
  });

  it("rejects bad JSON, bad schema and huge bodies", async () => {
    const { url } = await start();
    const bad = await post(url, "{nope");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toHaveProperty("error");
    expect((await post(url, { bot: "A", status: "zzz", step: "" })).status).toBe(400);
    expect((await post(url, { bot: "A", status: "idle", step: "x".repeat(70 * 1024) })).status).toBe(413);
  });

  it("accepts Windows-1252 bodies sent by curl on Windows", async () => {
    const { port, store } = await start();
    const body = Buffer.concat([Buffer.from('{"bot":"A","status":"idle","step":"voc'), Buffer.from([0xea]), Buffer.from('"}')]);
    const res = await new Promise<number>((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, method: "POST", path: "/api/events", headers: { "content-type": "application/json" } }, (r) => { r.resume(); resolve(r.statusCode ?? 0); });
      req.on("error", reject);
      req.end(body);
    });
    expect(res).toBe(204);
    expect(store.state().agents["bot:A"].step).toBe("você");
  });

  it("rejects foreign Host headers (DNS rebinding)", async () => {
    const { port } = await start();
    expect((await raw(port, { path: "/api/state", headers: { Host: `evil.com:${port}` } })).status).toBe(403);
    expect((await raw(port, { path: "/api/state", headers: { Host: `localhost:${port}` } })).status).toBe(200);
  });

  it("requires the token for POST when configured", async () => {
    const { url } = await start({ token: "t" });
    expect((await post(url, { bot: "A", status: "idle", step: "" })).status).toBe(401);
    expect((await post(url, { bot: "A", status: "idle", step: "" }, { authorization: "Bearer t" })).status).toBe(204);
    expect((await fetch(`${url}/api/state`)).status).toBe(200);
  });

  it("allows CORS only for the web origin", async () => {
    const { port } = await start();
    const ok = await raw(port, { method: "OPTIONS", path: "/api/events", headers: { Host: `127.0.0.1:${port}`, Origin: "http://127.0.0.1:5173" } });
    expect(ok.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
    const evil = await raw(port, { method: "OPTIONS", path: "/api/events", headers: { Host: `127.0.0.1:${port}`, Origin: "http://evil.com" } });
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("streams a snapshot then deltas over SSE", async () => {
    const { url } = await start();
    const ctrl = new AbortController();
    const res = await fetch(`${url}/api/stream`, { signal: ctrl.signal });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let text = "";
    const readUntil = async (needle: string) => {
      while (!text.includes(needle)) {
        const { value, done } = await reader.read();
        if (done) break;
        text += dec.decode(value);
      }
    };
    await readUntil("event: snapshot");
    expect(text.startsWith("event: snapshot")).toBe(true);
    await post(url, { bot: "Streamy", status: "working", step: "x" });
    await readUntil("Streamy");
    expect(text).toMatch(/event: delta\ndata: .*Streamy/);
    ctrl.abort();
  });

  it("reports collector health", async () => {
    const { url } = await start({ health: () => ({ ok: true, collectors: [{ name: "k9Lanes", error: "sem pasta" }] }) });
    expect(await (await fetch(`${url}/api/health`)).json()).toEqual({ ok: true, collectors: [{ name: "k9Lanes", error: "sem pasta" }] });
  });

  it("returns 404 for unknown routes", async () => {
    const { url } = await start();
    expect((await fetch(`${url}/nope`)).status).toBe(404);
  });
});
