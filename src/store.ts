// App state: the game save plus UI state (current view, open dialogs).
// Every game change goes through `act`, which works on a copy, keeps the
// random sequence going and autosaves.
import {TUTORIAL_VERSION} from "./game/tutorial";
import {create} from "zustand";
import {createContext, useContext} from "react";
import type {Negotiation} from "./game/contracts";
import {newGame} from "./game/generate";
import {fixShirts} from "./game/shirts";
import {Rng} from "./game/rng";
import {addSpending, thisWeek} from "./game/spending";
import {topUpMansions} from "./game/morale";
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
  "national",
  "tournament",
  "pals",
  "stadium",
  "transfers",
  "codes",
  "contracts",
  "finance",
  "storage",
  "album",
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
  /** The slot belongs to the national eleven, not the club's. */
  profileNational: boolean;
  matchFixtureId: string | null;
  negotiation: Negotiation | null;
  toast: Toast | null;
  setLang: (lang: Lang) => void;
  setView: (view: View) => void;
  openPlayer: (id: string | null, slot?: number, national?: boolean) => void;
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

const savedGame = (() => {
  const g = loadGame();
  if (g) fixShirts(g);
  return g;
})();

export const useGame = create<Store>((set, get) => ({
  game: savedGame,
  lang: loadLang(),
  // A national match under way when the app was closed: back to the national page (the club pages are not for a country).
  view: savedGame?.nationalMatch ? "national" : "overview",
  playerId: null,
  profileSlot: null,
  profileNational: false,
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
  openPlayer: (playerId, slot, national) => set({playerId, profileSlot: slot ?? null, profileNational: !!national}),
  watchMatch: (matchFixtureId) => set({matchFixtureId}),
  setNegotiation: (negotiation) => set({negotiation}),
  notify: (key, params, tone = "info") => set({toast: {key, params, tone}}),
  act: (fn) => {
    const current = get().game;
    if (!current) throw new Error("No game loaded");
    const draft = structuredClone(current);
    const rng = new Rng(draft.rngState);
    const before = {diamonds: current.monetization.diamonds, cash: current.clubs[current.userClubId]?.cash ?? 0, week: current.absWeek, club: current.userClubId};
    const result = fn(draft, rng);
    // What was spent by hand (not a week's wages): counts towards the weekly spending package.
    if (draft.absWeek === before.week && draft.userClubId === before.club) {
      addSpending(draft, thisWeek(), before.diamonds - draft.monetization.diamonds, before.cash - (draft.clubs[draft.userClubId]?.cash ?? 0));
    }
    draft.rngState = rng.state;
    // Everyone has a number of their own (new signings, loans back, a changed club).
    fixShirts(draft);
    // Those with a mansion are always full on every bar.
    topUpMansions(draft);
    saveGame(draft);
    set({game: draft});
    return result;
  },
  start: (managerName, clubIndex, look, playersGender, leagueId) => {
    const game = newGame(managerName, clubIndex, (Math.random() * 2 ** 32) >>> 0, look, playersGender, leagueId);
    // New players get the guide.
    game.tutorial = {step: 0, v: TUTORIAL_VERSION};
    fixShirts(game);
    saveGame(game);
    set({game, view: "overview"});
  },
  replace: (game) => {
    fixShirts(game);
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
