// A whole player for the set-piece close-ups: kit, arms in a pose, and the
// same cartoon face as the player's portrait. Drawn with the feet at (0, 0),
// about 30 units tall, for use inside another SVG.
import type {Look} from "./Avatar";
import {Face} from "./Avatar";

export type Pose = "ready" | "up" | "wall" | "run" | "kick";

interface Props {
  look: Look;
  kit: string;
  trim: string;
  shorts?: string;
  socks?: string;
  facing?: "front" | "back";
  pose?: Pose;
  gloves?: boolean;
  number?: number;
  name?: string;
  mood?: number;
}

/** Elbow and hand for the right arm (x mirrored for the left). */
const ARMS: Record<Pose, {elbow: [number, number]; hand: [number, number]}> = {
  ready: {elbow: [7.6, -16.5], hand: [9, -12.2]},
  up: {elbow: [6.6, -27], hand: [7.4, -32.5]},
  wall: {elbow: [4.4, -15.2], hand: [1.3, -12.4]},
  run: {elbow: [6.2, -17], hand: [4.6, -13.6]},
  kick: {elbow: [7.8, -19], hand: [10, -21]},
};

export function Figure({look, kit, trim, shorts = "#111827", socks, facing = "front", pose = "ready", gloves, number, name, mood}: Props) {
  const arm = ARMS[pose];
  const sock = socks ?? kit;
  const leg = (side: -1 | 1, swing: number) => (
    <g transform={`rotate(${swing} ${side * 1.9} -9)`}>
      <rect x={side * 1.9 - 1.3} y={-9} width={2.6} height={4.6} rx={1} fill={look.skin} />
      <rect x={side * 1.9 - 1.35} y={-5} width={2.7} height={4.2} rx={0.8} fill={sock} />
      <ellipse cx={side * 1.9 + (facing === "front" ? 0 : 0)} cy={-0.4} rx={1.9} ry={1} fill="#111" />
    </g>
  );
  const armPath = (side: -1 | 1) => {
    const [ex, ey] = arm.elbow;
    const [hx, hy] = arm.hand;
    return (
      <g strokeLinecap="round" fill="none">
        <path d={`M${side * 4.9} -21 L${side * ex} ${ey}`} stroke={kit} strokeWidth={2.6} />
        <path d={`M${side * ex} ${ey} L${side * hx} ${hy}`} stroke={look.skin} strokeWidth={2} />
        {gloves && <circle cx={side * hx} cy={hy} r={1.5} fill="#f8fafc" stroke="#94a3b8" strokeWidth={0.3} />}
      </g>
    );
  };
  const kicking = pose === "kick" || pose === "run";
  return (
    <g className="figure">
      <ellipse cx={0} cy={0.3} rx={5} ry={1.1} fill="#000" opacity={0.2} />
      {leg(-1, kicking ? 14 : 0)}
      {leg(1, pose === "kick" ? -38 : pose === "run" ? -18 : 0)}
      <path d="M-4.7 -13 L4.7 -13 L5 -8.6 L0.6 -8.6 L0 -9.8 L-0.6 -8.6 L-5 -8.6Z" fill={shorts} />
      {facing === "back" && armPath(-1)}
      {facing === "back" && armPath(1)}
      <path d="M-5.6 -21.6 Q0 -23.2 5.6 -21.6 L4.6 -12.6 L-4.6 -12.6Z" fill={kit} stroke="rgb(0 0 0 / 0.25)" strokeWidth={0.25} />
      <rect x={-1.2} y={-23.6} width={2.4} height={2.4} fill={look.skin} />
      {facing === "front" ? (
        <path d="M-2 -22.4 L0 -20.4 L2 -22.4" fill="none" stroke={trim} strokeWidth={0.7} />
      ) : (
        <>
          {name && <text x={0} y={-19.6} className="fig-name" fill={trim}>{name.toUpperCase()}</text>}
          {number !== undefined && <text x={0} y={-14} className="fig-number" fill={trim}>{number}</text>}
        </>
      )}
      {facing === "front" && armPath(-1)}
      {facing === "front" && armPath(1)}
      {facing === "front" ? (
        <g transform="translate(0 -26) scale(0.14) translate(-50 -45)">
          <Face look={look} mood={mood} />
        </g>
      ) : (
        <g>
          <circle cx={-2.9} cy={-25.6} r={0.7} fill={look.skin} />
          <circle cx={2.9} cy={-25.6} r={0.7} fill={look.skin} />
          <ellipse cx={0} cy={-26} rx={2.9} ry={3.3} fill={look.skin} />
          {look.style !== "bald" && (
            <path
              d={look.style === "buzz" ? "M-2.9 -25.8 Q-3 -29.4 0 -29.4 Q3 -29.4 2.9 -25.8 Q0 -24.6 -2.9 -25.8Z" : "M-3.1 -24.4 Q-3.4 -29.8 0 -29.8 Q3.4 -29.8 3.1 -24.4 Q0 -22.8 -3.1 -24.4Z"}
              fill={look.hair}
              opacity={look.style === "buzz" ? 0.6 : 1}
            />
          )}
          {look.style === "afro" && <circle cx={0} cy={-27.4} r={4} fill={look.hair} />}
          {(look.style === "long" || look.style === "bob") && <path d="M-3.2 -25 Q-3.4 -21 -1.6 -21.4 L1.6 -21.4 Q3.4 -21 3.2 -25Z" fill={look.hair} />}
          {look.style === "long" && <path d="M-2.8 -22 Q-2.9 -20.6 0 -20.5 Q2.9 -20.6 2.8 -22Z" fill={look.hair} />}
          {look.style === "ponytail" && <path d="M-0.9 -25.5 Q-1.6 -22.6 0 -21.4 Q1.6 -22.6 0.9 -25.5Z" fill={look.hair} />}
          {look.style === "bun" && <circle cx={0} cy={-27.6} r={1.6} fill={look.hair} />}
          {look.style === "braids" && (
            <g fill={look.hair}>
              {/* Over the shoulders, clear of the name on the back. */}
              {[-23.8, -22.7, -21.6].map((y, i) => (
                <g key={y}>
                  <circle cx={-2.4 - i * 0.5} cy={y} r={0.65} />
                  <circle cx={2.4 + i * 0.5} cy={y} r={0.65} />
                </g>
              ))}
            </g>
          )}
        </g>
      )}
    </g>
  );
}
