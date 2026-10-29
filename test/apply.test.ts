import { beforeEach, describe, expect, it } from "vitest";
import { rollModeOf, useOnMessage } from "../src/apply";
import { rollTargets } from "../src/targets";
import { FakeActor, FakeItem, FakeRoll, FakeRollInstance, d20Roll, installGlobals, lastCreated, posted } from "./fakes";

let hero: FakeItem;
let ally: FakeItem;
let actors: Record<string, FakeActor>;

beforeEach(() => {
  hero = new FakeItem("Hero Points", 2);
  ally = new FakeItem("Hero Points", 1);
  actors = { seoni: new FakeActor("Seoni", [hero]), valeros: new FakeActor("Valeros", [ally]) };
  installGlobals({ actors, settings: { itemName: "Hero Points", confirmSpend: false, oncePerRound: true } });
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
    FakeRoll.d20s = [14];
    const message = checkMessage();
    const [target] = rollTargets(message);
    await useOnMessage(message, "reroll", { target });

    expect(hero.charges).toBe(1);
    const [post] = posted;
    expect(post.roll).toBeInstanceOf((globalThis as any).pf1.dice.D20RollPF);
    expect(post.roll.total).toBe(19);
    expect(post.data.flags["pf1e-hero-points"]).toEqual({
      source: "ChatMessage.src",
      use: "reroll",
      spender: "Actor.Seoni",
      previous: 11,
      spent: true,
    });
    expect(post.data.speaker).toEqual({ actor: "seoni" });
    expect(post.options).toMatchObject({
      create: false,
      subject: { skill: "per" },
      reference: "ChatMessage.ref",
      noSound: false,
    });
    expect(lastCreated().flags["pf1e-hero-points"].use).toBe("reroll");
  });

  it("rerolls only the d20, keeping other dice", async () => {
    FakeRoll.d20s = [3];
    const roll = d20Roll(15, 2, { flavor: "Will" });
    roll.terms.push(
      { class: "OperatorTerm", operator: "+", evaluated: true },
      { class: "Die", faces: 6, number: 1, evaluated: true, results: [{ result: 5, active: true }] },
    );
    roll.total += 5;
    const message = checkMessage({ rolls: [roll] });
    await useOnMessage(message, "reroll", { target: rollTargets(message)[0] });
    const json = posted[0].roll.json;
    expect(json.total).toBe(3 + 2 + 5);
    expect(json.terms[4].results).toEqual([{ result: 5, active: true }]);
    expect(json.terms[0].results).toEqual([{ result: 3, active: true }]);
  });

  it("adds +4 without rerolling", async () => {
    const message = checkMessage();
    await useOnMessage(message, "bonus", { target: rollTargets(message)[0] });
    const [post] = posted;
    expect(post.roll.total).toBe(15);
    expect(post.roll.json.terms[0].results).toEqual([{ result: 6, active: true }]);
    expect(post.data.sound).toBeNull();
  });

  it("posts plain /r rolls through core Roll#toMessage", async () => {
    const message = checkMessage({ type: "base", rolls: [d20Roll(6, 5, {}, "RollPF")], system: undefined });
    await useOnMessage(message, "bonus", { target: rollTargets(message)[0] });
    const [post] = posted;
    expect(post.roll).not.toBeInstanceOf((globalThis as any).pf1.dice.D20RollPF);
    expect(post.roll).toBeInstanceOf(FakeRollInstance);
    expect(post.options).toEqual({ create: false, rollMode: "publicroll" });
  });

  it("charges the helper, not the roller, when aiding", async () => {
    const message = checkMessage();
    await useOnMessage(message, "aid", { target: rollTargets(message)[0], helper: actors.valeros });
    expect(ally.charges).toBe(0);
    expect(hero.charges).toBe(2);
    expect(posted[0].roll.total).toBe(13);
  });

  it("does nothing when aiding without a helper", async () => {
    const message = checkMessage();
    expect(await useOnMessage(message, "aid", { target: rollTargets(message)[0] })).toBeNull();
    expect(posted).toHaveLength(0);
  });

  it("does nothing without points", async () => {
    hero.charges = 0;
    const message = checkMessage();
    expect(await useOnMessage(message, "reroll", { target: rollTargets(message)[0] })).toBeNull();
    expect(posted).toHaveLength(0);
  });

  it("does nothing when the confirmation is declined", async () => {
    installGlobals({ actors, settings: { itemName: "Hero Points", confirmSpend: true, oncePerRound: true } });
    (globalThis as any).foundry.applications.api.DialogV2.confirm.mockResolvedValue(false);
    const message = checkMessage();
    expect(await useOnMessage(message, "bonus", { target: rollTargets(message)[0] })).toBeNull();
    expect(hero.charges).toBe(2);
  });

  it("refunds the point and lifts the round lock if posting fails", async () => {
    installGlobals({
      actors,
      settings: { itemName: "Hero Points", confirmSpend: false, oncePerRound: true },
      combat: { id: "c1", round: 1, started: true, combatants: [{ actor: actors.seoni }] },
    });
    (globalThis as any).ChatMessage.implementation.create.mockRejectedValue(new Error("boom"));
    const message = checkMessage();
    expect(await useOnMessage(message, "bonus", { target: rollTargets(message)[0] })).toBeNull();
    expect(hero.charges).toBe(2);
    expect(actors.seoni.getFlag("pf1e-hero-points", "lastSpent")).toBeUndefined();
  });

  it("works on its own result message (chained uses)", async () => {
    const first = checkMessage();
    await useOnMessage(first, "bonus", { target: rollTargets(first)[0] });
    const second = { ...checkMessage(), uuid: "ChatMessage.result", rolls: [posted[0].roll.json] };
    await useOnMessage(second, "bonus", { target: rollTargets(second)[0] });
    expect(posted[1].roll.total).toBe(19);
    expect(hero.charges).toBe(0);
  });

  it("points an attack reroll back at its action card and flags a new threat", async () => {
    FakeRoll.d20s = [19];
    const message = {
      uuid: "ChatMessage.card",
      type: "action",
      speaker: { actor: "seoni" },
      whisper: [],
      system: { reference: "ChatMessage.elsewhere", item: { name: "Longsword" } },
      systemRolls: { attacks: [{ attack: d20Roll(4, 6, { critical: 19, flavor: "Attack" }) }] },
    };
    await useOnMessage(message, "reroll", { target: rollTargets(message)[0] });
    const [post] = posted;
    expect(post.options.reference).toBe("ChatMessage.card");
    expect(post.options.subject).toBeUndefined();
    expect(post.data.flavor).toContain("Longsword");
    expect(post.data.flavor).toContain("Banner.NewThreat");
  });

  it("keeps blind rolls blind and doesn't print their old total", async () => {
    const message = checkMessage({ blind: true, whisper: ["gm"] });
    await useOnMessage(message, "bonus", { target: rollTargets(message)[0] });
    expect(lastCreated()).toMatchObject({ blind: true, whisper: ["gm"] });
    expect(posted[0].data.flavor).not.toContain("Banner.Was");
  });

  it("whispers the result to the same players as the original", async () => {
    const message = checkMessage({ whisper: ["player2", "gm"], author: { id: "player1" } });
    await useOnMessage(message, "bonus", { target: rollTargets(message)[0] });
    expect(lastCreated()).toMatchObject({ blind: false, whisper: ["player2", "gm"] });
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
