// The "Hero Points" feature item: finding it on an actor and spending its limited uses.
import { MODULE_ID, SPENT_FLAG } from "./constants";

export const DEFAULT_ITEM_NAME = "Hero Points";

function configuredName(): string {
  const name = game.settings.get(MODULE_ID, "itemName");
  return typeof name === "string" && name.trim() ? name : DEFAULT_ITEM_NAME;
}

const normalize = (s: unknown) => (typeof s === "string" ? s.trim().toLowerCase() : "");

/**
 * The actor's Hero Points item: one named like the itemName setting (case-insensitive) that has
 * limited uses. pf1 reports items without limited uses as having Infinity charges; those are skipped.
 */
export function heroPointItem(actor: any, name: string = configuredName()): any | undefined {
  if (!actor?.items) return undefined;
  const wanted = normalize(name);
  for (const item of actor.items) {
    if (normalize(item.name) !== wanted) continue;
    if (Number.isFinite(item.charges)) return item;
  }
  return undefined;
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
 * Deduct Hero Points from the actor's item. Returns false (and spends nothing) if the actor
 * doesn't have enough. Records the combat round it was spent in.
 */
export async function spend(actor: any, cost = 1, name?: string): Promise<boolean> {
  const item = heroPointItem(actor, name);
  if (!item || item.charges < cost) return false;
  await item.addCharges(-cost);
  const now = combatRound(actor);
  if (now) await actor.setFlag(MODULE_ID, SPENT_FLAG, now);
  return true;
}

/** Give Hero Points back, used when posting the result fails after the spend. */
export async function refund(actor: any, cost = 1, name?: string): Promise<void> {
  const item = heroPointItem(actor, name);
  if (item) await item.addCharges(cost);
  await actor?.unsetFlag?.(MODULE_ID, SPENT_FLAG);
}
