// Minimal Foundry v13 / pf1 fakes: just enough globals for the module's logic to run under node.
import { vi } from "vitest";
import type { RollJSON } from "../src/rules";

export function d20Roll(natural: number, mod: number, options: Record<string, any> = {}, cls = "D20RollPF"): RollJSON {
  return {
    class: cls,
    options: { critical: 20, ...options },
    formula: `1d20 + ${mod}[Bonus]`,
    terms: [
      { class: "Die", faces: 20, number: 1, modifiers: [], evaluated: true, results: [{ result: natural, active: true }] },
      { class: "OperatorTerm", operator: "+", evaluated: true },
      { class: "NumericTerm", number: mod, evaluated: true, options: { flavor: "Bonus" } },
    ],
    total: natural + mod,
    evaluated: true,
  };
}

function setPath(target: any, path: string, value: unknown): void {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) node = node[part] ??= {};
  const last = parts.at(-1)!;
  if (last.startsWith("-=")) delete node[last.slice(2)];
  else node[last] = value;
}

/** A pf1 item: charges read from system.uses like ItemPF#charges (Infinity without limited uses). */
export class FakeItem {
  updates: number[] = [];
  system: any;
  isActive?: boolean;
  constructor(
    public name: string,
    charges: number,
    public id = Math.random().toString(36).slice(2),
  ) {
    this.system = { uses: Number.isFinite(charges) ? { per: "charges", value: charges } : { per: "" } };
  }
  get charges(): number {
    return this.system.uses?.per ? (this.system.uses.value ?? 0) : Infinity;
  }
  set charges(value: number) {
    this.system.uses.value = value;
  }
  /** Like pf1: an unclamped update of uses.value, landing only after the round trip. */
  async addCharges(value: number) {
    const next = (this.system.uses.value || 0) + value;
    await Promise.resolve();
    this.system.uses.value = next;
    this.updates.push(value);
  }
  async update(data: Record<string, unknown>) {
    await Promise.resolve();
    for (const [path, value] of Object.entries(data)) setPath(this, path, value);
  }
}

export class FakeActor {
  flags: Record<string, Record<string, unknown>> = {};
  updates: Record<string, unknown>[] = [];
  type = "character";
  hasPlayerOwner = true;
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
    await this.update({ [`flags.${scope}.${key}`]: value });
  }
  async unsetFlag(scope: string, key: string) {
    await this.update({ [`flags.${scope}.-=${key}`]: null });
  }
  async update(data: Record<string, unknown>) {
    this.updates.push(data);
    await Promise.resolve();
    for (const [path, value] of Object.entries(data)) setPath(this, path, value);
  }
  async createEmbeddedDocuments(_type: string, data: any[]) {
    const created = data.map((d) => {
      const item = new FakeItem(d.name, Infinity);
      item.system = structuredClone(d.system);
      return item;
    });
    this.items.push(...created);
    return created;
  }
}

/** Posted results: what the module handed to toMessage, and the message data it created. */
export const posted: { data: any; options: any; roll: FakeRollInstance }[] = [];

/** Stand-in for evaluated D20RollPF / plain Roll instances built from JSON. */
export class FakeRollInstance {
  constructor(public json: RollJSON) {}
  get total() {
    return this.json.total;
  }
  toJSON() {
    return structuredClone(this.json);
  }
  async toMessage(data: any, options: any) {
    posted.push({ data, options, roll: this });
    // Like Roll#toMessage with create: false: the message data, rolls included, with the roll mode
    // applied (publicroll here; the module overwrites whisper/blind from the original anyway).
    return { ...structuredClone(data), rolls: [this.toJSON()], whisper: [], blind: false };
  }
}
export class FakeD20Roll extends FakeRollInstance {}

/**
 * Stand-in for core Roll. `new Roll(f).evaluate()` takes its d20 from the shared `d20s` queue
 * (10 when empty), used both by rerolls and the Luck of Heroes roll.
 */
export class FakeRoll {
  static d20s: number[] = [];
  total = 0;
  terms: { toJSON: () => any }[] = [];
  constructor(public formula: string) {}
  async evaluate() {
    const result = FakeRoll.d20s.shift() ?? 10;
    this.total = result;
    const die = { class: "Die", faces: 20, number: 1, modifiers: [], evaluated: true, results: [{ result, active: true }] };
    this.terms = [{ toJSON: () => structuredClone(die) }];
    return this;
  }
  static fromData(json: RollJSON) {
    return json.class === "D20RollPF" ? new FakeD20Roll(json) : new FakeRollInstance(json);
  }
}

export interface World {
  actors: Record<string, FakeActor>;
  settings: Record<string, unknown>;
  combat?: { id: string; round: number; started: boolean; combatants: { actor: any }[] };
}

export function installGlobals(world: World): void {
  posted.length = 0;
  FakeRoll.d20s = [];
  const g = globalThis as any;
  g.game = {
    combat: world.combat,
    settings: { get: (_scope: string, key: string) => world.settings[key] },
    i18n: {
      localize: (key: string) => key,
      format: (key: string, data: Record<string, unknown>) => `${key} ${JSON.stringify(data)}`,
    },
    user: { character: null, isGM: true },
    messages: { get: () => undefined },
    actors: { contents: Object.values(world.actors), get: (id: string) => world.actors[id] },
  };
  g.canvas = { tokens: { controlled: [] } };
  g.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
  g.ChatMessage = {
    getSpeakerActor: (speaker: any) => world.actors[speaker?.actor] ?? null,
    implementation: { create: vi.fn(async (data: any) => ({ id: "new", ...data })) },
  };
  g.Roll = FakeRoll;
  g.pf1 = { dice: { D20RollPF: FakeD20Roll } };
  g.foundry = {
    applications: { api: { DialogV2: { confirm: vi.fn(async () => true), wait: vi.fn(async () => "0") } } },
  };
  g.Hooks = { on: vi.fn(), once: vi.fn() };
}

/** The last message the module created (ChatMessage.implementation.create's first argument). */
export function lastCreated(): any {
  const calls = (globalThis as any).ChatMessage.implementation.create.mock.calls;
  return calls.at(-1)?.[0];
}
