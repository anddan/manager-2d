// Plays back a match from the touches the engine recorded (passes, dribbles,
// tackles, shots). Stored matches are replays; the user's match this week is
// live and stops at penalties and free kicks for the user to take.
// Every player moves on their own:
// - the player about to receive the ball runs to meet it,
// - the nearest defender presses the ball,
// - everyone else holds their spot in the team's shape, which shifts with the ball.
// Top speed comes from pace and drops late in the game for players with low
// stamina, so quick players visibly get there first. Sprinting players leave a trail.
import {useEffect, useMemo, useState} from "react";
import {FORMATIONS, type Slot} from "../game/constants";
import {LiveMatch} from "../game/live";
import {distance, teamSpot, type Point} from "../game/pitch";
import type {SetPiece, SetPieceInput, SetPieceOutcome} from "../game/setpieces";
import type {Frame, GameState, MatchEvent, MatchReport, Side} from "../game/types";
import {finishWeek} from "../game/week";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Modal} from "./common";
import {SetPieceView} from "./SetPieceView";

const SPEEDS = [1, 2, 4, 8];
/** Real milliseconds per match minute at 1x. */
const MS_PER_MINUTE = 1200;
/** Physics step in match minutes. */
const STEP = 0.02;
/** Share of the gap between touches that the carrier keeps the ball. */
const HOLD = 0.3;

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sprint: boolean;
}

export interface Scene {
  time: number;
  ball: Point;
  bodies: Record<string, Body>;
}

export interface Ctx {
  report: MatchReport;
  frames: Frame[];
  slots: Record<Side, Slot[]>;
  players: GameState["players"];
}

/** Who is on the pitch in which slot at minute t. */
function onPitchAt(report: MatchReport, side: Side, t: number): Map<number, string> {
  const lineup = side === "home" ? report.lineups.home : report.lineups.away;
  const slots = new Map<number, string>();
  lineup.forEach((id, i) => {
    if (id && report.ratings[id] !== undefined) slots.set(i, id);
  });
  const subbedOut = new Set(report.events.filter((e) => e.type === "sub").map((e) => e.playerId));
  for (const e of report.events) {
    if (e.minute > t || e.side !== side || !e.playerId) continue;
    const slot = [...slots.entries()].find(([, id]) => id === e.playerId)?.[0];
    if (slot === undefined) continue;
    if (e.type === "sub" && e.otherId) slots.set(slot, e.otherId);
    if (e.type === "red" || (e.type === "injury" && !subbedOut.has(e.playerId))) slots.delete(slot);
  }
  return slots;
}

/** Index of the last touch at or before t, or -1. */
function touchIndex(frames: Frame[], t: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].minute <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Top running speed in pitch units per match minute. */
function topSpeed(ctx: Ctx, id: string, t: number): number {
  const p = ctx.players[id];
  if (!p) return 20;
  const tiring = 1 - (t / 90) * (1 - p.attrs.stamina / 100) * 0.35;
  // Pace 40 -> ~19, pace 85 -> ~32 units a minute: a clear gap on screen.
  return (8 + p.attrs.pace * 0.28) * tiring;
}

/** A small personal drift so nobody stands perfectly still. */
function wander(id: string, t: number): Point {
  const h = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
  return {x: Math.sin(t * 0.8 + h) * 2.5, y: Math.cos(t * 0.6 + h * 1.7) * 3};
}

function possessionAt(ctx: Ctx, t: number): Side {
  const i = touchIndex(ctx.frames, t);
  return i >= 0 ? ctx.frames[i].possession : "home";
}

/** Everyone in their team spot, the ball at the latest touch: used when jumping in time. */
export function snap(ctx: Ctx, t: number): Scene {
  const i = touchIndex(ctx.frames, t);
  const ball = i >= 0 ? {x: ctx.frames[i].x, y: ctx.frames[i].y} : {x: 50, y: 50};
  const possession = possessionAt(ctx, t);
  const bodies: Record<string, Body> = {};
  for (const side of ["home", "away"] as const) {
    for (const [slot, id] of onPitchAt(ctx.report, side, t)) {
      const spot = teamSpot(ctx.slots[side][slot], side, ball, possession === side);
      bodies[id] = {...spot, vx: 0, vy: 0, sprint: false};
    }
  }
  return {time: t, ball, bodies};
}

/** Moves the scene forward to t1 in small steps. Pure: returns a new scene. */
export function advance(prev: Scene, t1: number, ctx: Ctx): Scene {
  let ball = {...prev.ball};
  const bodies: Record<string, Body> = {};
  for (const [id, b] of Object.entries(prev.bodies)) bodies[id] = {...b};
  let t = prev.time;

  while (t < t1 - 1e-9) {
    const dt = Math.min(STEP, t1 - t);
    t += dt;
    const i = touchIndex(ctx.frames, t);
    const cur = i >= 0 ? ctx.frames[i] : undefined;
    const next = ctx.frames[i + 1];
    const possession: Side = cur?.possession ?? "home";

    // Ball: with the carrier for a moment, then on its way to the next touch.
    if (cur && next) {
      const span = next.minute - cur.minute;
      const held = cur.playerId && next.playerId !== cur.playerId && t - cur.minute < span * HOLD;
      const carrier = cur.playerId ? bodies[cur.playerId] : undefined;
      if (held && carrier) {
        ball = {x: carrier.x, y: carrier.y};
      } else {
        const left = Math.max(next.minute - t, dt);
        const k = Math.min(1, dt / left);
        ball = {x: ball.x + (next.x - ball.x) * k, y: ball.y + (next.y - ball.y) * k};
      }
    } else if (cur?.playerId && bodies[cur.playerId]) {
      ball = {x: bodies[cur.playerId].x, y: bodies[cur.playerId].y};
    }

    for (const side of ["home", "away"] as const) {
      const onPitch = onPitchAt(ctx.report, side, t);
      // The nearest outfield player of the side without the ball presses it.
      let presser: string | undefined;
      if (side !== possession) {
        let best = Infinity;
        for (const [slot, id] of onPitch) {
          const b = bodies[id];
          if (!b || ctx.slots[side][slot].pos === "GK") continue;
          const d = distance(b, ball);
          if (d < best) {
            best = d;
            presser = id;
          }
        }
      }
      for (const [slot, id] of onPitch) {
        const spot = teamSpot(ctx.slots[side][slot], side, ball, possession === side);
        const body = bodies[id] ?? {...spot, vx: 0, vy: 0, sprint: false};
        const w = wander(id, t);
        let target: Point = {x: spot.x + w.x, y: spot.y + w.y};
        let sprint = false;
        if (next?.playerId === id && next.minute - t < 1) {
          target = {x: next.x, y: next.y};
          sprint = true;
        } else if (cur?.playerId === id && next && t - cur.minute < (next.minute - cur.minute) * HOLD) {
          target = {x: cur.x, y: cur.y};
        } else if (id === presser) {
          target = ball;
          sprint = true;
        }
        const top = topSpeed(ctx, id, t);
        const speed = sprint ? top : top * 0.45;
        const dx = target.x - body.x;
        const dy = target.y - body.y;
        const gap = Math.hypot(dx, dy);
        const move = Math.min(gap, speed * dt);
        const nx = gap > 0 ? (dx / gap) * move : 0;
        const ny = gap > 0 ? (dy / gap) * move : 0;
        bodies[id] = {
          x: body.x + nx,
          y: body.y + ny,
          vx: nx / dt,
          vy: ny / dt,
          sprint: sprint && move / dt > top * 0.6,
        };
      }
    }
  }
  // Drop players who went off.
  const onNow = new Set([...onPitchAt(ctx.report, "home", t1).values(), ...onPitchAt(ctx.report, "away", t1).values()]);
  for (const id of Object.keys(bodies)) if (!onNow.has(id)) delete bodies[id];
  return {time: t1, ball, bodies};
}

/** Replays a stored match. */
export function MatchViewer({fixtureId}: {fixtureId: string}) {
  const game = useGameState();
  const watchMatch = useGame((s) => s.watchMatch);
  const report = game.reports.find((r) => r.fixtureId === fixtureId);
  if (!report) return null;
  return <MatchScreen report={report} onClose={() => watchMatch(null)} />;
}

/** The user's match, played live: it stops at penalties and free kicks. */
export function LiveMatchViewer() {
  const game = useGameState();
  const act = useGame((s) => s.act);
  const [live] = useState(() => new LiveMatch(game));
  // Closing early lets the computer decide the rest; either way the week goes on.
  const finish = () => {
    live.playOut();
    act((g, rng) => finishWeek(g, rng));
  };
  return <MatchScreen report={live.report} live={live} onClose={finish} onFinish={finish} />;
}

interface ScreenProps {
  report: MatchReport;
  live?: LiveMatch;
  onClose: () => void;
  onFinish?: () => void;
}

function MatchScreen({report, live, onClose, onFinish}: ScreenProps) {
  const {t, tx} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const ctx = useMemo<Ctx>(
    () => ({
      report,
      frames: report.frames,
      slots: {home: FORMATIONS[report.formations.home], away: FORMATIONS[report.formations.away]},
      players: game.players,
    }),
    // Players only matter for pace and stamina, which don't change mid-replay.
    [report]
  );
  const [scene, setScene] = useState<Scene>(() => snap(ctx, 0));
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  // The set piece just taken, shown with its result before play goes on.
  const [shown, setShown] = useState<{sp: SetPiece; outcome?: SetPieceOutcome} | null>(null);
  const [, rerender] = useState(0);

  // Playback can't run past a set piece the user hasn't taken yet.
  const limit = live?.pending ? live.pending.minute - 1 : 90;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      // Cap the step so a background tab doesn't fast-forward in one jump.
      const dt = last === null ? 0 : Math.min(now - last, 100);
      last = now;
      setScene((prev) => {
        const next = Math.min(limit, prev.time + (dt / MS_PER_MINUTE) * speed);
        return next > prev.time ? advance(prev, next, ctx) : prev;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, ctx, limit]);

  const time = scene.time;
  useEffect(() => {
    if (time >= 90) setPlaying(false);
  }, [time]);

  const pending = live?.pending && time >= live.pending.minute - 1 - 1e-6 ? live.pending : null;
  const current = shown ?? (pending ? {sp: pending} : null);

  const answer = (input: SetPieceInput | null) => {
    if (!live?.pending) return;
    const sp = live.pending;
    // Saved straight away, so reloading can't undo the choice.
    if (input) act((g) => { if (g.liveMatch) g.liveMatch.inputs[sp.index] = input; });
    live.answer(input);
    setShown({sp, outcome: report.setPieces?.find((s) => s.index === sp.index)});
  };

  const events = report.events.filter((e) => e.minute <= time);
  const home = game.clubs[report.homeId];
  const away = game.clubs[report.awayId];
  const score = {
    home: events.filter((e) => e.type === "goal" && e.side === "home").length,
    away: events.filter((e) => e.type === "goal" && e.side === "away").length,
  };
  const done = time >= 90 && (!live || live.done);
  const carrierIndex = touchIndex(report.frames, time);
  const carrierId = carrierIndex >= 0 ? report.frames[carrierIndex].playerId : undefined;

  const name = (id?: string) => {
    const p = id ? game.players[id] : undefined;
    return p ? p.lastName : "?";
  };
  const jump = (to: number) => {
    if (to >= 90 && live) {
      live.playOut();
      setShown(null);
      rerender((n) => n + 1);
    }
    setScene(snap(ctx, to));
    setPlaying(to < 90);
  };

  const dots = (side: Side) => {
    const club = side === "home" ? home : away;
    return [...onPitchAt(report, side, time).values()].map((id) => {
      const b = scene.bodies[id];
      if (!b) return null;
      const cx = b.x * 1.05;
      const cy = b.y * 0.68;
      // Trail length follows actual speed, so fast sprinters leave longer trails.
      const trail = b.sprint ? 0.12 : 0;
      return (
        <g key={id}>
          {trail > 0 && (
            <line
              x1={(b.x - b.vx * trail) * 1.05}
              y1={(b.y - b.vy * trail) * 0.68}
              x2={cx}
              y2={cy}
              className="trail"
              stroke={club.color}
            />
          )}
          <g transform={`translate(${cx} ${cy})`}>
            {id === carrierId && <circle r={2.4} className="carrier-ring" />}
            <circle r={1.6} fill={club.color} stroke={club.color2} strokeWidth={0.4} />
            <text y={-2.4} className="dot-label">{name(id)}</text>
          </g>
        </g>
      );
    });
  };

  const title = (
    <>
      {live && <span className="live-badge">{t("match.live")}</span>} {home.name} – {away.name}
    </>
  );

  return (
    <Modal wide title={title} onClose={onClose}>
      <div className="scoreboard">
        <span className="crest" style={{background: home.color, color: home.color2}}>{home.short}</span>
        <span className="score">{score.home} – {score.away}</span>
        <span className="crest" style={{background: away.color, color: away.color2}}>{away.short}</span>
        <span className="clock">{Math.floor(time)}'</span>
      </div>

      {current && live ? (
        <SetPieceView
          key={current.sp.index}
          sp={current.sp}
          role={live.role(current.sp) ?? "shooter"}
          taker={game.players[current.sp.takerId]}
          keeper={current.sp.keeperId ? game.players[current.sp.keeperId] : undefined}
          shooters={current.sp.side === "home" ? home : away}
          keepers={current.sp.side === "home" ? away : home}
          outcome={current.outcome}
          onAnswer={answer}
          onDone={() => setShown(null)}
        />
      ) : (
        <svg className="pitch" viewBox="0 0 105 68" role="img" aria-label={t("match.pitch")}>
          <rect x={0} y={0} width={105} height={68} className="pitch-grass" />
          <g className="pitch-line">
            <rect x={1} y={1} width={103} height={66} fill="none" />
            <line x1={52.5} y1={1} x2={52.5} y2={67} />
            <circle cx={52.5} cy={34} r={9.15} fill="none" />
            <rect x={1} y={13.84} width={16.5} height={40.32} fill="none" />
            <rect x={87.5} y={13.84} width={16.5} height={40.32} fill="none" />
            <rect x={1} y={24.84} width={5.5} height={18.32} fill="none" />
            <rect x={98.5} y={24.84} width={5.5} height={18.32} fill="none" />
          </g>
          {dots("home")}
          {dots("away")}
          <circle cx={scene.ball.x * 1.05} cy={scene.ball.y * 0.68} r={0.9} className="ball" />
        </svg>
      )}
      <p className="muted small">{t("match.legend")}</p>

      <div className="btn-row">
        {done && onFinish ? (
          <button className="btn primary" onClick={onFinish}>{t("match.finish")} ▶</button>
        ) : (
          <>
            <button className="btn" disabled={!!current} onClick={() => (done ? jump(0) : setPlaying(!playing))}>
              {done ? `↺ ${t("match.replay")}` : playing ? `⏸ ${t("match.pause")}` : `▶ ${t("match.play")}`}
            </button>
            {SPEEDS.map((s) => (
              <button key={s} className={s === speed ? "chip active" : "chip"} onClick={() => setSpeed(s)}>{s}×</button>
            ))}
            {!done && <button className="btn" onClick={() => jump(90)}>⏭ {t("match.skip")}</button>}
          </>
        )}
      </div>

      <div className="match-columns">
        <ol className="feed" aria-live="polite">
          {events.slice().reverse().map((e, i) => (
            <li key={i} className={`ev ev-${e.type} ${e.side ?? ""}`}>
              <span className="ev-min">{e.minute}'</span> {eventText(e, name, tx, e.side === "home" ? home.short : away.short)}
            </li>
          ))}
        </ol>
        {done && <Summary report={report} />}
      </div>
    </Modal>
  );
}

function eventText(e: MatchEvent, name: (id?: string) => string, tx: (k: string, p?: Record<string, string | number>) => string, team: string): string {
  const params = {player: name(e.playerId), other: name(e.otherId), team};
  if (e.type === "goal" && e.otherId) return tx("ev.goalAssist", params);
  return tx(`ev.${e.type}`, params);
}

function Summary({report}: {report: MatchReport}) {
  const {t} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const rows = (clubId: string) =>
    Object.entries(report.ratings)
      .filter(([id]) => game.players[id]?.clubId === clubId || game.players[id]?.loan?.parentClubId === clubId)
      .sort((a, b) => b[1] - a[1]);
  return (
    <div className="summary">
      <dl className="kv">
        <dt>{t("match.possession")}</dt><dd>{report.possessionHome}% – {100 - report.possessionHome}%</dd>
        <dt>{t("match.shots")}</dt><dd>{report.shots[0]} – {report.shots[1]}</dd>
        <dt>{t("match.onTarget")}</dt><dd>{report.onTarget[0]} – {report.onTarget[1]}</dd>
      </dl>
      <div className="ratings">
        {[report.homeId, report.awayId].map((clubId) => (
          <div key={clubId}>
            <h4>{game.clubs[clubId].short}</h4>
            <ul className="plain-list small">
              {rows(clubId).map(([id, r]) => (
                <li key={id}>
                  <button className="link" onClick={() => openPlayer(id)}>{game.players[id].lastName}</button>{" "}
                  <span className={r >= 7.5 ? "rating good" : r < 6 ? "rating bad" : "rating"}>{r.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
