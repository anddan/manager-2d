// Fixtures and the league table.
import {newId} from "./helpers";
import type {Rng} from "./rng";
import type {Club, Fixture, GameState} from "./types";

/** Double round robin with the circle method; second half mirrors the first. */
export function makeFixtures(state: GameState, rng: Rng, clubIds: string[]): Fixture[] {
  const ids = rng.shuffle([...clubIds]);
  const n = ids.length;
  const firstHalf: [string, string][][] = [];
  const rotating = ids.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    const order = [ids[0], ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      // Alternate home and away so nobody plays five home games in a row.
      round.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    firstHalf.push(round);
    rotating.unshift(rotating.pop()!);
  }
  const rounds = [...firstHalf, ...firstHalf.map((round) => round.map(([h, a]) => [a, h] as [string, string]))];
  return rounds.flatMap((round, r) =>
    round.map(([homeId, awayId]) => ({
      id: newId(state, "f"),
      round: r + 1,
      homeId,
      awayId,
      played: false,
      homeGoals: 0,
      awayGoals: 0,
    }))
  );
}

export interface TableRow {
  club: Club;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Last results, newest last: "W" | "D" | "L". */
  form: string[];
}

export function standings(state: GameState): TableRow[] {
  const rows: Record<string, TableRow> = {};
  for (const club of Object.values(state.clubs)) {
    rows[club.id] = {club, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: []};
  }
  const played = state.fixtures.filter((f) => f.played).sort((a, b) => a.round - b.round);
  for (const f of played) {
    const home = rows[f.homeId];
    const away = rows[f.awayId];
    home.played++;
    away.played++;
    home.goalsFor += f.homeGoals;
    home.goalsAgainst += f.awayGoals;
    away.goalsFor += f.awayGoals;
    away.goalsAgainst += f.homeGoals;
    if (f.homeGoals > f.awayGoals) {
      home.won++; home.points += 3; away.lost++;
      home.form.push("W"); away.form.push("L");
    } else if (f.homeGoals < f.awayGoals) {
      away.won++; away.points += 3; home.lost++;
      home.form.push("L"); away.form.push("W");
    } else {
      home.drawn++; away.drawn++; home.points++; away.points++;
      home.form.push("D"); away.form.push("D");
    }
  }
  return Object.values(rows)
    .map((row) => ({...row, form: row.form.slice(-5)}))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
        b.goalsFor - a.goalsFor ||
        a.club.name.localeCompare(b.club.name)
    );
}

export function leaguePosition(state: GameState, clubId: string): number {
  return standings(state).findIndex((row) => row.club.id === clubId) + 1;
}

/** Points per game over the last five, 0..3. */
export function recentPointsPerGame(state: GameState, clubId: string): number {
  const recent = state.fixtures
    .filter((f) => f.played && (f.homeId === clubId || f.awayId === clubId))
    .sort((a, b) => b.round - a.round)
    .slice(0, 5);
  if (recent.length === 0) return 1.4;
  const points = recent.reduce((sum, f) => {
    const mine = f.homeId === clubId ? f.homeGoals : f.awayGoals;
    const theirs = f.homeId === clubId ? f.awayGoals : f.homeGoals;
    return sum + (mine > theirs ? 3 : mine === theirs ? 1 : 0);
  }, 0);
  return points / recent.length;
}
