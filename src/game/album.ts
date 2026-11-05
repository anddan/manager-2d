// The collector's album: everything there is to collect (presents in every colour, kit of every kind and
// tier, trophies, packs and a few very rare things), what the manager has had so far greyed out until then.
// What was had is kept in `state.album`; older saves are filled in from what the squad and the bag hold now
// and from the history. Every new thing can be opened once for diamonds (a blue number in the menu until it is).
//
// An item is named by a key: "trophy:league", "gift:sportsCar:blue", "gear:speed:gold", "pack:bronze", "rare:dynasty".
import type {GearItem} from "./gear";
import {GEAR_KINDS, GEAR_TIERS} from "./gear";
import {LEGEND_ID, THEO_ID} from "./legend";
import {GIFT_VARIANTS, parseGift} from "./morale";
import {overall} from "./ratings";
import {partLevel, partMax, type StadiumPart} from "./stadium";
import type {GameState} from "./types";

export interface Album {
  /** Presents given ("sportsCar:blue"). */
  gifts: string[];
  /** Kit had ("speed:gold"). */
  gear: string[];
  /** Packs opened, by kind (bronze, silver, gold, special, diamond, kit). */
  packs: Record<string, number>;
  /** Trophies won, by key (see TROPHIES). */
  trophies: Record<string, number>;
  /** The rare ones reached (see RARES). */
  rare?: string[];
  /** The items opened for their diamonds (by key). */
  claimed?: string[];
}

/** The trophies to win. The medals of the World Cup and the Euros are one each: gold, silver, bronze. */
export const TROPHIES = ["league", "cup", "wc1", "wc2", "wc3", "ec1", "ec2", "ec3", "award.player", "award.keeper", "award.talent", "award.manager"] as const;
export type TrophyKey = (typeof TROPHIES)[number];

/** The packs to open. */
export const ALBUM_PACKS = ["bronze", "silver", "gold", "special", "diamond", "kit"] as const;

/** The very rare ones: things that take a long time, or a lot of luck. */
export const RARES = ["dynasty", "double", "dream", "rich", "legend", "prodigy", "cars", "wardrobe", "king"] as const;
export type RareKey = (typeof RARES)[number];

/** Every present there is to give: each kind in each of its colours (a function: gear, morale and this file import each other). */
export const albumGifts = (): string[] => [...Object.entries(GIFT_VARIANTS).flatMap(([id, colours]) => colours.map((c) => `${id}:${c}`)), "mansion"];

/** Every piece of kit there is: each kind in each tier. */
export const albumGear = (): string[] => GEAR_KINDS.flatMap((kind) => GEAR_TIERS.map((tier) => `${kind}:${tier}`));

/** Every item in the album, by key. */
export const albumKeys = (): string[] => [
  ...TROPHIES.map((k) => `trophy:${k}`),
  ...albumGifts().map((k) => `gift:${k}`),
  ...albumGear().map((k) => `gear:${k}`),
  ...ALBUM_PACKS.map((k) => `pack:${k}`),
  ...RARES.map((k) => `rare:${k}`),
];

export function ensureAlbum(state: GameState): Album {
  state.album ??= {gifts: [], gear: [], packs: {}, trophies: {}};
  return state.album;
}

export function collectGift(state: GameState, kept: string): void {
  const a = ensureAlbum(state);
  const {id, variant} = parseGift(kept);
  const key = variant ? `${id}:${variant}` : id;
  if (!a.gifts.includes(key)) a.gifts.push(key);
}

export function collectGear(state: GameState, item: GearItem): void {
  const a = ensureAlbum(state);
  const key = `${item.kind}:${item.tier}`;
  if (!a.gear.includes(key)) a.gear.push(key);
}

export function collectPack(state: GameState, pack: string): void {
  const a = ensureAlbum(state);
  a.packs[pack] = (a.packs[pack] ?? 0) + 1;
}

export function collectTrophy(state: GameState, key: string): void {
  const a = ensureAlbum(state);
  a.trophies[key] = (a.trophies[key] ?? 0) + 1;
}

/** What the manager has had: the album's own record, with what can be seen in the game now added. */
export function albumOwned(state: GameState): {gifts: Set<string>; gear: Set<string>; packs: Record<string, number>; trophies: Record<string, number>; rare: Set<string>} {
  const a = state.album;
  const gifts = new Set(a?.gifts ?? []);
  const gear = new Set(a?.gear ?? []);
  const club = state.clubs[state.userClubId];
  for (const p of Object.values(state.players)) {
    if (p.clubId !== state.userClubId) continue;
    for (const kept of p.gifts ?? []) {
      const {id, variant} = parseGift(kept);
      if (id !== "cash") gifts.add(variant ? `${id}:${variant}` : id);
    }
    for (const item of [p.gear, p.shin]) if (item) gear.add(`${item.kind}:${item.tier}`);
  }
  for (const item of state.gearBag ?? []) gear.add(`${item.kind}:${item.tier}`);
  const trophies = {...(a?.trophies ?? {})};
  const titles = state.history.filter((h) => h.championId === club?.id).length;
  const cups = state.history.filter((h) => h.cup === 4).length;
  if (titles > (trophies.league ?? 0)) trophies.league = titles;
  if (cups > (trophies.cup ?? 0)) trophies.cup = cups;
  return {gifts, gear, packs: {...(a?.packs ?? {})}, trophies, rare: new Set(a?.rare ?? [])};
}

const STADIUM_PARTS: StadiumPart[] = ["north", "south", "west", "east", "kiosks", "shop", "training", "gym", "rehab", "academy"] as StadiumPart[];

/** Whether a rare one is reached right now. */
function rareReached(state: GameState, key: RareKey): boolean {
  const club = state.clubs[state.userClubId];
  const o = albumOwned(state);
  if (key === "dynasty") return state.history.filter((h) => h.championId === club?.id).length >= 3;
  // The league and the Champions Cup in the same season.
  if (key === "double") return state.history.some((h) => h.championId === club?.id && h.cup === 4);
  if (key === "dream") return !!club?.stadium && STADIUM_PARTS.every((p) => partLevel(club.stadium!, p) >= partMax(p));
  if (key === "rich") return (club?.cash ?? 0) >= 100_000_000;
  if (key === "legend") return [LEGEND_ID, THEO_ID].some((id) => state.players[id]?.clubId === state.userClubId);
  // One of our own academy players, grown into a star.
  if (key === "prodigy") return Object.values(state.players).some((p) => p.homegrown && p.clubId === state.userClubId && overall(p) >= 95);
  if (key === "cars") return (GIFT_VARIANTS.sportsCar ?? []).every((c) => o.gifts.has(`sportsCar:${c}`));
  if (key === "wardrobe") return albumGear().every((g) => o.gear.has(g));
  // The king: everything else in the album.
  const rest = albumKeys().filter((k) => k !== "rare:king");
  return rest.every((k) => hasKey(state, o, k));
}

function hasKey(_state: GameState, o: ReturnType<typeof albumOwned>, key: string): boolean {
  const [kind, ...rest] = key.split(":");
  const id = rest.join(":");
  return kind === "gift" ? o.gifts.has(id) : kind === "gear" ? o.gear.has(id) : kind === "trophy" ? (o.trophies[id] ?? 0) > 0 : kind === "pack" ? (o.packs[id] ?? 0) > 0 : o.rare.has(id);
}

/** Notes the rare ones reached (called now and then: each week, and when the album is opened). */
export function updateAlbum(state: GameState): void {
  const a = ensureAlbum(state);
  a.rare ??= [];
  for (const key of RARES) {
    if (!a.rare.includes(key) && rareReached(state, key)) a.rare.push(key);
  }
}

/** The keys of everything had. */
export function ownedKeys(state: GameState): Set<string> {
  const o = albumOwned(state);
  return new Set(albumKeys().filter((k) => hasKey(state, o, k)));
}

/** The items had and not opened yet. */
export function claimable(state: GameState): string[] {
  const done = new Set(state.album?.claimed ?? []);
  const owned = ownedKeys(state);
  return albumKeys().filter((k) => owned.has(k) && !done.has(k));
}

/** The diamonds an item gives when it is opened. */
export function rewardOf(key: string): number {
  const [kind, a, b] = key.split(":");
  if (kind === "trophy") {
    const R: Record<string, number> = {league: 30, cup: 50, wc1: 100, ec1: 80, wc2: 50, ec2: 40, wc3: 30, ec3: 25};
    return R[a] ?? 25;
  }
  if (kind === "gift") return ({gaming: 3, watch: 4, motorcycle: 6, sportsCar: 10, mansion: 40} as Record<string, number>)[a] ?? 3;
  if (kind === "gear") return ({common: 2, silver: 4, gold: 8, special: 15} as Record<string, number>)[b] ?? 2;
  if (kind === "pack") return ({bronze: 3, silver: 5, gold: 10, special: 20, diamond: 25, kit: 6} as Record<string, number>)[a] ?? 3;
  return ({dynasty: 150, double: 200, dream: 150, rich: 120, legend: 100, prodigy: 200, cars: 100, wardrobe: 150, king: 500} as Record<string, number>)[a] ?? 100;
}

/** Opens an item: its diamonds. 0 if it isn't had or is already opened. */
export function claimItem(state: GameState, key: string): number {
  const a = ensureAlbum(state);
  a.claimed ??= [];
  if (a.claimed.includes(key) || !claimable(state).includes(key)) return 0;
  a.claimed.push(key);
  const n = rewardOf(key);
  state.monetization.diamonds += n;
  return n;
}

/** How much of the album is filled: the things to collect and how many are had. */
export function albumProgress(state: GameState): {have: number; total: number} {
  const keys = albumKeys();
  const owned = ownedKeys(state);
  return {have: keys.filter((k) => owned.has(k)).length, total: keys.length};
}
