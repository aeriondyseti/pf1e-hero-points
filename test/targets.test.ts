import { describe, expect, it } from "vitest";
import { pickTarget, rollTargets } from "../src/targets";
import { d20Roll, installGlobals } from "./fakes";

installGlobals({ actors: {}, settings: {} });

const damage = { ...d20Roll(4, 3), terms: [{ class: "Die", faces: 8, number: 1, results: [{ result: 4 }] }] };

describe("rollTargets", () => {
  it("lists the d20 rolls of a check message", () => {
    const message = { rolls: [d20Roll(12, 5, { flavor: "Perception" })] };
    expect(rollTargets(message)).toEqual([expect.objectContaining({ kind: "roll", index: 0, label: "Perception: 17" })]);
  });

  it("lists attack and crit-confirmation rolls of an action card, skipping damage", () => {
    const message = {
      rolls: [],
      systemRolls: {
        attacks: [
          { attack: d20Roll(19, 6, { flavor: "Attack" }), critConfirm: d20Roll(8, 6, { flavor: "Confirm" }), damage: [damage] },
          { attack: d20Roll(3, 1, { flavor: "Iterative" }), critConfirm: null, damage: [damage] },
        ],
      },
    };
    expect(rollTargets(message).map((t) => t.label)).toEqual(["Attack: 25", "Confirm: 14", "Iterative: 4"]);
  });

  it("finds nothing on a damage-only card", () => {
    expect(rollTargets({ systemRolls: { attacks: [{ attack: null, damage: [damage] }] } })).toEqual([]);
  });
});

describe("pickTarget", () => {
  const message = {
    systemRolls: {
      attacks: [{ attack: d20Roll(19, 6), critConfirm: d20Roll(8, 6) }, { attack: d20Roll(3, 1) }],
    },
  };
  const targets = rollTargets(message);
  const describe_ = (t: any) => t && `${t.attackIndex}:${t.field}`;

  it("uses the attack or confirmation under the cursor", () => {
    expect(describe_(pickTarget(targets, { attackIndex: 0 }))).toBe("0:attack");
    expect(describe_(pickTarget(targets, { attackIndex: 0, critConfirm: true }))).toBe("0:critConfirm");
    expect(describe_(pickTarget(targets, { attackIndex: 1, critConfirm: true }))).toBe("1:attack");
  });

  it("asks (undefined) when several rolls could be meant", () => {
    expect(pickTarget(targets, {})).toBeUndefined();
  });

  it("takes the only candidate without asking", () => {
    const only = rollTargets({ rolls: [d20Roll(5, 5)] });
    expect(pickTarget(only, {})).toBe(only[0]);
  });
});
