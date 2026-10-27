// Country flags drawn as SVG. Emoji flags don't show on Windows (it prints
// the letters "SE" instead), so every nation in the game has a drawing here.
// All flags share a 30x20 box so they line up in lists.
import type {ReactNode} from "react";

/** A Nordic cross: `x` is where the upright starts, `w` its width. */
function nordic(bg: string, cross: string, x: number, w: number, inner?: string): ReactNode {
  const y = 10 - w / 2;
  return (
    <>
      <rect width={30} height={20} fill={bg} />
      <rect x={x} width={w} height={20} fill={cross} />
      <rect y={y} width={30} height={w} fill={cross} />
      {inner && (
        <>
          <rect x={x + w / 4} width={w / 2} height={20} fill={inner} />
          <rect y={y + w / 4} width={30} height={w / 2} fill={inner} />
        </>
      )}
    </>
  );
}

const bands = (colors: string[], vertical = false): ReactNode =>
  colors.map((c, i) =>
    vertical ? (
      <rect key={i} x={(30 / colors.length) * i} width={30 / colors.length + 0.1} height={20} fill={c} />
    ) : (
      <rect key={i} y={(20 / colors.length) * i} width={30} height={20 / colors.length + 0.1} fill={c} />
    )
  );

/** A five-pointed star centred at (cx, cy). */
function star(cx: number, cy: number, r: number, fill: string, outline = false): ReactNode {
  const pts = Array.from({length: 10}, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.4 : r;
    return `${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`;
  });
  return outline ? <polygon points={pts.join(" ")} fill="none" stroke={fill} strokeWidth={0.9} /> : <polygon points={pts.join(" ")} fill={fill} />;
}

/** The USA: thirteen stripes and a blue canton with a few stars (they'd be specks at this size). */
const usa: ReactNode = (
  <>
    {Array.from({length: 13}, (_, i) => (
      <rect key={i} y={(20 / 13) * i} width={30} height={20 / 13 + 0.05} fill={i % 2 === 0 ? "#b22234" : "#ffffff"} />
    ))}
    <rect width={12} height={(20 / 13) * 7} fill="#3c3b6e" />
    {[[2, 2], [6, 2], [10, 2], [4, 5], [8, 5], [2, 8], [6, 8], [10, 8]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={0.7} fill="#ffffff" />
    ))}
  </>
);

const FLAGS: Record<string, ReactNode> = {
  US: usa,
  PT: (
    <>
      <rect width={30} height={20} fill="#da291c" />
      <rect width={12} height={20} fill="#046a38" />
      <circle cx={12} cy={10} r={3.6} fill="#ffe900" />
      <circle cx={12} cy={10} r={2.2} fill="#da291c" stroke="#fff" strokeWidth={0.5} />
    </>
  ),
  BE: bands(["#000000", "#fdda24", "#ef3340"], true),
  HR: (
    <>
      {bands(["#ff0000", "#ffffff", "#171796"])}
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={12.6 + c * 1.6} y={5.5 + r * 1.6} width={1.6} height={1.6} fill={(r + c) % 2 ? "#ffffff" : "#ff0000"} />))}
    </>
  ),
  PL: bands(["#ffffff", "#dc143c"]),
  CH: (
    <>
      <rect width={30} height={20} fill="#da291c" />
      <rect x={13} y={4} width={4} height={12} fill="#fff" />
      <rect x={9} y={8} width={12} height={4} fill="#fff" />
    </>
  ),
  AT: bands(["#ed2939", "#ffffff", "#ed2939"]),
  IS: nordic("#02529c", "#ffffff", 8, 5, "#dc1e35"),
  RS: bands(["#c6363c", "#0c4076", "#ffffff"]),
  TR: (
    <>
      <rect width={30} height={20} fill="#e30a17" />
      <circle cx={11} cy={10} r={5} fill="#fff" />
      <circle cx={12.3} cy={10} r={4} fill="#e30a17" />
      {star(17.6, 10, 2.4, "#fff")}
    </>
  ),
  UY: (
    <>
      {Array.from({length: 9}, (_, i) => <rect key={i} y={(20 / 9) * i} width={30} height={20 / 9 + 0.05} fill={i % 2 ? "#0038a8" : "#ffffff"} />)}
      <rect width={11} height={(20 / 9) * 5} fill="#ffffff" />
      <circle cx={5.5} cy={5.5} r={3} fill="#fcd116" stroke="#7b3f00" strokeWidth={0.3} />
    </>
  ),
  CO: (
    <>
      <rect width={30} height={10} fill="#fcd116" />
      <rect y={10} width={30} height={5} fill="#003893" />
      <rect y={15} width={30} height={5} fill="#ce1126" />
    </>
  ),
  MX: (
    <>
      {bands(["#006847", "#ffffff", "#ce1126"], true)}
      <circle cx={15} cy={10} r={2.6} fill="#8c6a2f" />
    </>
  ),
  JP: (
    <>
      <rect width={30} height={20} fill="#ffffff" />
      <circle cx={15} cy={10} r={6} fill="#bc002d" />
    </>
  ),
  KR: (
    <>
      <rect width={30} height={20} fill="#ffffff" />
      <path d="M10 10 A5 5 0 0 1 20 10 A2.5 2.5 0 0 1 15 10 A2.5 2.5 0 0 0 10 10Z" fill="#cd2e3a" />
      <path d="M10 10 A5 5 0 0 0 20 10 A2.5 2.5 0 0 1 15 10 A2.5 2.5 0 0 0 10 10Z" fill="#0047a0" />
      {[[4, 4, 35], [26, 4, -35], [4, 16, -35], [26, 16, 35]].map(([x, y, a], i) => (
        <g key={i} transform={`rotate(${a} ${x} ${y})`}>
          {[-1.4, 0, 1.4].map((d) => <rect key={d} x={x - 2.4} y={y + d - 0.4} width={4.8} height={0.8} fill="#000" />)}
        </g>
      ))}
    </>
  ),
  MA: (
    <>
      <rect width={30} height={20} fill="#c1272d" />
      {star(15, 10.4, 4.6, "#006233", true)}
    </>
  ),
  SN: (
    <>
      {bands(["#00853f", "#fdef42", "#e31b23"], true)}
      {star(15, 10.3, 3, "#00853f")}
    </>
  ),
  GH: (
    <>
      {bands(["#ce1126", "#fcd116", "#006b3f"])}
      {star(15, 10.3, 3, "#000000")}
    </>
  ),
  CI: bands(["#f77f00", "#ffffff", "#009e60"], true),
  CM: (
    <>
      {bands(["#007a5e", "#ce1126", "#fcd116"], true)}
      {star(15, 10.3, 2.8, "#fcd116")}
    </>
  ),
  SE: nordic("#006aa7", "#fecc00", 9, 4),
  NO: nordic("#ba0c2f", "#ffffff", 8, 5, "#00205b"),
  DK: nordic("#c8102e", "#ffffff", 9, 3.4),
  FI: nordic("#ffffff", "#002f6c", 8, 4.6),
  DE: bands(["#000000", "#dd0000", "#ffce00"]),
  NL: bands(["#ae1c28", "#ffffff", "#21468b"]),
  FR: bands(["#0055a4", "#ffffff", "#ef4135"], true),
  IT: bands(["#009246", "#ffffff", "#ce2b37"], true),
  NG: bands(["#008751", "#ffffff", "#008751"], true),
  ES: (
    <>
      <rect width={30} height={20} fill="#aa151b" />
      <rect y={5} width={30} height={10} fill="#f1bf00" />
    </>
  ),
  AR: (
    <>
      {bands(["#74acdf", "#ffffff", "#74acdf"])}
      <circle cx={15} cy={10} r={2.2} fill="#f6b40e" stroke="#85340a" strokeWidth={0.3} />
    </>
  ),
  BR: (
    <>
      <rect width={30} height={20} fill="#009b3a" />
      <path d="M15 2.5 L27 10 L15 17.5 L3 10Z" fill="#fedf00" />
      <circle cx={15} cy={10} r={4.3} fill="#002776" />
      <path d="M10.9 9 Q15 7.8 19.2 10.6" stroke="#fff" strokeWidth={0.8} fill="none" />
    </>
  ),
  GB: (
    <>
      <rect width={30} height={20} fill="#012169" />
      <path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" strokeWidth={4} />
      <path d="M0 0 L30 20 M30 0 L0 20" stroke="#c8102e" strokeWidth={1.4} />
      <path d="M15 0 V20 M0 10 H30" stroke="#fff" strokeWidth={6} />
      <path d="M15 0 V20 M0 10 H30" stroke="#c8102e" strokeWidth={3.4} />
    </>
  ),
};

/** The flag for a country code like "SE", as a small SVG. */
export function FlagIcon({code, title, size = 18}: {code: string; title?: string; size?: number}) {
  const drawing = FLAGS[code];
  return (
    <svg className="flag" viewBox="0 0 30 20" width={size} height={(size * 2) / 3} role="img" aria-label={title ?? code}>
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={`flag-${code}`}>
          <rect width={30} height={20} rx={2.5} />
        </clipPath>
      </defs>
      <g clipPath={`url(#flag-${code})`}>
        {drawing ?? (
          <>
            <rect width={30} height={20} fill="#64748b" />
            <text x={15} y={14} textAnchor="middle" fontSize={10} fill="#fff" fontWeight={700}>{code}</text>
          </>
        )}
      </g>
      <rect width={30} height={20} rx={2.5} fill="none" stroke="rgb(0 0 0 / 0.2)" strokeWidth={0.8} />
    </svg>
  );
}

/** Same flag inside another SVG, at (x, y) with the given width. */
export function FlagShape({code, x, y, width}: {code: string; x: number; y: number; width: number}) {
  const s = width / 30;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <clipPath id={`flag-in-${code}`}>
        <rect width={30} height={20} rx={2.5} />
      </clipPath>
      <g clipPath={`url(#flag-in-${code})`}>{FLAGS[code] ?? <rect width={30} height={20} fill="#64748b" />}</g>
    </g>
  );
}
