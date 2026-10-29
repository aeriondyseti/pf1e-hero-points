// The +8 "before the roll" use. Two ways in, one Hero Point:
//
// - A toggle in pf1's roll windows. Check dialog (skills, saves, abilities, CL, concentration): a
//   DialogV2 that carries the roll being configured in its options; ticking marks that roll and
//   pf1PreD20Roll adds the bonus once the dialog is submitted. Attack dialog: a V1 app holding the
//   action use's shared rollData, the same object every attack of the action is rolled with;
//   ticking marks it and pf1PreAttackRoll adds the bonus to the first attack roll only.
// - A ★ on the Hero Points item's sheet row that arms the actor, for rolls that skip the dialog.
//   An armed actor's roll windows open with the toggle ticked; unticking it keeps them armed.
//
// Whichever way, the point is spent when the bonus is applied, so closing a dialog costs nothing.
import { ARMED_FLAG, HERO_USES, MODULE_ID } from "./constants";
import { LUCK_OF_HEROES, luckBonusExtra, pay } from "./feats";
import { heroPointItem, heroPoints, spentThisRound } from "./hero-points";
import { bonusPart } from "./rules";
import { escapeHtml, t } from "./ui";

const BEFORE = HERO_USES.beforeRoll;
const TOGGLE_CLASS = `${MODULE_ID}-toggle`;

/** Check rolls whose dialog showed the toggle (the dialog decided), and those it was ticked for. */
const decidedRolls = new WeakSet<object>();
const requestedRolls = new WeakSet<object>();

/**
 * Key on an attack's shared rollData: true/false once the dialog decided (false again after the
 * first attack used it), absent when the dialog was skipped and the armed flag decides.
 */
export const ROLLDATA_KEY = MODULE_ID;

// Armed actors whose bonus has been applied but whose flag clear hasn't landed yet, so two rolls in
// quick succession can't both claim it.
const claiming = new Set<string>();

export function isArmed(actor: any): boolean {
  return !!actor?.getFlag?.(MODULE_ID, ARMED_FLAG);
}

export async function setArmed(actor: any, armed: boolean): Promise<void> {
  if (!actor?.isOwner) return;
  if (armed && heroPoints(actor) < BEFORE.cost) {
    ui.notifications.warn(t("Warn.NoPoints", { name: actor.name }));
    return;
  }
  if (armed) await actor.setFlag(MODULE_ID, ARMED_FLAG, true);
  else await actor.unsetFlag(MODULE_ID, ARMED_FLAG);
  ui.notifications.info(t(armed ? "Arm.Armed" : "Arm.Disarmed", { name: actor.name, amount: beforeRollBonus(actor) }));
}

export function requestForRoll(roll: object, on: boolean): void {
  decidedRolls.add(roll);
  if (on) requestedRolls.add(roll);
  else requestedRolls.delete(roll);
}

/** The bonus this actor would get, Fate's Favored included. */
export function beforeRollBonus(actor: any): number {
  return BEFORE.bonus + luckBonusExtra(actor);
}

/**
 * Claim the bonus for a roll being made, synchronously (pf1's roll hooks don't wait). Returns the
 * formula part to add, or null if the actor can't spend a point now. The spend, and clearing the
 * armed flag, happen afterwards.
 */
export function claimBeforeRoll(actor: any, rollLabel = ""): string | null {
  if (!actor?.isOwner || claiming.has(actor.uuid)) return null;
  if (heroPoints(actor) < BEFORE.cost) {
    ui.notifications.warn(t("Warn.NoPoints", { name: actor.name }));
    if (isArmed(actor)) void actor.unsetFlag(MODULE_ID, ARMED_FLAG);
    return null;
  }
  if (spentThisRound(actor)) {
    ui.notifications.warn(t("Warn.OncePerRound", { name: actor.name }));
    return null;
  }
  const amount = beforeRollBonus(actor);
  claiming.add(actor.uuid);
  void settle(actor, rollLabel, amount);
  return bonusPart(amount, t("Label"));
}

async function settle(actor: any, rollLabel: string, amount: number): Promise<void> {
  try {
    const payment = await pay(actor, "beforeRoll");
    if (isArmed(actor)) await actor.unsetFlag(MODULE_ID, ARMED_FLAG);
    ui.notifications.info(t("Before.Applied", { name: actor.name, amount, roll: rollLabel }));
    if (payment.luckRoll !== undefined) {
      const effect = t(payment.spent ? "Banner.LuckSpent" : "Banner.LuckKept", { roll: payment.luckRoll });
      ui.notifications.info(`${LUCK_OF_HEROES}: ${effect}`);
    }
  } catch (err) {
    console.error(`${MODULE_ID} | spending the before-roll Hero Point failed`, err);
  } finally {
    claiming.delete(actor.uuid);
  }
}

export function onPreD20Roll(roll: any, options: any): void {
  const decided = decidedRolls.has(roll);
  const requested = requestedRolls.has(roll);
  decidedRolls.delete(roll);
  requestedRolls.delete(roll);
  if (roll.isStatic) return; // Take 10/20 isn't a roll: nothing to add to, and an armed point stays armed

  const actor = options?.speaker ? ChatMessage.getSpeakerActor(options.speaker) : null;
  if (decided ? !requested : !isArmed(actor)) return;
  const part = claimBeforeRoll(actor, roll.options?.flavor ?? options?.flavor ?? "");
  if (part) roll.addBonus(part);
}

export function onPreAttackRoll(action: any, _config: unknown, rollData: any, _rollOptions: unknown, parts: string[]): void {
  if (!rollData) return;
  const wanted = ROLLDATA_KEY in rollData ? rollData[ROLLDATA_KEY] === true : isArmed(action?.actor);
  rollData[ROLLDATA_KEY] = false; // later attacks and crit confirmations of this action don't get it
  if (!wanted) return;
  const part = claimBeforeRoll(action?.actor, action?.item?.name ?? "");
  if (part) parts.push(part);
}

/** The toggle's checkbox and label, or null if the actor has no points to spend. */
function buildToggle(actor: any, checked: boolean, onChange: (on: boolean) => void): HTMLLabelElement | null {
  if (!actor?.isOwner) return null;
  const left = heroPoints(actor);
  if (left < BEFORE.cost) return null;

  const blocked = spentThisRound(actor);
  const label = document.createElement("label");
  label.className = `checkbox ${TOGGLE_CLASS}`;
  if (blocked) label.dataset.tooltip = t("Warn.OncePerRound", { name: actor.name });
  label.innerHTML =
    `<input type="checkbox"${checked && !blocked ? " checked" : ""}${blocked ? " disabled" : ""}> ` +
    `<i class="fa-solid fa-star" inert></i> ` +
    escapeHtml(t("Before.Toggle", { amount: beforeRollBonus(actor), count: left }));
  // No name attribute, so pf1 never sees the checkbox in its form data.
  label.querySelector("input")!.addEventListener("change", (event) => {
    onChange((event.currentTarget as HTMLInputElement).checked);
  });
  return label;
}

/** pf1's check roll dialog (D20RollPF#promptDialog). */
function onRenderDialog(app: any, element: HTMLElement): void {
  const roll = app?.options?.roll;
  if (!roll || !(roll instanceof pf1.dice.D20RollPF)) return;
  const form = element?.querySelector?.("form");
  if (!form || form.querySelector(`.${TOGGLE_CLASS}`)) return;

  const speaker = app.options.speaker;
  const actor = speaker ? ChatMessage.getSpeakerActor(speaker) : null;
  const checked = decidedRolls.has(roll) ? requestedRolls.has(roll) : isArmed(actor);
  const toggle = buildToggle(actor, checked, (on) => requestForRoll(roll, on));
  if (!toggle) return;
  requestForRoll(roll, checked && !spentThisRound(actor));

  const group = document.createElement("div");
  group.className = "form-group";
  group.innerHTML = `<label>${escapeHtml(t("Label"))}</label><div class="form-fields"></div>`;
  group.querySelector(".form-fields")!.append(toggle);
  form.append(group);
  app.setPosition?.({ height: "auto" });
}

/** pf1's attack dialog (V1); it re-renders when its own checkboxes change, so state lives in rollData. */
function onRenderAttackDialog(app: any, html: any): void {
  const root: HTMLElement | undefined = html instanceof HTMLElement ? html : html?.[0];
  const rollData = app?.rollData;
  if (!root || !rollData || root.querySelector(`.${TOGGLE_CLASS}`)) return;

  const actor = app.actionUse?.actor ?? app.object?.actor;
  if (!(ROLLDATA_KEY in rollData)) rollData[ROLLDATA_KEY] = isArmed(actor) && !spentThisRound(actor);
  const toggle = buildToggle(actor, rollData[ROLLDATA_KEY] === true, (on) => {
    rollData[ROLLDATA_KEY] = on;
  });
  if (!toggle) return;

  const flags = root.querySelector(".flags");
  if (flags) flags.append(toggle);
  else root.querySelector("form")?.prepend(toggle);
}

/** The ★ arm/disarm button on the Hero Points item's row(s) on pf1 actor sheets. */
function onRenderSheet(app: any, html: any): void {
  const actor = app?.actor;
  if (!actor?.isOwner) return;
  const item = heroPointItem(actor);
  if (!item) return;
  const root: HTMLElement | undefined = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  const armed = isArmed(actor);
  const amount = beforeRollBonus(actor);
  for (const row of root.querySelectorAll<HTMLElement>(`li.item[data-item-id="${item.id}"]`)) {
    if (row.querySelector(`.${MODULE_ID}-arm`)) continue;
    const button = document.createElement("a");
    button.className = `item-control ${MODULE_ID}-arm${armed ? " active" : ""}`;
    button.dataset.tooltip = t(armed ? "Arm.DisarmTooltip" : "Arm.ArmTooltip", { amount });
    button.innerHTML = `<i class="fa-solid fa-star" inert></i>`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void setArmed(actor, !isArmed(actor));
    });
    const host = row.querySelector(".item-action") ?? row.querySelector(".item-controls") ?? row;
    host.prepend(button);
  }
}

export function registerBeforeRollHooks(): void {
  Hooks.on("pf1PreD20Roll", onPreD20Roll);
  Hooks.on("pf1PreAttackRoll", onPreAttackRoll);
  Hooks.on("renderDialogV2", onRenderDialog);
  Hooks.on("renderAttackDialog", onRenderAttackDialog);
  Hooks.on("renderActorSheetPF", onRenderSheet);
}
