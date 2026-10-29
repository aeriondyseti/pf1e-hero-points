import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ROLLDATA_KEY,
  claimBeforeRoll,
  isArmed,
  onPreAttackRoll,
  onPreD20Roll,
  requestForRoll,
  setArmed,
} from "../src/before-roll";
import { FakeActor, FakeItem, installGlobals } from "./fakes";

let points: FakeItem;
let actor: FakeActor;

beforeEach(() => {
  points = new FakeItem("Hero Points", 2);
  actor = new FakeActor("Seoni", [points]);
  installGlobals({ actors: { seoni: actor }, settings: { itemName: "Hero Points", oncePerRound: true } });
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const checkRoll = (isStatic = false) => ({ isStatic, options: { flavor: "Perception" }, addBonus: vi.fn() });
const PART = "8[pf1e-hero-points.Label]";

describe("check dialog toggle", () => {
  it("adds +8 to the toggled roll and spends the point", async () => {
    const roll = checkRoll();
    requestForRoll(roll, true);
    onPreD20Roll(roll, { speaker: { actor: "seoni" } });
    expect(roll.addBonus).toHaveBeenCalledWith(PART);
    await flush();
    expect(points.charges).toBe(1);
  });

  it("leaves untoggled and untoggled-again rolls alone", async () => {
    const untouched = checkRoll();
    const changedMind = checkRoll();
    requestForRoll(changedMind, true);
    requestForRoll(changedMind, false);
    onPreD20Roll(untouched, { speaker: { actor: "seoni" } });
    onPreD20Roll(changedMind, { speaker: { actor: "seoni" } });
    expect(untouched.addBonus).not.toHaveBeenCalled();
    expect(changedMind.addBonus).not.toHaveBeenCalled();
    await flush();
    expect(points.charges).toBe(2);
  });

  it("doesn't spend on Take 10/20", async () => {
    const roll = checkRoll(true);
    requestForRoll(roll, true);
    onPreD20Roll(roll, { speaker: { actor: "seoni" } });
    expect(roll.addBonus).not.toHaveBeenCalled();
    await flush();
    expect(points.charges).toBe(2);
  });
});

describe("attack dialog toggle", () => {
  const action = () => ({ actor, item: { name: "Longsword" } });

  it("adds +8 to the first attack roll of the action only", async () => {
    const rollData: Record<string, unknown> = { [ROLLDATA_KEY]: true };
    const first: string[] = [];
    const second: string[] = [];
    onPreAttackRoll(action(), {}, rollData, {}, first);
    onPreAttackRoll(action(), {}, rollData, {}, second);
    expect(first).toEqual([PART]);
    expect(second).toEqual([]);
    await flush();
    expect(points.charges).toBe(1);
  });

  it("does nothing when the toggle is off", () => {
    const parts: string[] = [];
    onPreAttackRoll(action(), {}, { [ROLLDATA_KEY]: false }, {}, parts);
    onPreAttackRoll(action(), {}, {}, {}, parts);
    expect(parts).toEqual([]);
  });
});

describe("armed from the sheet's star", () => {
  const action = () => ({ actor, item: { name: "Longsword" } });

  it("costs nothing to arm and nothing to disarm", async () => {
    await setArmed(actor, true);
    expect(isArmed(actor)).toBe(true);
    await setArmed(actor, false);
    expect(isArmed(actor)).toBe(false);
    expect(points.charges).toBe(2);
  });

  it("can't be armed without a point", async () => {
    points.charges = 0;
    await setArmed(actor, true);
    expect(isArmed(actor)).toBe(false);
  });

  it("applies to a check that skipped the dialog, then disarms", async () => {
    await setArmed(actor, true);
    const roll = checkRoll();
    onPreD20Roll(roll, { speaker: { actor: "seoni" } });
    expect(roll.addBonus).toHaveBeenCalledWith(PART);
    await flush();
    expect(points.charges).toBe(1);
    expect(isArmed(actor)).toBe(false);
  });

  it("isn't claimed twice by rolls made before the disarm lands", async () => {
    await setArmed(actor, true);
    const a = checkRoll();
    const b = checkRoll();
    onPreD20Roll(a, { speaker: { actor: "seoni" } });
    onPreD20Roll(b, { speaker: { actor: "seoni" } });
    expect(b.addBonus).not.toHaveBeenCalled();
    await flush();
    expect(points.charges).toBe(1);
  });

  it("yields to a dialog where the toggle was unticked, staying armed", async () => {
    await setArmed(actor, true);
    const roll = checkRoll();
    requestForRoll(roll, false);
    onPreD20Roll(roll, { speaker: { actor: "seoni" } });
    expect(roll.addBonus).not.toHaveBeenCalled();
    await flush();
    expect(isArmed(actor)).toBe(true);
  });

  it("spends only one point when the dialog toggle is ticked as well", async () => {
    await setArmed(actor, true);
    const roll = checkRoll();
    requestForRoll(roll, true);
    onPreD20Roll(roll, { speaker: { actor: "seoni" } });
    await flush();
    expect(roll.addBonus).toHaveBeenCalledTimes(1);
    expect(points.charges).toBe(1);
    expect(isArmed(actor)).toBe(false);
  });

  it("applies to the first attack of an action that skipped the dialog", async () => {
    await setArmed(actor, true);
    const rollData = {};
    const first: string[] = [];
    const second: string[] = [];
    onPreAttackRoll(action(), {}, rollData, {}, first);
    onPreAttackRoll(action(), {}, rollData, {}, second);
    expect(first).toEqual([PART]);
    expect(second).toEqual([]);
    await flush();
    expect(isArmed(actor)).toBe(false);
  });

  it("stays armed through Take 10", async () => {
    await setArmed(actor, true);
    onPreD20Roll(checkRoll(true), { speaker: { actor: "seoni" } });
    await flush();
    expect(isArmed(actor)).toBe(true);
    expect(points.charges).toBe(2);
  });
});

describe("claimBeforeRoll", () => {
  it("refuses with no points or someone else's actor", () => {
    points.charges = 0;
    expect(claimBeforeRoll(actor)).toBeNull();
    points.charges = 2;
    expect(claimBeforeRoll(new FakeActor("Other", [new FakeItem("Hero Points", 3)], false))).toBeNull();
  });
});
