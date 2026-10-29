// The "Hero Points" feature item: finding it on an actor and spending its limited uses.
import { MODULE_ID, SPENT_FLAG } from "./constants";

export const DEFAULT_ITEM_NAME = "Hero Points";

export function configuredName(): string {
  const name = game.settings.get(MODULE_ID, "itemName");
  return typeof name === "string" && name.trim() ? name : DEFAULT_ITEM_NAME;
}

/** Item names compared loosely: case, surrounding space and curly apostrophes don't matter. */
export function normalizeName(name: unknown): string {
  return typeof name === "string" ? name.trim().toLowerCase().replace(/[‘’]/g, "'") : "";
}

/** The actor's enabled items with this name (pf1 isActive false means switched off on the sheet). */
export function itemsNamed(actor: any, name: string): any[] {
  const wanted = normalizeName(name);
  return [...(actor?.items ?? [])].filter((item: any) => normalizeName(item.name) === wanted && item.isActive !== false);
}

/**
 * The actor's Hero Points item: one named like the itemName setting that has limited uses. pf1
 * reports items without limited uses as having Infinity charges; those are skipped.
 */
export function heroPointItem(actor: any, name: string = configuredName()): any | undefined {
  return itemsNamed(actor, name).find((item) => Number.isFinite(item.charges));
}

/** Hero Points the actor has left (0 with no usable item). */
export function heroPoints(actor: any, name?: string): number {
  const item = heroPointItem(actor, name);
  return item ? Math.max(0, item.charges) : 0;
}

export function canSpend(actor: any, cost = 1, name?: string): boolean {
  return !!actor?.isOwner && heroPoints(actor, name) >= cost;
}

/** The combat round the actor is fighting in, or null outside combat. */
function combatRound(actor: any): { combat: string; round: number } | null {
  const combat = game.combat;
  if (!combat?.started || !actor) return null;
  const fighting = combat.combatants?.some((c: any) => c.actor?.uuid === actor.uuid);
  return fighting ? { combat: combat.id, round: combat.round } : null;
}

/** APG: "You cannot spend more than 1 hero point during a single round of combat." */
export function spentThisRound(actor: any): boolean {
  if (!game.settings.get(MODULE_ID, "oncePerRound")) return false;
  const now = combatRound(actor);
  if (!now) return false;
  const last = actor.getFlag?.(MODULE_ID, SPENT_FLAG);
  return last?.combat === now.combat && last?.round === now.round;
}

/**
 * Record a Hero Point use on the actor: the combat round it was used in (for the one-per-round
 * limit), plus any other actor changes the caller wants made in the same update.
 */
export async function recordUse(actor: any, actorUpdate: Record<string, unknown> = {}): Promise<void> {
  const update = { ...actorUpdate };
  const now = combatRound(actor);
  if (now) update[`flags.${MODULE_ID}.${SPENT_FLAG}`] = now;
  if (Object.keys(update).length) await actor.update(update);
}

/**
 * Deduct Hero Points from the actor's item. Returns false (and spends nothing) if the actor
 * doesn't have enough.
 */
export async function spend(actor: any, cost = 1, name?: string): Promise<boolean> {
  const item = heroPointItem(actor, name);
  if (!item || item.charges < cost) return false;
  await item.addCharges(-cost);
  return true;
}

/** Undo a use when posting its result fails: give back `cost` points and lift the round lock. */
export async function refund(actor: any, cost = 1, name?: string): Promise<void> {
  const item = heroPointItem(actor, name);
  if (item && cost) await item.addCharges(cost);
  if (actor?.getFlag?.(MODULE_ID, SPENT_FLAG)) await actor.update({ [`flags.${MODULE_ID}.-=${SPENT_FLAG}`]: null });
}
