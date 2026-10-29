import { beforeEach, describe, expect, it } from "vitest";
import { useOnMessage } from "../src/apply";
import { claimBeforeRoll, settled } from "../src/before-roll";
import { hasFeat, pay } from "../src/feats";
import { spentThisRound } from "../src/hero-points";
import { rollTargets } from "../src/targets";
import { FakeActor, FakeItem, FakeRoll, d20Roll, installGlobals, posted, type World } from "./fakes";

let points: FakeItem;
let actor: FakeActor;
let world: World;

const feat = (name: string, isActive?: boolean) => Object.assign(new FakeItem(name, Infinity), { isActive });

beforeEach(() => {
  points = new FakeItem("Hero Points", 2);
  actor = new FakeActor("Seoni", [points]);
  world = { actors: { seoni: actor }, settings: { itemName: "Hero Points", confirmSpend: false, oncePerRound: true } };
  installGlobals(world);
});

const message = () => ({
  uuid: "ChatMessage.src",
  type: "check",
  speaker: { actor: "seoni" },
  whisper: [],
  rolls: [d20Roll(6, 5, { flavor: "Perception" })],
});
const flush = () => settled();

describe("hasFeat", () => {
  it("matches by name, curly apostrophes included, and ignores disabled feats", () => {
    actor.items.push(feat("Fate’s Favored"), feat("Luck of Heroes", false));
    expect(hasFeat(actor, "Fate's Favored")).toBe(true);
    expect(hasFeat(actor, "Luck of Heroes")).toBe(false);
  });
});

describe("Luck of Heroes", () => {
  beforeEach(() => actor.items.push(feat("Luck of Heroes")));

  it("keeps the point on 16+ for a reroll", async () => {
    FakeRoll.d20s = [16];
    expect(await pay(actor, "reroll")).toEqual({ ok: true, spent: false, luckRoll: 16 });
    expect(points.charges).toBe(2);
  });

  it("spends the point on 15 or less", async () => {
    FakeRoll.d20s = [15];
    expect(await pay(actor, "reroll")).toEqual({ ok: true, spent: true, luckRoll: 15 });
    expect(points.charges).toBe(1);
  });

  it("doesn't apply to after-the-roll bonuses or aiding", async () => {
    FakeRoll.d20s = [20, 20];
    expect((await pay(actor, "bonus")).luckRoll).toBeUndefined();
    expect((await pay(actor, "aid")).luckRoll).toBeUndefined();
    expect(points.charges).toBe(0);
  });

  it("applies to the +8 before the roll", async () => {
    FakeRoll.d20s = [19];
    expect(claimBeforeRoll(actor)).toBe("8[pf1e-hero-points.Label]");
    await flush();
    expect(points.charges).toBe(2);
  });

  it("still counts as the round's Hero Point use when it keeps the point", async () => {
    world.combat = { id: "c1", round: 1, started: true, combatants: [{ actor }] };
    installGlobals(world);
    FakeRoll.d20s = [18];
    expect((await pay(actor, "reroll")).spent).toBe(false);
    expect(spentThisRound(actor)).toBe(true);
  });

  it("is reported on the chat result", async () => {
    FakeRoll.d20s = [10, 17]; // the reroll, then the Luck of Heroes d20
    const msg = message();
    await useOnMessage(msg, "reroll", { target: rollTargets(msg)[0] });
    expect(posted[0].data.flavor).toContain("Banner.LuckKept");
    expect(posted[0].data.flags["pf1e-hero-points"].spent).toBe(false);
  });
});

describe("Fate's Favored", () => {
  beforeEach(() => actor.items.push(feat("Fate's Favored")));

  it("raises the roller's luck bonus by 1", async () => {
    const msg = message();
    await useOnMessage(msg, "bonus", { target: rollTargets(msg)[0] });
    expect(posted[0].roll.total).toBe(16);
    expect(claimBeforeRoll(actor)).toBe("9[pf1e-hero-points.Label]");
  });

  it("counts for the aided roller, not the helper", async () => {
    const helper = new FakeActor("Valeros", [new FakeItem("Hero Points", 1), feat("Fate's Favored")]);
    actor.items.pop();
    const msg = message();
    await useOnMessage(msg, "aid", { target: rollTargets(msg)[0], helper });
    expect(posted[0].roll.total).toBe(13);
  });
});

describe("one Hero Point per round", () => {
  beforeEach(() => {
    world.combat = { id: "c1", round: 2, started: true, combatants: [{ actor }] };
    installGlobals(world);
  });

  it("blocks a second spend in the same round, allows it the next round", async () => {
    const msg = message();
    await useOnMessage(msg, "bonus", { target: rollTargets(msg)[0] });
    expect(spentThisRound(actor)).toBe(true);
    expect(await useOnMessage(msg, "bonus", { target: rollTargets(msg)[0] })).toBeNull();
    expect(points.charges).toBe(1);

    world.combat!.round = 3;
    expect(spentThisRound(actor)).toBe(false);
  });

  it("refuses the +8 before the roll too", async () => {
    const msg = message();
    await useOnMessage(msg, "bonus", { target: rollTargets(msg)[0] });
    expect(claimBeforeRoll(actor)).toBeNull();
    world.combat!.round = 3;
    expect(claimBeforeRoll(actor)).not.toBeNull();
  });

  it("can be turned off", async () => {
    world.settings.oncePerRound = false;
    const msg = message();
    await useOnMessage(msg, "bonus", { target: rollTargets(msg)[0] });
    await useOnMessage(msg, "bonus", { target: rollTargets(msg)[0] });
    expect(points.charges).toBe(0);
  });

  it("doesn't apply outside combat or to actors not in it", async () => {
    world.combat!.combatants = [];
    const msg = message();
    await useOnMessage(msg, "bonus", { target: rollTargets(msg)[0] });
    await useOnMessage(msg, "bonus", { target: rollTargets(msg)[0] });
    expect(points.charges).toBe(0);
  });
});
