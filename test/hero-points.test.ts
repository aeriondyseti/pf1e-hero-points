import { beforeEach, describe, expect, it } from "vitest";
import { canSpend, heroPointItem, heroPoints, refund, spend } from "../src/hero-points";
import { FakeActor, FakeItem, installGlobals } from "./fakes";

beforeEach(() => installGlobals({ actors: {}, settings: { itemName: "Hero Points" } }));

describe("heroPointItem", () => {
  it("matches the configured name case-insensitively", () => {
    const item = new FakeItem("hero points ", 2);
    expect(heroPointItem(new FakeActor("A", [new FakeItem("Power Attack", Infinity), item]))).toBe(item);
  });

  it("skips a same-named item without limited uses", () => {
    const actor = new FakeActor("A", [new FakeItem("Hero Points", Infinity), new FakeItem("Hero Points", 1)]);
    expect(heroPointItem(actor)?.charges).toBe(1);
    expect(heroPoints(new FakeActor("B", [new FakeItem("Hero Points", Infinity)]))).toBe(0);
  });

  it("follows the itemName setting", () => {
    installGlobals({ actors: {}, settings: { itemName: "Luck Points" } });
    expect(heroPoints(new FakeActor("A", [new FakeItem("Hero Points", 3), new FakeItem("Luck Points", 1)]))).toBe(1);
  });
});

describe("spending", () => {
  it("deducts charges and refuses to go below zero", async () => {
    const item = new FakeItem("Hero Points", 1);
    const actor = new FakeActor("A", [item]);
    expect(await spend(actor)).toBe(true);
    expect(item.charges).toBe(0);
    expect(await spend(actor)).toBe(false);
    expect(item.updates).toEqual([-1]);
    await refund(actor);
    expect(item.charges).toBe(1);
  });

  it("requires ownership", () => {
    const actor = new FakeActor("A", [new FakeItem("Hero Points", 3)], false);
    expect(canSpend(actor)).toBe(false);
  });
});
