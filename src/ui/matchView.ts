// How a match is watched, remembered on this device: the pitch, the zones the ball has been in (the
// start), or only the commentary. With the pitch hidden, the set pieces are the assistant's.
export const MATCH_VIEWS = ["pitch", "zones", "text"] as const;
export type MatchView = (typeof MATCH_VIEWS)[number];

const KEY = "manager2d.matchView";
const OLD_TEXT_ONLY_KEY = "manager2d.textOnly";
const SET_PIECES_KEY = "manager2d.manualSetPieces";

export function readMatchView(): MatchView {
  try {
    const v = localStorage.getItem(KEY);
    if ((MATCH_VIEWS as readonly string[]).includes(v ?? "")) return v as MatchView;
    // Before there were three ways: only the commentary or not (those who chose the commentary keep it); otherwise the zones to begin with.
    return localStorage.getItem(OLD_TEXT_ONLY_KEY) === "1" ? "text" : "zones";
  } catch {
    return "zones";
  }
}

export function writeMatchView(view: MatchView): void {
  try {
    localStorage.setItem(KEY, view);
    // Without the pitch there is nothing to aim on: the set pieces become the assistant's.
    if (view !== "pitch") localStorage.setItem(SET_PIECES_KEY, "auto");
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
