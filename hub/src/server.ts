import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { parseEvent } from "./schema";
import type { Store } from "./store";

export interface HealthReport {
  ok: true;
  collectors: { name: string; lastRunAt?: string; error?: string }[];
}

export interface ServerOptions {
  port: number;
  token?: string;
  health: () => HealthReport;
  allowedOrigins?: string[];
}

const MAX_BODY = 64 * 1024;
const PING_MS = 15_000;
const DEFAULT_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"];

function send(res: http.ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(body));
}

function hostAllowed(req: http.IncomingMessage): boolean {
  const port = req.socket.localPort;
  const host = (req.headers.host ?? "").toLowerCase();
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

function tokenOk(req: http.IncomingMessage, token?: string): boolean {
  if (!token) return true;
  const got = Buffer.from(String(req.headers.authorization ?? ""));
  const want = Buffer.from(`Bearer ${token}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

function readBody(req: http.IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    let tooBig = false;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) { tooBig = true; return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(tooBig ? null : Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export function createServer(store: Store, opts: ServerOptions): http.Server {
  const origins = opts.allowedOrigins ?? DEFAULT_ORIGINS;
  const clients = new Set<http.ServerResponse>();

  store.subscribe((delta) => {
    const msg = `event: delta\ndata: ${JSON.stringify(delta)}\n\n`;
    for (const c of clients) c.write(msg);
  });

  const ping = setInterval(() => { for (const c of clients) c.write(": ping\n\n"); }, PING_MS);
  ping.unref();

  const server = http.createServer(async (req, res) => {
    try {
      if (!hostAllowed(req)) return send(res, 403, { error: "host não permitido" });

      const origin = req.headers.origin;
      if (origin && origins.includes(origin)) {
        res.setHeader("access-control-allow-origin", origin);
        res.setHeader("vary", "origin");
        res.setHeader("access-control-allow-headers", "content-type, authorization");
        res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
      }
      if (req.method === "OPTIONS") return send(res, 204);

      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (req.method === "GET" && url.pathname === "/api/state") return send(res, 200, store.state());
      if (req.method === "GET" && url.pathname === "/api/health") return send(res, 200, opts.health());

      if (req.method === "GET" && url.pathname === "/api/stream") {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        });
        res.write(`event: snapshot\ndata: ${JSON.stringify(store.state())}\n\n`);
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/events") {
        if (!tokenOk(req, opts.token)) return send(res, 401, { error: "token inválido" });
        const raw = await readBody(req);
        if (raw === null) return send(res, 413, { error: "corpo maior que 64 KB" });
        let json: unknown;
        try { json = JSON.parse(raw); } catch { return send(res, 400, { error: "JSON inválido" }); }
        try {
          store.applyEvent(parseEvent(json));
        } catch (e) {
          if (e instanceof ZodError) return send(res, 400, { error: "evento inválido", issues: e.issues.slice(0, 5).map((i) => i.message) });
          throw e;
        }
        return send(res, 204);
      }

      send(res, 404, { error: "não encontrado" });
    } catch (e) {
      console.error("[hub] erro na requisição", e);
      if (!res.headersSent) send(res, 500, { error: "erro interno" });
      else res.end();
    }
  });

  server.on("close", () => {
    clearInterval(ping);
    for (const c of clients) c.end();
    clients.clear();
  });
  return server;
}
