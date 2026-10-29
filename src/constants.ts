export const MODULE_ID = "pf1e-hero-points";

/** Actor flag set by the sheet's ★: +8 on the next d20 roll. */
export const ARMED_FLAG = "armed";

/** Actor flag recording the combat round a Hero Point was last spent in. */
export const SPENT_FLAG = "lastSpent";

/**
 * The APG Hero Point uses that touch a d20 roll. Bonuses are luck bonuses; aiding an ally grants half.
 * "beforeRoll" is a toggle in pf1's roll windows; the rest act on a roll already in chat.
 */
export const HERO_USES = {
  reroll: { cost: 1, bonus: 0 },
  bonus: { cost: 1, bonus: 4 },
  aid: { cost: 1, bonus: 2 },
  beforeRoll: { cost: 1, bonus: 8 },
} as const;

export type ChatUse = "reroll" | "bonus" | "aid";
