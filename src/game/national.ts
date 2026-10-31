// The national team. After a title (the league or the Champions Cup) a country may ask the manager to
// be its national coach, next to the club. The squad is the country's best players, whatever club they
// play for, picked automatically for the formation the manager chooses. The team plays a few friendlies a
// year, and a knockout tournament (the Euros in the years after a World Cup's two years, the World Cup
// every fourth year) in the last weeks of the season. Matches are played out in the background.
import {FORMATIONS, SEASON_WEEKS} from "./constants";
import {NATIONALITIES} from "./names";
import {addMessage} from "./helpers";
import {isAvailable, pickBestLineup} from "./lineup";
import {effectiveRating, overall} from "./ratings";
import type {Rng} from "./rng";
import type {FormationId, GameState, NationalJob, NationalResult, Player} from "./types";

/** A country needs this many players in the game to have a team. */
const NATION_MIN = 14;
/** The weeks of the season with a friendly. */
export const FRIENDLY_WEEKS = [8, 18];
/** The tournament: three group matches, then the last sixteen, quarter-finals, semi-finals and final, in the last seven weeks of the season. */
export const TOURNAMENT_WEEKS = [SEASON_WEEKS - 6, SEASON_WEEKS - 5, SEASON_WEEKS - 4, SEASON_WEEKS - 3, SEASON_WEEKS - 2, SEASON_WEEKS - 1, SEASON_WEEKS];
const KNOCKOUT_NAMES = ["r16", "qf", "sf", "final"];
export const TOURNAMENT_WINNER_DIAMONDS = 30;

/** Which tournament a season has, if any: the World Cup every fourth year, the Euros two years after it. */
export function tournamentOf(season: number): "wc" | "ec" | null {
  return season % 4 === 0 ? "wc" : season % 4 === 2 ? "ec" : null;
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
export function nationalSquad(state: GameState, country: string, formation: FormationId): {lineup: string[]; bench: string[]} {
  return pickBestLineup(state, {id: `nat:${country}`} as never, FORMATIONS[formation], nationalPool(state, country));
}

/** The colours of a country's shirt (the same every time). */
const KITS: [string, string][] = [
  ["#1d4ed8", "#facc15"], ["#dc2626", "#ffffff"], ["#16a34a", "#ffffff"], ["#facc15", "#1d4ed8"], ["#ffffff", "#dc2626"], ["#0f172a", "#f97316"],
  ["#7c3aed", "#fde047"], ["#0ea5e9", "#ffffff"], ["#ea580c", "#0f172a"], ["#be123c", "#facc15"], ["#047857", "#fde047"], ["#1e3a8a", "#ffffff"],
];
export function nationalKit(country: string): {color: string; color2: string} {
  let h = 5;
  for (const c of country) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  const [color, color2] = KITS[h % KITS.length];
  return {color, color2};
}

/** How strong the national eleven is: their average rating in the places they fill. */
function elevenStrength(state: GameState, ids: string[], formation: FormationId): number {
  const slots = FORMATIONS[formation];
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
  addMessage(state, {kind: "news", key: "msg.nationalOffer", params: {country: `nat.${country}`}, action: {type: "nationalOffer", country}, highlight: true});
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

/** How strong every country is: the ones with a real team by their players, the rest by a fixed made-up level. */
function strengths(state: GameState): Map<string, number> {
  const real = new Map(nations(state).map((n) => [n.code, n.strength]));
  const out = new Map<string, number>();
  for (const code of Object.keys(NATIONALITIES)) out.set(code, real.get(code) ?? 48 + (codeHash(code) % 18));
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
function drawGroups(state: GameState, rng: Rng, own: string): string[][] {
  const strength = strengths(state);
  const ranked = [...strength.entries()].sort((x, y) => y[1] - x[1]).map(([code]) => code);
  const field = ranked.slice(0, 32);
  if (!field.includes(own)) field[31] = own;
  field.sort((x, y) => strength.get(y)! - strength.get(x)!);
  const pots = [0, 1, 2, 3].map((p) => field.slice(p * 8, p * 8 + 8));
  for (const pot of pots) for (let i = pot.length - 1; i > 0; i--) { const j = rng.int(0, i); [pot[i], pot[j]] = [pot[j], pot[i]]; }
  return Array.from({length: 8}, (_, g) => pots.map((pot) => pot[g]));
}

/** The group places in order: points, goal difference, goals scored. */
function standingsOf(group: string[], table: Record<string, {pl: number; gf: number; ga: number; pts: number}>): string[] {
  return [...group].sort((x, y) => table[y].pts - table[x].pts || table[y].gf - table[y].ga - (table[x].gf - table[x].ga) || table[y].gf - table[x].gf);
}

const MATCHDAYS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

/** Plays whatever the national team has this week (called once for each week that is played). */
export function nationalWeek(state: GameState, rng: Rng): void {
  const job = state.national;
  if (!job) return;
  const tournament = tournamentOf(state.season);
  const step = TOURNAMENT_WEEKS.indexOf(state.week);
  const friendly = FRIENDLY_WEEKS.includes(state.week);
  if (friendly) {
    const strength = strengths(state);
    const opponent = rng.pick([...strength.keys()].filter((c) => c !== job.country && (strength.get(c) ?? 0) >= 55));
    userMatch(state, rng, job, opponent, "friendly", false, strength);
    return;
  }
  if (!tournament || step < 0) return;
  const strength = strengths(state);
  if (step === 0 || !job.tournament || job.tournament.season !== state.season) {
    if (step !== 0) return;
    const groups = drawGroups(state, rng, job.country);
    const table: Record<string, {pl: number; gf: number; ga: number; pts: number}> = {};
    for (const code of groups.flat()) table[code] = {pl: 0, gf: 0, ga: 0, pts: 0};
    job.tournament = {comp: tournament, season: state.season, alive: true, groups, table, bracket: []};
  }
  const t = job.tournament;
  if (t.champion) return;

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
          const r = userMatch(state, rng, job, other, `${t.comp}.g`, false, strength);
          [ga, gb] = a === job.country ? r : [r[1], r[0]];
        } else {
          const r = simulate(rng, strength.get(a)!, strength.get(b)!, false);
          [ga, gb] = [r.ga, r.gb];
        }
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
      for (let g = 0; g < 8; g += 2) t.bracket.push(top[g][0], top[g + 1][1], top[g + 1][0], top[g][1]);
      if (t.alive && !t.bracket.includes(job.country)) {
        t.alive = false;
        addMessage(state, {kind: "news", key: "msg.nationalOut", params: {country: `nat.${job.country}`, comp: `national.comp.${t.comp}`}});
      }
    }
    return;
  }

  // A knockout round: the last sixteen (3), quarter-finals (4), semi-finals (5), the final (6).
  const name = KNOCKOUT_NAMES[step - 3];
  const next: string[] = [];
  for (let i = 0; i < t.bracket.length; i += 2) {
    const a = t.bracket[i];
    const b = t.bracket[i + 1];
    let aWins: boolean;
    if (t.alive && (a === job.country || b === job.country)) {
      const other = a === job.country ? b : a;
      const won = userMatch(state, rng, job, other, `${t.comp}.${name}`, true, strength);
      const ours = won[0] > won[1] || (won[0] === won[1] && won[2]);
      aWins = a === job.country ? ours : !ours;
      if (!ours) {
        t.alive = false;
        addMessage(state, {kind: "news", key: "msg.nationalOut", params: {country: `nat.${job.country}`, comp: `national.comp.${t.comp}`}});
      }
    } else aWins = simulate(rng, strength.get(a)!, strength.get(b)!, true).aWins;
    next.push(aWins ? a : b);
  }
  t.bracket = next;
  if (step === 6) {
    t.champion = next[0];
    const ours = next[0] === job.country;
    t.alive = false;
    if (ours) state.monetization.diamonds += TOURNAMENT_WINNER_DIAMONDS;
    addMessage(state, {
      kind: "news",
      key: ours ? "msg.nationalChampion" : "msg.nationalWinner",
      params: {country: `nat.${next[0]}`, comp: `national.comp.${t.comp}`, diamonds: TOURNAMENT_WINNER_DIAMONDS},
      highlight: ours,
    });
  }
}

/**
 * The national team plays one match: the best eleven against the opponent. Returns [goals for us, goals
 * against, won on penalties] (a drawn knockout goes to penalties).
 */
function userMatch(state: GameState, rng: Rng, job: NationalJob, opponent: string, what: string, knockout: boolean, strength: Map<string, number>): [number, number, boolean] {
  const squad = nationalSquad(state, job.country, job.formation);
  const ours = elevenStrength(state, squad.lineup, job.formation);
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

/** The week (of this season) of the next international match, if there is one left. */
export function nextNationalWeek(state: GameState): {week: number; what: "friendly" | "wc" | "ec"} | null {
  const t = tournamentOf(state.season);
  const job = state.national;
  const options: {week: number; what: "friendly" | "wc" | "ec"}[] = [
    ...FRIENDLY_WEEKS.map((week) => ({week, what: "friendly" as const})),
    ...(t && (!job?.tournament || job.tournament.season !== state.season || job.tournament.alive) ? [{week: TOURNAMENT_WEEKS[0], what: t}] : []),
  ];
  return options.filter((o) => o.week >= state.week).sort((a, b) => a.week - b.week)[0] ?? null;
}

