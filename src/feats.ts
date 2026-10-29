// Feats and traits that change how a Hero Point is spent or what it grants, recognised by item name
// (English, as pf1's compendiums name them).
//
// - Luck of Heroes (APG): when spending a point to reroll or for a bonus before the roll, roll a
//   d20; on 16+ the point is not spent. The use still counts toward the one-per-round limit: the
//   character used a Hero Point, the feat just let them keep it.
// - Fate's Favored (trait): every luck bonus the character receives is 1 higher, and the Hero
//   Point bonus is a luck bonus.
// Hero's Fortune (max 5) and Blood of Heroes (2 points per level) only change the item's maximum
// and how many points are awarded, which the Hero Points item itself tracks.
import { HERO_USES } from "./constants";
import { heroPoints, itemsNamed, recordUse, spend } from "./hero-points";

export const LUCK_OF_HEROES = "Luck of Heroes";
export const FATES_FAVORED = "Fate's Favored";

/** Uses Luck of Heroes applies to: rerolls and bonuses you grant yourself before the roll. */
const LUCK_USES = new Set<keyof typeof HERO_USES>(["reroll", "beforeRoll"]);

export function hasFeat(actor: any, name: string): boolean {
  return itemsNamed(actor, name).length > 0;
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

/**
 * Pay for a Hero Point use, giving Luck of Heroes its chance to keep the point, and record the use
 * on the actor together with any other actor changes the caller passes.
 */
export async function pay(actor: any, use: keyof typeof HERO_USES, actorUpdate: Record<string, unknown> = {}): Promise<Payment> {
  const cost = HERO_USES[use].cost;
  if (heroPoints(actor) < cost) return { ok: false, spent: false };

  let luckRoll: number | undefined;
  let spent = false;
  if (LUCK_USES.has(use) && hasFeat(actor, LUCK_OF_HEROES)) {
    const roll = await new Roll("1d20").evaluate();
    luckRoll = roll.total as number;
  }
  if (luckRoll === undefined || luckRoll <= 15) {
    spent = await spend(actor, cost);
    if (!spent) return { ok: false, spent: false, luckRoll };
  }
  await recordUse(actor, actorUpdate);
  return { ok: true, spent, luckRoll };
}
