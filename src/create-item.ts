// Giving a character a working Hero Points item: created from the definition below, or repaired in
// place when one with the right name exists but doesn't track uses (which the module can't spend).
import { MODULE_ID } from "./constants";
import { hasFeat } from "./feats";
import { configuredName, heroPointItem, normalizeName } from "./hero-points";
import { t } from "./ui";

export const HEROS_FORTUNE = "Hero's Fortune";
export const HERO_POINTS_IMG = "icons/magic/control/buff-luck-fortune-rainbow.webp";

/** APG: characters start with 1 point and hold at most 3. Hero's Fortune grants 1 and raises it to 5. */
export function startingPoints(actor: any): { value: number; max: number } {
  return hasFeat(actor, HEROS_FORTUNE) ? { value: 2, max: 5 } : { value: 1, max: 3 };
}

const DESCRIPTION = `<p><em>Advanced Player's Guide.</em> Spend a hero point at any time, no action required;
no more than 1 per round of combat (except to cheat death). Max 3 held (5 with Hero's Fortune).</p>
<ul>
<li><strong>Act Out of Turn:</strong> take your turn now (standard or move action), moving your initiative.</li>
<li><strong>Bonus:</strong> +8 luck bonus on a d20 roll before rolling, +4 after; half that to aid an ally.</li>
<li><strong>Extra Action:</strong> an additional standard or move action this turn.</li>
<li><strong>Inspiration:</strong> ask the GM for a hint.</li>
<li><strong>Recall:</strong> recall a spell already cast, or regain a daily use of an ability.</li>
<li><strong>Reroll:</strong> reroll a d20 you just made; you must take the new result.</li>
<li><strong>Special:</strong> anything else the GM agrees to.</li>
<li><strong>Cheat Death (2 points):</strong> avoid dying; the GM decides how, usually leaving you alive and stable.</li>
</ul>
<p>Right-click a roll in chat to reroll, +4 or aid; tick <em>Hero Point</em> in a roll window (or the
&#9733; here) for +8 before rolling.</p>`;

/** Item data for a new Hero Points feature on this actor. */
export function heroPointItemData(actor: any, name: string = configuredName()): Record<string, unknown> {
  const { value, max } = startingPoints(actor);
  return {
    name,
    type: "feat",
    img: HERO_POINTS_IMG,
    system: {
      subType: "misc",
      abilityType: "na",
      description: { value: DESCRIPTION },
      uses: { per: "charges", maxFormula: String(max), value },
      sources: [{ id: "PZO1115" }],
    },
    flags: { [MODULE_ID]: { created: true } },
  };
}

/** A same-named item that doesn't track uses, which addHeroPoints repairs instead of duplicating. */
function brokenItem(actor: any, name: string): any | undefined {
  const wanted = normalizeName(name);
  return [...(actor.items ?? [])].find((item: any) => normalizeName(item.name) === wanted);
}

/** Does this actor lack a usable Hero Points item? */
export function needsHeroPoints(actor: any): boolean {
  return !!actor?.items && !heroPointItem(actor);
}

export type AddResult = "created" | "repaired" | "skipped";

/** Give one actor a usable Hero Points item. */
export async function addHeroPointsTo(actor: any): Promise<AddResult> {
  if (!actor?.isOwner || !needsHeroPoints(actor)) return "skipped";
  const name = configuredName();
  const broken = brokenItem(actor, name);
  if (broken) {
    const { value, max } = startingPoints(actor);
    await broken.update({
      "system.uses.per": "charges",
      "system.uses.maxFormula": broken.system?.uses?.maxFormula || String(max),
      "system.uses.value": broken.system?.uses?.value ?? value,
    });
    return "repaired";
  }
  await actor.createEmbeddedDocuments("Item", [heroPointItemData(actor, name)]);
  return "created";
}

/** Player-owned characters, the default targets for a whole-table setup. */
function playerCharacters(): any[] {
  return (game.actors?.contents ?? []).filter((a: any) => a.type === "character" && a.hasPlayerOwner);
}

/**
 * Give Hero Points to the given actors (default: every player-owned character) that lack a usable
 * item, then report what changed. Resolves to the actors that were changed.
 */
export async function addHeroPoints(actors: any[] = playerCharacters()): Promise<any[]> {
  const changed: any[] = [];
  for (const actor of actors) {
    const result = await addHeroPointsTo(actor);
    if (result === "skipped") continue;
    changed.push(actor);
    ui.notifications.info(t(result === "created" ? "Add.Created" : "Add.Repaired", { name: actor.name }));
  }
  if (!changed.length) ui.notifications.info(t("Add.Nothing"));
  return changed;
}

/** "Add Hero Points" on actors in the sidebar's Actors directory (GM only). */
export function registerActorDirectoryMenu(): void {
  const actorOf = (li: any) => {
    const el: HTMLElement | undefined = li instanceof HTMLElement ? li : li?.[0];
    const id = el?.dataset?.entryId ?? el?.dataset?.documentId;
    return id ? game.actors.get(id) : undefined;
  };
  Hooks.on("getActorContextOptions", (_app: unknown, options: any[]) => {
    options.push({
      name: `${MODULE_ID}.Add.Menu`,
      icon: '<i class="fa-solid fa-star"></i>',
      condition: (li: any) => game.user.isGM && needsHeroPoints(actorOf(li)),
      callback: (li: any) => void addHeroPoints([actorOf(li)]),
    });
  });
}
