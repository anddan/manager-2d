// The national team. After a title (the league or the Champions Cup) a country may ask the manager to
// be its national coach, next to the club. The squad is the country's best players, whatever club they
// play for, picked automatically for the formation the manager chooses. The team plays a few friendlies a
// year, and a knockout tournament (the Euros in the years after a World Cup's two years, the World Cup
// every fourth year) in the last weeks of the season. Matches are played out in the background.
import {FORMATIONS, SEASON_WEEKS} from "./constants";
import {addMessage} from "./helpers";
import {isAvailable, pickBestLineup} from "./lineup";
import {effectiveRating, overall} from "./ratings";
import type {Rng} from "./rng";
import type {FormationId, GameState, NationalResult, Player} from "./types";

/** A country needs this many players in the game to have a team. */
const NATION_MIN = 14;
/** The weeks of the season with a friendly. */
export const FRIENDLY_WEEKS = [8, 18];
/** The tournament's quarter-final, semi-final and final: the last three weeks of the season. */
export const TOURNAMENT_WEEKS = [SEASON_WEEKS - 2, SEASON_WEEKS - 1, SEASON_WEEKS];
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

/** Plays whatever the national team has this week (called once for each week that is played). */
export function nationalWeek(state: GameState, rng: Rng): void {
  const job = state.national;
  if (!job) return;
  const tournament = tournamentOf(state.season);
  const round = TOURNAMENT_WEEKS.indexOf(state.week);
  const friendly = FRIENDLY_WEEKS.includes(state.week);
  if (!friendly && !(tournament && round >= 0)) return;

  const field = nations(state);
  if (field.length < 2) return;
  const rank = (code: string) => field.findIndex((n) => n.code === code);
  const strengthOf = (code: string) => field[rank(code)]?.strength ?? 50;

  // The tournament: the eight strongest countries (ours instead of the eighth if it is not one of them).
  if (tournament && round >= 0) {
    if (round === 0 || !job.tournament || job.tournament.season !== state.season) {
      const eight = field.slice(0, 8).map((n) => n.code);
      if (!eight.includes(job.country)) eight[7] = job.country;
      const rivals = eight.filter((c) => c !== job.country).sort(() => rng.next() - 0.5).slice(0, 3);
      job.tournament = {comp: tournament, season: state.season, rivals, alive: true};
    }
    if (!job.tournament.alive) return;
  }

  const opponent = tournament && round >= 0 ? job.tournament!.rivals[round] : rng.pick(field.filter((n) => n.code !== job.country).slice(0, 20)).code;
  const squad = nationalSquad(state, job.country, job.formation);
  const ours = elevenStrength(state, squad.lineup, job.formation);
  // A more attacking line-up scores and lets in a bit more.
  const attack = job.mentality === "attacking" ? 1.12 : job.mentality === "defensive" ? 0.9 : 1;
  const defence = job.mentality === "attacking" ? 1.1 : job.mentality === "defensive" ? 0.88 : 1;
  const theirs = strengthOf(opponent);
  const us = poisson(rng, 1.35 * attack * Math.exp((ours - theirs) / 22));
  const them = poisson(rng, 1.35 * defence * Math.exp((theirs - ours) / 22));
  const knockout = tournament && round >= 0;
  let pens: [number, number] | undefined;
  let won = us > them;
  if (knockout && us === them) {
    const edge = 0.5 + Math.max(-0.2, Math.min(0.2, (ours - theirs) / 100));
    won = rng.chance(edge);
    pens = won ? [5, rng.int(3, 4)] : [rng.int(3, 4), 5];
  }
  // Who scored: the attackers more often.
  const outfield = squad.lineup.filter((id) => state.players[id] && state.players[id].position !== "GK");
  const scorers: string[] = [];
  for (let i = 0; i < us && outfield.length; i++) {
    const weights = outfield.map((id) => state.players[id].attrs.finishing + (state.players[id].position === "ST" ? 40 : state.players[id].position === "W" || state.players[id].position === "AM" ? 20 : 0));
    scorers.push(rng.weighted(outfield, (id) => weights[outfield.indexOf(id)] ** 2));
  }
  const what = knockout ? `${job.tournament!.comp}.${["qf", "sf", "final"][round]}` : "friendly";
  const result: NationalResult = {season: state.season, week: state.week, opponent, what, goals: [us, them], ...(pens ? {pens} : {}), scorers};
  job.results.unshift(result);
  if (job.results.length > 30) job.results.length = 30;
  const decided = knockout || us !== them;
  addMessage(state, {
    kind: "match",
    key: "msg.nationalMatch",
    params: {what: `national.what.${what}`, country: `nat.${job.country}`, opponent: `nat.${opponent}`, score: `${us}–${them}${pens ? ` (${pens[0]}–${pens[1]})` : ""}`},
  });
  if (!decided) return;
  if (knockout) {
    if (!won) {
      job.tournament!.alive = false;
      addMessage(state, {kind: "news", key: "msg.nationalOut", params: {country: `nat.${job.country}`, comp: `national.comp.${job.tournament!.comp}`}});
    } else if (round === 2) {
      job.tournament!.alive = false;
      state.monetization.diamonds += TOURNAMENT_WINNER_DIAMONDS;
      addMessage(state, {kind: "news", key: "msg.nationalChampion", params: {country: `nat.${job.country}`, comp: `national.comp.${job.tournament!.comp}`, diamonds: TOURNAMENT_WINNER_DIAMONDS}, highlight: true});
    }
  }
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

