// Boots for outfield players and gloves for keepers: a few points on a couple of
// attributes while they're worn. Bought in the shop into the kit bag, put on (and
// taken off) in the player's profile; they never wear out. The bonus counts in the
// match and the line-up, not in the player's own attributes (so not in value or training).
import {book} from "./helpers";
import type {Rng} from "./rng";
import type {Attribute, GameState, Player} from "./types";

export const GEAR_KINDS = ["speed", "shooting", "technique", "grip", "gloves", "shin"] as const;
export type GearKind = (typeof GEAR_KINDS)[number];
export const GEAR_TIERS = ["common", "silver", "gold", "special"] as const;
export type GearTier = (typeof GEAR_TIERS)[number];

export interface GearItem {
  kind: GearKind;
  tier: GearTier;
  /** From the kit pack: a lucky extra on one attribute (it can lift a piece past the best in the shop). */
  perk?: {attr: Attribute; n: number};
}

/** What each kind lifts. Gloves lift one thing, twice as much. */
export const GEAR_ATTRS: Record<GearKind, Attribute[]> = {
  speed: ["pace", "stamina"],
  shooting: ["finishing", "technique"],
  technique: ["passing", "vision"],
  grip: ["defending", "physical"],
  gloves: ["goalkeeping"],
  shin: ["physical", "stamina"],
};
/** Where a piece is worn: boots or gloves on the feet (or hands), shin guards on the shins. One of each. */
export type GearSlot = "feet" | "shin";
export function gearSlot(kind: GearKind): GearSlot {
  return kind === "shin" ? "shin" : "feet";
}
/** Shin guards: the share of injuries they keep away. */
export const SHIN_PROTECT: Record<GearTier, number> = {common: 0.15, silver: 0.25, gold: 0.35, special: 0.5};
export const GEAR_ICON: Record<GearKind, string> = {speed: "⚡", shooting: "🎯", technique: "✨", grip: "🛡️", gloves: "🧤", shin: "🦵"};
export const GEAR_BONUS: Record<GearTier, number> = {common: 1, silver: 2, gold: 3, special: 5};
/** Common and silver for club money, gold and special for diamonds. */
export const GEAR_PRICE: Record<GearTier, {money?: number; diamonds?: number}> = {
  common: {money: 250_000},
  silver: {money: 750_000},
  gold: {diamonds: 40},
  special: {diamonds: 100},
};
/** Each kind's colour, so the five look different at a glance (in pictures, lists and on the pitch). */
export const GEAR_KIND_COLOR: Record<GearKind, string> = {speed: "#f97316", shooting: "#ef4444", technique: "#8b5cf6", grip: "#2563eb", gloves: "#16a34a", shin: "#14b8a6"};
/** The tier's colour: the trim on pictures, the outline on the pitch. */
export const GEAR_COLOR: Record<GearTier, string> = {common: "#e5e7eb", silver: "#94a3b8", gold: "#facc15", special: "#ec4899"};

/** Gloves are for keepers, boots for everyone else; shin guards for all. */
export function gearFits(p: Player, kind: GearKind): boolean {
  if (kind === "shin") return true;
  return (kind === "gloves") === (p.position === "GK");
}

/** What a player has on: boots or gloves, and shin guards. */
export function wornGear(p: Player): {slot: GearSlot; item: GearItem}[] {
  const out: {slot: GearSlot; item: GearItem}[] = [];
  if (p.gear) out.push({slot: "feet", item: p.gear});
  if (p.shin) out.push({slot: "shin", item: p.shin});
  return out;
}

/** The piece a player wears in a slot. */
export function gearIn(p: Player, slot: GearSlot): GearItem | undefined {
  return slot === "shin" ? p.shin : p.gear;
}

/** Everything a player's kit adds, attribute by attribute. */
export function totalGearBonus(p: Player): Partial<Record<Attribute, number>> {
  const sum: Partial<Record<Attribute, number>> = {};
  for (const {item} of wornGear(p)) {
    for (const [a, n] of Object.entries(gearBonus(item)) as [Attribute, number][]) sum[a] = (sum[a] ?? 0) + n;
  }
  return sum;
}

/** How much the gear adds to each attribute it lifts. */
export function gearBonus(item: GearItem): Partial<Record<Attribute, number>> {
  const attrs = GEAR_ATTRS[item.kind];
  const each = GEAR_BONUS[item.tier] * (attrs.length === 1 ? 2 : 1);
  const out: Partial<Record<Attribute, number>> = Object.fromEntries(attrs.map((a) => [a, each]));
  if (item.perk) out[item.perk.attr] = (out[item.perk.attr] ?? 0) + item.perk.n;
  return out;
}

/** The player as they play: with their gear's bonus on top (capped at 99). */
export function geared(p: Player): Player {
  if (!p.gear && !p.shin) return p;
  const attrs = {...p.attrs};
  for (const [a, n] of Object.entries(totalGearBonus(p)) as [Attribute, number][]) attrs[a] = Math.min(99, attrs[a] + n);
  return {...p, attrs};
}

/** Buys a pair into the kit bag. Returns an error key, or null. */
export function buyGear(state: GameState, item: GearItem): string | null {
  const price = GEAR_PRICE[item.tier];
  if (price.diamonds) {
    if (state.monetization.diamonds < price.diamonds) return "shop.notEnoughDiamonds";
    state.monetization.diamonds -= price.diamonds;
  } else if (price.money) {
    if (state.clubs[state.userClubId].cash < price.money) return "gear.noMoney";
    book(state, state.userClubId, "equipment", -price.money);
  }
  (state.gearBag ??= []).push({...item});
  return null;
}

/** What a piece from the bag sells back for: half its price, in the same kind of money. */
export function gearResale(item: GearItem): {money?: number; diamonds?: number} {
  const price = GEAR_PRICE[item.tier];
  return price.diamonds ? {diamonds: Math.floor(price.diamonds / 2)} : {money: Math.round((price.money ?? 0) / 2)};
}

/** Sells a piece from the bag. Returns an error key, or null. */
export function sellGear(state: GameState, bagIndex: number): string | null {
  const item = state.gearBag?.[bagIndex];
  if (!item) return "gear.none";
  state.gearBag!.splice(bagIndex, 1);
  const back = gearResale(item);
  if (back.diamonds) state.monetization.diamonds += back.diamonds;
  if (back.money) book(state, state.userClubId, "equipment", back.money);
  return null;
}

/** Puts a piece from the bag on a player; what they wore in that place goes back in the bag. */
export function equipGear(state: GameState, playerId: string, bagIndex: number): string | null {
  const p = state.players[playerId];
  const item = state.gearBag?.[bagIndex];
  if (!p || !item) return "gear.none";
  if (!gearFits(p, item.kind)) return "gear.noFit";
  state.gearBag!.splice(bagIndex, 1);
  if (gearSlot(item.kind) === "shin") {
    if (p.shin) state.gearBag!.push(p.shin);
    p.shin = item;
  } else {
    if (p.gear) state.gearBag!.push(p.gear);
    p.gear = item;
  }
  return null;
}

/** Takes a player's kit off (one place, or all of it), back into the bag. */
export function unequipGear(state: GameState, playerId: string, slot?: GearSlot): void {
  const p = state.players[playerId];
  if (!p) return;
  if (p.gear && slot !== "shin") {
    (state.gearBag ??= []).push(p.gear);
    delete p.gear;
  }
  if (p.shin && slot !== "feet") {
    (state.gearBag ??= []).push(p.shin);
    delete p.shin;
  }
}

/** The bag with pieces alike (same kind and tier) together: each once, how many, and where the first one is. */
export function groupBag(bag: GearItem[]): {item: GearItem; index: number; count: number}[] {
  const groups: {item: GearItem; index: number; count: number}[] = [];
  bag.forEach((item, index) => {
    const same = groups.find((x) => x.item.kind === item.kind && x.item.tier === item.tier && x.item.perk?.attr === item.perk?.attr && x.item.perk?.n === item.perk?.n);
    if (same) same.count++;
    else groups.push({item, index, count: 1});
  });
  return groups;
}

/**
 * The kit pack: a random piece (any kind, mostly common or silver) with a perk on top, an extra
 * on one attribute. Most perks are small; now and then one is big enough to beat a special pair.
 */
export const GEAR_PACK = {price: 60} as const;
const PACK_TIERS: Record<GearTier, number> = {common: 34, silver: 34, gold: 22, special: 10};
const PERK_SIZES: [number, number][] = [[1, 36], [2, 28], [3, 16], [4, 10], [5, 6], [7, 3], [10, 1]];
const PERK_ATTRS: Attribute[] = ["pace", "finishing", "passing", "technique", "defending", "physical", "stamina", "vision"];

export function rollGearPack(rng: Rng): GearItem {
  const kind = rng.pick([...GEAR_KINDS]);
  const tier = rng.weighted([...GEAR_TIERS], (t) => PACK_TIERS[t]);
  const n = rng.weighted(PERK_SIZES, ([, w]) => w)[0];
  const attr = kind === "gloves" ? rng.pick<Attribute>(["goalkeeping", "vision", "physical"]) : rng.pick(PERK_ATTRS);
  return {kind, tier, perk: {attr, n}};
}

/** Opens a kit pack for diamonds: the piece goes in the bag. The piece, or an error key. */
export function openGearPack(state: GameState, rng: Rng): GearItem | string {
  if (state.monetization.diamonds < GEAR_PACK.price) return "shop.notEnoughDiamonds";
  state.monetization.diamonds -= GEAR_PACK.price;
  const item = rollGearPack(rng);
  (state.gearBag ??= []).push(item);
  return item;
}
