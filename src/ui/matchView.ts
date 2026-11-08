// How a match is watched, remembered on this device: the pitch in 2D, the zones the ball has been in (the
// start), or the match in 3D. With the zones, the set pieces are the assistant's.
export const MATCH_VIEWS = ["pitch", "zones", "3d"] as const;
export type MatchView = (typeof MATCH_VIEWS)[number];

const KEY = "manager2d.matchView";
// Before the 3D view was a way of its own it was a button on the pitch.
const OLD_3D_KEY = "manager2d.view3d";
const SET_PIECES_KEY = "manager2d.manualSetPieces";

export function readMatchView(): MatchView {
  try {
    const v = localStorage.getItem(KEY);
    // The 3D button on the pitch was on: 3D it is.
    if (v === "pitch" && localStorage.getItem(OLD_3D_KEY) === "1") return "3d";
    // The commentary-only way is gone: the zones take its place.
    if ((MATCH_VIEWS as readonly string[]).includes(v ?? "")) return v as MatchView;
    return "zones";
  } catch {
    return "zones";
  }
}

export function writeMatchView(view: MatchView): void {
  try {
    localStorage.setItem(KEY, view);
    // On the zones board there is nothing to aim on: the set pieces become the assistant's.
    if (view === "zones") localStorage.setItem(SET_PIECES_KEY, "auto");
    // The old 3D button is not used any more.
    localStorage.removeItem(OLD_3D_KEY);
  } catch {
    // Only for now.
  }
}

const RATINGS_KEY = "manager2d.showRatings";

/** Whether the players' match ratings are shown (on to begin with). */
export function readShowRatings(): boolean {
  try {
    return localStorage.getItem(RATINGS_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeShowRatings(on: boolean): void {
  try {
    localStorage.setItem(RATINGS_KEY, on ? "1" : "0");
  } catch {
    // Only for now.
  }
}

const ZONE_MOVE_KEY = "manager2d.zoneMove";

/** Whether the players move about on the zones board with how the play goes (on to begin with). */
export function readZoneMove(): boolean {
  try {
    return localStorage.getItem(ZONE_MOVE_KEY) !== "off";
  } catch {
    return true;
  }
}
