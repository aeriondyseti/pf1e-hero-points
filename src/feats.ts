// Feats and traits that change how a Hero Point is spent or what it grants, recognised by item name.
//
// - Luck of Heroes (APG): when spending a point to reroll or for a bonus before the roll, roll a
//   d20; on 16+ the point is not spent.
// - Fate's Favored (trait): every luck bonus the character receives is 1 higher, and the Hero
//   Point bonus is a luck bonus.
// Hero's Fortune (max 5) and Blood of Heroes (2 points per level) only change the item's maximum
// and how many points are awarded, which the Hero Points item itself tracks.
import { HERO_USES } from "./constants";
import { heroPoints, spend } from "./hero-points";

export const LUCK_OF_HEROES = "Luck of Heroes";
export const FATES_FAVORED = "Fate's Favored";

/** Uses Luck of Heroes applies to: rerolls and bonuses you grant yourself before the roll. */
const LUCK_USES = new Set<keyof typeof HERO_USES>(["reroll", "beforeRoll"]);

const normalize = (s: unknown) =>
  typeof s === "string" ? s.trim().toLowerCase().replace(/[‘’]/g, "'") : "";

export function hasFeat(actor: any, name: string): boolean {
  if (!actor?.items) return false;
  const wanted = normalize(name);
  // A feat switched off on the sheet (pf1 isActive false) doesn't count.
  for (const item of actor.items) if (normalize(item.name) === wanted && item.isActive !== false) return true;
  return false;
}

/** Bonus the roller gets on top of a Hero Point's luck bonus. */
export function luckBonusExtra(rollActor: any): number {
  return hasFeat(rollActor, FATES_FAVORED) ? 1 : 0;
}

export interface Payment {
  /** The use goes ahead. */
  ok: boolean;
  /** A point actually left the item (false when Luck of Heroes kept it). */
  spent: boolean;
  /** The Luck of Heroes d20, when one was rolled. */
  luckRoll?: number;
}

/** Pay for a Hero Point use, giving Luck of Heroes its chance to keep the point. */
export async function pay(actor: any, use: keyof typeof HERO_USES): Promise<Payment> {
  const cost = HERO_USES[use].cost;
  if (heroPoints(actor) < cost) return { ok: false, spent: false };

  let luckRoll: number | undefined;
  if (LUCK_USES.has(use) && hasFeat(actor, LUCK_OF_HEROES)) {
    const roll = await new Roll("1d20").evaluate();
    luckRoll = roll.total as number;
    if (luckRoll > 15) return { ok: true, spent: false, luckRoll };
  }

  const spent = await spend(actor, cost);
  return { ok: spent, spent, luckRoll };
}
