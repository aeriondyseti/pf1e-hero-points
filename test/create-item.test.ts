import { beforeEach, describe, expect, it } from "vitest";
import { addHeroPoints, heroPointItemData, needsHeroPoints } from "../src/create-item";
import { heroPoints } from "../src/hero-points";
import { FakeActor, FakeItem, installGlobals } from "./fakes";

let world: Parameters<typeof installGlobals>[0];

beforeEach(() => {
  world = { actors: {}, settings: { itemName: "Hero Points" } };
  installGlobals(world);
});

const feat = (name: string) => new FakeItem(name, Infinity);

describe("heroPointItemData", () => {
  it("is a misc feat with 1 of 3 charges", () => {
    const data: any = heroPointItemData(new FakeActor("Seoni"));
    expect(data).toMatchObject({ name: "Hero Points", type: "feat" });
    expect(data.system).toMatchObject({ subType: "misc", uses: { per: "charges", maxFormula: "3", value: 1 } });
  });

  it("gives 2 of 5 with Hero's Fortune, and follows the item name setting", () => {
    world.settings.itemName = "Luck Points";
    installGlobals(world);
    const data: any = heroPointItemData(new FakeActor("Seoni", [feat("Hero’s Fortune")]));
    expect(data.name).toBe("Luck Points");
    expect(data.system.uses).toMatchObject({ maxFormula: "5", value: 2 });
  });
});

describe("addHeroPoints", () => {
  it("creates a usable item on actors without one", async () => {
    const actor = new FakeActor("Seoni");
    expect(needsHeroPoints(actor)).toBe(true);
    expect(await addHeroPoints([actor])).toEqual([actor]);
    expect(heroPoints(actor)).toBe(1);
    expect(needsHeroPoints(actor)).toBe(false);
  });

  it("skips actors that already have one, and those the user doesn't own", async () => {
    const has = new FakeActor("Has", [new FakeItem("Hero Points", 2)]);
    const notMine = new FakeActor("NotMine", [], false);
    expect(await addHeroPoints([has, notMine])).toEqual([]);
    expect(has.items).toHaveLength(1);
    expect(notMine.items).toHaveLength(0);
  });

  it("repairs a same-named item without limited uses instead of duplicating it", async () => {
    const broken = Object.assign(new FakeItem("hero points", Infinity), { system: { uses: { per: "", maxFormula: "" } } });
    const actor = new FakeActor("Seoni", [broken]);
    await addHeroPoints([actor]);
    expect(actor.items).toHaveLength(1);
    expect(broken.system.uses).toMatchObject({ per: "charges", maxFormula: "3", value: 1 });
    expect(heroPoints(actor)).toBe(1);
  });

  it("defaults to every player-owned character", async () => {
    const pc = Object.assign(new FakeActor("PC"), { type: "character", hasPlayerOwner: true });
    const npc = Object.assign(new FakeActor("NPC"), { type: "npc", hasPlayerOwner: false });
    const unowned = Object.assign(new FakeActor("Spare"), { type: "character", hasPlayerOwner: false });
    (globalThis as any).game.actors = { contents: [pc, npc, unowned] };
    expect(await addHeroPoints()).toEqual([pc]);
  });
});
