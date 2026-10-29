import { describe, expect, it } from "vitest";
import { bonusPart, canReroll, isD20Roll, naturalD20, threatens, withFlatBonus } from "../src/rules";
import { d20Roll } from "./fakes";

describe("isD20Roll", () => {
  it("accepts an evaluated roll led by a d20", () => {
    expect(isD20Roll(d20Roll(12, 5))).toBe(true);
  });

  it("rejects damage rolls, unevaluated rolls and nothing", () => {
    const damage = { ...d20Roll(3, 2), terms: [{ class: "Die", faces: 8, number: 1 }] };
    expect(isD20Roll(damage)).toBe(false);
    expect(isD20Roll({ ...d20Roll(12, 5), evaluated: false })).toBe(false);
    expect(isD20Roll(null)).toBe(false);
  });
});

describe("canReroll", () => {
  it("refuses Take 10/20", () => {
    expect(canReroll(d20Roll(10, 5, { staticRoll: 10 }))).toBe(false);
    expect(canReroll(d20Roll(10, 5))).toBe(true);
  });
});

describe("naturalD20 / threatens", () => {
  it("reads the kept die and compares it with the crit range", () => {
    expect(naturalD20(d20Roll(18, 3))).toBe(18);
    expect(threatens(d20Roll(18, 3, { critical: 18 }))).toBe(true);
    expect(threatens(d20Roll(17, 3, { critical: 18 }))).toBe(false);
  });

  it("is undefined for advantage-style rolls with several kept dice", () => {
    const roll = d20Roll(5, 0);
    roll.terms[0].results = [
      { result: 5, active: true },
      { result: 9, active: true },
    ];
    expect(naturalD20(roll)).toBeUndefined();
  });
});

describe("withFlatBonus", () => {
  it("appends a labelled bonus without touching the dice or the original", () => {
    const original = d20Roll(12, 5);
    const boosted = withFlatBonus(original, 4, "Hero Point");
    expect(boosted.total).toBe(21);
    expect(boosted.formula).toBe("1d20 + 5[Bonus] + 4[Hero Point]");
    expect(boosted.terms[0]).toEqual(original.terms[0]);
    expect(boosted.terms.slice(-2)).toEqual([
      { class: "OperatorTerm", options: {}, evaluated: true, operator: "+" },
      { class: "NumericTerm", options: { flavor: "Hero Point" }, evaluated: true, number: 4 },
    ]);
    expect(original.total).toBe(17);
    expect(original.terms).toHaveLength(3);
  });

  it("strips brackets that would break the flavor tag", () => {
    expect(withFlatBonus(d20Roll(1, 0), 2, "Aid [x]").formula).toBe("1d20 + 0[Bonus] + 2[Aid x]");
    expect(bonusPart(8, "Hero [Point]")).toBe("8[Hero Point]");
  });
});
