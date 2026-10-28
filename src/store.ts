// App state: the game save plus UI state (current view, open dialogs).
// Every game change goes through `act`, which works on a copy, keeps the
// random sequence going and autosaves.
import {TUTORIAL_VERSION} from "./game/tutorial";
import {create} from "zustand";
import {createContext, useContext} from "react";
import type {Negotiation} from "./game/contracts";
import {newGame} from "./game/generate";
import {Rng} from "./game/rng";
import {deleteSave, loadGame, saveGame} from "./game/save";
import type {GameState, ManagerLook, PlayersGender} from "./game/types";
import type {Params} from "./i18n";
import {LANGS, type Lang} from "./i18n/langs";

export const VIEWS = [
  "overview",
  "inbox",
  "squad",
  "tactics",
  "training",
  "fixtures",
  "table",
  "cup",
  "friends",
  "pals",
  "stadium",
  "transfers",
  "codes",
  "contracts",
  "finance",
  "storage",
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
  /** The tactics spot the open profile was opened from (it can then take them out of it). */
  profileSlot: number | null;
  matchFixtureId: string | null;
  negotiation: Negotiation | null;
  toast: Toast | null;
  setLang: (lang: Lang) => void;
  setView: (view: View) => void;
  openPlayer: (id: string | null, slot?: number) => void;
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
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  } catch {
    // Fall through to the browser language.
  }
  // The browser's language if the game speaks it, otherwise Swedish.
  const nav = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "sv";
  return (LANGS as readonly string[]).includes(nav) ? (nav as Lang) : "sv";
}

export const useGame = create<Store>((set, get) => ({
  game: loadGame(),
  lang: loadLang(),
  view: "overview",
  playerId: null,
  profileSlot: null,
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
  openPlayer: (playerId, slot) => set({playerId, profileSlot: slot ?? null}),
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
    // New players get the guide.
    game.tutorial = {step: 0, v: TUTORIAL_VERSION};
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

/** A game lent to the screens inside it instead of the saved one (a friends' cup match being watched). */
export const GameOverride = createContext<GameState | null>(null);

/** The loaded game (or one lent by GameOverride); only use inside screens that render with a game. */
export function useGameState(): GameState {
  const lent = useContext(GameOverride);
  const game = useGame((s) => s.game);
  return (lent ?? game)!;
}
