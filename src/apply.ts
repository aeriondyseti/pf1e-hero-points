// Spending a Hero Point on a roll already in chat. The original message is left untouched; the
// result is posted as a new message that names the use and links back to it.
import { HERO_USES, MODULE_ID, type ChatUse } from "./constants";
import { FATES_FAVORED, LUCK_OF_HEROES, luckBonusExtra, pay, type Payment } from "./feats";
import { heroPoints, refund, spentThisRound } from "./hero-points";
import { threatens, withFlatBonus, type RollJSON } from "./rules";
import type { RollTarget } from "./targets";
import { confirmSpend, escapeHtml, t } from "./ui";

export interface UseOptions {
  target: RollTarget;
  /** The actor spending the point when aiding; defaults to the roll's own actor. */
  helper?: any;
  /** Skip the confirmation dialog (API callers). */
  skipConfirm?: boolean;
}

export function speakerActor(message: any): any {
  return message?.speaker ? ChatMessage.getSpeakerActor(message.speaker) : null;
}

/** The roll mode the original was made with, so a hidden roll stays hidden. */
export function rollModeOf(message: any): string {
  if (message.blind) return "blindroll";
  const whisper: string[] = message.whisper ?? [];
  if (!whisper.length) return "publicroll";
  const authorId = message.author?.id ?? message.author;
  return whisper.length === 1 && whisper[0] === authorId ? "selfroll" : "gmroll";
}

/** The luck bonus this use grants the roller, Fate's Favored included. */
export function bonusFor(use: ChatUse, rollActor: any): number {
  const base = HERO_USES[use].bonus;
  return base ? base + luckBonusExtra(rollActor) : 0;
}

interface BannerInput {
  message: any;
  use: ChatUse;
  target: RollTarget;
  fresh: RollJSON;
  helper: any;
  amount: number;
  payment: Payment;
}

function banner({ message, use, target, fresh, helper, amount, payment }: BannerInput): string {
  const title =
    use === "reroll"
      ? t("Banner.Reroll")
      : use === "bonus"
        ? t("Banner.Bonus", { amount })
        : t("Banner.Aid", { name: escapeHtml(helper?.name), amount });
  const lines = [`<strong><i class="fa-solid fa-star"></i> ${t("Banner.Title")}: ${title}</strong>`];

  if (target.kind === "attack") {
    const itemName = message.itemSource?.name ?? message.system?.item?.name;
    if (itemName) lines.push(escapeHtml(itemName));
  }
  // Blind rolls hide their totals from players, and flavor text isn't hidden, so don't leak it here.
  if (!message.blind) lines.push(t("Banner.Was", { total: target.roll.total }));
  if (amount > HERO_USES[use].bonus) lines.push(t("Banner.Feat", { feat: FATES_FAVORED, effect: "+1" }));
  if (payment.luckRoll !== undefined) {
    const effect = t(payment.spent ? "Banner.LuckSpent" : "Banner.LuckKept", { roll: payment.luckRoll });
    lines.push(t("Banner.Feat", { feat: LUCK_OF_HEROES, effect }));
  }
  if (use === "reroll" && target.kind === "attack" && target.field === "attack") {
    const before = threatens(target.roll);
    const after = threatens(fresh);
    if (after && !before) lines.push(t("Banner.NewThreat"));
    if (before && !after) lines.push(t("Banner.LostThreat"));
  }
  return `<div class="${MODULE_ID} banner">${lines.join("<br>")}</div>`;
}

async function buildRoll(use: ChatUse, roll: RollJSON, amount: number): Promise<any> {
  if (use === "reroll") return Roll.fromData(roll).reroll();
  return Roll.fromData(withFlatBonus(roll, amount, t("Label")));
}

/** Spend a Hero Point on a chat roll and post the result. Resolves to the new message, or null. */
export async function useOnMessage(message: any, use: ChatUse, { target, helper, skipConfirm }: UseOptions): Promise<any> {
  const rollActor = speakerActor(message);
  const spender = use === "aid" ? helper : rollActor;
  if (!spender?.isOwner) return null;

  const left = heroPoints(spender);
  if (left < HERO_USES[use].cost) {
    ui.notifications.warn(t("Warn.NoPoints", { name: spender.name }));
    return null;
  }
  if (spentThisRound(spender)) {
    ui.notifications.warn(t("Warn.OncePerRound", { name: spender.name }));
    return null;
  }

  const amount = bonusFor(use, rollActor);
  if (!skipConfirm) {
    const data = { name: spender.name, count: left, roll: target.label, target: rollActor?.name, amount };
    if (!(await confirmSpend(t(`Confirm.${use}`, data)))) return null;
  }

  // Roll first: a reroll can prompt for manual dice entry, and cancelling that shouldn't cost a point.
  const fresh = await buildRoll(use, target.roll, amount);
  const payment = await pay(spender, use);
  if (!payment.ok) {
    ui.notifications.warn(t("Warn.NoPoints", { name: spender.name }));
    return null;
  }

  const rolledDice = use === "reroll";
  const messageData: Record<string, unknown> = {
    speaker: message.speaker,
    flavor: banner({ message, use, target, fresh: fresh.toJSON(), helper, amount, payment }),
    flags: {
      [MODULE_ID]: {
        source: message.uuid,
        use,
        spender: spender.uuid,
        previous: target.roll.total,
        spent: payment.spent,
      },
    },
  };
  if (!rolledDice) messageData.sound = null;

  try {
    const rollMode = rollModeOf(message);
    if (fresh instanceof pf1.dice.D20RollPF) {
      // Checks keep their subject and reference so pf1 still records a rerolled save on the card
      // that asked for it; attack rolls point back at their action card instead.
      const isCheck = message.type === "check";
      return await fresh.toMessage(messageData, {
        rollMode,
        noSound: !rolledDice,
        subject: isCheck ? message.system?.subject : undefined,
        reference: (isCheck && message.system?.reference) || message.uuid,
      });
    }
    return await fresh.toMessage(messageData, { rollMode });
  } catch (err) {
    console.error(`${MODULE_ID} | posting the Hero Point result failed`, err);
    if (payment.spent) await refund(spender, HERO_USES[use].cost);
    ui.notifications.error(t("Warn.PostFailed"));
    return null;
  }
}
