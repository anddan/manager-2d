// App state: the game save plus UI state (current view, open dialogs).
// Every game change goes through `act`, which works on a copy, keeps the
// random sequence going and autosaves.
import {create} from "zustand";
import type {Negotiation} from "./game/contracts";
import {newGame} from "./game/generate";
import {Rng} from "./game/rng";
import {deleteSave, loadGame, saveGame} from "./game/save";
import type {GameState, ManagerLook, PlayersGender} from "./game/types";
import type {Lang, Params} from "./i18n";

export const VIEWS = [
  "overview",
  "inbox",
  "squad",
  "tactics",
  "training",
  "fixtures",
  "table",
  "transfers",
  "contracts",
  "finance",
  "shop",
  "settings",
] as const;
export type View = (typeof VIEWS)[number];

export interface Toast {
  key: string;
  params?: Params;
  tone: "info" | "good" | "error";
}

interface Store {
  game: GameState | null;
  lang: Lang;
  view: View;
  playerId: string | null;
  matchFixtureId: string | null;
  negotiation: Negotiation | null;
  toast: Toast | null;
  setLang: (lang: Lang) => void;
  setView: (view: View) => void;
  openPlayer: (id: string | null) => void;
  watchMatch: (fixtureId: string | null) => void;
  setNegotiation: (neg: Negotiation | null) => void;
  notify: (key: string, params?: Params, tone?: Toast["tone"]) => void;
  act: <R>(fn: (game: GameState, rng: Rng) => R) => R;
  start: (managerName: string, clubIndex: number, look?: ManagerLook, playersGender?: PlayersGender, leagueId?: string) => void;
  replace: (game: GameState) => void;
  quit: () => void;
}

const LANG_KEY = "manager2d.lang";

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "sv" || saved === "en" || saved === "es") return saved;
  } catch {
    // Fall through to the browser language.
  }
  const nav = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "sv";
  return nav === "es" ? "es" : nav === "en" ? "en" : "sv";
}

export const useGame = create<Store>((set, get) => ({
  game: loadGame(),
  lang: loadLang(),
  view: "overview",
  playerId: null,
  matchFixtureId: null,
  negotiation: null,
  toast: null,
  setLang: (lang) => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // Not remembered, still switched.
    }
    document.documentElement.lang = lang;
    set({lang});
  },
  setView: (view) => set({view, playerId: null}),
  openPlayer: (playerId) => set({playerId}),
  watchMatch: (matchFixtureId) => set({matchFixtureId}),
  setNegotiation: (negotiation) => set({negotiation}),
  notify: (key, params, tone = "info") => set({toast: {key, params, tone}}),
  act: (fn) => {
    const current = get().game;
    if (!current) throw new Error("No game loaded");
    const draft = structuredClone(current);
    const rng = new Rng(draft.rngState);
    const result = fn(draft, rng);
    draft.rngState = rng.state;
    saveGame(draft);
    set({game: draft});
    return result;
  },
  start: (managerName, clubIndex, look, playersGender, leagueId) => {
    const game = newGame(managerName, clubIndex, (Math.random() * 2 ** 32) >>> 0, look, playersGender, leagueId);
    saveGame(game);
    set({game, view: "overview"});
  },
  replace: (game) => {
    saveGame(game);
    set({game, view: "overview", playerId: null, matchFixtureId: null, negotiation: null});
  },
  quit: () => {
    deleteSave();
    set({game: null, playerId: null, matchFixtureId: null, negotiation: null});
  },
}));

/** The loaded game; only use inside screens that render with a game. */
export function useGameState(): GameState {
  return useGame((s) => s.game)!;
}
