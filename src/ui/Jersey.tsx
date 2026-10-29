// A match shirt in the club's colours, like the ones on a fantasy-league lineup, plain or patterned
// (stripes, hoops, checks…) in the club's two colours. Keepers wear green.
import {useId} from "react";
import type {Collar, ShirtPattern, Sleeves} from "../game/types";

/** The shirt's outline: short or long sleeves, a round (U) or V neck. */
function bodyPath(sleeves: Sleeves, collar: Collar): string {
  const neck = collar === "v" ? "L20 11 L13 3Z" : collar === "polo" ? "L20 7.4 L13 3Z" : collar === "upolo" ? "Q20 6.6 13 3Z" : "Q20 8 13 3Z";
  // A tank top (no sleeves): narrow straps and round armholes.
  if (sleeves === "none") return `M13 3 L10.5 3.5 Q11 11 9 16 L9 37 Q20 39 31 37 L31 16 Q29 11 29.5 3.5 L27 3 ${neck}`;
  return sleeves === "long"
    ? `M13 3 L8 5 L2 12 L2 32 L7 32 L9 17 L9 37 Q20 39 31 37 L31 17 L33 32 L38 32 L38 12 L32 5 L27 3 ${neck}`
    : `M13 3 L8 5 L1 11 L5 18 L9 15.5 L9 37 Q20 39 31 37 L31 15.5 L35 18 L39 11 L32 5 L27 3 ${neck}`;
}

/** A nuance of the club colour: lighter on a dark shirt, darker on a light one (for the tone-on-tone patterns). */
export function shade(hex: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const h = m[1].length === 3 ? m[1].replace(/./g, "/** The pattern drawn/** The pattern drawn") : m[1];
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const light = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) > 150;
  const out = c.map((v) => Math.round(light ? v * 0.78 : v + (255 - v) * 0.24));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** The pattern drawn over the shirt in the second colour (the shirt's shape cuts it to size). */
function Pattern({pattern, color, base}: {pattern: ShirtPattern; color: string; base: string}) {
  const tone = shade(base);
  switch (pattern) {
    case "chevron":
      return <g fill="none" stroke={color} strokeWidth={3.2}>{[0, 1, 2].map((i) => <path key={i} d={`M4 ${15 + i * 9} L20 ${23 + i * 9} L36 ${15 + i * 9}`} />)}</g>;
    case "yoke":
      return <path d="M0 0 H40 V12 L27 9 Q20 11 13 9 L0 12Z" fill={color} />;
    case "sleeves":
      return <><rect x={0} y={0} width={9} height={40} fill={color} /><rect x={31} y={0} width={9} height={40} fill={color} /></>;
    case "tonal":
      return <g stroke={tone} strokeWidth={1.3} strokeLinecap="round">{Array.from({length: 12}, (_, i) => <line key={i} x1={i * 5 - 14} y1={40} x2={i * 5 + 6} y2={0} />)}</g>;
    case "waves":
      return <g fill="none" stroke={tone} strokeWidth={1.4}>{Array.from({length: 9}, (_, i) => <path key={i} d={`M${3 + i * 4.6} 0 q2.2 4 0 8 t0 8 t0 8 t0 8 t0 8`} />)}</g>;
    case "stripes":
      return <>{[1, 2, 3, 4, 5, 6, 7].filter((_, i) => i % 2 === 0).map((i) => <rect key={i} x={(i - 1) * 5.6 + 0.2} y={0} width={5.6} height={40} fill={color} />)}</>;
    case "hoops":
      return <>{[0, 1, 2, 3, 4, 5, 6, 7].filter((_, i) => i % 2 === 1).map((i) => <rect key={i} x={0} y={3 + i * 4.6} width={40} height={4.6} fill={color} />)}</>;
    case "pinstripes":
      return <>{Array.from({length: 11}, (_, i) => <rect key={i} x={2 + i * 3.6} y={0} width={0.9} height={40} fill={color} />)}</>;
    case "checks":
      return <>{Array.from({length: 7 * 8}, (_, k) => ({r: Math.floor(k / 8), c: k % 8})).filter(({r, c}) => (r + c) % 2 === 0).map(({r, c}) => <rect key={`${r}-${c}`} x={c * 5} y={r * 5 + 2} width={5} height={5} fill={color} />)}</>;
    case "halves":
      return <rect x={20} y={0} width={20} height={40} fill={color} />;
    case "sash":
      return <path d="M2 4 L11 2 L40 31 L40 40 L33 40 L2 9Z" fill={color} transform="translate(-1 3)" />;
    default:
      return null;
  }
}

export function Jersey({color, trim, number, size = 44, keeper, pattern, trim3, collar = "round", sleeves = "short"}: {color: string; trim: string; number?: number; size?: number; keeper?: boolean; pattern?: ShirtPattern; trim3?: string; collar?: Collar; sleeves?: Sleeves}) {
  const body = keeper ? "#16a34a" : color;
  const edge = keeper ? "#facc15" : trim3 ?? trim;
  const clip = useId();
  const BODY = bodyPath(sleeves, collar);
  const patterned = !keeper && pattern && pattern !== "solid";
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className="jersey" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <path d={BODY} fill={body} />
      {patterned && (
        <g clipPath={`url(#${clip})`}>
          <Pattern pattern={pattern} color={trim} base={color} />
        </g>
      )}
      <path d={BODY} fill="none" stroke="rgb(0 0 0 / 0.35)" strokeWidth={0.8} strokeLinejoin="round" />
      {collar === "upolo" ? (
        // A round (U) neck with a collar: a folded band that lies close to the neck.
        <g fill="none" strokeLinecap="round">
          <path d="M12.7 2.7 Q20 8.4 27.3 2.7" stroke="rgb(0 0 0 / 0.4)" strokeWidth={3.6} />
          <path d="M12.7 2.7 Q20 8.4 27.3 2.7" stroke={edge} strokeWidth={2.6} />
        </g>
      ) : collar === "polo" ? (
        // A polo collar: two small folded flaps close to the neck and a short placket.
        <g>
          <path d="M20 7.6 L20 12.4" stroke={edge} strokeWidth={1.2} strokeLinecap="round" />
          <path d="M12.6 2.4 L20 7.8 L16.9 9.2 L11.2 4.6Z" fill={edge} stroke="rgb(0 0 0 / 0.4)" strokeWidth={0.6} strokeLinejoin="round" />
          <path d="M27.4 2.4 L20 7.8 L23.1 9.2 L28.8 4.6Z" fill={edge} stroke="rgb(0 0 0 / 0.4)" strokeWidth={0.6} strokeLinejoin="round" />
        </g>
      ) : (
        <path d={collar === "v" ? "M13 3 L20 11 L27 3" : "M13 3 Q20 8 27 3"} fill="none" stroke={edge} strokeWidth={2} strokeLinecap="round" />
      )}
      {sleeves === "rolled" ? (
        // Short sleeves turned up: a wide cuff with a fold line.
        <g strokeLinecap="round">
          <path d="M2.6 11.6 L6 16.6 M37.4 11.6 L34 16.6" stroke={edge} strokeWidth={3} />
          <path d="M4.3 9.4 L7.4 14.2 M35.7 9.4 L32.6 14.2" stroke="rgb(0 0 0 / 0.3)" strokeWidth={0.7} />
        </g>
      ) : sleeves === "none" ? (
        <path d="M10.5 3.5 Q11 11 9 16 M29.5 3.5 Q29 11 31 16" fill="none" stroke={edge} strokeWidth={1.6} strokeLinecap="round" />
      ) : (
        <path d={sleeves === "long" ? "M2 30.5 L7 30.5 M33 30.5 L38 30.5" : "M1.8 12 L5.4 17.2 M38.2 12 L34.6 17.2"} stroke={edge} strokeWidth={1.4} />
      )}
      <path d="M9 17 L9 37 Q11 37.4 13 37.6 L13 12 Z" fill="#000" opacity={0.12} />
      {number !== undefined && (
        // On a pattern the number gets a dark outline so it stays readable on either colour.
        <text x={20} y={27.5} textAnchor="middle" fontSize={12} fontWeight={900} fill={patterned && !trim3 ? "#fff" : edge} stroke={patterned ? "rgb(0 0 0 / 0.7)" : "rgb(0 0 0 / 0.25)"} strokeWidth={patterned ? 1 : 0.3} paintOrder="stroke">
          {number}
        </text>
      )}
    </svg>
  );
}
