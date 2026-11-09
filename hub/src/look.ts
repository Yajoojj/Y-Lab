import { SHAPES, type Accessory, type Look, type Shape } from "./types";

/** Paleta corporativa vermelho/preto (inspirada na estética Arasaka; sem nome ou logo). */
export const CORP = {
  red: "#FF1F33",
  crimson: "#C3001B",
  scarlet: "#FF4D3D",
  bone: "#EDE6DC",
  steel: "#9AA0AB",
  ember: "#FF8A3D",
  amber: "#FFB547",
  ice: "#4DE8FF",
  bg: "#060507",
} as const;

export const PALETTE: string[] = [CORP.red, CORP.crimson, CORP.scarlet, CORP.bone, CORP.steel, CORP.ember];

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
