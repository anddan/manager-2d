// The close-up for a set piece.
// Penalties and free kicks: the goal is seen from behind the taker, in a
// stadium, with the real players: the taker from behind with their name on
// the shirt, the keeper and the wall with their own faces. Shooting: drag from
// the ball to where the shot should go; the circle shows how accurate the
// taker is. Keeping: drag the way the keeper should dive. Once chosen, the
// taker runs up and strikes, the ball curls in flight, the wall jumps and the
// keeper launches towards where they guessed.
// Corners: tap the zone the cross should go to; each zone shows who goes up.
import {useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode} from "react";
import {shortName} from "../game/helpers";
import {
  CORNER_TARGETS,
  WALL,
  cornerAttacker,
  keeperReach,
  shotSpread,
  type CornerTarget,
  type SetPiece,
  type SetPieceInput,
  type SetPieceOutcome,
} from "../game/setpieces";
import type {SetPieceRole} from "../game/live";
import type {Point} from "../game/pitch";
import type {Club, Player, Position} from "../game/types";
import {useT} from "../i18n";
import {Avatar, lookFor} from "./Avatar";
import {Football} from "./Ball";
import {Flag} from "./common";
import {Figure, type Pose} from "./Figure";

// Goal in SVG units: posts at x 20 and 100, bar at y 12, ground at y 52.
const LEFT = 20;
const WIDTH = 80;
const BAR = 12;
const GROUND = 52;
const HEIGHT = GROUND - BAR;
const CENTER = LEFT + WIDTH / 2;
const BALL = {x: CENTER, y: 68};
/** Ball radius on the spot, and when it reaches the goal (smaller, further away). */
const BALL_R = 3.4;
const BALL_R_GOAL = 2.2;
const SECONDS = 10;
/** Length of the keeper from feet to fingertips, arms up. */
const KEEPER_REACH = 32;

const toSvgX = (goalX: number) => CENTER + goalX * (WIDTH / 2);
const toSvgY = (goalY: number) => GROUND - goalY * HEIGHT;

/** Usual shirt numbers, so the taker's back looks right. */
const NUMBERS: Record<Position, number> = {GK: 1, FB: 2, CB: 4, DM: 6, W: 7, CM: 8, ST: 9, AM: 10};

interface Props {
  sp: SetPiece;
  role: SetPieceRole;
  taker: Player;
  keeper?: Player;
  shooters: Club;
  keepers: Club;
  /** The attacking side's players on the pitch (for corners). */
  attackers?: Player[];
  /** The defending side's players on the pitch (for the wall). */
  defenders?: Player[];
  /** Set once answered: where the ball and keeper went. */
  outcome?: SetPieceOutcome;
  onAnswer: (input: SetPieceInput | null) => void;
  onDone: () => void;
}

export function SetPieceView(props: Props) {
  return props.sp.kind === "corner" ? <CornerView {...props} /> : <ShotView {...props} />;
}

/**
 * Seconds left to choose; at zero the computer decides. Once answered, the
 * result shows for a moment before play goes on. Callbacks go through refs so
 * re-renders don't restart the timers.
 */
function useCountdown(outcome: SetPieceOutcome | undefined, onAnswer: Props["onAnswer"], onDone: Props["onDone"], showFor = 2400): number {
  const [left, setLeft] = useState(SECONDS);
  const answerRef = useRef(onAnswer);
  const doneRef = useRef(onDone);
  answerRef.current = onAnswer;
  doneRef.current = onDone;
  useEffect(() => {
    if (outcome) return;
    if (left <= 0) {
      answerRef.current(null);
      return;
    }
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left, outcome]);
  useEffect(() => {
    if (!outcome) return;
    const id = setTimeout(() => doneRef.current(), showFor);
    return () => clearTimeout(id);
  }, [outcome, showFor]);
  return left;
}

/** Milliseconds since mount, updated every animation frame. */
function useFrameTime(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      setNow(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return now;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const easeOut = (n: number) => 1 - (1 - n) ** 2;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** A crowd behind the goal: rows of heads in a mix of both clubs' colours. */
function Crowd({colors}: {colors: string[]}) {
  const heads = useMemo(() => {
    const out: {x: number; y: number; c: string}[] = [];
    for (let row = 0; row < 6; row++) {
      for (let i = 0; i < 40; i++) {
        const h = (row * 41 + i * 17) % 23;
        out.push({x: i * 3.05 + (row % 2) * 1.5 + (h % 3) * 0.3, y: 4 + row * 4.6 + (h % 2) * 0.4, c: colors[h % colors.length]});
      }
    }
    return out;
  }, [colors]);
  return (
    <g className="sp-crowd">
      {heads.map((p, i) => (
        <g key={i}>
          <rect x={p.x - 1.2} y={p.y + 0.8} width={2.4} height={2.6} rx={0.8} fill={p.c} />
          <circle cx={p.x} cy={p.y} r={1} fill={i % 5 === 0 ? "#8a5638" : i % 3 === 0 ? "#d49c74" : "#ebbd9c"} />
        </g>
      ))}
    </g>
  );
}

function ShotView({sp, role, taker, keeper, defenders, shooters, keepers, outcome, onAnswer, onDone}: Props) {
  const {t} = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{x: number; y: number} | null>(null);
  // A penalty is over quickly: a shorter look at the result.
  const left = useCountdown(outcome, onAnswer, onDone, sp.kind === "penalty" ? 1900 : 2200);
  const now = useFrameTime();
  // When the answer arrived, on the same clock.
  const [struck, setStruck] = useState<number | null>(null);
  const nowRef = useRef(now);
  nowRef.current = now;
  useEffect(() => {
    if (outcome && struck === null) setStruck(nowRef.current);
  }, [outcome, struck]);

  const toGoal = (e: PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * 120;
    const vy = ((e.clientY - rect.top) / rect.height) * 75;
    return {x: (vx - CENTER) / (WIDTH / 2), y: (GROUND - vy) / HEIGHT};
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (outcome) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(toGoal(e));
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (drag && !outcome) setDrag(toGoal(e));
  };
  const onUp = () => {
    if (!drag || outcome) return;
    onAnswer(role === "shooter" ? {aim: {x: drag.x, y: Math.max(0, drag.y)}} : {dive: drag.x});
    setDrag(null);
  };

  const ours = role === "shooter";
  const penalty = sp.kind === "penalty";
  const title = penalty
    ? ours ? t("sp.penaltyUs") : t("sp.penaltyThem", {team: shooters.name})
    : t("sp.freekickUs");
  const spread = shotSpread(taker, sp.kind) * (WIDTH / 2) * 1.3;
  const reach = keeperReach(keeper, sp.kind) * (WIDTH / 2);
  const keeperKit = keepers.color === "#16a34a" ? "#f97316" : "#16a34a";
  const takerLook = useMemo(() => lookFor(taker), [taker]);
  const keeperLook = useMemo(() => (keeper ? lookFor(keeper) : takerLook), [keeper, takerLook]);
  const wallPlayers = useMemo(() => {
    const pool = (defenders ?? []).filter((p) => p.position !== "GK").sort((a, b) => b.attrs.physical - a.attrs.physical);
    return [0, 1, 2, 3].map((i) => pool[i]);
  }, [defenders]);

  // The timeline after the choice: run-up, strike, flight, the result.
  const RUNUP = 450;
  const FLIGHT = penalty ? 380 : 720;
  const e = struck === null ? -1 : now - struck;
  const flying = e >= RUNUP;
  const p = clamp01((e - RUNUP) / FLIGHT);
  const arrived = e >= RUNUP + FLIGHT;
  const after = clamp01((e - RUNUP - FLIGHT) / 350);
  const showResult = e >= RUNUP + FLIGHT + 120;
  // Spins in flight, slows as it lands and then lies still.
  const flown = Math.max(0, e - RUNUP);
  const spin = flown < FLIGHT ? flown * 0.9 : FLIGHT * 0.9 + (1 - (1 - Math.min(1, (flown - FLIGHT) / 350)) ** 2) * 60;

  // Ball path: a curve to where the shot went. Free kicks bend round the wall or dip over it.
  const shotPoint = outcome ? {x: toSvgX(outcome.shot.x), y: Math.min(toSvgY(outcome.shot.y), GROUND - 0.8)} : BALL;
  const wallTop = {x: toSvgX(sp.wallSide * (WALL.inner + WALL.outer) / 2), y: GROUND - 18};
  const endPoint = outcome?.result === "blocked" ? {x: lerp(BALL.x, shotPoint.x, 0.6), y: wallTop.y + 6} : shotPoint;
  const overWall = outcome ? outcome.shot.x * sp.wallSide > 0 : false;
  const curl = penalty ? 0 : overWall ? 0 : sp.wallSide * 14;
  const lift = penalty ? 4 : overWall ? 22 : 12;
  const control = {x: (BALL.x + endPoint.x) / 2 + curl, y: Math.min(BALL.y, endPoint.y) - lift};
  const bez = (k: number) => ({
    x: (1 - k) ** 2 * BALL.x + 2 * (1 - k) * k * control.x + k * k * endPoint.x,
    y: (1 - k) ** 2 * BALL.y + 2 * (1 - k) * k * control.y + k * k * endPoint.y,
  });
  let ball = {x: BALL.x, y: BALL.y, r: BALL_R};
  if (outcome && flying) {
    const at = bez(p);
    ball = {...at, r: lerp(BALL_R, BALL_R_GOAL, p)};
    if (arrived) {
      if (outcome.result === "goal") ball = {x: endPoint.x + (CENTER - endPoint.x) * 0.06 * after, y: endPoint.y - 2 * after, r: BALL_R_GOAL * 0.92};
      else if (outcome.result === "saved") {
        const out = Math.sign(endPoint.x - CENTER) || 1;
        ball = {x: endPoint.x + out * 9 * easeOut(after), y: endPoint.y + 10 * easeOut(after) - Math.sin(after * Math.PI) * 6, r: BALL_R_GOAL * 1.05};
      } else if (outcome.result === "missed") {
        const dir = {x: endPoint.x - control.x, y: endPoint.y - control.y};
        ball = {x: endPoint.x + dir.x * 0.25 * after, y: endPoint.y + dir.y * 0.25 * after, r: lerp(BALL_R_GOAL, BALL_R_GOAL * 0.85, after)};
      } else {
        ball = {x: endPoint.x + sp.wallSide * 4 * after, y: lerp(endPoint.y, GROUND + 8, easeOut(after)), r: BALL_R_GOAL * 1.2};
      }
    }
  }
  const shadowX = outcome && flying ? lerp(BALL.x, endPoint.x, p) : BALL.x;
  const shadowY = outcome && flying ? lerp(BALL.y + 1.6, GROUND + 1, p) : BALL.y + 1.6;

  // Keeper: shuffles on the line, then launches. On penalties they commit as
  // the ball is struck; on free kicks they react to the flight.
  const idleX = CENTER + Math.sin(now / 520) * (penalty ? 1.6 : 2.6);
  const bob = Math.abs(Math.sin(now / 260)) * 0.7;
  let keeperFeet = {x: idleX, y: GROUND - bob};
  let keeperAngle = 0;
  let keeperPose: Pose = "ready";
  if (!outcome && role === "keeper" && drag) {
    keeperFeet = {x: CENTER + drag.x * 5, y: GROUND};
    keeperAngle = Math.max(-25, Math.min(25, drag.x * 25));
  }
  if (outcome && e >= 0) {
    const start = {x: CENTER, y: GROUND};
    const guessed = Math.abs(outcome.dive - outcome.shot.x) < 0.35;
    const hands = outcome.result === "saved"
      ? endPoint
      : {x: toSvgX(outcome.dive), y: toSvgY(guessed ? Math.max(0.12, Math.min(0.9, outcome.shot.y)) : 0.42)};
    const v = {x: hands.x - start.x, y: hands.y - start.y};
    const dist = Math.hypot(v.x, v.y) || 1;
    const fly = Math.max(0, dist - KEEPER_REACH) * (outcome.result === "saved" ? 1 : 0.85);
    const feet = {x: start.x + (v.x / dist) * fly, y: Math.min(GROUND, start.y + (v.y / dist) * fly)};
    const angle = Math.max(-88, Math.min(88, (Math.atan2(v.x, -v.y) * 180) / Math.PI));
    const diveStart = penalty ? RUNUP - 60 : RUNUP + 160;
    const d = easeOut(clamp01((e - diveStart) / 380));
    keeperFeet = {x: lerp(idleX, feet.x, d), y: lerp(GROUND, feet.y, d) - Math.sin(d * Math.PI) * (Math.abs(angle) > 20 ? 3 : 0)};
    keeperAngle = angle * d;
    if (d > 0) keeperPose = "up";
  }

  // The wall jumps as the ball is struck.
  const wallJump = outcome && e >= RUNUP - 30 ? Math.sin(clamp01((e - RUNUP + 30) / 380) * Math.PI) * 5 : 0;

  // The taker runs up from behind and to the side, then strikes.
  const run = outcome ? easeOut(clamp01(e / RUNUP)) : 0;
  const takerAt = {x: lerp(BALL.x - 14, BALL.x - 4.5, run), y: lerp(81, 77, run)};
  const takerPose: Pose = !outcome ? "ready" : e < RUNUP ? "run" : e < RUNUP + 300 ? "kick" : "ready";
  const goalNow = outcome?.result === "goal" && arrived;

  return (
    <div className="setpiece">
      <div className="setpiece-head">
        <strong>{title}</strong>
        {!outcome && <span className="clock">{t("sp.seconds", {s: left})}</span>}
      </div>
      <div className="sp-duel">
        <span className="sp-duelist">
          <Avatar player={taker} shirt={shooters.color} trim={shooters.color2} size={36} />
          <Flag code={taker.nationality} /> <strong>{shortName(taker)}</strong>
        </span>
        <span className="muted">vs</span>
        {keeper && (
          <span className="sp-duelist">
            <strong>{shortName(keeper)}</strong> <Flag code={keeper.nationality} />
            <Avatar player={keeper} shirt={keepers.color} trim={keepers.color2} size={36} />
          </span>
        )}
      </div>
      <p className="muted small">
        {ours
          ? t("sp.aimHint", {name: shortName(taker)})
          : t("sp.diveHint", {name: shortName(taker), keeper: (keeper ? shortName(keeper) : undefined) ?? "?"})}
      </p>
      <svg
        ref={svgRef}
        className="setpiece-goal"
        viewBox="0 0 120 75"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        role="img"
        aria-label={title}
      >
        <defs>
          <linearGradient id="sp-stand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1324" />
            <stop offset="1" stopColor="#1e293b" />
          </linearGradient>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10z" fill="#fde047" />
          </marker>
        </defs>

        {/* Stand, crowd and advertising boards */}
        <rect x={0} y={0} width={120} height={36} fill="url(#sp-stand)" />
        <Crowd colors={[shooters.color, shooters.color2, keepers.color, keepers.color2, "#e2e8f0", "#475569"]} />
        <rect x={0} y={32} width={120} height={5} className="sp-boards" />
        {[8, 38, 68, 98].map((x) => (
          <text key={x} x={x} y={35.6} className="sp-board-text">FORZA MANAGER</text>
        ))}

        {/* Grass, striped and getting wider towards us */}
        <rect x={0} y={37} width={120} height={38} className="sp-grass" />
        {[37, 41.5, 47, 54, 62, 71].map((y, i, all) => i % 2 === 0 && (
          <rect key={y} x={0} y={y} width={120} height={(all[i + 1] ?? 75) - y} className="sp-grass-stripe" />
        ))}
        <line x1={0} y1={GROUND} x2={120} y2={GROUND} className="sp-line" />
        <path d={`M2 58 L118 58 M${LEFT - 14} ${GROUND} L${LEFT - 18} 58 M${LEFT + WIDTH + 14} ${GROUND} L${LEFT + WIDTH + 18} 58`} className="sp-line" />
        {penalty && <ellipse cx={BALL.x} cy={BALL.y + 1.4} rx={1.6} ry={0.6} fill="#fff" opacity={0.8} />}

        {/* Net: back and sides, rippling when the ball goes in */}
        <g className={goalNow ? "sp-net ripple" : "sp-net"}>
          <path d={`M${LEFT} ${BAR} L${LEFT + 5} ${BAR + 4} L${LEFT + WIDTH - 5} ${BAR + 4} L${LEFT + WIDTH} ${BAR} M${LEFT + 5} ${BAR + 4} L${LEFT + 5} ${GROUND - 3} L${LEFT + WIDTH - 5} ${GROUND - 3} L${LEFT + WIDTH - 5} ${BAR + 4}`} className="sp-net-frame" />
          {Array.from({length: 15}, (_, i) => <line key={`v${i}`} x1={LEFT + 5 + i * 5} y1={BAR + 4} x2={LEFT + 5 + i * 5} y2={GROUND - 3} />)}
          {Array.from({length: 8}, (_, i) => <line key={`h${i}`} x1={LEFT + 5} y1={BAR + 4 + i * 4.7} x2={LEFT + WIDTH - 5} y2={BAR + 4 + i * 4.7} />)}
          {Array.from({length: 8}, (_, i) => (
            <g key={`s${i}`}>
              <line x1={LEFT} y1={BAR + i * 5} x2={LEFT + 5} y2={BAR + 4 + i * 4.4} />
              <line x1={LEFT + WIDTH} y1={BAR + i * 5} x2={LEFT + WIDTH - 5} y2={BAR + 4 + i * 4.4} />
            </g>
          ))}
        </g>

        {/* Keeper */}
        <g transform={`translate(${keeperFeet.x} ${keeperFeet.y}) rotate(${keeperAngle})`}>
          <Figure look={keeperLook} kit={keeperKit} trim="#111827" shorts="#111827" socks={keeperKit} gloves pose={keeperPose} mood={keeper?.happiness} />
        </g>
        <path d={`M${LEFT} ${GROUND} V${BAR} H${LEFT + WIDTH} V${GROUND}`} className="sp-posts" />
        {role === "keeper" && !outcome && (
          <rect x={keeperFeet.x - reach} y={GROUND - 1.5} width={reach * 2} height={1.5} className="sp-reach" />
        )}

        {/* Wall on free kicks: the defenders' own faces */}
        {sp.kind === "freekick" && (
          <g className="sp-wall">
            {wallPlayers.map((wp, i) => {
              const gx = sp.wallSide * (WALL.inner + ((WALL.outer - WALL.inner) * (i + 0.5)) / 4);
              const look = wp ? lookFor(wp) : keeperLook;
              return (
                <g key={i} transform={`translate(${toSvgX(gx)} ${GROUND + 7 - wallJump}) scale(1.12)`}>
                  <Figure look={look} kit={keepers.color} trim={keepers.color2} pose="wall" mood={wp?.happiness} />
                </g>
              );
            })}
          </g>
        )}

        {/* Aim */}
        {role === "shooter" && drag && !outcome && (
          <g className="sp-aim">
            <line x1={BALL.x} y1={BALL.y} x2={toSvgX(drag.x)} y2={toSvgY(drag.y)} />
            <circle cx={toSvgX(drag.x)} cy={toSvgY(drag.y)} r={spread} className="sp-spread" />
            <circle cx={toSvgX(drag.x)} cy={toSvgY(drag.y)} r={1.2} className="sp-target" />
          </g>
        )}
        {role === "keeper" && drag && !outcome && (
          <line x1={CENTER} y1={GROUND - 12} x2={toSvgX(drag.x)} y2={GROUND - 12} className="sp-dive-arrow" markerEnd="url(#arrow)" />
        )}

        {/* Ball and its shadow */}
        <ellipse cx={shadowX} cy={shadowY} rx={ball.r * 0.9} ry={ball.r * 0.3} fill="#000" opacity={0.3} />
        <g transform={`translate(${ball.x} ${ball.y}) rotate(${flying ? spin : 0})`}>
          <Football r={ball.r} />
        </g>

        {/* Taker, from behind */}
        <g transform={`translate(${takerAt.x} ${takerAt.y}) scale(1.05)`} opacity={!outcome && ours && drag ? 0.55 : 1}>
          <Figure look={takerLook} kit={shooters.color} trim={shooters.color2} facing="back" pose={takerPose} name={shortName(taker)} number={NUMBERS[taker.position]} />
        </g>
        {goalNow && <text x={CENTER} y={8} className="sp-goal-flash">{t("match.goal")}</text>}
      </svg>

      {outcome && showResult ? (
        <p className={`sp-result sp-${outcome.result}`}>{t(`sp.result.${outcome.result}`)}</p>
      ) : outcome ? (
        <p className="sp-result">&nbsp;</p>
      ) : (
        <div className="btn-row">
          <button className="btn" onClick={() => onAnswer(null)}>{t("sp.auto")}</button>
        </div>
      )}
    </div>
  );
}

// Corner view: from the edge of the box towards the goal, with the stands
// behind. Your attackers are seen from behind (names on their shirts), the
// defenders and keeper from the front with their own faces. Each zone shows
// who goes up there; after the choice the cross comes in, the attacker jumps
// for it and the ball goes in, is saved, goes wide or is headed clear.
// Goal: posts at x 45 and 75, bar at y 30, goal line at y 44.
const C_GOAL = {left: 45, right: 75, bar: 30, line: 44};
const C_CENTER = 60;
/** Where each zone is, for the flag on side `flag` (-1 left, 1 right). */
const C_ZONES: Record<CornerTarget, (flag: number) => Point> = {
  near: (flag) => ({x: C_CENTER + flag * 11, y: 48}),
  penalty: () => ({x: C_CENTER, y: 56}),
  far: (flag) => ({x: C_CENTER - flag * 13, y: 48.5}),
  short: (flag) => ({x: C_CENTER + flag * 44, y: 52}),
};
/** Figures get bigger towards us. */
const cScale = (y: number) => 0.34 + (y - C_GOAL.line) * 0.012;

interface Placed {
  player: Player;
  at: Point;
}

function CornerView({sp, taker, attackers = [], defenders = [], keeper, shooters, keepers, outcome, onAnswer, onDone}: Props) {
  const {t} = useT();
  const left = useCountdown(outcome, onAnswer, onDone, 2700);
  const now = useFrameTime();
  const [struck, setStruck] = useState<number | null>(null);
  const nowRef = useRef(now);
  nowRef.current = now;
  useEffect(() => {
    if (outcome && struck === null) setStruck(nowRef.current);
  }, [outcome, struck]);
  const flag = sp.wallSide;
  const flagAt = {x: flag < 0 ? 3 : 117, y: C_GOAL.line + 0.5};
  const chosen = outcome?.target;
  const header = outcome?.headerId ? attackers.find((p) => p.id === outcome.headerId) : undefined;
  const keeperKit = keepers.color === "#16a34a" ? "#f97316" : "#16a34a";

  // Who stands where: the player each zone goes to first, then the best of the rest.
  const {mine, theirs} = useMemo(() => {
    const zoneOrder: CornerTarget[] = ["near", "penalty", "far", "short"];
    const used = new Set<string>([taker.id]);
    const placed: Placed[] = [];
    for (const zone of zoneOrder) {
      const who = cornerAttacker(attackers.filter((p) => !used.has(p.id)), zone, taker.id);
      if (!who) continue;
      used.add(who.id);
      const z = C_ZONES[zone](flag);
      placed.push({player: who, at: zone === "short" ? z : {x: z.x + (zone === "penalty" ? 0 : flag * 2), y: z.y + 4}});
    }
    const markers = defenders
      .filter((p) => p.position !== "GK")
      .sort((a, b) => b.attrs.defending + b.attrs.physical - (a.attrs.defending + a.attrs.physical))
      .slice(0, placed.length + 1);
    // Goal side of their man; the last one guards the near post.
    const marked: Placed[] = markers.map((p, i) => {
      const target = placed[i];
      return {player: p, at: target ? {x: target.at.x - flag * 1.6, y: target.at.y - 2.2} : {x: C_CENTER + flag * 13, y: C_GOAL.line + 1}};
    });
    return {mine: placed, theirs: marked};
  }, [attackers, defenders, taker.id, flag]);

  // The timeline after the choice: cross in, the jump, then the ball goes on.
  const CROSS_START = 250;
  const CROSS = 800;
  const AFTER = 450;
  const e = struck === null ? -1 : now - struck;
  const crossK = clamp01((e - CROSS_START) / CROSS);
  const afterK = clamp01((e - CROSS_START - CROSS) / AFTER);
  const landed = e >= CROSS_START + CROSS;
  const showResult = e >= CROSS_START + CROSS + AFTER * 0.7;
  const zone = chosen ? C_ZONES[chosen](flag) : null;
  // The ball meets the header at head height above the zone.
  const meet = zone ? {x: zone.x, y: zone.y - 30 * cScale(zone.y) - 1} : flagAt;
  const goalPoint = outcome
    ? {x: C_CENTER + Math.max(-1.3, Math.min(1.3, outcome.shot.x)) * 15, y: C_GOAL.line - Math.max(0.05, Math.min(1.2, outcome.shot.y)) * 14}
    : meet;
  const away = {x: meet.x - flag * 18, y: 70};

  let ball = {x: flagAt.x + (flag < 0 ? 1.5 : -1.5), y: flagAt.y, r: 1.3};
  if (outcome && e >= CROSS_START) {
    if (!landed) {
      const k = crossK;
      const ctrl = {x: (flagAt.x + meet.x) / 2, y: Math.min(flagAt.y, meet.y) - 22};
      ball = {
        x: (1 - k) ** 2 * flagAt.x + 2 * (1 - k) * k * ctrl.x + k * k * meet.x,
        y: (1 - k) ** 2 * flagAt.y + 2 * (1 - k) * k * ctrl.y + k * k * meet.y,
        r: 1.3 + k * 0.2,
      };
    } else {
      const cleared = outcome.result === "cleared";
      const end = cleared ? away : goalPoint;
      const k = easeOut(afterK);
      ball = {
        x: lerp(meet.x, end.x, k),
        y: lerp(meet.y, end.y, k) - (cleared ? Math.sin(k * Math.PI) * 10 : 0),
        r: cleared ? 1.5 + k * 0.6 : 1.5 - k * 0.3,
      };
    }
  }
  const goalNow = outcome?.result === "goal" && afterK >= 1;

  // The header runs in and jumps; their marker goes with them.
  const runK = outcome ? easeOut(clamp01(e / (CROSS_START + CROSS))) : 0;
  const jump = outcome ? Math.sin(clamp01((e - CROSS_START - CROSS * 0.7) / 500) * Math.PI) * 4 : 0;
  const headerIndex = mine.findIndex((m) => m.player.id === outcome?.headerId);
  const placeOf = (pl: Placed, i: number, side: "mine" | "theirs"): {at: Point; lift: number; pose: Pose} => {
    const still = {at: pl.at, lift: 0, pose: (side === "theirs" ? "wall" : "ready") as Pose};
    if (!outcome || !zone) return still;
    if (side === "mine" && pl.player.id === outcome.headerId) {
      return {at: {x: lerp(pl.at.x, zone.x, runK), y: lerp(pl.at.y, zone.y + 0.5, runK)}, lift: jump, pose: jump > 1 ? "up" : "run"};
    }
    if (side === "theirs" && (pl.player.id === outcome.defenderId || i === headerIndex)) {
      return {at: {x: lerp(pl.at.x, zone.x - flag * 1.6, runK), y: lerp(pl.at.y, zone.y - 1.5, runK)}, lift: jump * 0.8, pose: jump > 1 ? "up" : "ready"};
    }
    return still;
  };

  // The keeper: on the line, coming for far-post balls, diving for headers on target.
  let keeperAt: Point = {x: C_CENTER + flag * 2, y: C_GOAL.line + 0.6};
  let keeperAngle = 0;
  let keeperPose: Pose = "ready";
  if (outcome && zone) {
    if (outcome.result === "saved" && chosen === "far" && !header) {
      keeperAt = {x: lerp(keeperAt.x, zone.x, runK), y: lerp(keeperAt.y, zone.y - 1, runK)};
      keeperPose = runK > 0.6 ? "up" : "ready";
    } else if (landed && outcome.result !== "cleared") {
      const d = easeOut(clamp01(afterK * 1.4));
      const target = outcome.result === "saved" ? goalPoint : {x: C_CENTER + (goalPoint.x > C_CENTER ? -1 : 1) * 6, y: goalPoint.y};
      keeperAt = {x: lerp(keeperAt.x, target.x, d), y: keeperAt.y};
      keeperAngle = (target.x - C_CENTER) * 4 * d;
      keeperPose = "up";
    }
  }
  const pick = (target: CornerTarget) => {
    if (!outcome) onAnswer({target});
  };

  // Nearer figures cover the ones behind them.
  const figures: {y: number; node: ReactNode}[] = [];
  mine.forEach((pl, i) => {
    const {at, lift, pose} = placeOf(pl, i, "mine");
    figures.push({
      y: at.y,
      node: (
        <g key={`a${pl.player.id}`} transform={`translate(${at.x} ${at.y - lift}) scale(${cScale(at.y)})`}>
          <Figure look={lookFor(pl.player)} kit={shooters.color} trim={shooters.color2} facing="back" pose={pose} name={shortName(pl.player)} number={NUMBERS[pl.player.position]} />
        </g>
      ),
    });
  });
  theirs.forEach((pl, i) => {
    const {at, lift, pose} = placeOf(pl, i, "theirs");
    figures.push({
      y: at.y,
      node: (
        <g key={`d${pl.player.id}`} transform={`translate(${at.x} ${at.y - lift}) scale(${cScale(at.y)})`}>
          <Figure look={lookFor(pl.player)} kit={keepers.color} trim={keepers.color2} pose={pose} mood={pl.player.happiness} />
        </g>
      ),
    });
  });
  figures.sort((a, b) => a.y - b.y);

  const takerStep = outcome ? lerp(0, flag < 0 ? 2.5 : -2.5, clamp01(e / CROSS_START)) : 0;
  const shadowY = outcome && e >= CROSS_START && !landed ? lerp(flagAt.y, meet.y + 30 * cScale(meet.y), crossK) : ball.y + ball.r;
  const spin = outcome && e >= CROSS_START ? Math.min(e - CROSS_START, CROSS + AFTER) * 0.6 : 0;

  return (
    <div className="setpiece">
      <div className="setpiece-head">
        <strong>{t("sp.cornerUs")}</strong>
        {!outcome && <span className="clock">{t("sp.seconds", {s: left})}</span>}
      </div>
      <p className="muted small">{t("sp.cornerHint", {name: shortName(taker)})}</p>
      <svg className="setpiece-goal corner" viewBox="0 0 120 75" role="img" aria-label={t("sp.cornerUs")}>
        <defs>
          <linearGradient id="corner-stand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1324" />
            <stop offset="1" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={120} height={34} fill="url(#corner-stand)" />
        <Crowd colors={[shooters.color, shooters.color2, keepers.color, keepers.color2, "#e2e8f0", "#475569"]} />
        <rect x={0} y={30} width={120} height={4.5} className="sp-boards" />
        {[6, 36, 66, 96].map((x) => (
          <text key={x} x={x} y={33.4} className="sp-board-text">FORZA MANAGER</text>
        ))}
        <rect x={0} y={34.5} width={120} height={40.5} className="sp-grass" />
        {[34.5, 39, 44, 50, 57, 65].map((y, i, all) => i % 2 === 0 && (
          <rect key={y} x={0} y={y} width={120} height={(all[i + 1] ?? 75) - y} className="sp-grass-stripe" />
        ))}
        {/* Box lines, narrowing away from us. */}
        <g className="sp-line">
          <line x1={0} y1={C_GOAL.line} x2={120} y2={C_GOAL.line} />
          <path d={`M36 ${C_GOAL.line} L33 49.5 L87 49.5 L84 ${C_GOAL.line}`} />
          <path d={`M18 ${C_GOAL.line} L8 64 L112 64 L102 ${C_GOAL.line}`} />
          <path d="M44 64 Q60 69 76 64" />
        </g>
        <ellipse cx={C_CENTER} cy={58.5} rx={0.9} ry={0.35} fill="#fff" opacity={0.8} />
        {/* Goal and net */}
        <g className={goalNow ? "sp-net ripple" : "sp-net"}>
          <path
            d={`M${C_GOAL.left} ${C_GOAL.bar} L${C_GOAL.left + 2} ${C_GOAL.bar + 2} L${C_GOAL.right - 2} ${C_GOAL.bar + 2} L${C_GOAL.right} ${C_GOAL.bar} M${C_GOAL.left + 2} ${C_GOAL.bar + 2} V${C_GOAL.line - 1.5} H${C_GOAL.right - 2} V${C_GOAL.bar + 2}`}
            className="sp-net-frame"
          />
          {Array.from({length: 11}, (_, i) => <line key={`v${i}`} x1={C_GOAL.left + 2 + i * 2.6} y1={C_GOAL.bar + 2} x2={C_GOAL.left + 2 + i * 2.6} y2={C_GOAL.line - 1.5} />)}
          {Array.from({length: 5}, (_, i) => <line key={`h${i}`} x1={C_GOAL.left + 2} y1={C_GOAL.bar + 2 + i * 2.6} x2={C_GOAL.right - 2} y2={C_GOAL.bar + 2 + i * 2.6} />)}
        </g>
        <g transform={`translate(${keeperAt.x} ${keeperAt.y}) rotate(${keeperAngle}) scale(${cScale(keeperAt.y)})`}>
          <Figure look={keeper ? lookFor(keeper) : lookFor(taker)} kit={keeperKit} trim="#111827" socks={keeperKit} gloves pose={keeperPose} mood={keeper?.happiness} />
        </g>
        <path d={`M${C_GOAL.left} ${C_GOAL.line} V${C_GOAL.bar} H${C_GOAL.right} V${C_GOAL.line}`} className="sp-posts" />

        {/* Zones to aim for. */}
        {CORNER_TARGETS.map((z) => {
          const at = C_ZONES[z](flag);
          const who = cornerAttacker(attackers, z, taker.id);
          return (
            <g
              key={z}
              className={`zone ${chosen === z ? "active" : ""} ${outcome ? "locked" : ""}`}
              onClick={() => pick(z)}
              role="button"
              tabIndex={outcome ? -1 : 0}
              aria-label={`${t(`sp.zone.${z}`)}: ${(who ? shortName(who) : undefined) ?? "?"}`}
              onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && pick(z)}
            >
              <ellipse cx={at.x} cy={at.y} rx={17 * cScale(at.y)} ry={6 * cScale(at.y)} />
            </g>
          );
        })}

        {figures.map((f) => f.node)}

        {/* Labels on top, so the players don't hide them: the zone and who goes up there. */}
        {!outcome &&
          CORNER_TARGETS.map((z) => {
            const at = C_ZONES[z](flag);
            const who = cornerAttacker(attackers, z, taker.id);
            const labelY = z === "penalty" ? at.y + 8 : at.y - 13;
            return (
              <g key={`l${z}`} className="zone-tag" onClick={() => pick(z)}>
                <rect x={at.x - 9} y={labelY - 3.2} width={18} height={6.2} rx={1.2} />
                <text x={at.x} y={labelY - 0.4} className="zone-label">{t(`sp.zone.${z}`)}</text>
                <text x={at.x} y={labelY + 2.3} className="zone-player">{(who ? shortName(who) : undefined) ?? "?"}</text>
              </g>
            );
          })}

        {/* The taker at the flag, and the ball. */}
        <line x1={flagAt.x} y1={flagAt.y} x2={flagAt.x} y2={flagAt.y - 6} className="sp-flag-pole" />
        <path d={`M${flagAt.x} ${flagAt.y - 6} l${flag < 0 ? 3 : -3} 1.2 l${flag < 0 ? -3 : 3} 1.2z`} fill="#fde047" />
        <g transform={`translate(${flagAt.x + (flag < 0 ? -1.5 : 1.5) + takerStep} ${flagAt.y + 1.2}) scale(${cScale(flagAt.y + 1.2)})`}>
          <Figure look={lookFor(taker)} kit={shooters.color} trim={shooters.color2} facing="back" pose={outcome && e < CROSS_START + 200 ? "kick" : "ready"} name={shortName(taker)} number={NUMBERS[taker.position]} />
        </g>
        <ellipse cx={ball.x} cy={shadowY} rx={ball.r * 0.8} ry={ball.r * 0.3} fill="#000" opacity={0.25} />
        <g transform={`translate(${ball.x} ${ball.y}) rotate(${spin})`}>
          <Football r={ball.r} />
        </g>
        {goalNow && <text x={C_CENTER} y={9} className="sp-goal-flash">{t("match.goal")}</text>}
      </svg>
      {outcome && showResult ? (
        <p className={`sp-result sp-${outcome.result}`}>
          {t(`sp.result.${outcome.result}`)} {header && outcome.result !== "cleared" && <small className="muted">({shortName(header)})</small>}
        </p>
      ) : outcome ? (
        <p className="sp-result">&nbsp;</p>
      ) : (
        <div className="btn-row">
          <button className="btn" onClick={() => onAnswer(null)}>{t("sp.auto")}</button>
        </div>
      )}
    </div>
  );
}
