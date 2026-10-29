// Which d20 rolls in a chat message a Hero Point can act on.
//
// Plain and pf1 check messages (skills, saves, abilities, CL, `/r 1d20+x`) keep their rolls in
// message.rolls. pf1 action cards keep each attack's attack and crit-confirmation rolls in
// message.systemRolls.attacks[i] instead, rendered inside `.chat-attack[data-index=i]`.
import { isD20Roll, type RollJSON } from "./rules";
import { t } from "./ui";

export type RollTarget =
  | { kind: "roll"; index: number; roll: RollJSON; label: string }
  | { kind: "attack"; attackIndex: number; field: "attack" | "critConfirm"; roll: RollJSON; label: string };

/** Where in a message the user right-clicked, as far as it matters for picking a roll. */
export interface ClickedSpot {
  attackIndex?: number;
  critConfirm?: boolean;
}

const toJSON = (roll: any): RollJSON | null =>
  roll == null ? null : typeof roll.toJSON === "function" ? roll.toJSON() : roll;

export function rollTargets(message: any): RollTarget[] {
  const attacks: any[] = message?.systemRolls?.attacks ?? [];
  const out: RollTarget[] = [];

  if (attacks.length) {
    attacks.forEach((atk, attackIndex) => {
      for (const field of ["attack", "critConfirm"] as const) {
        const roll = toJSON(atk?.[field]);
        if (!isD20Roll(roll)) continue;
        const flavor = roll.options?.flavor || t(field === "attack" ? "Fallback.Attack" : "Fallback.CritConfirm");
        out.push({ kind: "attack", attackIndex, field, roll, label: `${flavor}: ${roll.total}` });
      }
    });
    return out;
  }

  (message?.rolls ?? []).forEach((r: any, index: number) => {
    const roll = toJSON(r);
    if (!isD20Roll(roll)) return;
    const flavor = roll.options?.flavor || message.flavor || t("Fallback.Roll");
    out.push({ kind: "roll", index, roll, label: `${flavor}: ${roll.total}` });
  });
  return out;
}

/**
 * The roll the user meant: the one under the cursor on an attack card, else the only candidate.
 * Undefined means the user must choose.
 */
export function pickTarget(targets: RollTarget[], spot: ClickedSpot = {}): RollTarget | undefined {
  if (targets.length === 1) return targets[0];
  if (spot.attackIndex === undefined) return undefined;
  const inAttack = targets.filter((t) => t.kind === "attack" && t.attackIndex === spot.attackIndex);
  const wantedField = spot.critConfirm ? "critConfirm" : "attack";
  return inAttack.find((t) => t.kind === "attack" && t.field === wantedField) ?? (inAttack.length === 1 ? inAttack[0] : undefined);
}

/** Read the clicked spot from the element under the cursor (pf1 attack-roll.hbs markup). */
export function spotFromElement(el: Element | null | undefined): ClickedSpot {
  const attack = el?.closest?.(".chat-attack[data-index]") as HTMLElement | null | undefined;
  if (!attack) return {};
  const attackIndex = Number(attack.dataset.index);
  if (!Number.isInteger(attackIndex)) return {};
  const critConfirm = !!el?.closest?.("td.roll.critical:not(.damage)");
  return { attackIndex, critConfirm };
}
