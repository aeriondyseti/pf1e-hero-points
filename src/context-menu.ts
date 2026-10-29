// Right-click entries on chat messages for the Hero Point uses that act on a roll already made.
import { MODULE_ID, type ChatUse } from "./constants";
import { speakerActor, useOnMessage } from "./apply";
import { canSpend } from "./hero-points";
import { canReroll } from "./rules";
import { pickTarget, rollTargets, spotFromElement, type RollTarget } from "./targets";
import { choose, t } from "./ui";

// The element last right-clicked. The context menu only hands us the whole message, and on an
// attack card we want the attack (or crit confirmation) the cursor was on.
let lastClicked: Element | null = null;

const elementOf = (li: any): HTMLElement | undefined => (li instanceof HTMLElement ? li : li?.[0]);

function messageOf(li: any): any {
  const id = elementOf(li)?.dataset?.messageId;
  return id ? game.messages.get(id) : undefined;
}

function targetsFor(message: any, use: ChatUse): RollTarget[] {
  const targets = rollTargets(message);
  return use === "reroll" ? targets.filter((target) => canReroll(target.roll)) : targets;
}

/** Owned actors (controlled tokens, then the user's character) who could aid this roll. */
export function helpersFor(rollActor: any): any[] {
  const candidates = [...(canvas?.tokens?.controlled ?? []).map((token: any) => token.actor), game.user?.character];
  const seen = new Set<string>();
  return candidates.filter((actor) => {
    if (!actor || actor === rollActor || seen.has(actor.uuid)) return false;
    seen.add(actor.uuid);
    return canSpend(actor);
  });
}

function available(li: any, use: ChatUse): boolean {
  const message = messageOf(li);
  if (!message || !targetsFor(message, use).length) return false;
  const rollActor = speakerActor(message);
  if (!rollActor) return false;
  return use === "aid" ? helpersFor(rollActor).length > 0 : canSpend(rollActor);
}

async function run(li: any, use: ChatUse): Promise<void> {
  const element = elementOf(li);
  const spot = lastClicked && element?.contains(lastClicked) ? spotFromElement(lastClicked) : {};
  const message = messageOf(li);
  if (!message) return;

  const targets = targetsFor(message, use);
  const target = pickTarget(targets, spot) ?? (await choose(t("Choose.Roll"), targets, (c) => c.label));
  if (!target) return;

  let helper: any;
  if (use === "aid") {
    helper = await choose(t("Choose.Helper"), helpersFor(speakerActor(message)), (actor) => actor.name);
    if (!helper) return;
  }

  await useOnMessage(message, use, { target, helper });
}

const ENTRIES: { use: ChatUse; icon: string }[] = [
  { use: "reroll", icon: "fa-solid fa-dice-d20" },
  { use: "bonus", icon: "fa-solid fa-star" },
  { use: "aid", icon: "fa-solid fa-hands-helping" },
];

export function registerContextMenu(): void {
  document.addEventListener("contextmenu", (event) => (lastClicked = event.target as Element), { capture: true });

  Hooks.on("getChatMessageContextOptions", (_app: unknown, options: any[]) => {
    for (const { use, icon } of ENTRIES) {
      options.push({
        name: `${MODULE_ID}.Menu.${use}`,
        icon: `<i class="${icon}"></i>`,
        condition: (li: any) => available(li, use),
        callback: (li: any) => void run(li, use),
      });
    }
  });
}
