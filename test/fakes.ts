// Minimal Foundry v13 / pf1 fakes: just enough globals for the module's logic to run under node.
import { vi } from "vitest";
import type { RollJSON } from "../src/rules";

export function d20Roll(natural: number, mod: number, options: Record<string, any> = {}): RollJSON {
  return {
    class: "D20RollPF",
    options: { critical: 20, ...options },
    formula: `1d20 + ${mod}[Bonus]`,
    terms: [
      { class: "Die", faces: 20, number: 1, evaluated: true, results: [{ result: natural, active: true }] },
      { class: "OperatorTerm", operator: "+", evaluated: true },
      { class: "NumericTerm", number: mod, evaluated: true, options: { flavor: "Bonus" } },
    ],
    total: natural + mod,
    evaluated: true,
  };
}

export class FakeItem {
  updates: number[] = [];
  constructor(
    public name: string,
    public charges: number,
    public id = Math.random().toString(36).slice(2),
  ) {}
  async addCharges(value: number) {
    this.charges += value;
    this.updates.push(value);
  }
}

export class FakeActor {
  flags: Record<string, Record<string, unknown>> = {};
  constructor(
    public name: string,
    public items: FakeItem[] = [],
    public isOwner = true,
    public uuid = `Actor.${name}`,
  ) {}
  getFlag(scope: string, key: string) {
    return this.flags[scope]?.[key];
  }
  async setFlag(scope: string, key: string, value: unknown) {
    (this.flags[scope] ??= {})[key] = value;
  }
  async unsetFlag(scope: string, key: string) {
    delete this.flags[scope]?.[key];
  }
}

/** Stand-in for D20RollPF: wraps roll JSON, rerolls to a fixed natural, records toMessage calls. */
export class FakeD20Roll {
  static nextNatural = 10;
  static posted: { data: any; options: any; roll: FakeD20Roll }[] = [];
  constructor(public json: RollJSON) {}
  get total() {
    return this.json.total;
  }
  toJSON() {
    return structuredClone(this.json);
  }
  async reroll() {
    const json = structuredClone(this.json);
    const natural = FakeD20Roll.nextNatural;
    const old = json.terms[0].results![0].result;
    json.terms[0].results = [{ result: natural, active: true }];
    json.total = json.total - old + natural;
    return new FakeD20Roll(json);
  }
  async toMessage(data: any, options: any) {
    FakeD20Roll.posted.push({ data, options, roll: this });
    return { id: "new", data };
  }
}

/** Stand-in for core Roll: `new Roll("1d20").evaluate()` yields the next queued luck result. */
export class FakeRoll {
  static luck: number[] = [];
  total = 0;
  constructor(public formula: string) {}
  async evaluate() {
    this.total = FakeRoll.luck.shift() ?? 1;
    return this;
  }
  static fromData(json: RollJSON) {
    return new FakeD20Roll(json);
  }
}

export interface World {
  actors: Record<string, FakeActor>;
  settings: Record<string, unknown>;
  combat?: { id: string; round: number; started: boolean; combatants: { actor: any }[] };
}

export function installGlobals(world: World): void {
  FakeD20Roll.posted = [];
  FakeRoll.luck = [];
  const g = globalThis as any;
  g.game = {
    combat: world.combat,
    settings: { get: (_scope: string, key: string) => world.settings[key] },
    i18n: {
      localize: (key: string) => key,
      format: (key: string, data: Record<string, unknown>) => `${key} ${JSON.stringify(data)}`,
    },
    user: { character: null },
    messages: { get: () => undefined },
  };
  g.canvas = { tokens: { controlled: [] } };
  g.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
  g.ChatMessage = { getSpeakerActor: (speaker: any) => world.actors[speaker?.actor] ?? null };
  g.Roll = FakeRoll;
  g.pf1 = { dice: { D20RollPF: FakeD20Roll } };
  g.foundry = {
    applications: { api: { DialogV2: { confirm: vi.fn(async () => true), wait: vi.fn(async () => "0") } } },
  };
  g.Hooks = { on: vi.fn(), once: vi.fn() };
}
