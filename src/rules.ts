// Pure transforms over serialized Foundry rolls (Roll#toJSON output). No Foundry globals here,
// so everything in this file is unit-tested directly.

export interface RollTermJSON {
  class: string;
  options?: Record<string, any>;
  evaluated?: boolean;
  faces?: number;
  number?: number;
  operator?: string;
  method?: string;
  modifiers?: string[];
  results?: { result: number; active?: boolean; discarded?: boolean }[];
  [key: string]: unknown;
}

export interface RollJSON {
  class: string;
  options?: Record<string, any>;
  formula: string;
  terms: RollTermJSON[];
  total: number;
  evaluated?: boolean;
  [key: string]: unknown;
}

/** An evaluated roll led by a d20 die (1d20, 2d20kh, ...), the only rolls Hero Points apply to. */
export function isD20Roll(roll: RollJSON | null | undefined): roll is RollJSON {
  if (!roll || roll.evaluated === false || !Array.isArray(roll.terms)) return false;
  const first = roll.terms[0];
  return first?.class === "Die" && first.faces === 20 && Number.isFinite(roll.total);
}

/** Take 10 / Take 20 is not a roll, so it cannot be rerolled (pf1 records it as options.staticRoll). */
export function canReroll(roll: RollJSON): boolean {
  return isD20Roll(roll) && !Number.isFinite(roll.options?.staticRoll);
}

/** The kept d20 result, or undefined when it cannot be read. */
export function naturalD20(roll: RollJSON): number | undefined {
  const kept = (roll.terms[0]?.results ?? []).filter((r) => r.active !== false && !r.discarded);
  return kept.length === 1 ? kept[0].result : undefined;
}

/** Does this attack roll threaten a critical hit? */
export function threatens(roll: RollJSON): boolean {
  const natural = naturalD20(roll);
  const range = roll.options?.critical;
  return natural !== undefined && Number.isFinite(range) && natural >= range;
}

/** Sum of a dice term's kept results. */
function keptTotal(term: RollTermJSON): number {
  return (term.results ?? []).filter((r) => r.active !== false && !r.discarded).reduce((sum, r) => sum + r.result, 0);
}

/** The formula of a roll's leading d20 term alone, modifiers included (`1d20`, `2d20kh`). */
export function d20Expression(roll: RollJSON): string {
  const die = roll.terms[0];
  const modifiers = Array.isArray(die.modifiers) ? die.modifiers.join("") : "";
  return `${die.number ?? 1}d${die.faces ?? 20}${modifiers}`;
}

/**
 * A copy of an evaluated roll with its leading d20 replaced by a freshly rolled one. Only the d20
 * is rerolled (APG: "reroll any one d20 roll"); other dice in the formula keep their results.
 */
export function withD20(roll: RollJSON, die: RollTermJSON): RollJSON {
  const copy: RollJSON = structuredClone(roll);
  const old = copy.terms[0];
  copy.terms[0] = { ...structuredClone(die), options: old.options ?? {} };
  copy.total = roll.total - keptTotal(old) + keptTotal(die);
  return copy;
}

/** Strip characters that would break a Foundry flavor tag. */
function cleanLabel(label: string): string {
  return label.replace(/[[\]]/g, "").trim();
}

/**
 * A copy of an evaluated roll with a flat bonus appended, without rerolling any dice:
 * `1d20 + 5[Ranks]` (total 17) becomes `1d20 + 5[Ranks] + 4[Hero Point]` (total 21).
 */
export function withFlatBonus(roll: RollJSON, amount: number, label: string): RollJSON {
  const flavor = cleanLabel(label);
  const copy: RollJSON = structuredClone(roll);
  copy.terms.push(
    { class: "OperatorTerm", options: {}, evaluated: true, operator: "+" },
    { class: "NumericTerm", options: { flavor }, evaluated: true, number: amount },
  );
  copy.formula = `${roll.formula} + ${amount}[${flavor}]`;
  copy.total = roll.total + amount;
  return copy;
}

/** The formula part pf1 roll hooks receive for a pre-committed bonus. */
export function bonusPart(amount: number, label: string): string {
  return `${amount}[${cleanLabel(label)}]`;
}
