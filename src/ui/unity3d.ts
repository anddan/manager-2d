import {useEffect, useRef, useState, type RefObject} from "react";
import type {Club, Player} from "../game/types";
import {lookFor} from "./Avatar";

/**
 * The 3D match: a Unity WebGL build (public/unity3d/, built from the forza-3d project) shown in an iframe over the
 * pitch. The web app keeps running the match (clock, movement, set pieces); Unity only draws what it is told.
 * Messages go through postMessage, so nothing in the game depends on Unity being there:
 *   page -> unity: {src: "forza", type: "setup", ...} once Unity is ready, {type: "state", ...} every frame
 *   unity -> page: {src: "forza-unity", type: "ready"}
 */

export const UNITY_URL = `${import.meta.env.BASE_URL}unity3d/index.html`;
const KEY = "manager2d.view3d";

let prefetched = false;

/**
 * Starts fetching the Unity build in the background (low priority), so that it is in the browser's cache when the 3D
 * view is switched on. Called when a match opens; does nothing if there is no build or it has been done already.
 */
export function prefetchUnity() {
  if (prefetched || typeof document === "undefined") return;
  prefetched = true;
  fetch(UNITY_URL)
    .then((r) => (r.ok ? r.text() : ""))
    .then((text) => {
      if (!text.includes("unity-canvas")) return;
      const base = UNITY_URL.replace(/index\.html$/, "Build/");
      for (const file of ["unity3d.loader.js", "unity3d.framework.js", "unity3d.wasm", "unity3d.data"]) {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = base + file;
        document.head.appendChild(link);
      }
    })
    .catch(() => {
      prefetched = false;
    });
}

export function read3d(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** How far the 3D camera is: a few steps from close to the whole pitch (a bigger number is further away). */
export const ZOOM_STEPS = [0.4, 0.55, 0.75, 1, 1.35, 1.8, 2.4, 3.2];
const ZOOM_KEY = "manager2d.zoom3d2";
const DEFAULT_ZOOM = 4;
const VIEW_KEY = "manager2d.view3dSide";

export function readZoom3d(): number {
  try {
    const i = Number(localStorage.getItem(ZOOM_KEY));
    return localStorage.getItem(ZOOM_KEY) !== null && Number.isInteger(i) && i >= 0 && i < ZOOM_STEPS.length ? i : DEFAULT_ZOOM;
  } catch {
    return DEFAULT_ZOOM;
  }
}

export function writeZoom3d(i: number) {
  try {
    localStorage.setItem(ZOOM_KEY, String(i));
  } catch {
    // Only for this match.
  }
}

/** Which side of the pitch the camera looks from: 0 a touchline, 1 behind the left goal, 2 the other touchline, 3 behind the right goal. */
export function readSide3d(userSide?: "home" | "away"): number {
  // Behind the goal your team attacks away from: the home side attacks to the right (the camera behind the left goal, 1), the away side to the left (3).
  const fallback = userSide === "away" ? 3 : 1;
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    const i = Number(raw);
    return raw !== null && Number.isInteger(i) && i >= 0 && i < 4 ? i : fallback;
  } catch {
    return fallback;
  }
}

export function writeSide3d(i: number) {
  try {
    localStorage.setItem(VIEW_KEY, String(i));
  } catch {
    // Only for this match.
  }
}

export function write3d(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Only for this match.
  }
}

/** Pitch units (0..100 across, 0..100 up and down) to metres. */
export const toMetres = (x: number, y: number) => ({x: +(x * 1.05).toFixed(2), z: +(y * 0.68).toFixed(2)});

export interface PlayerState {
  id: string;
  side: "home" | "away";
  x: number;
  z: number;
  /** Speed in metres per second along the pitch and across it. */
  vx: number;
  vz: number;
  sprint: boolean;
  /** Jumping for a header (0..1), and a dive: the direction in degrees, as drawn on the pitch. */
  lift: number;
  dive: number;
  diving: boolean;
  /** The dive is a slide tackle (feet first along the grass), not a keeper's save. */
  slide: boolean;
  forza: boolean;
  /** The manager's orders are for this player. */
  shouted: boolean;
  /** The player picked for orders. */
  selected: boolean;
  celebrate: boolean;
  captain: boolean;
  /** "scorer" or "assist" while a goal is celebrated. */
  mark: string;
}

export interface MatchState3D {
  time: number;
  /** How far away the camera is (see ZOOM_STEPS). */
  zoom: number;
  /** Which side the camera is on (see readSide3d). */
  view: number;
  running: boolean;
  ball: {x: number; z: number; h: number};
  players: PlayerState[];
  /** A shot with a tail of fire: a fired-up side ("Forza!") or a great finisher. */
  fire: boolean;
  /** The player with the ball, if any. */
  carrier?: string;
  /** What is going on: "play", "goal", "setup" (a set piece), "restart", "halftime", "fulltime". */
  phase: string;
  /** The side that scored, or took the set piece. */
  side?: "home" | "away";
}

export interface PlayerInfo {
  id: string;
  side: "home" | "away";
  number: number;
  keeper: boolean;
  name: string;
  /** The same look the 2D avatar is drawn from, so the 3D player is the same person. */
  look: ReturnType<typeof lookFor>;
}

const kit = (c: Club) => ({color: c.color, color2: c.color2, short: c.short});

/** Where the goal and the ball are on the 3D screen during a set piece (0..1 from the top left); Unity sends it. */
export interface GoalRect {
  bl: [number, number];
  br: [number, number];
  tl: [number, number];
  tr: [number, number];
  ball: [number, number];
}

/** Until Unity has said where the goal is: a goal about in the middle of the screen. */
export const DEFAULT_GOAL: GoalRect = {bl: [0.3, 0.55], br: [0.7, 0.55], tl: [0.3, 0.38], tr: [0.7, 0.38], ball: [0.5, 0.9]};

const mix = (a: [number, number], b: [number, number], k: number): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/** A point in the goal (x from the left post -1 to the right post 1, y from the ground 0 to the bar 1) to where it is on the screen. */
export function goalToScreen(r: GoalRect, gx: number, gy: number): [number, number] {
  const u = (gx + 1) / 2;
  return mix(mix(r.bl, r.br, u), mix(r.tl, r.tr, u), gy);
}

/** The other way round: where a touch on the screen is in the goal (found by a few steps of Newton's method; the goal is nearly a rectangle). */
export function screenToGoal(r: GoalRect, sx: number, sy: number): {x: number; y: number} {
  let u = 0.5;
  let v = 0.4;
  for (let i = 0; i < 8; i++) {
    const p = goalToScreen(r, u * 2 - 1, v);
    const ex = p[0] - sx;
    const ey = p[1] - sy;
    // The slopes of the screen position with respect to u and v.
    const pu = goalToScreen(r, (u + 0.01) * 2 - 1, v);
    const pv = goalToScreen(r, u * 2 - 1, v + 0.01);
    const a = (pu[0] - p[0]) / 0.01;
    const b = (pv[0] - p[0]) / 0.01;
    const cc = (pu[1] - p[1]) / 0.01;
    const d = (pv[1] - p[1]) / 0.01;
    const det = a * d - b * cc;
    if (Math.abs(det) < 1e-9) break;
    u -= (d * ex - b * ey) / det;
    v -= (-cc * ex + a * ey) / det;
  }
  return {x: u * 2 - 1, y: v};
}

/** Everything that stays the same through a match: the kits, and who is who. */
export function setupMessage(home: Club, away: Club, stands?: {north: number; south: number; west: number; east: number}, fill = 1) {
  return {src: "forza", type: "setup", home: kit(home), away: kit(away), stands, fill};
}

export function playerInfo(p: Player, side: "home" | "away"): PlayerInfo {
  return {id: p.id, side, number: p.shirt ?? 0, keeper: p.position === "GK", name: `${p.firstName} ${p.lastName}`, look: lookFor(p)};
}

/**
 * Keeps the Unity iframe in step with the match. Returns what the page needs to show the frame and a `send`
 * that is called with the newest state whenever the match has moved.
 */
export function useUnity3d(enabled: boolean, home: Club, away: Club, stands?: {north: number; south: number; west: number; east: number}, fill = 1) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  // Whether the Unity build is really there: without it the server answers with the app itself (a window in a window).
  const [available, setAvailable] = useState<boolean | null>(null);
  const known = useRef(new Set<string>());
  // Where the goal is on screen during a set piece (Unity tells us).
  const [goalRect, setGoalRect] = useState<GoalRect | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch(UNITY_URL)
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => alive && setAvailable(text.includes("unity-canvas")))
      .catch(() => alive && setAvailable(false));
    return () => {
      alive = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.src === "forza-unity" && e.data.type === "goalRect") {
        setGoalRect(e.data as GoalRect);
        return;
      }
      if (e.data?.src === "forza-unity" && e.data.type === "ready") {
        known.current = new Set();
        frame.current?.contentWindow?.postMessage(setupMessage(home, away, stands, fill), "*");
        setReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, home.color, home.color2, away.color, away.color2]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Sends the newest state; players Unity has not seen yet are described first. */
  const lastSent = useRef(0);
  const send = (state: MatchState3D, info: (id: string) => PlayerInfo | undefined) => {
    const win = frame.current?.contentWindow;
    if (!enabled || !ready || !win) return;
    // About 40 times a second is plenty: Unity smooths the movement between the messages.
    const now = performance.now();
    if (now - lastSent.current < 25) return;
    lastSent.current = now;
    const fresh: PlayerInfo[] = [];
    for (const p of state.players) {
      if (known.current.has(p.id)) continue;
      const i = info(p.id);
      if (i) {
        fresh.push(i);
        known.current.add(p.id);
      }
    }
    if (fresh.length) win.postMessage({src: "forza", type: "players", players: fresh}, "*");
    win.postMessage({src: "forza", type: "state", ...state}, "*");
  };

  /** Any other message to Unity (a set piece starting, a kick). */
  const post = (message: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({src: "forza", ...message}, "*");
  };

  return {frame: frame as RefObject<HTMLIFrameElement>, ready, available, send, post, goalRect};
}
