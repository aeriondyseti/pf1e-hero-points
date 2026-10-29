// @vitest-environment happy-dom
// The parts that hook into pf1/Foundry markup, against fixtures copied from pf1 v11.11's templates
// (public/templates/chat/attack-roll.hbs, apps/attack-roll-dialog.hbs, chat/roll-dialog.hbs,
// actors/parts/actor-features.hbs) and Foundry v13's DialogV2 frame. If pf1 changes these, update
// the fixtures from the new templates and see what breaks.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onPreAttackRoll, onPreD20Roll, onRenderAttackDialog, onRenderDialog, onRenderSheet } from "../src/before-roll";
import { registerContextMenu } from "../src/context-menu";
import { spotFromElement } from "../src/targets";
import { choose } from "../src/ui";
import { FakeActor, FakeD20Roll, FakeItem, d20Roll, installGlobals, posted } from "./fakes";

let points: FakeItem;
let actor: FakeActor;

beforeEach(() => {
  document.body.innerHTML = "";
  points = new FakeItem("Hero Points", 2, "hpItem");
  actor = new FakeActor("Seoni", [points]);
  installGlobals({ actors: { seoni: actor }, settings: { itemName: "Hero Points", confirmSpend: false, oncePerRound: true } });
});

function html(markup: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = markup.trim();
  document.body.append(root);
  return root;
}

const tick = (input: HTMLInputElement, checked: boolean) => {
  input.checked = checked;
  input.dispatchEvent(new Event("change"));
};

// attack-roll.hbs: one attack with a crit confirmation and crit damage.
const ATTACK_CARD = `
<li class="chat-message" data-message-id="msg1"><div class="message-content">
  <div class="chat-attack" data-index="0"><table>
    <tr><td class="roll normal"><a class="inline-roll">25</a></td><td class="roll critical"><a class="inline-roll">14</a></td></tr>
    <tr><td class="roll damage normal"><a class="inline-roll">9</a></td><td class="roll damage critical"><a class="inline-roll">9</a></td></tr>
  </table></div>
  <div class="chat-attack" data-index="1"><table>
    <tr><td class="roll normal"><a class="inline-roll">4</a></td></tr>
  </table></div>
</div></li>`;

describe("spotFromElement (attack cards)", () => {
  it("tells attack, crit confirmation and crit damage apart", () => {
    const root = html(ATTACK_CARD);
    const cell = (sel: string) => root.querySelector(sel)!.querySelector("a")!;
    expect(spotFromElement(cell('.chat-attack[data-index="0"] td.roll.normal:not(.damage)'))).toEqual({ attackIndex: 0, critConfirm: false });
    expect(spotFromElement(cell('.chat-attack[data-index="0"] td.roll.critical:not(.damage)'))).toEqual({ attackIndex: 0, critConfirm: true });
    expect(spotFromElement(cell('.chat-attack[data-index="0"] td.roll.damage.critical'))).toEqual({ attackIndex: 0, critConfirm: false });
    expect(spotFromElement(cell('.chat-attack[data-index="1"] td.roll.normal'))).toEqual({ attackIndex: 1, critConfirm: false });
    expect(spotFromElement(root)).toEqual({});
  });
});

describe("chat context menu", () => {
  function menu(): any[] {
    registerContextMenu();
    const register = (globalThis as any).Hooks.on.mock.calls.find((c: any[]) => c[0] === "getChatMessageContextOptions");
    const options: any[] = [];
    register[1]({}, options);
    return options;
  }
  const attackMessage = {
    id: "msg1",
    uuid: "ChatMessage.msg1",
    type: "action",
    speaker: { actor: "seoni" },
    whisper: [],
    system: { item: { name: "Longsword" } },
    systemRolls: {
      attacks: [
        { attack: d20Roll(19, 6, { flavor: "Attack" }), critConfirm: d20Roll(8, 6, { flavor: "Confirm" }) },
        { attack: d20Roll(3, 1, { flavor: "Iterative" }) },
      ],
    },
  };

  it("offers reroll and +4 to the roller's owner, but not aid without a helper", () => {
    (globalThis as any).game.messages.get = () => attackMessage;
    const li = html(ATTACK_CARD).querySelector("li")!;
    const [reroll, bonus, aid] = menu();
    expect(reroll.condition(li)).toBe(true);
    expect(bonus.condition(li)).toBe(true);
    expect(aid.condition(li)).toBe(false);
    points.charges = 0;
    expect(reroll.condition(li)).toBe(false);
  });

  it("acts on the crit confirmation that was right-clicked", async () => {
    (globalThis as any).game.messages.get = () => attackMessage;
    const li = html(ATTACK_CARD).querySelector("li")!;
    const [, bonus] = menu();
    const confirmCell = li.querySelector('.chat-attack[data-index="0"] td.roll.critical:not(.damage) a')!;
    confirmCell.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    bonus.callback(li);
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].roll.total).toBe(8 + 6 + 4);
    expect((globalThis as any).foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  it("asks which roll when the click was outside any attack", async () => {
    (globalThis as any).game.messages.get = () => attackMessage;
    (globalThis as any).foundry.applications.api.DialogV2.wait.mockResolvedValue("2");
    const li = html(ATTACK_CARD).querySelector("li")!;
    const [, bonus] = menu();
    li.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    bonus.callback(li);
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].roll.total).toBe(3 + 1 + 4);
  });
});

describe("choose", () => {
  it("maps the clicked button back to its choice and escapes labels", async () => {
    const wait = (globalThis as any).foundry.applications.api.DialogV2.wait;
    wait.mockResolvedValue("1");
    expect(await choose("Pick", ["a", "<b>"], (s) => s)).toBe("<b>");
    expect(wait.mock.calls[0][0].buttons[1].label).toBe("&#60;b&#62;");
    wait.mockResolvedValue(null);
    expect(await choose("Pick", ["a", "b"], (s) => s)).toBeUndefined();
  });
});

describe("check roll dialog toggle", () => {
  // Foundry v13 DialogV2 frame around pf1's roll-dialog.hbs (its own <form> is dropped by the parser).
  const DIALOG = `
<dialog class="application dialog pf1-v2 roll-prompt"><form class="dialog-form standard-form">
  <div class="dialog-content standard-form"><form autocomplete="off">
    <div class="form-group"><label>Situational Bonus</label><div class="form-fields"><input name="bonus"></div></div>
  </form></div>
  <footer class="form-footer"><button data-action="normal">Normal</button></footer>
</form></dialog>`;

  const open = () => {
    const roll = Object.assign(new FakeD20Roll(d20Roll(10, 5)), { isStatic: false, options: { flavor: "Perception" }, addBonus: vi.fn() });
    const element = html(DIALOG);
    onRenderDialog({ options: { roll, speaker: { actor: "seoni" } }, setPosition: vi.fn() }, element);
    return { roll, element, input: element.querySelector<HTMLInputElement>(".pf1e-hero-points-toggle input")! };
  };

  it("goes in the dialog content, above the buttons", () => {
    const { element, input } = open();
    expect(input).not.toBeNull();
    expect(input.closest(".dialog-content")).not.toBeNull();
    expect(input.closest("footer")).toBeNull();
    expect(input.name).toBe("");
    expect(element.querySelectorAll(".pf1e-hero-points-toggle")).toHaveLength(1);
  });

  it("adds +8 to the roll only when ticked", () => {
    const ticked = open();
    tick(ticked.input, true);
    onPreD20Roll(ticked.roll, { speaker: { actor: "seoni" } });
    expect(ticked.roll.addBonus).toHaveBeenCalledWith("8[pf1e-hero-points.Label]");

    const unticked = open();
    onPreD20Roll(unticked.roll, { speaker: { actor: "seoni" } });
    expect(unticked.roll.addBonus).not.toHaveBeenCalled();
  });

  it("isn't added for actors without points, or to other dialogs", () => {
    points.charges = 0;
    expect(open().input).toBeNull();
    points.charges = 2;
    const element = html(DIALOG);
    onRenderDialog({ options: { roll: undefined } }, element);
    expect(element.querySelector(".pf1e-hero-points-toggle")).toBeNull();
  });
});

describe("attack dialog toggle", () => {
  // attack-roll-dialog.hbs, trimmed to the options block.
  const ATTACK_DIALOG = `
<form><div class="form-group stacked flags">
  <label class="checkbox"><input type="checkbox" name="flanking"> Flanking</label>
  <label class="checkbox"><input type="checkbox" name="power-attack"> Power Attack</label>
</div></form>`;

  it("sits with the attack options and survives the dialog re-rendering", () => {
    const app = { rollData: {}, actionUse: { actor } };
    const first = html(ATTACK_DIALOG);
    onRenderAttackDialog(app, first);
    const input = first.querySelector<HTMLInputElement>(".flags .pf1e-hero-points-toggle input")!;
    expect(input).not.toBeNull();
    tick(input, true);

    const rerendered = html(ATTACK_DIALOG); // pf1 re-renders when Power Attack etc. change
    onRenderAttackDialog(app, [rerendered]); // V1 hooks pass jQuery
    expect(rerendered.querySelector<HTMLInputElement>(".pf1e-hero-points-toggle input")!.checked).toBe(true);

    const parts: string[] = [];
    onPreAttackRoll({ actor, item: { name: "Longsword" } }, {}, app.rollData, {}, parts);
    expect(parts).toEqual(["8[pf1e-hero-points.Label]"]);
  });
});

describe("sheet star", () => {
  // actor-features.hbs item row.
  const SHEET = `
<ol class="item-list">
  <li class="item flexrow" data-item-id="hpItem">
    <div class="item-name rollable"><h4>Hero Points</h4></div>
    <div class="item-detail item-actions"><div class="item-action"></div></div>
    <div class="item-controls"><a class="item-control item-edit"></a></div>
  </li>
  <li class="item flexrow" data-item-id="other"><div class="item-controls"></div></li>
</ol>`;

  it("adds one star to the Hero Points row that arms the actor", async () => {
    const root = html(SHEET);
    onRenderSheet({ actor }, [root]);
    onRenderSheet({ actor }, [root]);
    const stars = root.querySelectorAll(".pf1e-hero-points-arm");
    expect(stars).toHaveLength(1);
    expect(stars[0].parentElement!.classList.contains("item-action")).toBe(true);
    (stars[0] as HTMLElement).click();
    await vi.waitFor(() => expect(actor.getFlag("pf1e-hero-points", "armed")).toBe(true));
  });

  it("isn't added for someone else's actor", () => {
    const root = html(SHEET);
    onRenderSheet({ actor: new FakeActor("Other", [new FakeItem("Hero Points", 1, "hpItem")], false) }, root);
    expect(root.querySelector(".pf1e-hero-points-arm")).toBeNull();
  });
});
