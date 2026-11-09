import { SHAPES, type Accessory, type Look, type Shape } from "./types";

export const NEON = {
  yellow: "#FCEE0A",
  cyan: "#00F0FF",
  magenta: "#FF2A6D",
  violet: "#9D4EDD",
  green: "#39FF88",
  orange: "#FF8A00",
  bg: "#05060B",
} as const;

export const PALETTE: string[] = [NEON.yellow, NEON.cyan, NEON.magenta, NEON.violet, NEON.green, NEON.orange];

const ROLE_LOOK: Record<string, [Shape, Accessory]> = {
  lider: ["rounded_cube", "none"],
  implementador: ["pill", "antenna"],
  revisor: ["sphere", "glasses"],
  planejador: ["cone", "stem"],
  relator: ["hexagon", "bow"],
  ajudante: ["hexagon", "none"],
};

export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function deriveLook(id: string, role?: string): Look {
  const h = hash(id);
  const color = PALETTE[h % PALETTE.length];
  const byRole = role ? ROLE_LOOK[role] : undefined;
  if (byRole) return { shape: byRole[0], color, accessory: byRole[1] };
  return { shape: SHAPES[(h >>> 8) % SHAPES.length], color, accessory: "none" };
}

export function teamColor(name: string): string {
  return PALETTE[hash("team:" + name) % PALETTE.length];
}
