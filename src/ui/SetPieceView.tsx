// The close-up for a penalty or free kick. The goal is seen from behind the
// ball. Shooting: drag from the ball to where the shot should go; the circle
// shows how accurate the taker is. Keeping: drag the way the keeper should dive.
import {useEffect, useRef, useState, type PointerEvent} from "react";
import {WALL, keeperReach, shotSpread, type SetPiece, type SetPieceInput, type SetPieceOutcome} from "../game/setpieces";
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
  /** Set once answered: where the ball and keeper went. */
  outcome?: SetPieceOutcome;
  onAnswer: (input: SetPieceInput | null) => void;
  onDone: () => void;
}

export function SetPieceView({sp, role, taker, keeper, shooters, keepers, outcome, onAnswer, onDone}: Props) {
  const {t} = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{x: number; y: number} | null>(null);
  const [left, setLeft] = useState(SECONDS);

  // Countdown; at zero the computer decides.
  useEffect(() => {
    if (outcome) return;
    if (left <= 0) {
      onAnswer(null);
      return;
    }
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left, outcome, onAnswer]);

  // Show the result for a moment, then carry on.
  useEffect(() => {
    if (!outcome) return;
    const id = setTimeout(onDone, 2400);
    return () => clearTimeout(id);
  }, [outcome, onDone]);

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
