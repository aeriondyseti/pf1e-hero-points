import { beforeEach, describe, expect, it } from "vitest";
import { rollModeOf, useOnMessage } from "../src/apply";
import { rollTargets } from "../src/targets";
import { FakeActor, FakeD20Roll, FakeItem, d20Roll, installGlobals } from "./fakes";

let hero: FakeItem;
let ally: FakeItem;
let actors: Record<string, FakeActor>;

beforeEach(() => {
  hero = new FakeItem("Hero Points", 2);
  ally = new FakeItem("Hero Points", 1);
  actors = { seoni: new FakeActor("Seoni", [hero]), valeros: new FakeActor("Valeros", [ally]) };
  installGlobals({ actors, settings: { itemName: "Hero Points", confirmSpend: false } });
});

const checkMessage = (extra: Record<string, unknown> = {}) => ({
  uuid: "ChatMessage.src",
  type: "check",
  speaker: { actor: "seoni" },
  whisper: [],
  rolls: [d20Roll(6, 5, { flavor: "Perception", dc: 15 })],
  system: { subject: { skill: "per" }, reference: "ChatMessage.ref" },
  ...extra,
});

describe("useOnMessage", () => {
  it("rerolls, spends the roller's point and posts a linked check", async () => {
    FakeD20Roll.nextNatural = 14;
    const message = checkMessage();
    const [target] = rollTargets(message);
    await useOnMessage(message, "reroll", { target });

    expect(hero.charges).toBe(1);
    const [post] = FakeD20Roll.posted;
    expect(post.roll.total).toBe(19);
    expect(post.data.flags["pf1e-hero-points"]).toEqual({
      source: "ChatMessage.src",
      use: "reroll",
      spender: "Actor.Seoni",
      previous: 11,
      spent: true,
    });
    expect(post.data.speaker).toEqual({ actor: "seoni" });
    expect(post.options).toMatchObject({ rollMode: "publicroll", subject: { skill: "per" }, reference: "ChatMessage.ref", noSound: false });
  });

  it("adds +4 without rerolling", async () => {
    const message = checkMessage();
    await useOnMessage(message, "bonus", { target: rollTargets(message)[0] });
    const [post] = FakeD20Roll.posted;
    expect(post.roll.total).toBe(15);
    expect(post.roll.json.terms[0].results).toEqual([{ result: 6, active: true }]);
    expect(post.data.sound).toBeNull();
  });

  it("charges the helper, not the roller, when aiding", async () => {
    const message = checkMessage();
    await useOnMessage(message, "aid", { target: rollTargets(message)[0], helper: actors.valeros });
    expect(ally.charges).toBe(0);
    expect(hero.charges).toBe(2);
    expect(FakeD20Roll.posted[0].roll.total).toBe(13);
  });

  it("does nothing without points", async () => {
    hero.charges = 0;
    const message = checkMessage();
    expect(await useOnMessage(message, "reroll", { target: rollTargets(message)[0] })).toBeNull();
    expect(FakeD20Roll.posted).toHaveLength(0);
  });

  it("does nothing when the confirmation is declined", async () => {
    installGlobals({ actors, settings: { itemName: "Hero Points", confirmSpend: true } });
    (globalThis as any).foundry.applications.api.DialogV2.confirm.mockResolvedValue(false);
    const message = checkMessage();
    expect(await useOnMessage(message, "bonus", { target: rollTargets(message)[0] })).toBeNull();
    expect(hero.charges).toBe(2);
  });

  it("refunds the point if posting fails", async () => {
    const message = checkMessage();
    const [target] = rollTargets(message);
    const original = FakeD20Roll.prototype.toMessage;
    FakeD20Roll.prototype.toMessage = async () => {
      throw new Error("boom");
    };
    try {
      expect(await useOnMessage(message, "bonus", { target })).toBeNull();
    } finally {
      FakeD20Roll.prototype.toMessage = original;
    }
    expect(hero.charges).toBe(2);
  });

  it("points an attack reroll back at its action card and flags a new threat", async () => {
    FakeD20Roll.nextNatural = 19;
    const message = {
      uuid: "ChatMessage.card",
      type: "action",
      speaker: { actor: "seoni" },
      whisper: [],
      system: { reference: "ChatMessage.elsewhere", item: { name: "Longsword" } },
      systemRolls: { attacks: [{ attack: d20Roll(4, 6, { critical: 19, flavor: "Attack" }) }] },
    };
    await useOnMessage(message, "reroll", { target: rollTargets(message)[0] });
    const [post] = FakeD20Roll.posted;
    expect(post.options.reference).toBe("ChatMessage.card");
    expect(post.options.subject).toBeUndefined();
    expect(post.data.flavor).toContain("Longsword");
    expect(post.data.flavor).toContain("Banner.NewThreat");
  });

  it("keeps blind rolls blind and doesn't print their old total", async () => {
    const message = checkMessage({ blind: true, whisper: ["gm"] });
    await useOnMessage(message, "bonus", { target: rollTargets(message)[0] });
    const [post] = FakeD20Roll.posted;
    expect(post.options.rollMode).toBe("blindroll");
    expect(post.data.flavor).not.toContain("Banner.Was");
  });
});

describe("rollModeOf", () => {
  it("maps whisper/blind back to a roll mode", () => {
    expect(rollModeOf({ whisper: [] })).toBe("publicroll");
    expect(rollModeOf({ whisper: ["gm"], author: { id: "me" } })).toBe("gmroll");
    expect(rollModeOf({ whisper: ["me"], author: { id: "me" } })).toBe("selfroll");
    expect(rollModeOf({ whisper: ["gm"], blind: true })).toBe("blindroll");
  });
});
