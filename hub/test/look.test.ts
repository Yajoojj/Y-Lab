import { describe, it, expect } from "vitest";
import { deriveLook, PALETTE, teamColor } from "../src/look";

describe("deriveLook", () => {
  it("is deterministic", () => {
    expect(deriveLook("x")).toEqual(deriveLook("x"));
  });
  it("uses the role to pick the shape", () => {
    expect(deriveLook("x", "revisor").shape).toBe("sphere");
    expect(deriveLook("x", "implementador")).toMatchObject({ shape: "pill", accessory: "antenna" });
  });
  it("picks colors from the neon palette", () => {
    for (const id of ["a", "b", "c", "claude:123", "bot:Z"]) expect(PALETTE).toContain(deriveLook(id).color);
    expect(PALETTE).toContain(teamColor("Ops"));
  });
});
