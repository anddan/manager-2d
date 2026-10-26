// Picking up a new deploy without reinstalling: a game opened from a phone's home screen
// isn't reloaded when it's opened again, so it would keep running the old version. It
// checks version.json (written by every build) when it comes back to the front and every
// few minutes, and reloads when there's a newer build. The save is in the browser, so
// nothing is lost; a live match is let finish first.
import {useEffect} from "react";
import {useGame} from "../store";

declare const __BUILD_ID__: string;

/** This build's id: when it was built (an ISO time). */
export const BUILD_ID = __BUILD_ID__;

const EVERY_MS = 5 * 60 * 1000;

async function newerBuildOut(): Promise<boolean> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {cache: "no-store"});
    if (!res.ok) return false;
    const {id} = (await res.json()) as {id?: string};
    return !!id && id !== __BUILD_ID__;
  } catch {
    return false;
  }
}

/**
 * Looks for a newer build now: reloads into it if there is one (not during a live match).
 * Says what it found: "reload", "latest", or "match" (one is out, after the match).
 */
export async function checkForUpdate(): Promise<"reload" | "latest" | "match"> {
  if (!(await newerBuildOut())) return "latest";
  if (useGame.getState().game?.liveMatch) return "match";
  location.reload();
  return "reload";
}

/** Keeps the game up to date with the latest deploy (built game only; not while developing). */
export function useUpdates(): void {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      const newer = await newerBuildOut();
      busy = false;
      // Not in the middle of a match: that waits until it's over.
      if (newer && !useGame.getState().game?.liveMatch) location.reload();
    };
    void check();
    const id = setInterval(check, EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, []);
}
