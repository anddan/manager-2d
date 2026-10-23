// The close-up for a set piece.
// Penalties and free kicks: the goal is seen from behind the ball. Shooting:
// drag from the ball to where the shot should go; the circle shows how
// accurate the taker is. Keeping: drag the way the keeper should dive.
// Corners: tap the zone the cross should go to; each zone shows who goes up.
import {useEffect, useRef, useState, type PointerEvent} from "react";
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
import type {Club, Player} from "../game/types";
import {useT} from "../i18n";

// Goal in SVG units: posts at x 20 and 100, bar at y 12, ground at y 52.
const LEFT = 20;
const WIDTH = 80;
const BAR = 12;
const GROUND = 52;
const HEIGHT = GROUND - BAR;
const CENTER = LEFT + WIDTH / 2;
const BALL = {x: CENTER, y: 68};
const SECONDS = 10;

const toSvgX = (goalX: number) => CENTER + goalX * (WIDTH / 2);
const toSvgY = (goalY: number) => GROUND - goalY * HEIGHT;

interface Props {
  sp: SetPiece;
  role: SetPieceRole;
  taker: Player;
  keeper?: Player;
  shooters: Club;
  keepers: Club;
  /** The attacking side's players on the pitch (for corners). */
  attackers?: Player[];
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
function useCountdown(outcome: SetPieceOutcome | undefined, onAnswer: Props["onAnswer"], onDone: Props["onDone"]): number {
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
    const id = setTimeout(() => doneRef.current(), 2400);
    return () => clearTimeout(id);
  }, [outcome]);
  return left;
}

function ShotView({sp, role, taker, keeper, shooters, keepers, outcome, onAnswer, onDone}: Props) {
  const {t} = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{x: number; y: number} | null>(null);
  const left = useCountdown(outcome, onAnswer, onDone);

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
  const title = sp.kind === "penalty"
    ? ours ? t("sp.penaltyUs") : t("sp.penaltyThem", {team: shooters.name})
    : t("sp.freekickUs");
  const spread = shotSpread(taker, sp.kind) * (WIDTH / 2) * 1.3;
  const reach = keeperReach(keeper, sp.kind) * (WIDTH / 2);
  const keeperX = outcome ? toSvgX(outcome.dive) : role === "keeper" && drag ? toSvgX(drag.x) : CENTER;
  const diving = outcome ? Math.abs(outcome.dive) > 0.2 : role === "keeper" && !!drag && Math.abs(drag.x) > 0.2;

  return (
    <div className="setpiece">
      <div className="setpiece-head">
        <strong>{title}</strong>
        {!outcome && <span className="clock">{t("sp.seconds", {s: left})}</span>}
      </div>
      <p className="muted small">
        {ours
          ? t("sp.aimHint", {name: taker.lastName})
          : t("sp.diveHint", {name: taker.lastName, keeper: keeper?.lastName ?? "?"})}
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
        <rect x={0} y={0} width={120} height={75} className="sp-sky" />
        <rect x={0} y={GROUND} width={120} height={23} className="sp-grass" />
        {/* Net */}
        <g className="sp-net">
          {Array.from({length: 17}, (_, i) => <line key={`v${i}`} x1={LEFT + i * 5} y1={BAR} x2={LEFT + i * 5} y2={GROUND} />)}
          {Array.from({length: 9}, (_, i) => <line key={`h${i}`} x1={LEFT} y1={BAR + i * 5} x2={LEFT + WIDTH} y2={BAR + i * 5} />)}
        </g>
        <path d={`M${LEFT} ${GROUND} V${BAR} H${LEFT + WIDTH} V${GROUND}`} className="sp-posts" />

        {/* Keeper: stretched sideways when diving */}
        <g transform={`translate(${keeperX} ${GROUND})`} className="sp-keeper">
          <g transform={diving ? `rotate(${(outcome ? outcome.dive : drag?.x ?? 0) > 0 ? 60 : -60}) translate(0 -2)` : undefined}>
            <rect x={-4} y={-22} width={8} height={14} rx={3} fill={keepers.color === "#16a34a" ? "#f97316" : "#16a34a"} />
            <circle cx={0} cy={-25} r={3.4} fill="#e8b48f" />
            <line x1={-4} y1={-19} x2={-9} y2={-27} />
            <line x1={4} y1={-19} x2={9} y2={-27} />
            <line x1={-2} y1={-8} x2={-3} y2={0} />
            <line x1={2} y1={-8} x2={3} y2={0} />
          </g>
        </g>
        {role === "keeper" && !outcome && (
          <rect x={keeperX - reach} y={GROUND - 1.5} width={reach * 2} height={1.5} className="sp-reach" />
        )}

        {/* Wall on free kicks */}
        {sp.kind === "freekick" && (
          <g className="sp-wall">
            {[0, 1, 2, 3].map((i) => {
              const gx = sp.wallSide * (WALL.inner + ((WALL.outer - WALL.inner) * (i + 0.5)) / 4);
              const x = toSvgX(gx);
              return (
                <g key={i} transform={`translate(${x} ${GROUND + 4})`}>
                  <rect x={-3.6} y={-22} width={7.2} height={16} rx={3} fill={keepers.color} stroke={keepers.color2} strokeWidth={0.6} />
                  <circle cx={0} cy={-25} r={3} fill="#e8b48f" />
                  <rect x={-2.6} y={-6} width={2} height={6} fill="#1f2937" />
                  <rect x={0.6} y={-6} width={2} height={6} fill="#1f2937" />
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
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10z" fill="#fde047" />
          </marker>
        </defs>

        {/* Ball: on the spot, or where it ended up */}
        <circle
          cx={outcome ? toSvgX(outcome.shot.x) : BALL.x}
          cy={outcome ? Math.min(toSvgY(outcome.shot.y), GROUND + 2) : BALL.y}
          r={outcome ? 2 : 2.6}
          className="sp-ball"
        />
      </svg>

      {outcome ? (
        <p className={`sp-result sp-${outcome.result}`}>{t(`sp.result.${outcome.result}`)}</p>
      ) : (
        <div className="btn-row">
          <button className="btn" onClick={() => onAnswer(null)}>{t("sp.auto")}</button>
        </div>
      )}
    </div>
  );
}

// Corner view: the box from above, goal at the top.
const ZONE_SPOTS: Record<CornerTarget, (flag: number) => {x: number; y: number}> = {
  near: (flag) => ({x: 50 + flag * 9, y: 13}),
  penalty: () => ({x: 50, y: 30}),
  far: (flag) => ({x: 50 - flag * 11, y: 15}),
  short: (flag) => ({x: 50 + flag * 37, y: 16}),
};

function CornerView({sp, taker, attackers = [], shooters, outcome, onAnswer, onDone}: Props) {
  const {t} = useT();
  const left = useCountdown(outcome, onAnswer, onDone);
  const flag = sp.wallSide;
  const flagX = flag < 0 ? 3 : 97;
  const chosen = outcome?.target;
  const header = outcome?.headerId ? attackers.find((p) => p.id === outcome.headerId) : undefined;
  return (
    <div className="setpiece">
      <div className="setpiece-head">
        <strong>{t("sp.cornerUs")}</strong>
        {!outcome && <span className="clock">{t("sp.seconds", {s: left})}</span>}
      </div>
      <p className="muted small">{t("sp.cornerHint", {name: taker.lastName})}</p>
      <svg className="setpiece-goal corner" viewBox="0 0 100 62" role="img" aria-label={t("sp.cornerUs")}>
        <rect x={0} y={0} width={100} height={62} className="sp-grass" />
        <g className="pitch-line">
          <line x1={0} y1={6} x2={100} y2={6} />
          <rect x={20} y={6} width={60} height={34} fill="none" />
          <rect x={37} y={6} width={26} height={10} fill="none" />
          <path d="M40 40 A12 12 0 0 0 60 40" fill="none" />
          <circle cx={50} cy={28} r={0.6} className="spot" />
        </g>
        <rect x={44} y={2} width={12} height={4} className="sp-goal-top" />
        <line x1={flagX} y1={6} x2={flagX} y2={1} className="sp-flag-pole" />
        <path d={`M${flagX} 1 l${flag < 0 ? 4 : -4} 1.5 l${flag < 0 ? -4 : 4} 1.5z`} fill="#fde047" />
        <circle cx={flagX + (flag < 0 ? 1 : -1)} cy={7} r={1.4} className="sp-ball" />
        {CORNER_TARGETS.map((zone) => {
          const at = ZONE_SPOTS[zone](flag);
          const who = cornerAttacker(attackers, zone, taker.id);
          const active = chosen === zone;
          return (
            <g
              key={zone}
              className={`zone ${active ? "active" : ""} ${outcome ? "locked" : ""}`}
              onClick={outcome ? undefined : () => onAnswer({target: zone})}
              role="button"
              tabIndex={outcome ? -1 : 0}
              aria-label={t(`sp.zone.${zone}`)}
              onKeyDown={(e) => !outcome && (e.key === "Enter" || e.key === " ") && onAnswer({target: zone})}
            >
              <circle cx={at.x} cy={at.y} r={6.5} />
              <text x={at.x} y={at.y - 0.5} className="zone-label">{t(`sp.zone.${zone}`)}</text>
              <text x={at.x} y={at.y + 3} className="zone-player">{who?.lastName ?? "?"}</text>
            </g>
          );
        })}
        {outcome && chosen && (
          <line
            x1={flagX}
            y1={7}
            x2={ZONE_SPOTS[chosen](flag).x}
            y2={ZONE_SPOTS[chosen](flag).y}
            className="sp-cross"
            stroke={shooters.color2}
          />
        )}
      </svg>
      {outcome ? (
        <p className={`sp-result sp-${outcome.result}`}>
          {t(`sp.result.${outcome.result}`)} {header && outcome.result !== "cleared" && <small className="muted">({header.lastName})</small>}
        </p>
      ) : (
        <div className="btn-row">
          <button className="btn" onClick={() => onAnswer(null)}>{t("sp.auto")}</button>
        </div>
      )}
    </div>
  );
}