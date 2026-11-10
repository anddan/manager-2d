// The national team. After a title (the league or the Champions Cup) a country may ask the manager to
// be its national coach, next to the club. The squad is the country's best players, whatever club they
// play for, picked automatically for the formation the manager chooses. The team plays a few friendlies a
// year, and a knockout tournament (the Euros in the years after a World Cup's two years, the World Cup
// every fourth year) in the last weeks of the season. Matches are played out in the background.
import {FORMATIONS, SEASON_WEEKS, roleAt, type Slot} from "./constants";
import {NATIONALITIES} from "./names";
import {collectTrophy} from "./album";
import {addMessage, fullName} from "./helpers";
import {isAvailable, pickBestLineup} from "./lineup";
import {effectiveRating, overall} from "./ratings";
import {Rng} from "./rng";
import {createPlayer} from "./generate";
import {ENGINE, simulateMatch} from "./match";
import type {Club, CupFixture, FormationId, GameState, NationalJob, NationalResult, Player, Position, ShirtPattern} from "./types";

/** A country needs this many players in the game to have a team. */
const NATION_MIN = 14;
/** The weeks of the season with a friendly. */
export const FRIENDLY_WEEKS = [8, 18];
/** The tournament: three group matches, then the last sixteen, quarter-finals, semi-finals and final, in the last seven weeks of the season. */
export const TOURNAMENT_WEEKS = [SEASON_WEEKS - 6, SEASON_WEEKS - 5, SEASON_WEEKS - 4, SEASON_WEEKS - 3, SEASON_WEEKS - 2, SEASON_WEEKS - 1, SEASON_WEEKS];
/** The tournaments: the World Cup for every country, and the continental one for the country's own confederation. */
export type Comp = "wc" | "ec" | "copa" | "gold" | "afcon" | "asia";
/** Which continental tournament a country plays in: the Euros (Europe), Copa América (South America), the Gold Cup (North America), the Africa Cup and the Asian Cup. */
const CONFEDERATION: Record<string, Comp> = {
  SE: "ec", NO: "ec", DK: "ec", FI: "ec", ES: "ec", DE: "ec", NL: "ec", GB: "ec", FR: "ec", IT: "ec", PT: "ec", BE: "ec", HR: "ec", PL: "ec", CH: "ec", AT: "ec", IS: "ec", RS: "ec", TR: "ec",
  BR: "copa", AR: "copa", UY: "copa", CO: "copa",
  US: "gold", MX: "gold",
  NG: "afcon", MA: "afcon", SN: "afcon", GH: "afcon", CI: "afcon", CM: "afcon",
  JP: "asia", KR: "asia",
};
export const continentalOf = (country?: string): Comp => (country && CONFEDERATION[country]) || "ec";
/** How many countries play: 32 in the World Cup, 16 in a continental tournament (that country's confederation first, then invited guests, as Copa América has them). */
export const fieldSize = (comp: Comp): number => (comp === "wc" ? 32 : 16);
/** The knockout rounds of a field, by name (the last sixteen only with 32 countries). */
const koNames = (size: number): string[] => (size === 32 ? ["r16", "qf", "sf", "final"] : ["qf", "sf", "final"]);
export const TOURNAMENT_WINNER_DIAMONDS = 30;

/** Which tournament a season has, if any: the World Cup every fourth year, two years after it the continental one (the Euros, Copa América and so on, by the country's confederation). */
export function tournamentOf(season: number, country?: string): Comp | null {
  return season % 4 === 0 ? "wc" : season % 4 === 2 ? continentalOf(country) : null;
}

/** The countries that have a team, strongest first: the average of their best fourteen. */
export function nations(state: GameState): {code: string; strength: number}[] {
  const by = new Map<string, number[]>();
  for (const p of Object.values(state.players)) {
    if (!p.clubId || state.clubs[p.clubId]?.guest) continue;
    (by.get(p.nationality) ?? by.set(p.nationality, []).get(p.nationality)!).push(overall(p));
  }
  return [...by.entries()]
    .filter(([, list]) => list.length >= NATION_MIN)
    .map(([code, list]) => {
      const top = list.sort((a, b) => b - a).slice(0, 14);
      return {code, strength: top.reduce((s, v) => s + v, 0) / top.length};
    })
    .sort((a, b) => b.strength - a.strength);
}

/** A country's players who can play now (whatever club they are in). */
export function nationalPool(state: GameState, country: string): Player[] {
  return Object.values(state.players).filter((p) => p.clubId && !state.clubs[p.clubId]?.guest && p.nationality === country && isAvailable(p));
}

/** The eleven and the bench for the formation, picked from the country's players. */
export function nationalSquad(state: GameState, country: string, formation: FormationId, slots?: readonly Slot[]): {lineup: string[]; bench: string[]} {
  return pickBestLineup(state, {id: `nat:${country}`} as never, (slots ?? FORMATIONS[formation]) as Slot[], nationalPool(state, country));
}

/** The places of the national team: its formation, or the ones dragged about. */
export function nationalSlots(job: {formation: FormationId; customSlots?: Slot[]}): readonly Slot[] {
  return job.customSlots ?? FORMATIONS[job.formation];
}

/** The eleven as shown to the manager: the ones picked (empty places stay empty until the match), else the best. */
export function shownSquad(state: GameState, job: NationalJob): {lineup: string[]; bench: string[]} {
  if (!job.lineup) return nationalSquad(state, job.country, job.formation, job.customSlots);
  return {lineup: nationalSlots(job).map((_, i) => job.lineup![i] ?? ""), bench: nationalLineup(state, job).bench};
}

/** Puts a player in a place (the one who was there takes the other's place); "" empties it. */
export function setNationalSlot(state: GameState, slot: number, id: string): void {
  const job = state.national;
  if (!job) return;
  const next = [...(job.lineup ?? shownSquad(state, job).lineup)];
  while (next.length < nationalSlots(job).length) next.push("");
  if (id) {
    const at = next.indexOf(id);
    if (at >= 0) next[at] = next[slot] ?? "";
  }
  next[slot] = id;
  job.lineup = next;
}

/** Everybody out of the eleven. */
export function clearNationalLineup(state: GameState): void {
  if (state.national) state.national.lineup = nationalSlots(state.national).map(() => "");
}

/** The formation, or "custom": the places as they are now, to be dragged about. */
export function setNationalFormation(state: GameState, value: string): void {
  const job = state.national;
  if (!job) return;
  if (value === "custom") {
    job.customSlots = nationalSlots(job).map((s) => ({...s}));
    return;
  }
  delete job.customSlots;
  job.formation = value as FormationId;
  job.lineup = undefined;
}

/** A place dragged to a spot on the pitch (in percent from the left and the top); the keeper stays in goal. */
export function moveNationalSlot(state: GameState, i: number, left: number, top: number): void {
  const job = state.national;
  if (!job?.customSlots || i === 0) return;
  const x = Math.round(Math.max(10, Math.min(80, 5 + (1 - (top - 8) / 79) * 71)));
  const y = Math.round(Math.max(5, Math.min(95, 50 + (left - 50) / 0.95)));
  job.customSlots[i] = {pos: roleAt(x, y), x, y};
}

/**
 * The eleven for the formation: the ones the manager picked (if they are still there to pick), the empty places
 * filled with the best of the rest, so a team is never sent out with gaps.
 */
export function nationalLineup(state: GameState, job: NationalJob): {lineup: string[]; bench: string[]} {
  const best = nationalSquad(state, job.country, job.formation, job.customSlots);
  if (!job.lineup) return best;
  const pool = new Set(nationalPool(state, job.country).map((p) => p.id));
  const used = new Set<string>();
  const lineup = best.lineup.map((_, i) => {
    const picked = job.lineup![i];
    if (picked && pool.has(picked) && !used.has(picked)) {
      used.add(picked);
      return picked;
    }
    return "";
  });
  const spare = [...best.lineup, ...best.bench].filter((id) => !used.has(id));
  const filled = lineup.map((id) => {
    if (id) return id;
    const next = spare.find((s) => !used.has(s));
    if (next) used.add(next);
    return next ?? "";
  });
  return {lineup: filled, bench: best.bench.filter((id) => !used.has(id))};
}

/** The home shirts of the countries: the colours and the pattern they really play in (Croatia in red and white checks, Argentina in stripes). */
const KITS: Record<string, {color: string; color2: string; pattern?: ShirtPattern}> = {
  SE: {color: "#facc15", color2: "#1d4ed8"}, NO: {color: "#dc2626", color2: "#1e3a8a"}, DK: {color: "#dc2626", color2: "#ffffff"},
  FI: {color: "#ffffff", color2: "#1d4ed8"}, ES: {color: "#dc2626", color2: "#facc15"}, BR: {color: "#facc15", color2: "#16a34a"},
  AR: {color: "#75aadb", color2: "#ffffff", pattern: "stripes"}, DE: {color: "#ffffff", color2: "#0f172a"}, NL: {color: "#f97316", color2: "#0f172a"},
  GB: {color: "#ffffff", color2: "#1e3a8a"}, FR: {color: "#1e3a8a", color2: "#ffffff"}, US: {color: "#ffffff", color2: "#1e3a8a"},
  IT: {color: "#2563eb", color2: "#ffffff"}, NG: {color: "#16a34a", color2: "#ffffff"}, PT: {color: "#b91c1c", color2: "#15803d"},
  BE: {color: "#dc2626", color2: "#facc15"}, HR: {color: "#dc2626", color2: "#ffffff", pattern: "checks"}, PL: {color: "#ffffff", color2: "#dc2626"},
  CH: {color: "#dc2626", color2: "#ffffff"}, AT: {color: "#dc2626", color2: "#ffffff"}, IS: {color: "#1d4ed8", color2: "#dc2626"},
  RS: {color: "#b91c1c", color2: "#1e3a8a"}, TR: {color: "#dc2626", color2: "#ffffff"}, UY: {color: "#7dd3fc", color2: "#0f172a"},
  CO: {color: "#facc15", color2: "#1e3a8a"}, MX: {color: "#15803d", color2: "#dc2626"}, JP: {color: "#1d4ed8", color2: "#ffffff"},
  KR: {color: "#dc2626", color2: "#1e3a8a"}, MA: {color: "#dc2626", color2: "#15803d"}, SN: {color: "#ffffff", color2: "#16a34a"},
  GH: {color: "#ffffff", color2: "#facc15"}, CI: {color: "#f97316", color2: "#16a34a"}, CM: {color: "#16a34a", color2: "#dc2626"},
};
export function nationalKit(country: string): {color: string; color2: string; pattern?: ShirtPattern} {
  const known = KITS[country];
  if (known) return known;
  let h = 5;
  for (const c of country) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  const palette = ["#1d4ed8", "#dc2626", "#16a34a", "#facc15", "#7c3aed", "#0ea5e9"];
  return {color: palette[h % palette.length], color2: "#ffffff"};
}

/** How strong the national eleven is: their average rating in the places they fill. */
function elevenStrength(state: GameState, ids: string[], slots: readonly Slot[]): number {
  const rated = ids.map((id, i) => (state.players[id] ? effectiveRating(state.players[id], slots[i].pos) : 0)).filter((v) => v > 0);
  return rated.length ? rated.reduce((s, v) => s + v, 0) / rated.length : 40;
}

function poisson(rng: Rng, lambda: number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = rng.next();
  while (p > limit && k < 12) {
    k++;
    p *= rng.next();
  }
  return k;
}

/** The country's offer to the manager (sent after a title; a country they are not already coach of). */
export function offerNational(state: GameState, rng: Rng): void {
  if (state.national) return;
  const top = nations(state).slice(0, 10);
  if (top.length === 0) return;
  const country = rng.pick(top).code;
  addMessage(state, {kind: "news", key: "msg.nationalOffer", params: {country: `nat.${country}`}, action: {type: "nationalOffer", country}});
}

/** Becomes national coach. */
export function acceptNational(state: GameState, country: string): void {
  state.national = {country, since: state.season, formation: "4-3-3", mentality: "balanced", results: []};
}

/** A number from a country code (the same every time). */
function codeHash(code: string): number {
  let h = 11;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** How strong the countries are in real life (about the world ranking): the starting point, so Spain and Argentina are not weaker than Finland. */
const REAL_LEVEL: Record<string, number> = {
  ES: 74, FR: 74, AR: 74, BR: 73, GB: 73, DE: 72, PT: 72, NL: 71, BE: 69, IT: 70, HR: 68, UY: 67, CO: 66, MA: 66, SN: 65, JP: 65,
  CH: 64, DK: 64, MX: 63, US: 63, KR: 62, NO: 63, AT: 62, RS: 61, PL: 61, TR: 61, SE: 62, NG: 60, CI: 60, GH: 58, CM: 57, FI: 55, IS: 54,
};

/** A country's team to look at: its best eleven and bench (4-4-2) with their average rating, or just a level when it has no real team. */
export function countryTeam(state: GameState, code: string): {squad: {lineup: string[]; bench: string[]} | null; ovr: number} {
  if (nationalPool(state, code).length >= NATION_MIN) {
    const squad = nationalSquad(state, code, "4-4-2");
    const rated = squad.lineup.map((id, i) => (state.players[id] ? effectiveRating(state.players[id], FORMATIONS["4-4-2"][i].pos) : 0)).filter((v) => v > 0);
    return {squad, ovr: rated.length ? Math.round(rated.reduce((s, v) => s + v, 0) / rated.length) : 0};
  }
  return {squad: null, ovr: Math.round(strengths(state).get(code) ?? 0)};
}

/** How strong every country is: mostly its real-life level, with the players it has in this game making up the rest. */
function strengths(state: GameState): Map<string, number> {
  const real = new Map(nations(state).map((n) => [n.code, n.strength]));
  const out = new Map<string, number>();
  for (const code of Object.keys(NATIONALITIES)) {
    const base = REAL_LEVEL[code] ?? 48 + (codeHash(code) % 18);
    const players = real.get(code);
    out.set(code, players === undefined ? base : base * 0.6 + players * 0.4);
  }
  return out;
}

/** A match between two countries without the manager: goals by strength; a knockout is settled on penalties. */
function simulate(rng: Rng, a: number, b: number, knockout: boolean): {ga: number; gb: number; aWins: boolean} {
  const ga = poisson(rng, 1.35 * Math.exp((a - b) / 22));
  const gb = poisson(rng, 1.35 * Math.exp((b - a) / 22));
  const aWins = ga !== gb ? ga > gb : knockout ? rng.chance(0.5 + Math.max(-0.2, Math.min(0.2, (a - b) / 100))) : false;
  return {ga, gb, aWins};
}

/** The draw: 32 countries (the strongest, and ours), four pots of eight, one from each in every group. */
function drawGroups(state: GameState, rng: Rng, own: string, comp: Comp = "wc"): string[][] {
  const strength = strengths(state);
  const ranked = [...strength.entries()].sort((x, y) => y[1] - x[1]).map(([code]) => code);
  const size = fieldSize(comp);
  // The World Cup: the strongest 32. A continental tournament: the confederation's own countries first, then the strongest guests.
  const field = comp === "wc"
    ? ranked.slice(0, size)
    : [...ranked.filter((c) => continentalOf(c) === comp), ...ranked.filter((c) => continentalOf(c) !== comp)].slice(0, size);
  if (!field.includes(own)) field[size - 1] = own;
  field.sort((x, y) => strength.get(y)! - strength.get(x)!);
  const per = size / 4;
  const pots = [0, 1, 2, 3].map((p) => field.slice(p * per, p * per + per));
  for (const pot of pots) for (let i = pot.length - 1; i > 0; i--) { const j = rng.int(0, i); [pot[i], pot[j]] = [pot[j], pot[i]]; }
  return Array.from({length: per}, (_, g) => pots.map((pot) => pot[g]));
}

/** The group places in order: points, goal difference, goals scored. */
function standingsOf(group: string[], table: Record<string, {pl: number; gf: number; ga: number; pts: number}>): string[] {
  return [...group].sort((x, y) => table[y].pts - table[x].pts || table[y].gf - table[y].ga - (table[x].gf - table[x].ga) || table[y].gf - table[x].gf);
}

const MATCHDAYS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

type Tournament = NonNullable<NationalJob["tournament"]>;
type Scorer = {key: string; name: string; pos: string; score: number; assist: number};

/** How likely each place is to score and to set up a goal. */
const SCORE_WEIGHT: Record<string, number> = {ST: 10, W: 6, AM: 6, CM: 3, FB: 1, CB: 1, GK: 0.05};
const ASSIST_WEIGHT: Record<string, number> = {ST: 3, W: 7, AM: 8, CM: 5, FB: 3, CB: 0.5, GK: 0.05};
const MADE_UP_PLACES = ["ST", "ST", "W", "W", "AM", "CM", "CM", "FB", "CB", "GK"];

const asScorer = (p: Player): Scorer => ({key: p.id, name: fullName(p), pos: p.position, score: (SCORE_WEIGHT[p.position] ?? 1) * (p.attrs.finishing / 60) ** 2, assist: ASSIST_WEIGHT[p.position] ?? 1});

/** The players of a country who score and set up goals: its own best eleven, or made-up ones when it has no team. */
function scorersOf(state: GameState, country: string): Scorer[] {
  if (nationalPool(state, country).length >= NATION_MIN) {
    return nationalSquad(state, country, "4-3-3").lineup.filter((id) => state.players[id]).map((id) => asScorer(state.players[id]));
  }
  const names = NATIONALITIES[country];
  return MADE_UP_PLACES.map((pos, i) => {
    const r = new Rng(codeHash(country) * 31 + i);
    return {key: `${country}#${i}`, name: names ? `${r.pick(names.first)} ${r.pick(names.last)}` : `${country} ${i + 1}`, pos, score: (SCORE_WEIGHT[pos] ?? 1) * 1.1, assist: ASSIST_WEIGHT[pos] ?? 1};
  });
}

/** A country's goals in a tournament match, handed out to its players (the ones who really scored, where those are known). */
function creditGoals(state: GameState, t: Tournament, rng: Rng, country: string, goals: number, known?: string[]): void {
  if (goals <= 0) return;
  const side = scorersOf(state, country);
  const stats = (t.stats ??= {});
  const entry = (s: Scorer) => (stats[s.key] ??= {name: s.name, country, pos: s.pos, goals: 0, assists: 0});
  for (let i = 0; i < goals; i++) {
    const given = known?.[i] && state.players[known[i]] ? asScorer(state.players[known[i]]) : undefined;
    const scorer = given ?? rng.weighted(side, (s) => s.score);
    entry(scorer).goals++;
    if (rng.chance(0.7)) {
      const others = side.filter((s) => s.key !== scorer.key);
      if (others.length) entry(rng.weighted(others, (s) => s.assist)).assists++;
    }
  }
}

/** The awards when the final has been played: the top scorer, most assists, the best player and the best goalkeeper. */
function tournamentAwards(state: GameState, t: Tournament): void {
  const stats = t.stats ?? {};
  const keys = Object.keys(stats);
  if (keys.length === 0) return;
  const last = (r: number) => new Set((t.rounds?.[r] ?? []).flatMap((p) => [p.a, p.b]));
  const R = t.groups.length === 4 ? 3 : 4;
  const finalists = last(R - 1);
  const semis = last(R - 2);
  const bonus = (c: string) => (c === t.champion ? 6 : finalists.has(c) ? 4 : semis.has(c) ? 2 : 0);
  const top = (score: (k: string) => number) => keys.reduce((best, k) => (score(k) > score(best) ? k : best), keys[0]);
  const scorer = top((k) => stats[k].goals * 10 + stats[k].assists);
  const assists = top((k) => stats[k].assists * 10 + stats[k].goals);
  const player = top((k) => stats[k].goals * 3 + stats[k].assists * 2 + bonus(stats[k].country));
  // The goalkeeper of the semi-finalist that let in the fewest (per match).
  const conceded = (c: string) => {
    let ga = t.table[c]?.ga ?? 0;
    let pl = t.table[c]?.pl ?? 0;
    for (const round of t.rounds ?? []) for (const p of round) if (p.a === c || p.b === c) { ga += p.a === c ? p.gb : p.ga; pl++; }
    return ga / Math.max(1, pl);
  };
  const best = [...semis].sort((x, y) => conceded(x) - conceded(y))[0];
  let keeper: string | undefined;
  if (best) {
    const gk = scorersOf(state, best).find((s) => s.pos === "GK");
    if (gk) {
      stats[gk.key] ??= {name: gk.name, country: best, pos: "GK", goals: 0, assists: 0};
      keeper = gk.key;
    }
  }
  t.awards = {scorer, assists, player, keeper};
}

/** Plays whatever the national team has this week (called once for each week that is played). */
export function nationalWeek(state: GameState, rng: Rng): void {
  const job = state.national;
  if (!job) return;
  const tournament = tournamentOf(state.season, job.country);
  const step = TOURNAMENT_WEEKS.indexOf(state.week);
  const friendly = FRIENDLY_WEEKS.includes(state.week);
  if (friendly) {
    // Played live already: nothing more to do.
    if (recorded(job, state)) return;
    const strength = strengths(state);
    userMatch(state, rng, job, friendlyOpponent(state, job, strength), "friendly", false, strength);
    return;
  }
  if (!tournament || step < 0) return;
  const strength = strengths(state);
  if (step === 0 || !job.tournament || job.tournament.season !== state.season) {
    if (step !== 0) return;
    const groups = drawGroups(state, new Rng(state.season * 7919 + 13), job.country, tournament);
    const table: Record<string, {pl: number; gf: number; ga: number; pts: number}> = {};
    for (const code of groups.flat()) table[code] = {pl: 0, gf: 0, ga: 0, pts: 0};
    job.tournament = {comp: tournament, season: state.season, alive: true, groups, table, bracket: []};
  }
  const t = job.tournament;
  if (t.champion) return;
  // The knockout rounds of this field (three for 16 countries, four for 32): the final is the last of them.
  const size = t.groups.length * 4;
  const rounds = size === 32 ? 4 : 3;
  if (step > 3 + rounds - 1) return;

  if (step <= 2) {
    // A group matchday: every group plays its two matches (ours with the manager's team).
    for (const group of t.groups) {
      for (const [i, j] of MATCHDAYS[step]) {
        const a = group[i];
        const b = group[j];
        let ga: number;
        let gb: number;
        if (t.alive && (a === job.country || b === job.country)) {
          const other = a === job.country ? b : a;
          const r = recorded(job, state) ?? userMatch(state, rng, job, other, `${t.comp}.g`, false, strength);
          [ga, gb] = a === job.country ? r : [r[1], r[0]];
        } else {
          const r = simulate(rng, strength.get(a)!, strength.get(b)!, false);
          [ga, gb] = [r.ga, r.gb];
        }
        const known = t.alive && (a === job.country || b === job.country) ? job.results[0]?.scorers : undefined;
        creditGoals(state, t, rng, a, ga, a === job.country ? known : undefined);
        creditGoals(state, t, rng, b, gb, b === job.country ? known : undefined);
        for (const [code, f, ag] of [[a, ga, gb], [b, gb, ga]] as const) {
          const row = t.table[code];
          row.pl++;
          row.gf += f;
          row.ga += ag;
          row.pts += f > ag ? 3 : f === ag ? 1 : 0;
        }
      }
    }
    if (step === 2) {
      // The two best in each group go on, crossed over between neighbouring groups.
      const top = t.groups.map((g) => standingsOf(g, t.table).slice(0, 2));
      t.bracket = [];
      for (let g = 0; g < t.groups.length; g += 2) t.bracket.push(top[g][0], top[g + 1][1], top[g + 1][0], top[g][1]);
      if (t.alive && !t.bracket.includes(job.country)) {
        t.alive = false;
        addMessage(state, {kind: "news", key: "msg.nationalOut", params: {country: `nat.${job.country}`, comp: `national.comp.${t.comp}`}});
      }
    }
    return;
  }

  // A knockout round: the last sixteen (3), quarter-finals (4), semi-finals (5), the final (6).
  const name = koNames(size)[step - 3];
  const next: string[] = [];
  const round: {a: string; b: string; ga: number; gb: number; w: string}[] = [];
  for (let i = 0; i < t.bracket.length; i += 2) {
    const a = t.bracket[i];
    const b = t.bracket[i + 1];
    let aWins: boolean;
    let ga = 0;
    let gb = 0;
    if (t.alive && (a === job.country || b === job.country)) {
      const other = a === job.country ? b : a;
      const won = recorded(job, state) ?? userMatch(state, rng, job, other, `${t.comp}.${name}`, true, strength);
      const ours = won[0] > won[1] || (won[0] === won[1] && won[2]);
      aWins = a === job.country ? ours : !ours;
      [ga, gb] = a === job.country ? [won[0], won[1]] : [won[1], won[0]];
      if (!ours) {
        t.alive = false;
        addMessage(state, {kind: "news", key: "msg.nationalOut", params: {country: `nat.${job.country}`, comp: `national.comp.${t.comp}`}});
      }
    } else {
      const r = simulate(rng, strength.get(a)!, strength.get(b)!, true);
      aWins = r.aWins;
      ga = r.ga;
      gb = r.gb;
    }
    const known = a === job.country || b === job.country ? job.results[0]?.scorers : undefined;
    creditGoals(state, t, rng, a, ga, a === job.country ? known : undefined);
    creditGoals(state, t, rng, b, gb, b === job.country ? known : undefined);
    round.push({a, b, ga, gb, w: aWins ? a : b});
    next.push(aWins ? a : b);
  }
  t.rounds = [...(t.rounds ?? []), round];
  t.bracket = next;
  if (step === 3 + rounds - 1) {
    t.champion = next[0];
    tournamentAwards(state, t);
    // The manager's country on the podium: the champion, the beaten finalist (silver), a beaten semi-finalist (bronze).
    const lost = (r: number) => (t.rounds?.[r] ?? []).some((p) => (p.a === job.country || p.b === job.country) && p.w !== job.country);
    const place = next[0] === job.country ? 1 : lost(rounds - 1) ? 2 : lost(rounds - 2) ? 3 : 0;
    if (place) collectTrophy(state, `${t.comp}${place}`);
    if (place) state.celebrations = [...(state.celebrations ?? []), {kind: "tournament", season: state.season, comp: t.comp, place: place as 1 | 2 | 3, country: job.country}];
    const ours = next[0] === job.country;
    t.alive = false;
    if (ours) state.monetization.diamonds += TOURNAMENT_WINNER_DIAMONDS;
    addMessage(state, {
      kind: "news",
      key: ours ? "msg.nationalChampion" : "msg.nationalWinner",
      params: {country: `nat.${next[0]}`, comp: `national.comp.${t.comp}`, diamonds: TOURNAMENT_WINNER_DIAMONDS},
      highlight: ours,
    });
    const aw = t.awards;
    const st = t.stats;
    if (aw && st && aw.scorer && aw.assists && aw.player && aw.keeper) {
      addMessage(state, {
        kind: "news",
        key: "msg.tournamentAwards",
        params: {
          comp: `national.comp.${t.comp}`, season: state.season,
          scorer: st[aw.scorer].name, scorerCountry: `nat.${st[aw.scorer].country}`, scorerGoals: st[aw.scorer].goals,
          assister: st[aw.assists].name, assisterCountry: `nat.${st[aw.assists].country}`, assisterN: st[aw.assists].assists,
          player: st[aw.player].name, playerCountry: `nat.${st[aw.player].country}`,
          keeper: st[aw.keeper].name, keeperCountry: `nat.${st[aw.keeper].country}`,
        },
      });
    }
  }
}

/**
 * The national team plays one match: the best eleven against the opponent. Returns [goals for us, goals
 * against, won on penalties] (a drawn knockout goes to penalties).
 */
function userMatch(state: GameState, rng: Rng, job: NationalJob, opponent: string, what: string, knockout: boolean, strength: Map<string, number>): [number, number, boolean] {
  const squad = nationalLineup(state, job);
  const ours = elevenStrength(state, squad.lineup, nationalSlots(job));
  // A more attacking line-up scores and lets in a bit more.
  const attack = job.mentality === "attacking" ? 1.12 : job.mentality === "defensive" ? 0.9 : 1;
  const defence = job.mentality === "attacking" ? 1.1 : job.mentality === "defensive" ? 0.88 : 1;
  const theirs = strength.get(opponent) ?? 55;
  const us = poisson(rng, 1.35 * attack * Math.exp((ours - theirs) / 22));
  const them = poisson(rng, 1.35 * defence * Math.exp((theirs - ours) / 22));
  let pens: [number, number] | undefined;
  let won = us > them;
  if (knockout && us === them) {
    won = rng.chance(0.5 + Math.max(-0.2, Math.min(0.2, (ours - theirs) / 100)));
    pens = won ? [5, rng.int(3, 4)] : [rng.int(3, 4), 5];
  }
  // Who scored: the attackers more often.
  const outfield = squad.lineup.filter((id) => state.players[id] && state.players[id].position !== "GK");
  const scorers: string[] = [];
  for (let i = 0; i < us && outfield.length; i++) {
    const weights = outfield.map((id) => state.players[id].attrs.finishing + (state.players[id].position === "ST" ? 40 : state.players[id].position === "W" || state.players[id].position === "AM" ? 20 : 0));
    scorers.push(rng.weighted(outfield, (id) => weights[outfield.indexOf(id)] ** 2));
  }
  const result: NationalResult = {season: state.season, week: state.week, opponent, what, goals: [us, them], ...(pens ? {pens} : {}), scorers};
  job.results.unshift(result);
  if (job.results.length > 30) job.results.length = 30;
  addMessage(state, {
    kind: "match",
    key: "msg.nationalMatch",
    params: {what: `national.what.${what}`, country: `nat.${job.country}`, opponent: `nat.${opponent}`, score: `${us}–${them}${pens ? ` (${pens[0]}–${pens[1]})` : ""}`},
  });
  return [us, them, won];
}

/** The country the tournament is played in (the same every time it is asked for the season). */
export function tournamentHost(season: number): string {
  return new Rng(season * 97 + 5).pick(Object.keys(NATIONALITIES));
}

/** English names for the countries' teams while they play a match. */
const COUNTRY_NAMES: Record<string, string> = {
  SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland", ES: "Spain", BR: "Brazil", AR: "Argentina", DE: "Germany", NL: "Netherlands", GB: "England",
  FR: "France", US: "USA", IT: "Italy", NG: "Nigeria", PT: "Portugal", BE: "Belgium", HR: "Croatia", PL: "Poland", CH: "Switzerland", AT: "Austria",
  IS: "Iceland", RS: "Serbia", TR: "Turkey", UY: "Uruguay", CO: "Colombia", MX: "Mexico", JP: "Japan", KR: "South Korea", MA: "Morocco", SN: "Senegal",
  GH: "Ghana", CI: "Ivory Coast", CM: "Cameroon",
};

/** Who the friendly is against (the same every time it is asked for this week). */
function friendlyOpponent(state: GameState, job: NationalJob, strength: Map<string, number>, week = state.week): string {
  return new Rng(state.season * 131 + week).pick([...strength.keys()].filter((c) => c !== job.country && (strength.get(c) ?? 0) >= 55));
}

/** What this week's match was, if it has been played live already (goals for us, against, and whether we won). */
function recorded(job: NationalJob, state: GameState): [number, number, boolean] | undefined {
  const r = job.results[0];
  if (!r || r.season !== state.season || r.week !== state.week) return undefined;
  return [r.goals[0], r.goals[1], r.goals[0] > r.goals[1] || (r.goals[0] === r.goals[1] && !!r.pens && r.pens[0] > r.pens[1])];
}

/** The international match to play this week (not played yet), and against whom. */
export function dueNationalMatch(state: GameState): {what: string; opponent: string; knockout: boolean} | null {
  const job = state.national;
  if (!job || state.nationalMatch || state.liveMatch || recorded(job, state)) return null;
  const strength = strengths(state);
  if (FRIENDLY_WEEKS.includes(state.week)) return {what: "friendly", opponent: friendlyOpponent(state, job, strength), knockout: false};
  const tournament = tournamentOf(state.season, job.country);
  const step = TOURNAMENT_WEEKS.indexOf(state.week);
  if (!tournament || step < 0) return null;
  const t = job.tournament && job.tournament.season === state.season ? job.tournament : undefined;
  if (t && (!t.alive || t.champion)) return null;
  const size = t ? t.groups.length * 4 : fieldSize(tournament);
  if (step > 3 + (size === 32 ? 4 : 3) - 1) return null;
  if (step <= 2) {
    const groups = t?.groups ?? drawGroups(state, new Rng(state.season * 7919 + 13), job.country, tournament);
    const group = groups.find((g) => g.includes(job.country));
    if (!group) return null;
    const me = group.indexOf(job.country);
    const pair = MATCHDAYS[step].find(([i, j]) => i === me || j === me);
    if (!pair) return null;
    return {what: `${tournament}.g`, opponent: group[pair[0] === me ? pair[1] : pair[0]], knockout: false};
  }
  const i = t?.bracket.indexOf(job.country) ?? -1;
  if (!t || i < 0) return null;
  return {what: `${tournament}.${koNames(size)[step - 3]}`, opponent: t.bracket[i % 2 === 0 ? i + 1 : i - 1], knockout: true};
}

/** A country as a club for the length of a match (the user's club as the base for everything a club needs). */
function natClub(base: Club, code: string, formation: FormationId, mentality: Club["mentality"], lineup: string[], bench: string[], customSlots?: readonly Slot[]): Club {
  const kit = nationalKit(code);
  return {
    ...structuredClone(base),
    id: `nat:${code}`,
    name: COUNTRY_NAMES[code] ?? code,
    short: code,
    color: kit.color,
    color2: kit.color2,
    color3: undefined,
    away: undefined,
    pattern: kit.pattern,
    collar: undefined,
    sleeves: undefined,
    formation,
    mentality,
    lineup,
    bench,
    roles: undefined,
    customSlots: customSlots?.map((s) => ({...s})),
    officialName: undefined,
    stadium: undefined,
    installments: [],
    loan: undefined,
    guest: true,
    country: code,
  };
}

/**
 * Sets up this week's national match to be played live, like any other: the two countries become clubs for the
 * match, the manager's country is "the user's club" while it lasts, and a live match is started. An error key, or null.
 */
export function startNationalMatch(state: GameState, rng: Rng): string | null {
  const job = state.national;
  const due = dueNationalMatch(state);
  if (!job || !due) return "national.nothing";
  const strength = strengths(state);
  const base = state.clubs[state.userClubId];
  const ours = nationalLineup(state, job);
  // The other country: its own players if it has a team, otherwise a squad made up for the match.
  const tempPlayers: string[] = [];
  let theirs: {lineup: string[]; bench: string[]};
  if (nationalPool(state, due.opponent).length >= NATION_MIN) {
    theirs = nationalSquad(state, due.opponent, "4-4-2");
  } else {
    const level = strength.get(due.opponent) ?? 55;
    const names = NATIONALITIES[due.opponent];
    const positions: Position[] = ["GK", "CB", "CB", "FB", "FB", "W", "CM", "CM", "W", "ST", "ST", "GK", "CB", "CM", "W", "ST"];
    const made = positions.map((position) => {
      const p = createPlayer(state, rng, {position, level: Math.round(level + rng.range(-3, 3)), age: rng.int(22, 32), clubId: null, season: state.season});
      p.nationality = due.opponent;
      if (names) {
        p.firstName = rng.pick(names.first);
        p.lastName = rng.pick(names.last);
      }
      tempPlayers.push(p.id);
      return p;
    });
    theirs = pickBestLineup(state, {id: `nat:${due.opponent}`} as never, FORMATIONS["4-4-2"], made);
  }
  const mine = natClub(base, job.country, job.formation, job.mentality, ours.lineup, ours.bench, job.customSlots);
  const other = natClub(base, due.opponent, "4-4-2", "balanced", theirs.lineup, theirs.bench);
  state.clubs[mine.id] = mine;
  state.clubs[other.id] = other;
  const fixture: CupFixture = {id: `nat-${state.season}-${state.week}`, round: 0, homeId: mine.id, awayId: other.id, played: false, homeGoals: 0, awayGoals: 0, stage: due.knockout ? 3 : 0};
  state.nationalMatch = {realClubId: state.userClubId, fixture, what: due.what, opponent: due.opponent, knockout: due.knockout, tempPlayers};
  state.userClubId = mine.id;
  state.liveMatch = {fixtureId: fixture.id, seed: rng.int(1, 2 ** 31 - 1), inputs: {}, commands: [], engine: ENGINE.mode};
  return null;
}

/** The live national match is over: counted, written into the country's results, and everything put back as it was. */
export function finishNationalMatch(state: GameState, rng: Rng): void {
  void rng;
  const nm = state.nationalMatch;
  const live = state.liveMatch;
  const job = state.national;
  if (!nm || !live) return;
  const f = nm.fixture;
  const report = simulateMatch(state, new Rng(live.seed), f, true, live.inputs, live.commands ?? [], "home", live.engine);
  const us = report.homeGoals;
  const them = report.awayGoals;
  const pens = f.penalties && us === them ? ([f.penalties[0], f.penalties[1]] as [number, number]) : undefined;
  const scorers = report.events.filter((e) => e.type === "goal" && e.side === "home" && e.playerId).map((e) => e.playerId!);
  // Put everything back.
  state.userClubId = nm.realClubId;
  for (const id of [`nat:${job?.country ?? ""}`, `nat:${nm.opponent}`]) delete state.clubs[id];
  for (const id of nm.tempPlayers) delete state.players[id];
  state.nationalMatch = undefined;
  state.liveMatch = null;
  if (!job) return;
  const result: NationalResult = {season: state.season, week: state.week, opponent: nm.opponent, what: nm.what, goals: [us, them], ...(pens ? {pens} : {}), scorers};
  job.results.unshift(result);
  if (job.results.length > 30) job.results.length = 30;
  addMessage(state, {
    kind: "match",
    key: "msg.nationalMatch",
    params: {what: `national.what.${nm.what}`, country: `nat.${job.country}`, opponent: `nat.${nm.opponent}`, score: `${us}–${them}${pens ? ` (${pens[0]}–${pens[1]})` : ""}`},
  });
}

/** The international matches still to come this season (the opponent where it is known by now). */
export function upcomingNational(state: GameState): {week: number; what: string; opponent?: string}[] {
  const job = state.national;
  if (!job) return [];
  const strength = strengths(state);
  const out: {week: number; what: string; opponent?: string}[] = [];
  const playedWeek = (week: number) => job.results.some((r) => r.season === state.season && r.week === week);
  for (const week of FRIENDLY_WEEKS) if (week >= state.week && !playedWeek(week)) out.push({week, what: "friendly", opponent: friendlyOpponent(state, job, strength, week)});
  const tournament = tournamentOf(state.season, job.country);
  const t = job.tournament && job.tournament.season === state.season ? job.tournament : undefined;
  if (tournament && (!t || (t.alive && !t.champion))) {
    const nextKnockout = 3 + (t?.rounds?.length ?? 0);
    const size = t ? t.groups.length * 4 : fieldSize(tournament);
    const lastStep = 3 + (size === 32 ? 4 : 3) - 1;
    TOURNAMENT_WEEKS.forEach((week, step) => {
      if (week < state.week || playedWeek(week) || step > lastStep) return;
      if (step <= 2) {
        const groups = t?.groups ?? drawGroups(state, new Rng(state.season * 7919 + 13), job.country, tournament);
        const group = groups.find((g) => g.includes(job.country));
        const me = group?.indexOf(job.country) ?? -1;
        const pair = MATCHDAYS[step].find(([i, j]) => i === me || j === me);
        out.push({week, what: `${tournament}.g`, opponent: group && pair ? group[pair[0] === me ? pair[1] : pair[0]] : undefined});
      } else {
        const i = step === nextKnockout ? (t?.bracket.indexOf(job.country) ?? -1) : -1;
        out.push({week, what: `${tournament}.${koNames(size)[step - 3]}`, opponent: i >= 0 ? t!.bracket[i % 2 === 0 ? i + 1 : i - 1] : undefined});
      }
    });
  }
  return out.sort((x, y) => x.week - y.week);
}

/** The week (of this season) of the next international match, if there is one left. */
export function nextNationalWeek(state: GameState): {week: number; what: "friendly" | Comp} | null {
  const job = state.national;
  const t = tournamentOf(state.season, job?.country);
  const options: {week: number; what: "friendly" | Comp}[] = [
    ...FRIENDLY_WEEKS.map((week) => ({week, what: "friendly" as const})),
    ...(t && (!job?.tournament || job.tournament.season !== state.season || job.tournament.alive) ? [{week: TOURNAMENT_WEEKS[0], what: t}] : []),
  ];
  return options.filter((o) => o.week >= state.week).sort((a, b) => a.week - b.week)[0] ?? null;
}

