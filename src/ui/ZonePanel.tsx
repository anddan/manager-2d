// The zones view: the lineup on the pitch as in Tactics, the pitch in three parts (own end, middle, the end
// the team attacks) with the share of the match the ball has been in each, so far. Light grey for little,
// darker grey the more it has been there. The user's team always attacks upwards. Under each player's name:
// the match rating and how fit they are.
import {useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from "react";
import type {Frame, MatchEvent, Side} from "../game/types";
import type {Slot} from "../game/constants";
import {progressFor} from "../game/pitch";
import {useT} from "../i18n";
import {Icon} from "./Icon";
import {Jersey} from "./Jersey";
import {Football} from "./Ball";
import {GearPicture} from "./Gear";
import type {GearItem} from "../game/gear";
import {ManagerAvatar} from "./Avatar";
import type {ManagerLook} from "../game/types";
import {boardSpots} from "./views/Tactics";

/** The tops (percent of the board) of the places with the team's lines squeezed: lean > 0 pulls the lines up towards the forwards, lean < 0 down towards the defenders. */
export function squeezeTops(places: {top: number; keeper: boolean}[], lean: number): number[] {
  const MIN_GAP = 12;
  const out = places.map((p) => p.top);
  const field = places.map((p, i) => ({i, top: p.top})).filter((_, i) => !places[i].keeper).sort((a, b) => a.top - b.top);
  // The rows (places at about the same height).
  const rows: {tops: number[]; ids: number[]}[] = [];
  for (const f of field) {
    const last = rows[rows.length - 1];
    if (last && f.top - last.tops[last.tops.length - 1] <= 5) {
      last.tops.push(f.top);
      last.ids.push(f.i);
    } else rows.push({tops: [f.top], ids: [f.i]});
  }
  // Dropping back: the keeper steps back towards his line too.
  if (lean < 0) places.forEach((p, i) => { if (p.keeper) out[i] = Math.min(88, p.top - lean * 7); });
  if (rows.length < 2 || lean === 0) return out;
  const mid = rows.map((r) => r.tops.reduce((a, b) => a + b, 0) / r.tops.length);
  const k = 1 - 0.55 * Math.abs(lean);
  const to = [...mid];
  if (lean > 0) {
    for (let i = 1; i < mid.length; i++) to[i] = Math.min(mid[i], to[i - 1] + Math.max(MIN_GAP, (mid[i] - mid[i - 1]) * k));
  } else {
    // The defenders drop back (towards their keeper), and the rows above are pulled down after them.
    to[mid.length - 1] = mid[mid.length - 1] - lean * 12;
    for (let i = mid.length - 2; i >= 0; i--) to[i] = Math.max(mid[i], to[i + 1] - Math.max(MIN_GAP, (mid[i + 1] - mid[i]) * k));
  }
  rows.forEach((r, ri) => r.ids.forEach((id) => (out[id] = places[id].top + (to[ri] - mid[ri]))));
  return out;
}

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
  /** Sent off: greyed out, with the red card. */
  sentOff?: boolean;
  /** Has the ball (or is about to take the set piece). */
  hasBall?: boolean;
  /** Came on as a substitute (not in the starting eleven). */
  subbedOn?: boolean;
  /** Their shirt number. */
  shirt?: number;
  /** The player of the match (a star at the name, once the match is over). */
  motm?: boolean;
  /** Wears the armband. */
  captain?: boolean;
  /** Just scored (yellow glow) or set up the goal (blue). */
  goalGlow?: "scorer" | "assist";
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
export interface MatchStatsData {
  shots: [number, number];
  onTarget: [number, number];
  corners: [number, number];
  penalties: [number, number];
  yellow: [number, number];
  red: [number, number];
}

export function matchStats(events: MatchEvent[], upTo: number): MatchStatsData {
  const pair = () => [0, 0] as [number, number];
  const out: MatchStatsData = {shots: pair(), onTarget: pair(), corners: pair(), penalties: pair(), yellow: pair(), red: pair()};
  for (const e of events) {
    if (e.minute - 1 > upTo || !e.side) continue;
    const i = e.side === "home" ? 0 : 1;
    if (e.type === "goal" || e.type === "saved") {
      out.shots[i]++;
      out.onTarget[i]++;
    } else if (e.type === "missed" || e.type === "blocked") out.shots[i]++;
    else if (e.type === "corner") out.corners[i]++;
    else if (e.type === "penalty") out.penalties[i]++;
    else if (e.type === "yellow") out.yellow[i]++;
    else if (e.type === "red") out.red[i]++;
  }
  return out;
}

/** The statistics so far, in one neutral style (the user's side in the accent colour): folded up to the two sides and who has the ball, opened for the rest. */
export function MatchStats({possession, stats, home, away, mine}: {
  possession: [number, number];
  stats: MatchStatsData;
  home: {short: string};
  away: {short: string};
  mine?: Side;
}) {
  const {t} = useT();
  const [open, setOpen] = useState(false);
  const row = (label: string, values: [ReactNode, ReactNode], suffix = "") => (
    <div className="zs-row">
      <b className={mine === "home" ? "mine" : undefined}>{values[0]}{suffix}</b>
      <span>{label}</span>
      <b className={mine === "away" ? "mine" : undefined}>{values[1]}{suffix}</b>
    </div>
  );
  const cards = (i: 0 | 1) => (
    <span className="zs-cards"><Icon name="cardYellow" size={13} /> {stats.yellow[i]} <Icon name="cardRed" size={13} /> {stats.red[i]}</span>
  );
  return (
    <div className="zone-stats match-stats">
      <button type="button" className="zs-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{mine === "home" && <Icon name="user" size={13} />} {home.short} <b className={mine === "home" ? "mine" : undefined}>{possession[0]} %</b></span>
        <span className={open ? "zs-chevron open" : "zs-chevron"}><Icon name="chevron" size={16} /></span>
        <span><b className={mine === "away" ? "mine" : undefined}>{possession[1]} %</b> {away.short} {mine === "away" && <Icon name="user" size={13} />}</span>
      </button>
      {open && row(t("match.possession"), possession, " %")}
      <div className="zs-bar" role="img" aria-label={`${t("match.possession")}: ${home.short} ${possession[0]} %, ${away.short} ${possession[1]} %`}>
        <i className={mine === "home" ? "mine" : undefined} style={{width: `${possession[0]}%`}} />
        <i className={mine === "away" ? "mine" : undefined} style={{width: `${possession[1]}%`}} />
      </div>
      {open && row(t("zones.shots"), stats.shots)}
      {open && row(t("zones.onTarget"), stats.onTarget)}
      {open && row(t("zones.corners"), stats.corners)}
      {open && row(t("zones.penalties"), stats.penalties)}
      {open && row(t("zones.cards"), [cards(0), cards(1)])}
    </div>
  );
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

export function ZonePanel({shares, home, away, mine, slots, players, kit, shout, managerLook, onSubOut, onProfile, forza, instructed, pass, leaving, over, still, hold}: {
  /** The first minutes of each half: the lines stand in their own places, and only then begin to move with the play. */
  hold?: boolean;
  /** The match is over (not just half-time): once they have started to walk off, no one comes back. */
  over?: boolean;
  /** The players stand on their places (the setting for it is off). */
  still?: boolean;
  /** The match is over: after a moment the players walk off the pitch, one after another. */
  leaving?: boolean;
  /** The last pass: who gave it and who got it (a dashed line that fades quickly); `key` changes with every pass. */
  pass?: {from: string; to: string; key: number};
  shares: [number, number, number];
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
  // Pressure squeezes the team's lines together: up when the play is in the opponent's end (the defenders come up towards the halfway line, the forwards stay), back when it is in their own (the defenders and the keeper drop back, and the rest of the team follows). The rows keep a gap so no one ends up on top of another. From the whole percentages, so it changes only now and then; the browser does the gliding.
  const lean = still || hold ? 0 : Math.max(-1, Math.min(1, ((shares[2] - shares[0]) / 100) * 3));
  const squeezed = squeezeTops(spots.map((sp, i) => ({top: parseFloat(sp.top), keeper: !!players?.find((p) => p.index === i)?.keeper})), lean);
  const pressed = (p: ZonePlayer) => {
    const sp = spots[p.index];
    if (!sp || still) return sp;
    return {left: sp.left, top: `${squeezed[p.index].toFixed(2)}%`};
  };
  // The line between the two on the board (the centre of their shirts).
  const centre = (id: string) => {
    const p = players?.find((x) => x.id === id);
    const sp = p && pressed(p);
    return sp ? {x: parseFloat(sp.left), y: parseFloat(sp.top) + 5} : null;
  };
  const passFrom = pass && centre(pass.from);
  const passTo = pass && centre(pass.to);
  // Once they have started to walk off they keep going (the match's end state may flicker): no one comes back.
  const [walkedOff, setWalkedOff] = useState(false);
  useEffect(() => {
    if (leaving && over) setWalkedOff(true);
  }, [leaving, over]);
  const gone = leaving || (!!over && walkedOff);
  const pickedPlayer = players?.find((p) => p.id === picked);
  return (
    <figure className="zone-panel">
      <div className="zone-frame">
        <div ref={board} className="pitch-board zone-board" role="group" aria-label={t("zones.title")} onClick={(e) => e.target === e.currentTarget && setPicked(null)}>
          {/* The three zones as one soft wash: the colour of each at its middle, blending between them. */}
          <div className="zone-wash" style={{background: `linear-gradient(to bottom, ${washStop(bands[0].tone)} 0%, ${washStop(bands[0].tone)} 12%, ${washStop(bands[1].tone)} 50%, ${washStop(bands[2].tone)} 88%, ${washStop(bands[2].tone)} 100%)`}} />
          <div className="pitch-lines" aria-hidden />
          {passFrom && passTo && (
            <svg key={pass!.key} className="zone-pass" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {/* A rubber band, cartoon style: it stretches out past the one who got the ball (and thins), settles, then snaps back the same way with a wobble (and thickens for a moment). */}
              <line x1={passFrom.x} y1={passFrom.y} x2={passFrom.x} y2={passFrom.y}>
                {(["x2", "y2"] as const).map((k) => {
                  const f = k === "x2" ? passFrom.x : passFrom.y;
                  const to = k === "x2" ? passTo.x : passTo.y;
                  return <animate key={k} attributeName={k} values={`${f};${f + (to - f) * 1.14};${f + (to - f) * 0.97};${to}`} keyTimes="0;0.55;0.8;1" dur="0.22s" fill="freeze" />;
                })}
                {(["x1", "y1"] as const).map((k) => {
                  const f = k === "x1" ? passFrom.x : passFrom.y;
                  const to = k === "x1" ? passTo.x : passTo.y;
                  return <animate key={k} attributeName={k} values={`${f};${f - (to - f) * 0.06};${f + (to - f) * 1.05};${f + (to - f) * 0.97};${to}`} keyTimes="0;0.2;0.62;0.82;1" dur="0.4s" begin="0.35s" fill="freeze" />;
                })}
                <animate attributeName="stroke-width" values="0.22;0.12;0.22" keyTimes="0;0.5;1" dur="0.22s" fill="freeze" />
                <animate attributeName="stroke-width" values="0.22;0.42;0.22" keyTimes="0;0.45;1" dur="0.4s" begin="0.35s" fill="freeze" />
              </line>
            </svg>
          )}
          <span className="zone-box top" aria-hidden />
          <span className="zone-box bottom" aria-hidden />
          {/* The goals: a frame with a net, at each end. */}
          <span className="zone-goal top" aria-hidden />
          <span className="zone-goal bottom" aria-hidden />
          {["tl", "tr", "bl", "br"].map((c) => <span key={c} className={`zone-corner ${c}`} aria-hidden />)}
          {bands.map((band, i) => (
          <div key={i} className="zone-label" style={{top: `${i * (100 / 3) + 100 / 6}%`}}>
            <span className="zone-pct">{band.share} %</span>
            <span className="zone-name">{band.label}</span>
          </div>
        ))}
        {/* The lineup, as in Tactics, with the rating and the fitness under each name. */}
          {kit && players?.map((p) => {
            const glow = instructed === "all" || instructed?.includes(p.id) ? "instructed" : forza ? "forza" : "";
            return (
              <div key={p.id} data-pid={p.id} className={`slot zone-slot ${gone ? "leaving" : ""} ${p.hasBall ? "holder" : ""} ${picked === p.id ? "picked" : ""} ${glow} ${p.sentOff ? "sent-off" : ""} ${p.goalGlow ? `goal-${p.goalGlow}` : ""}`} style={gone ? {...pressed(p), ["--n" as string]: p.index} : pressed(p)} role="button" tabIndex={p.sentOff ? -1 : 0} aria-disabled={p.sentOff} onClick={() => onSubOut && !p.sentOff && setPicked(picked === p.id ? null : p.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSubOut && !p.sentOff && setPicked(picked === p.id ? null : p.id)}>
                <Jersey color={kit.color} trim={kit.color2} pattern={kit.pattern} trim3={kit.color3} collar={kit.collar} sleeves={kit.sleeves} keeper={p.keeper} number={p.shirt ?? p.index + 1} captain={p.captain} />
                {/* Boots or gloves in front of the shirt at its lower right, shin guards on the other side (as in Tactics). */}
                {p.gear && <span className={p.gear.kind === "gloves" ? "slot-gear gloves" : "slot-gear"} aria-hidden><GearPicture item={p.gear} size={p.gear.kind === "gloves" ? 22 : 24} /></span>}
                {p.shin && <span className="slot-gear slot-shin" aria-hidden><GearPicture item={p.shin} size={15} /></span>}
                {p.subbedOn && <span className="zone-subbed" title={t("match.subs")} aria-hidden><Icon name="swap" size={11} /></span>}
                {p.hasBall && (
                  <span className="zone-ball" aria-hidden>
                    <svg viewBox="-3 -3 6 6" width={18} height={18}><Football r={2.5} /></svg>
                  </span>
                )}
                {(p.goals || p.assists || p.yellow || p.red) ? (
                  <span className="zone-marks" aria-hidden>
                    {p.goals ? <span className="zone-mark">{<Icon name="ball" size={13} />}{p.goals > 1 ? <i>{p.goals}</i> : null}</span> : null}
                    {p.assists ? <span className="zone-mark assist">{<Icon name="boot" size={13} />}{p.assists > 1 ? <i>{p.assists}</i> : null}</span> : null}
                    {p.yellow ? <span className="zone-mark">{<Icon name="cardYellow" size={13} />}</span> : null}
                    {p.red ? <span className="zone-mark">{<Icon name="cardRed" size={13} />}</span> : null}
                  </span>
                ) : null}
                <span className="plate">
                  <span className="plate-name">{p.motm && <span className="zone-motm" title="★"><Icon name="star" size={11} /></span>}{p.name}{p.captain && <small className="cap-c">c</small>}</span>
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
          {/* The manager at the touchline, calling out an instruction. */}
        {shout && managerLook && (
          <div className="zone-shout" role="status">
            <ManagerAvatar look={managerLook} size={36} tie={(mine === "away" ? away : home).color} />
            <span className="zone-shout-bubble">{shout}</span>
          </div>
        )}
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
        </div>
  
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
