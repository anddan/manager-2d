// The weather and the time of day for a match: only for show (small icons by the match), but it follows the
// season (cold in the middle of it, mild at both ends), the country the league is in (colder up north,
// warmer in the south) and the time of day (cooler in the evening). Picked from the match itself, so it is the
// same every time it is looked at.
import {SEASON_WEEKS} from "./constants";
import {LEAGUES} from "./leagues";
import {Rng} from "./rng";

export type Weather = "sun" | "cloud" | "rain" | "wind" | "snow";

export interface Conditions {
  weather: Weather;
  /** Degrees. */
  temp: number;
  /** Kick-off, "15:00". */
  time: string;
}

/** Kick-off times, and how much cooler (or warmer) they are than the afternoon. */
const TIMES: [string, number][] = [["13:00", 1], ["15:00", 0], ["16:00", 0], ["18:00", -2], ["19:30", -3], ["20:45", -4]];

/** How much warmer or colder than the middle a country is. */
const NORTH = ["SE", "NO", "DK", "FI", "IS"];
const SOUTH = ["IT", "ES", "PT", "TR", "AR", "BR", "MX", "MA", "UY", "CO", "NG", "GH", "SN", "CI", "CM"];
export function climateOf(country?: string): number {
  if (!country) return 0;
  return NORTH.includes(country) ? -5 : SOUTH.includes(country) ? 5 : 0;
}

/** The country a league is in (its flag). */
export const leagueCountry = (leagueId?: string): string | undefined => LEAGUES.find((l) => l.id === (leagueId ?? "nordic"))?.flag;

function seedOf(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function matchConditions(fixtureId: string, week: number, country?: string): Conditions {
  const rng = new Rng(seedOf(`${fixtureId}:${week}`));
  const [time, evening] = rng.pick(TIMES);
  // The season runs from August to May: the middle of it is the coldest.
  const f = Math.min(1, Math.max(0, (week - 1) / (SEASON_WEEKS - 1)));
  const month = 7.5 + f * 10;
  const seasonal = 10 + 10 * Math.cos((2 * Math.PI * (month - 6.5)) / 12);
  const temp = Math.round(seasonal + climateOf(country) + evening + rng.range(-3, 3));
  const warm = temp >= 14;
  const weather = rng.weighted<[Weather, number]>(
    [
      ["sun", warm ? 40 : 18],
      ["cloud", 30],
      ["rain", warm ? 14 : 24],
      ["wind", 9],
      ["snow", temp <= 1 ? 30 : 0],
    ],
    ([, w]) => w
  )[0];
  return {weather, temp, time};
}

/** How light it is at kick-off, 1 in the afternoon down to 0 on a late evening: dusk in between (18:00 is about half). */
export function daylightOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const hour = (h || 0) + (m || 0) / 60;
  if (hour <= 16) return 1;
  if (hour <= 18) return 1 - ((hour - 16) / 2) * 0.55;
  if (hour <= 19.5) return 0.45 - ((hour - 18) / 1.5) * 0.4;
  return Math.max(0, 0.05 - ((hour - 19.5) / 1.5) * 0.05);
}
