// Local saves in localStorage, plus file export/import as a backup.
import {SAVE_VERSION} from "./constants";
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
    return state;
  } catch {
    return null;
  }
}
