// Local saves in localStorage, plus file export/import as a backup.
import {upgradeTutorial} from "./tutorial";
import {SAVE_VERSION, SEASON_WEEKS} from "./constants";
import {roundInWeek} from "./helpers";
import type {GameState} from "./types";

const SAVE_KEY = "manager2d.save";

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Storage full or blocked (private mode); the game keeps running.
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? parseSave(raw) : null;
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do.
  }
}

/** Validates a save string; returns null for anything that isn't ours. */
export function parseSave(raw: string): GameState | null {
  try {
    const state = JSON.parse(raw) as GameState;
    if (state?.version !== SAVE_VERSION || !state.clubs || !state.players) return null;
    migrate(state);
    return state;
  } catch {
    return null;
  }
}

/**
 * Brings an older save up to date. A Champions Cup from before the group stage
 * is dropped: a new one with groups is drawn if the season is early enough,
 * otherwise from next season.
 */
function migrate(state: GameState): void {
  upgradeTutorial(state);
  if (state.cup && !state.cup.groups) {
    const cupIds = new Set(state.cup.fixtures.map((f) => f.id));
    if (state.liveMatch && cupIds.has(state.liveMatch.fixtureId)) state.liveMatch = null;
    state.cup = undefined;
    // The cup weeks moved, so the calendar did too: carry on from the next league round to play.
    const played = Math.max(0, ...state.fixtures.filter((f) => f.played).map((f) => f.round));
    if (played > 0) {
      const next = played + 1;
      let week = SEASON_WEEKS;
      for (let w = 1; w <= SEASON_WEEKS; w++) {
        if (roundInWeek(w) === next) {
          week = w;
          break;
        }
      }
      state.week = week;
    }
  }
}
