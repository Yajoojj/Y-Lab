import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config";

const write = (o: unknown) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ylab-cfg-")), "ylab.config.json");
  fs.writeFileSync(f, JSON.stringify(o));
  return f;
};

describe("loadConfig", () => {
  it("fills defaults", () => {
    const c = loadConfig(write({}));
    expect(c.port).toBe(7077);
    expect(c.sessionsMaxAgeH).toBe(6);
    expect(c.claudeProjectsDir).toBe(path.join(os.homedir(), ".claude", "projects"));
    expect(c.token).toBeUndefined();
    expect(c.k9).toBeUndefined();
  });

  it("reads values from the file", () => {
    const c = loadConfig(write({ port: 8000, token: "abc", sessionsMaxAgeH: 2, k9: { path: "C:/k9" } }));
    expect(c).toMatchObject({ port: 8000, token: "abc", sessionsMaxAgeH: 2, k9: { path: "C:/k9" } });
  });

  it("lets YLAB_PORT override the port", () => {
    process.env.YLAB_PORT = "7078";
    try {
      expect(loadConfig(write({ port: 8000 })).port).toBe(7078);
    } finally {
      delete process.env.YLAB_PORT;
    }
  });

  it("uses defaults when the file is missing", () => {
    expect(loadConfig(path.join(os.tmpdir(), "missing-ylab.json")).port).toBe(7077);
  });
});
