// The zones view: the lineup on the pitch as in Tactics, the pitch in three parts (own end, middle, the end
// the team attacks) with the share of the match the ball has been in each, so far. Light grey for little,
// darker grey the more it has been there. The user's team always attacks upwards. Under each player's name:
// the match rating and how fit they are.
import {useEffect, useLayoutEffect, useRef, useState, type RefObject} from "react";
import type {Frame, MatchEvent, Side} from "../game/types";
import type {Slot} from "../game/constants";
import {progressFor} from "../game/pitch";
import {useT} from "../i18n";
import {Icon} from "./Icon";
import {Jersey} from "./Jersey";
import {GearPicture} from "./Gear";
import type {GearItem} from "../game/gear";
import {ManagerAvatar} from "./Avatar";
import type {ManagerLook} from "../game/types";
import {boardSpots} from "./views/Tactics";

/** Percent of the match so far that the ball has been in [own third, middle, opponent's third], from `side`'s view. */
export function zoneShares(frames: Frame[], side: Side, upTo: number): [number, number, number] {
  const time = [0, 0, 0];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.minute >= upTo) break;
    // The ball stays where it was played until the next touch.
    const end = Math.min(frames[i + 1]?.minute ?? upTo, upTo);
    const dt = end - f.minute;
    if (dt <= 0) continue;
    const p = progressFor(side, f.x);
    time[p < 100 / 3 ? 0 : p < 200 / 3 ? 1 : 2] += dt;
  }
  const sum = time[0] + time[1] + time[2];
  if (sum <= 0) return [0, 0, 0];
  // Whole percentages that add up to 100 (the largest remainders get the spare ones).
  const exact = time.map((x) => (x / sum) * 100);
  const floor = exact.map(Math.floor);
  let spare = 100 - floor.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (spare <= 0) break;
    floor[i]++;
    spare--;
  }
  return [floor[0], floor[1], floor[2]];
}

/** Percent of the match so far each team has had the ball [home, away]. */
export function possessionShares(frames: Frame[], upTo: number): [number, number] {
  const time = [0, 0];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.minute >= upTo) break;
    const end = Math.min(frames[i + 1]?.minute ?? upTo, upTo);
    if (end > f.minute) time[f.possession === "home" ? 0 : 1] += end - f.minute;
  }
  const sum = time[0] + time[1];
  if (sum <= 0) return [0, 0];
  const home = Math.round((time[0] / sum) * 100);
  return [home, 100 - home];
}

/** The zone laid over the pitch: light grey for a small share, darker grey the more the ball has been there. */
export function zoneColor(share: number): {fill: string; opacity: number} {
  const k = Math.max(0, Math.min(1, share / 60));
  const LIGHT = [209, 213, 219];
  const DARK = [31, 41, 55];
  const rgb = LIGHT.map((v, i) => Math.round(v + (DARK[i] - v) * k));
  // See-through: at about a quarter of the match the pitch still shows almost green; the wash only thickens above that.
  const thick = Math.pow(Math.max(0, Math.min(1, (share - 20) / 40)), 1.2);
  return {fill: `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`, opacity: 0.05 + 0.8 * thick};
}

type ClubKit = {short: string; color: string; color2: string; color3?: string; pattern?: import("../game/types").ShirtPattern; collar?: import("../game/types").Collar; sleeves?: import("../game/types").Sleeves};

/** One player of the lineup on the pitch. */
export interface ZonePlayer {
  id: string;
  /** The place on the pitch (its number in the lineup). */
  index: number;
  name: string;
  keeper: boolean;
  /** The match rating so far, if there is one. */
  rating?: number;
  /** How fit they are, 0..100. */
  fitness: number;
  /** Boots or gloves, and shin guards. */
  gear?: GearItem;
  shin?: GearItem;
  /** Goals, assists and cards so far (shown as small icons on the shirt). */
  goals?: number;
  assists?: number;
  yellow?: number;
  red?: number;
}

/** Goals, assists and cards for each player so far. */
export function playerMarks(events: MatchEvent[], upTo: number): Record<string, {goals: number; assists: number; yellow: number; red: number}> {
  const out: Record<string, {goals: number; assists: number; yellow: number; red: number}> = {};
  const of = (id: string) => (out[id] ??= {goals: 0, assists: 0, yellow: 0, red: 0});
  for (const e of events) {
    if (e.minute - 1 > upTo) continue;
    if (e.type === "goal") {
      if (e.playerId) of(e.playerId).goals++;
      if (e.otherId) of(e.otherId).assists++;
    } else if (e.type === "yellow" && e.playerId) of(e.playerId).yellow++;
    else if (e.type === "red" && e.playerId) of(e.playerId).red++;
  }
  return out;
}

/** Shots, shots on target and corners for each side [home, away] up to a time. */
export function matchStats(events: MatchEvent[], upTo: number): {shots: [number, number]; onTarget: [number, number]; corners: [number, number]} {
  const out = {shots: [0, 0] as [number, number], onTarget: [0, 0] as [number, number], corners: [0, 0] as [number, number]};
  for (const e of events) {
    if (e.minute - 1 > upTo || !e.side) continue;
    const i = e.side === "home" ? 0 : 1;
    if (e.type === "goal" || e.type === "saved") {
      out.shots[i]++;
      out.onTarget[i]++;
    } else if (e.type === "missed" || e.type === "blocked") out.shots[i]++;
    else if (e.type === "corner") out.corners[i]++;
  }
  return out;
}

/**
 * Where a tapped player's name plate is on a board (measured), so the tap bar can lie right over it, as in
 * Tactics. `selector` finds the plate inside the board; null: nothing tapped.
 */
export function usePlateBar(board: RefObject<HTMLElement | null>, selector: string | null, dep?: unknown): {left: number; top: number; width: number; height: number; boardHeight: number} | null {
  const [bar, setBar] = useState<{left: number; top: number; width: number; height: number; boardHeight: number} | null>(null);
  useLayoutEffect(() => {
    const root = board.current;
    const plate = selector && root ? root.querySelector(selector) : null;
    if (!root || !plate) {
      setBar(null);
      return;
    }
    const b = root.getBoundingClientRect();
    const p = plate.getBoundingClientRect();
    setBar({left: p.left - b.left + p.width / 2, top: p.top - b.top, width: p.width, height: p.height, boardHeight: b.height});
  }, [board, selector, dep]);
  return bar;
}

/** Numbers that ease towards their target a little each frame, so a colour changes softly rather than jumping. */
function useSmoothed(target: number[]): number[] {
  const [shown, setShown] = useState(target);
  const goal = useRef(target);
  goal.current = target;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setShown((cur) => {
        const next = cur.map((v, i) => v + (goal.current[i] - v) * 0.06);
        return next.some((v, i) => Math.abs(v - cur[i]) > 0.01) ? next : cur;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return shown;
}

export function ZonePanel({shares, possession, stats, home, away, mine, slots, players, kit, shout, managerLook, onSubOut, onProfile, forza, instructed}: {
  shares: [number, number, number];
  possession: [number, number];
  stats: {shots: [number, number]; onTarget: [number, number]; corners: [number, number]};
  home: ClubKit;
  away: ClubKit;
  mine?: Side;
  /** The places of the lineup, numbered as the players' `index`. */
  slots?: Slot[];
  players?: ZonePlayer[];
  kit?: ClubKit;
  /** What the manager is calling out now, and how he looks. */
  shout?: string | null;
  managerLook?: ManagerLook;
  /** Tapping a player offers their profile and "take off" (the latter opens the substitutions with them picked). */
  onSubOut?: (id: string) => void;
  onProfile?: (id: string) => void;
  /** "Forza!" is on: the whole team glows blue. */
  forza?: boolean;
  /** Told something just now: these glow yellow ("all" for a team order). */
  instructed?: string[] | "all";
}) {
  const {t} = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const bar = usePlateBar(board, picked ? `[data-pid="${picked}"] .plate` : null, players);
  // The statistics start folded up: just the two sides and who has the ball.
  const [statsOpen, setStatsOpen] = useState(false);
  // The zones' colours ease towards their share (top: where the team attacks).
  const soft = useSmoothed([shares[2], shares[1], shares[0]]);
  const bands = [
    {share: shares[2], tone: soft[0], label: t("zones.attack")},
    {share: shares[1], tone: soft[1], label: t("zones.middle")},
    {share: shares[0], tone: soft[2], label: t("zones.defence")},
  ];
  const spots = slots ? boardSpots(slots) : [];
  // A click anywhere but on a player (or the take-off button) puts the button away.
  useEffect(() => {
    if (!picked) return;
    const away = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest(".zone-slot, .pop-actions")) setPicked(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [picked]);
  const pickedPlayer = players?.find((p) => p.id === picked);
  // One row of the statistics: the home value, what it is, the away value; the user's side lit.
  const row = (label: string, values: [number, number], suffix = "") => (
    <div className="zs-row">
      <b className={mine === "home" ? "mine" : undefined}>{values[0]}{suffix}</b>
      <span>{label}</span>
      <b className={mine === "away" ? "mine" : undefined}>{values[1]}{suffix}</b>
    </div>
  );
  return (
    <figure className="zone-panel">
      {/* The statistics so far, in one neutral style: the user's side in the accent colour. */}
      <div className="zone-stats">
        <button type="button" className="zs-head" aria-expanded={statsOpen} onClick={() => setStatsOpen((o) => !o)}>
          <span>{mine === "home" && <Icon name="user" size={13} />} {home.short} <b className={mine === "home" ? "mine" : undefined}>{possession[0]} %</b></span>
          <span className={statsOpen ? "zs-chevron open" : "zs-chevron"}><Icon name="chevron" size={16} /></span>
          <span><b className={mine === "away" ? "mine" : undefined}>{possession[1]} %</b> {away.short} {mine === "away" && <Icon name="user" size={13} />}</span>
        </button>
        {statsOpen && row(t("match.possession"), possession, " %")}
        <div className="zs-bar" role="img" aria-label={`${t("match.possession")}: ${home.short} ${possession[0]} %, ${away.short} ${possession[1]} %`}>
          <i className={mine === "home" ? "mine" : undefined} style={{width: `${possession[0]}%`}} />
          <i className={mine === "away" ? "mine" : undefined} style={{width: `${possession[1]}%`}} />
        </div>
        {statsOpen && row(t("zones.shots"), stats.shots)}
        {statsOpen && row(t("zones.onTarget"), stats.onTarget)}
        {statsOpen && row(t("zones.corners"), stats.corners)}
      </div>
      <div ref={board} className="pitch-board zone-board" role="group" aria-label={t("zones.title")} onClick={(e) => e.target === e.currentTarget && setPicked(null)}>
        {/* The three zones as one soft wash: the colour of each at its middle, blending between them. */}
        <div className="zone-wash" style={{background: `linear-gradient(to bottom, ${washStop(bands[0].tone)} 0%, ${washStop(bands[0].tone)} 12%, ${washStop(bands[1].tone)} 50%, ${washStop(bands[2].tone)} 88%, ${washStop(bands[2].tone)} 100%)`}} />
        <div className="pitch-lines" aria-hidden />
        <span className="zone-box top" aria-hidden />
        <span className="zone-box bottom" aria-hidden />
        {["tl", "tr", "bl", "br"].map((c) => <span key={c} className={`zone-corner ${c}`} aria-hidden />)}
        {bands.map((b, i) => (
          <div key={i} className="zone-label" style={{top: `${i * (100 / 3) + 100 / 6}%`}}>
            <span className="zone-pct">{b.share} %</span>
            <span className="zone-name">{b.label}</span>
          </div>
        ))}
        {/* The lineup, as in Tactics, with the rating and the fitness under each name. */}
        {kit && players?.map((p) => {
          const glow = instructed === "all" || instructed?.includes(p.id) ? "instructed" : forza ? "forza" : "";
          return (
            <div key={p.id} data-pid={p.id} className={`slot zone-slot ${picked === p.id ? "picked" : ""} ${glow}`} style={spots[p.index]} role="button" tabIndex={0} onClick={() => onSubOut && setPicked(picked === p.id ? null : p.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSubOut && setPicked(picked === p.id ? null : p.id)}>
              <Jersey color={kit.color} trim={kit.color2} pattern={kit.pattern} trim3={kit.color3} collar={kit.collar} sleeves={kit.sleeves} keeper={p.keeper} number={p.index + 1} />
              {/* Boots or gloves in front of the shirt at its lower right, shin guards on the other side (as in Tactics). */}
              {p.gear && <span className={p.gear.kind === "gloves" ? "slot-gear gloves" : "slot-gear"} aria-hidden><GearPicture item={p.gear} size={p.gear.kind === "gloves" ? 22 : 24} /></span>}
              {p.shin && <span className="slot-gear slot-shin" aria-hidden><GearPicture item={p.shin} size={15} /></span>}
              {(p.goals || p.assists || p.yellow || p.red) ? (
                <span className="zone-marks" aria-hidden>
                  {p.goals ? <span className="zone-mark">{<Icon name="ball" size={13} />}{p.goals > 1 ? <i>{p.goals}</i> : null}</span> : null}
                  {p.assists ? <span className="zone-mark assist">{<Icon name="boot" size={13} />}{p.assists > 1 ? <i>{p.assists}</i> : null}</span> : null}
                  {p.yellow ? <span className="zone-mark">{<Icon name="cardYellow" size={13} />}</span> : null}
                  {p.red ? <span className="zone-mark">{<Icon name="cardRed" size={13} />}</span> : null}
                </span>
              ) : null}
              <span className="plate">
                <span className="plate-name">{p.name}</span>
                <span className="plate-info">
                  <strong className={p.rating === undefined ? "" : p.rating >= 7 ? "good" : p.rating < 6 ? "bad" : ""}>{p.rating === undefined ? "–" : p.rating.toFixed(1)}</strong>
                  <span className="zone-fit" title={`${Math.round(p.fitness)}`}>
                    <i className={p.fitness < 35 ? "bad" : p.fitness < 60 ? "mid" : "good"} style={{width: `${Math.max(4, Math.min(100, p.fitness))}%`}} />
                  </span>
                </span>
              </span>
            </div>
          );
        })}
        {/* A tapped player: take them off. */}
        {onSubOut && pickedPlayer && bar && (
          <div className="pop-actions" role="toolbar" style={{left: bar.left, top: Math.min(bar.top + bar.height + 4, bar.boardHeight - 44)}}>
            <button type="button" className="pop-action swap" aria-label={t("zones.subOut")} title={t("zones.subOut")} onClick={() => { setPicked(null); onSubOut(pickedPlayer.id); }}>
              <Icon name="swap" size={16} />
            </button>
            {onProfile && (
              <button type="button" className="pop-action" aria-label={t("tac.profile")} title={t("tac.profile")} onClick={() => { setPicked(null); onProfile(pickedPlayer.id); }}>
                <Icon name="user" size={16} />
              </button>
            )}
          </div>
        )}
        {/* The manager at the touchline, calling out an instruction. */}
        {shout && managerLook && (
          <div className="zone-shout" role="status">
            <ManagerAvatar look={managerLook} size={36} tie={(mine === "away" ? away : home).color} />
            <span className="zone-shout-bubble">{shout}</span>
          </div>
        )}
      </div>
    </figure>
  );
}

/** A colour for a zone's share as a CSS colour (the same grey scale as the zones), with its see-through-ness. */
function washStop(share: number): string {
  const c = zoneColor(share);
  const m = /rgb\((\d+) (\d+) (\d+)\)/.exec(c.fill)!;
  return `rgb(${m[1]} ${m[2]} ${m[3]} / ${c.opacity.toFixed(2)})`;
}
