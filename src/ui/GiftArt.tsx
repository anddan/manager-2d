// The presents, drawn as illustrations: a sports car, a sport bike and a gold diver's watch,
// with gradients and gloss, and only thin dark outlines.
import {useId, type ReactNode} from "react";
import {Icon} from "./Icon";

const INK = "#14080a";

/** Car colours: the three body stops (light to dark), the wing and mirror, the seams and the stripe. */
const CAR: Record<string, {a: string; b: string; c: string; wing: string; seam: string; stripe: string}> = {
  red: {a: "#ff3a2e", b: "#d80a0a", c: "#6e0505", wing: "#c70909", seam: "#4a0505", stripe: "#ff5a4a"},
  blue: {a: "#5fb4ff", b: "#0a5fd8", c: "#052a6e", wing: "#0a4fb8", seam: "#031a45", stripe: "#8cc8ff"},
  yellow: {a: "#ffe45c", b: "#f2b705", c: "#8a6500", wing: "#d99f00", seam: "#5a4000", stripe: "#fff0a0"},
  white: {a: "#ffffff", b: "#e3e8ee", c: "#97a1ad", wing: "#c5ccd5", seam: "#6b7480", stripe: "#ffffff"},
  black: {a: "#6a707a", b: "#2a2d33", c: "#0b0c0e", wing: "#1c1e22", seam: "#000000", stripe: "#8a909b"},
};
/** Motorcycle paint, light to dark. */
const BIKE: Record<string, [string, string, string]> = {
  green: ["#c8ff4d", "#58d10e", "#1f7a05"],
  red: ["#ff7a6b", "#e01818", "#7a0606"],
  blue: ["#6fc3ff", "#1b6fe0", "#0a2f7a"],
  orange: ["#ffd27a", "#ff8a0a", "#9a4400"],
  black: ["#6a707a", "#2a2d33", "#0c0d0f"],
};
/** Watches: the case, the bracelet, the dial, the bezel, and the colour of the hands and the lines. */
const WATCH: Record<string, {case: [string, string, string]; band: [string, string, string, string]; dial: [string, string, string]; bezel: [string, string]; hand: string; line: string}> = {
  gold: {case: ["#fff0a6", "#e9b21c", "#9c6a06"], band: ["#b98206", "#ffe38a", "#e2a914", "#9c6a06"], dial: ["#5f8cff", "#1d4fd6", "#0c2a86"], bezel: ["#3b6df0", "#0a2275"], hand: "#f1d46a", line: "#7a5200"},
  silver: {case: ["#ffffff", "#c4ccd6", "#6f7884"], band: ["#7d8590", "#ffffff", "#b9c1cb", "#6f7884"], dial: ["#4a4f57", "#1c1f24", "#08090b"], bezel: ["#3a3f47", "#0b0c0e"], hand: "#e8edf3", line: "#4b525c"},
  green: {case: ["#fff0a6", "#e9b21c", "#9c6a06"], band: ["#b98206", "#ffe38a", "#e2a914", "#9c6a06"], dial: ["#5fd08a", "#0f8a45", "#05431f"], bezel: ["#1f9a55", "#05391b"], hand: "#f1d46a", line: "#7a5200"},
  rose: {case: ["#ffe3d6", "#e8a58a", "#9c5a40"], band: ["#b57a60", "#ffd9c8", "#e0a088", "#9c5a40"], dial: ["#6b4a3e", "#3a2620", "#1a0f0c"], bezel: ["#8a5a48", "#2d1a14"], hand: "#ffd9c8", line: "#6b3a28"},
};
/** TV and gaming gear: black or white. */
const GEAR: Record<string, {body: [string, string, string]; tv: string; stand: string; foot: string; band: string}> = {
  black: {body: ["#4a5160", "#262a33", "#101217"], tv: "#101217", stand: "#2b2f38", foot: "#3a4150", band: "#3a4150"},
  white: {body: ["#ffffff", "#e4e8ee", "#aab2be"], tv: "#eef1f5", stand: "#cfd5de", foot: "#b9c0cb", band: "#d5dae2"},
  red: {body: ["#ff6b5e", "#d81414", "#7a0808"], tv: "#3a0b0b", stand: "#5a1212", foot: "#7a1c1c", band: "#c01818"},
  blue: {body: ["#6fc3ff", "#1b6fe0", "#0a2f7a"], tv: "#0a1a3a", stand: "#143a7a", foot: "#1b4a9a", band: "#1b6fe0"},
};

function Frame({width, children, height = 120}: {width: number; children: ReactNode; height?: number}) {
  return (
    <svg viewBox={`0 0 210 ${height}`} width={width} height={(width * height) / 210} shapeRendering="geometricPrecision" style={{display: "block"}} aria-hidden>
      {children}
    </svg>
  );
}

/** A present as a picture: drawn for the watch, the motorcycle and the sports car, an icon for the money. */
export function GiftPicture({id, variant, width = 80}: {id: string; variant?: string; width?: number}) {
  if (id === "sportsCar") return <SportsCarArt width={width} variant={variant} />;
  if (id === "motorcycle") return <MotorcycleArt width={width} variant={variant} />;
  if (id === "watch") return <WatchArt width={width * 1.05} variant={variant} />;
  if (id === "gaming") return <GamingArt width={width} variant={variant} />;
  if (id === "mansion") return <MansionArt width={width} />;
  return <Icon name="coins" size={Math.round(width * 0.5)} />;
}

/** Gaming gear: a TV with a game on it, a speaker on each side, a controller and headphones in front. */
export function GamingArt({width = 96, variant}: {width?: number; variant?: string}) {
  const g = GEAR[variant ?? "black"] ?? GEAR.black;
  const id = useId();
  const body = `${id}-body`;
  const screen = `${id}-screen`;
  const glow = `${id}-glow`;
  const speaker = (x: number) => (
    <g key={x}>
      <rect x={x} y={22} width={24} height={64} rx={4.500} fill={`url(#${body})`} stroke={INK} strokeWidth={2.40} />
      <circle cx={x + 12} cy={32} r={3.800} fill="#0b0d11" stroke="#7b8494" strokeWidth={1.92} />
      <circle cx={x + 12} cy={62} r={8.500} fill="#0b0d11" stroke="#9aa6bb" strokeWidth={2.56} />
      <circle cx={x + 12} cy={62} r={4.200} fill="#2a2f3a" stroke="#566074" strokeWidth={1.60} />
      <circle cx={x + 12} cy={78} r={1.600} fill="#7fd4ff" />
    </g>
  );
  return (
    <Frame width={width}>
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={g.body[0]} />
          <stop offset="0.5" stopColor={g.body[1]} />
          <stop offset="1" stopColor={g.body[2]} />
        </linearGradient>
        <linearGradient id={screen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b1f8f" />
          <stop offset="0.6" stopColor="#d6489a" />
          <stop offset="1" stopColor="#ff9a3c" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7fd4ff" />
          <stop offset="1" stopColor="#1d7bd6" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={105} cy={111} rx={90} ry={5} fill="#000" opacity={0.28} />
      {/* A speaker on each side. */}
      {speaker(12)}
      {speaker(174)}
      {/* The TV: a thin black frame, a game on the screen and a stand. */}
      <path d="M94 78 L98 90 H112 L116 78Z" fill={g.stand} stroke={INK} strokeWidth={1.92} strokeLinejoin="round" />
      <rect x={82} y={89} width={46} height={5} rx={2.500} fill={g.foot} stroke={INK} strokeWidth={1.92} />
      <rect x={42} y={12} width={126} height={68} rx={4.500} fill={g.tv} stroke={INK} strokeWidth={2.88} />
      <rect x={46} y={16} width={118} height={60} rx={2.500} fill={`url(#${screen})`} />
      <circle cx={136} cy={32} r={9} fill="#ffe7a1" opacity={0.9} />
      <path d="M46 58 L66 47 L86 56 L110 41 L134 54 L164 45 V76 H46Z" fill="#1b1148" opacity={0.85} />
      <path d="M46 66 H164 V76 H46Z" fill="#12301f" opacity={0.9} />
      <path d="M68 66 L72 57 L76 66Z" fill="#3ddc84" stroke={INK} strokeWidth={1.28} strokeLinejoin="round" />
      <circle cx={72} cy={53} r={3.200} fill="#ffd23a" stroke={INK} strokeWidth={1.28} />
      <path d="M50 21 L82 19" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.35} />
      {/* The controller in front, to the right. */}
      <g transform="translate(97 52) scale(0.5 0.6)">
        <path d="M62 66 C72 56 138 56 148 66 C160 74 168 100 160 106 C152 112 142 98 134 90 L76 90 C68 98 58 112 50 106 C42 100 50 74 62 66Z" fill={`url(#${body})`} stroke={INK} strokeWidth={2.800} strokeLinejoin="round" />
        <path d="M70 66 C84 60 126 60 140 66" stroke="#9aa6bb" strokeWidth={2.800} strokeLinecap="round" fill="none" opacity={0.6} />
        <circle cx={105} cy={73} r={9} fill={`url(#${glow})`} />
        <circle cx={105} cy={73} r={3.200} fill="#7fd4ff" stroke={INK} strokeWidth={1.60} />
        <path d="M76 70 h8 v5 h5 v8 h-5 v5 h-8 v-5 h-5 v-8 h5Z" fill="#12151b" stroke="#566074" strokeWidth={2.24} strokeLinejoin="round" />
        <circle cx={134} cy={66} r={4.200} fill="#3ddc84" stroke={INK} strokeWidth={1.92} />
        <circle cx={142} cy={74} r={4.200} fill="#ff4b4b" stroke={INK} strokeWidth={1.92} />
        <circle cx={126} cy={74} r={4.200} fill="#3b82f6" stroke={INK} strokeWidth={1.92} />
        <circle cx={134} cy={82} r={4.200} fill="#ffd23a" stroke={INK} strokeWidth={1.92} />
        <circle cx={92} cy={86} r={7} fill="#12151b" stroke="#566074" strokeWidth={2.24} />
        <circle cx={92} cy={86} r={3.600} fill="#2c313c" />
        <circle cx={118} cy={86} r={7} fill="#12151b" stroke="#566074" strokeWidth={2.24} />
        <circle cx={118} cy={86} r={3.600} fill="#2c313c" />
      </g>
      {/* The headphones in front, to the left: a band and two ear cups with a blue ring. */}
      <path d="M38 106 C36 78 68 78 66 106" stroke={INK} strokeWidth={8} strokeLinecap="round" fill="none" />
      <path d="M38 106 C36 78 68 78 66 106" stroke={g.band} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M44 94 C48 84 60 84 62 94" stroke="#8fa0b8" strokeWidth={2.56} strokeLinecap="round" fill="none" opacity={0.7} />
      <rect x={31} y={95} width={12} height={20} rx={5.500} fill={`url(#${body})`} stroke={INK} strokeWidth={2.40} />
      <rect x={61} y={95} width={12} height={20} rx={5.500} fill={`url(#${body})`} stroke={INK} strokeWidth={2.40} />
      <ellipse cx={37} cy={105} rx={3} ry={6.500} fill="#1d7bd6" opacity={0.85} />
      <ellipse cx={67} cy={105} rx={3} ry={6.500} fill="#1d7bd6" opacity={0.85} />
    </Frame>
  );
}

/** A sports wheel: a thin tyre, a silver rim with five double spokes, a drilled disc and a coloured caliper. */
function SportWheel({cx, cy, r, rim, caliper = "#f5c400"}: {cx: number; cy: number; r: number; rim: string; caliper?: string}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1b1b1d" stroke={INK} strokeWidth={2.40} />
      <circle cx={cx} cy={cy} r={r * 0.84} fill="#2a2a2e" />
      <circle cx={cx} cy={cy} r={r * 0.74} fill={`url(#${rim})`} stroke="#59606a" strokeWidth={1.60} />
      <circle cx={cx} cy={cy} r={r * 0.5} fill="#3a3d44" />
      <path d={`M${cx + r * 0.1} ${cy - r * 0.48} A${r * 0.5} ${r * 0.5} 0 0 1 ${cx + r * 0.5} ${cy - r * 0.05} L${cx + r * 0.36} ${cy + r * 0.05} A${r * 0.4} ${r * 0.4} 0 0 0 ${cx + r * 0.08} ${cy - r * 0.38}Z`} fill={caliper} stroke={INK} strokeWidth={1.28} />
      {[0, 72, 144, 216, 288].map((a) => {
        const rad = (a * Math.PI) / 180;
        const ox = Math.cos(rad);
        const oy = Math.sin(rad);
        return (
          <g key={a}>
            <line x1={cx + ox * r * 0.14} y1={cy + oy * r * 0.14} x2={cx + ox * r * 0.7} y2={cy + oy * r * 0.7} stroke="#8d949e" strokeWidth={r * 0.17} strokeLinecap="round" />
            <line x1={cx + ox * r * 0.14} y1={cy + oy * r * 0.14} x2={cx + ox * r * 0.7} y2={cy + oy * r * 0.7} stroke="#e8edf3" strokeWidth={r * 0.07} strokeLinecap="round" />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.13} fill="#d7dde5" stroke={INK} strokeWidth={1.28} />
    </g>
  );
}

/** A red supercar in side view: low, long bonnet, cab-forward glass, side intake, split-spoke wheels. */
export function SportsCarArt({width = 96, variant}: {width?: number; variant?: string}) {
  const c = CAR[variant ?? "red"] ?? CAR.red;
  const id = useId();
  const body = `${id}-body`;
  const glass = `${id}-glass`;
  const rim = `${id}-rim`;
  const gloss = `${id}-gloss`;
  return (
    <Frame width={width}>
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.a} />
          <stop offset="0.45" stopColor={c.b} />
          <stop offset="1" stopColor={c.c} />
        </linearGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bcd7ee" />
          <stop offset="0.6" stopColor="#4a6a8c" />
          <stop offset="1" stopColor="#1b2a3d" />
        </linearGradient>
        <radialGradient id={rim} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#9aa3ad" />
        </radialGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0.5} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <ellipse cx={108} cy={104} rx={94} ry={6} fill="#000" opacity={0.28} />
      {/* The body: long, low and wide at the rear haunch. */}
      <path d="M17 88 C15 76 19 66 31 62 L62 56 C76 52 84 43 99 39 C113 35 127 38 137 44 L152 55 C166 59 182 61 195 65 C205 68 208 75 206 83 C205 89 200 92 193 92 L22 92 C19 92 17 91 17 88Z" fill={`url(#${body})`} stroke={INK} strokeWidth={2.56} strokeLinejoin="round" />
      {/* A big rear wing on two posts, with end plates. */}
      <path d="M30 62 L32 46 M46 58 L48 46" stroke="#1b1b1f" strokeWidth={3.400} strokeLinecap="round" />
      <path d="M6 41 L62 34 L64 40 L9 47Z" fill="#17171b" stroke={INK} strokeWidth={2.08} strokeLinejoin="round" />
      <path d="M8 41 L62 34" stroke={c.stripe} strokeWidth={2.24} strokeLinecap="round" />
      <path d="M5 33 L20 31 L23 50 L8 52Z" fill={c.wing} stroke={INK} strokeWidth={2.08} strokeLinejoin="round" />
      {/* A front splitter and a side skirt. */}
      <path d="M182 90 L209 86 L209 91 L186 94Z" fill="#141416" stroke={INK} strokeWidth={1.60} strokeLinejoin="round" />
      <path d="M72 91 L150 91" stroke="#141416" strokeWidth={3} strokeLinecap="round" />
      {/* The glass: a low teardrop. */}
      <path d="M84 57 C92 47 104 42 118 41 C128 41 135 45 141 50 L148 57Z" fill={`url(#${glass})`} stroke={INK} strokeWidth={2.24} strokeLinejoin="round" />
      <path d="M112 42 L109 57" stroke={INK} strokeWidth={2.24} />
      <path d="M91 52 C97 47 105 45 111 44" stroke="#fff" strokeWidth={2.88} strokeLinecap="round" fill="none" opacity={0.7} />
      {/* The shoulder line, the door and the shine along the body. */}
      <path d="M26 72 C70 64 128 62 196 70" stroke={c.stripe} strokeWidth={2.56} fill="none" opacity={0.7} strokeLinecap="round" />
      <path d="M97 58 C95 70 95 80 97 90" stroke={c.seam} strokeWidth={2.08} fill="none" />
      <rect x={101} y={65} width={10} height={2.600} rx={1.300} fill={c.seam} />
      <path d="M40 70 C80 63 130 62 180 68 L180 72 C130 67 80 68 40 75Z" fill={`url(#${gloss})`} />
      {/* The side intake with its fins. */}
      <path d="M70 70 L96 66 L100 82 L74 84Z" fill="#1d0808" stroke={INK} strokeWidth={1.60} />
      <path d="M78 72 L97 69 M79 77 L98 74 M80 82 L99 79" stroke={c.seam} strokeWidth={1.92} />
      {/* The bonnet: shine and vents. */}
      <path d="M140 47 C156 53 172 58 190 62" stroke="#fff" strokeWidth={2.600} opacity={0.55} fill="none" strokeLinecap="round" />
      <path d="M160 58 L170 60 M163 62 L173 64" stroke={c.seam} strokeWidth={2.24} strokeLinecap="round" />
      {/* The nose: lights, a black lip and a small badge. */}
      <path d="M185 63 C193 63 201 66 205 71 L191 72Z" fill="#eaf4ff" stroke={INK} strokeWidth={1.92} strokeLinejoin="round" />
      <path d="M186 82 L206 79 L206 86 L190 89Z" fill="#141416" stroke={INK} strokeWidth={1.60} />
      <ellipse cx={192} cy={76} rx={3} ry={3.400} fill="#ffd400" stroke={INK} strokeWidth={1.28} />
      {/* The tail: lamp and diffuser. */}
      <path d="M17 70 L29 66 L28 76 L18 77Z" fill="#ff2b2b" stroke={INK} strokeWidth={1.60} strokeLinejoin="round" />
      <path d="M17 90 L40 90 L38 94 L19 94Z" fill="#141416" />
      {/* A wing mirror. */}
      <path d="M141 50 L150 48 L151 53 L143 54Z" fill={c.wing} stroke={INK} strokeWidth={1.60} strokeLinejoin="round" />
      {/* The wheel arches and the wheels. */}
      <path d="M32 92 A21 21 0 0 1 74 92Z" fill="#150404" />
      <path d="M139 92 A21 21 0 0 1 181 92Z" fill="#150404" />
      <SportWheel cx={53} cy={91} r={19} rim={rim} />
      <SportWheel cx={160} cy={91} r={19} rim={rim} />
    </Frame>
  );
}

/** A gold diver's watch with a blue dial and bezel, a date window and an Oyster-type gold bracelet. */
export function WatchArt({width = 96, variant}: {width?: number; variant?: string}) {
  const w = WATCH[variant ?? "gold"] ?? WATCH.gold;
  const id = useId();
  const gold = `${id}-gold`;
  const goldV = `${id}-goldv`;
  const dial = `${id}-dial`;
  const bezel = `${id}-bezel`;
  const links = (y0: number, y1: number, top: boolean) => {
    const rows: ReactNode[] = [];
    for (let y = y0; y < y1; y += 8) rows.push(<path key={y} d={`M${top ? 85 : 84} ${y} H${top ? 125 : 126}`} stroke={w.line} strokeWidth={1.60} opacity={0.7} />);
    return rows;
  };
  return (
    <Frame width={width}>
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={w.case[0]} />
          <stop offset="0.45" stopColor={w.case[1]} />
          <stop offset="1" stopColor={w.case[2]} />
        </linearGradient>
        <linearGradient id={goldV} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={w.band[0]} />
          <stop offset="0.35" stopColor={w.band[1]} />
          <stop offset="0.7" stopColor={w.band[2]} />
          <stop offset="1" stopColor={w.band[3]} />
        </linearGradient>
        <radialGradient id={dial} cx="0.35" cy="0.3" r="0.95">
          <stop offset="0" stopColor={w.dial[0]} />
          <stop offset="0.6" stopColor={w.dial[1]} />
          <stop offset="1" stopColor={w.dial[2]} />
        </radialGradient>
        <linearGradient id={bezel} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={w.bezel[0]} />
          <stop offset="1" stopColor={w.bezel[1]} />
        </linearGradient>
      </defs>
      <ellipse cx={105} cy={115} rx={46} ry={4} fill="#000" opacity={0.28} />
      {/* The bracelet: gold links in three columns, top and bottom. */}
      <path d="M82 2 H128 L125 34 H85Z" fill={`url(#${goldV})`} stroke={INK} strokeWidth={2.24} strokeLinejoin="round" />
      <path d="M85 88 H125 L128 118 H82Z" fill={`url(#${goldV})`} stroke={INK} strokeWidth={2.24} strokeLinejoin="round" />
      {links(8, 34, true)}
      {links(94, 118, false)}
      <path d="M96 3 V34 M114 3 V34 M96 88 V118 M114 88 V118" stroke={w.line} strokeWidth={1.60} opacity={0.75} />
      {/* The crown with its guards. */}
      <rect x={147} y={52} width={13} height={16} rx={3} fill={`url(#${gold})`} stroke={INK} strokeWidth={2.24} />
      <path d="M149 55 H158 M149 60 H158 M149 65 H158" stroke={w.line} strokeWidth={1.60} />
      {/* The case, the blue bezel with its markers and the dial. */}
      <circle cx={105} cy={60} r={46} fill={`url(#${gold})`} stroke={INK} strokeWidth={2.56} />
      <circle cx={105} cy={60} r={39} fill={`url(#${bezel})`} stroke={INK} strokeWidth={1.92} />
      {Array.from({length: 12}, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const cx = 105 + Math.sin(a) * 34.500;
        const cy = 60 - Math.cos(a) * 34.500;
        return i === 0 ? <path key={i} d={`M${cx} ${cy - 3} L${cx + 3} ${cy + 2} L${cx - 3} ${cy + 2}Z`} fill="#fff7d0" stroke={INK} strokeWidth={0.96} /> : <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2.200 : 1.500} fill="#f6e7a5" />;
      })}
      <circle cx={105} cy={60} r={29.500} fill={`url(#${dial})`} stroke={INK} strokeWidth={1.92} />
      {[0, 60, 90, 120, 180, 240, 270, 300].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return <circle key={deg} cx={105 + Math.sin(a) * 23.500} cy={60 - Math.cos(a) * 23.500} r={deg % 90 === 0 ? 3 : 2.200} fill="#f7efc0" stroke="#b58910" strokeWidth={1.28} />;
      })}
      {/* The date window at three o'clock. */}
      <rect x={118} y={55.500} width={9} height={9} rx={1} fill="#fff" stroke={INK} strokeWidth={1.44} />
      <text x={122.500} y={62.500} textAnchor="middle" fontSize={6.500} fontWeight={700} fill="#111" fontFamily="sans-serif">17</text>
      {/* The hands. */}
      <path d="M105 60 L105 36" stroke={w.hand} strokeWidth={3} strokeLinecap="round" />
      <path d="M105 60 L121 70" stroke={w.hand} strokeWidth={3.600} strokeLinecap="round" />
      <path d="M105 60 L92 50" stroke="#fff" strokeWidth={1.92} strokeLinecap="round" />
      <circle cx={105} cy={60} r={3.600} fill={w.hand} stroke={INK} strokeWidth={1.60} />
      <path d="M78 46 A31 31 0 0 1 97 32" stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.55} />
    </Frame>
  );
}

/** A green sport bike: full fairing and windscreen, black seat, a silver muffler on this side, drilled brake discs. */
export function MotorcycleArt({width = 96, variant}: {width?: number; variant?: string}) {
  const paint = BIKE[variant ?? "green"] ?? BIKE.green;
  const id = useId();
  const green = `${id}-green`;
  const rim = `${id}-rim`;
  const metal = `${id}-metal`;
  const dark = `${id}-dark`;
  const wheel = (cx: number, r: number, disc: boolean) => (
    <g key={cx}>
      <circle cx={cx} cy={84} r={r} fill="#1b1b1d" stroke={INK} strokeWidth={2.40} />
      <circle cx={cx} cy={84} r={r * 0.82} fill="#2a2a2e" />
      <circle cx={cx} cy={84} r={r * 0.72} fill={`url(#${rim})`} stroke="#59606a" strokeWidth={1.60} />
      <circle cx={cx} cy={84} r={r * 0.5} fill="#3a3d44" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line key={a} x1={cx} y1={84} x2={cx + Math.cos((a * Math.PI) / 180) * r * 0.68} y2={84 + Math.sin((a * Math.PI) / 180) * r * 0.68} stroke="#e4e9ef" strokeWidth={r * 0.1} strokeLinecap="round" />
      ))}
      {disc && <circle cx={cx} cy={84} r={r * 0.48} fill="none" stroke="#c9d0d8" strokeWidth={2} strokeDasharray="2 2.600" />}
      <circle cx={cx} cy={84} r={r * 0.14} fill="#d7dde5" stroke={INK} strokeWidth={1.28} />
    </g>
  );
  return (
    <Frame width={width}>
      <defs>
        <linearGradient id={green} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={paint[0]} />
          <stop offset="0.5" stopColor={paint[1]} />
          <stop offset="1" stopColor={paint[2]} />
        </linearGradient>
        <radialGradient id={rim} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#8f98a3" />
        </radialGradient>
        <linearGradient id={metal} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f4f8" />
          <stop offset="0.5" stopColor="#aab3bd" />
          <stop offset="1" stopColor="#6c747e" />
        </linearGradient>
        <linearGradient id={dark} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="1" stopColor="#14161a" />
        </linearGradient>
      </defs>
      <ellipse cx={105} cy={106} rx={90} ry={6} fill="#000" opacity={0.28} />
      {/* The swing arm, the engine and the belly pan. */}
      <path d="M46 84 L96 76" stroke="#4a4f57" strokeWidth={6} strokeLinecap="round" />
      {/* The engine: a big dark block with cooling fins, a round clutch cover and the frame tubes round it. */}
      <path d="M80 58 L130 55 L134 94 L86 96Z" fill={`url(#${dark})`} stroke={INK} strokeWidth={2.24} strokeLinejoin="round" />
      <path d="M84 64 H130 M85 70 H131 M86 76 H132" stroke="#6b737d" strokeWidth={2.56} />
      <path d="M96 86 L126 84 L128 94 L98 95Z" fill={`url(#${metal})`} stroke={INK} strokeWidth={1.60} strokeLinejoin="round" />
      <circle cx={106} cy={78} r={11} fill={`url(#${metal})`} stroke={INK} strokeWidth={1.92} />
      <circle cx={106} cy={78} r={7} fill="#2b2f36" stroke="#ff9d2e" strokeWidth={2.88} />
      <circle cx={106} cy={78} r={2.400} fill="#d7dde5" />
      <path d="M82 60 L106 46 L136 52 M86 92 L74 74 L82 60" stroke="#8d949e" strokeWidth={2.600} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M100 84 L142 86 L126 99 L100 97Z" fill={`url(#${dark})`} stroke={INK} strokeWidth={2.08} strokeLinejoin="round" />
      {/* The tail, the seat and the tank. */}
      {/* The tail: an upswept cowl over the passenger seat, a pointed tail lamp, and the stepped rider seat. */}
      <path d="M8 34 C20 28 42 30 62 38 L72 50 L70 58 L30 58 C14 58 4 46 8 34Z" fill={`url(#${green})`} stroke={INK} strokeWidth={2.40} strokeLinejoin="round" />
      <path d="M8 34 L16 38 L10 42Z" fill="#ff2b2b" stroke={INK} strokeWidth={1.60} strokeLinejoin="round" />
      <path d="M20 36 C32 33 46 36 58 41" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.6} />
      <path d="M52 44 C60 42 70 43 86 47 L86 58 L58 58 C52 56 50 48 52 44Z" fill="#1d1f24" stroke={INK} strokeWidth={2.24} strokeLinejoin="round" />
      <path d="M58 46 C66 45 74 46 84 49" stroke="#5a606a" strokeWidth={2.24} strokeLinecap="round" fill="none" />
      <path d="M78 40 C94 29 118 29 136 36 L130 55 L84 60Z" fill={`url(#${green})`} stroke={INK} strokeWidth={2.24} strokeLinejoin="round" />
      <path d="M88 38 C102 33 118 33 130 39" stroke="#fff" strokeWidth={2.200} strokeLinecap="round" fill="none" opacity={0.65} />
      {/* The fairing with the windscreen and the headlight. */}
      <path d="M128 36 C144 27 166 33 180 46 C184 51 182 58 174 60 L152 66 L138 82 L112 84 C106 70 112 54 120 44Z" fill={`url(#${green})`} stroke={INK} strokeWidth={2.40} strokeLinejoin="round" />
      <path d="M148 36 L162 18 C165 15 170 18 168 23 L160 42Z" fill="#cfe6f7" stroke={INK} strokeWidth={1.92} strokeLinejoin="round" opacity={0.92} />
      <path d="M170 49 C176 49 182 52 181 57 L170 59Z" fill="#fff6c0" stroke={INK} strokeWidth={1.60} strokeLinejoin="round" />
      <path d="M122 52 C138 52 152 56 168 62" stroke="#15171b" strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d="M124 40 C132 36 140 36 148 40" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.6} />
      {/* The fork, the handlebar and the front brake. */}
      <path d="M152 60 L168 90" stroke="#4a4f57" strokeWidth={6} strokeLinecap="round" />
      <path d="M152 60 L168 90" stroke={`url(#${metal})`} strokeWidth={2.600} strokeLinecap="round" />
      <path d="M146 38 L156 34 M150 36 L154 30" stroke={INK} strokeWidth={2.600} strokeLinecap="round" />
      {wheel(46, 22, false)}
      {wheel(168, 22, true)}
      {/* A narrow black mudguard over the front wheel. */}
      <path d="M149 70 C155 61 181 61 188 71 L185 74 C178 67 159 67 153 74Z" fill="#15171b" stroke={INK} strokeWidth={1.92} strokeLinejoin="round" />
      {/* The exhaust on this side, drawn over the rear wheel: a pipe from the engine to a big silver muffler. */}
      <path d="M102 91 L28 72" stroke={INK} strokeWidth={13} strokeLinecap="round" fill="none" />
      <path d="M102 91 L28 72" stroke={`url(#${metal})`} strokeWidth={10} strokeLinecap="round" fill="none" />
      <path d="M98 89 L32 72" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
      <path d="M44 66 L46 77 M52 68 L54 79 M60 70 L62 81" stroke="#59606a" strokeWidth={2.56} strokeLinecap="round" />
      <ellipse cx={26} cy={71.500} rx={2.800} ry={5.500} transform="rotate(-14 26 71.500)" fill="#1a1c20" stroke={INK} strokeWidth={1.60} />
    </Frame>
  );
}

/** A luxury house: pillars, a pediment, two wings with lit windows, a gold door, a lawn and a couple of palms. */
export function MansionArt({width = 96}: {width?: number}) {
  const id = useId();
  const wall = `${id}-wall`;
  const roof = `${id}-roof`;
  const glass = `${id}-glass`;
  const lawn = `${id}-lawn`;
  const water = `${id}-water`;
  const win = (x: number, y: number, w = 11, h = 15) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h} rx={1.500} fill={`url(#${glass})`} stroke={INK} strokeWidth={1.800} />
      <path d={`M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}`} stroke={INK} strokeWidth={1} opacity={0.55} />
    </g>
  );
  const palm = (x: number) => (
    <g key={x}>
      <path d={`M${x} 104 Q${x + 2} 90 ${x} 78`} stroke="#7a4b1c" strokeWidth={3.200} fill="none" strokeLinecap="round" />
      {[-24, 0, 24, 48, -48].map((a) => <ellipse key={a} cx={x} cy={72} rx={9} ry={3} fill="#2fae4e" stroke={INK} strokeWidth={1.200} transform={`rotate(${a - 90} ${x} 76) translate(0 0)`} />)}
    </g>
  );
  return (
    <Frame width={width} height={126}>
      <defs>
        <linearGradient id={wall} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#e6d8bd" />
        </linearGradient>
        <linearGradient id={roof} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8f4a3a" />
          <stop offset="1" stopColor="#5a2418" />
        </linearGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2a8" />
          <stop offset="1" stopColor="#f0a82c" />
        </linearGradient>
        <linearGradient id={water} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9be8ff" />
          <stop offset="1" stopColor="#1f9be0" />
        </linearGradient>
        <linearGradient id={lawn} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#58c75a" />
          <stop offset="1" stopColor="#2a8a3c" />
        </linearGradient>
      </defs>
      <ellipse cx={105} cy={123} rx={98} ry={3} fill="#000" opacity={0.25} />
      {/* The lawn runs on under and round the pool. */}
      <rect x={4} y={98} width={202} height={25} rx={7} fill={`url(#${lawn})`} stroke={INK} strokeWidth={1.800} />
      {palm(14)}
      {palm(196)}
      {/* The wings. */}
      <rect x={26} y={62} width={50} height={38} fill={`url(#${wall})`} stroke={INK} strokeWidth={2.200} />
      <rect x={134} y={62} width={50} height={38} fill={`url(#${wall})`} stroke={INK} strokeWidth={2.200} />
      <path d="M22 62 30 52h42l6 10Z" fill={`url(#${roof})`} stroke={INK} strokeWidth={2.200} strokeLinejoin="round" />
      <path d="M132 62 138 52h42l8 10Z" fill={`url(#${roof})`} stroke={INK} strokeWidth={2.200} strokeLinejoin="round" />
      {[34, 54].map((x) => win(x, 70))}
      {[146, 166].map((x) => win(x, 70))}
      {/* The middle: pillars under a pediment. */}
      <rect x={72} y={44} width={66} height={56} fill={`url(#${wall})`} stroke={INK} strokeWidth={2.200} />
      <path d="M66 44 105 16l39 28Z" fill={`url(#${roof})`} stroke={INK} strokeWidth={2.400} strokeLinejoin="round" />
      <circle cx={105} cy={33} r={6.500} fill={`url(#${glass})`} stroke={INK} strokeWidth={1.800} />
      {win(78, 50, 10, 14)}
      {win(122, 50, 10, 14)}
      <rect x={96} y={78} width={18} height={22} rx={9} ry={9} fill="#6b3a1a" stroke={INK} strokeWidth={2} />
      <path d="M105 78v22" stroke={INK} strokeWidth={1.200} opacity={0.6} />
      <circle cx={109} cy={91} r={1.400} fill="#ffd54a" />
      {[76, 88, 116, 128].map((x) => (
        <g key={x}>
          <rect x={x} y={64} width={6} height={36} fill="#ffffff" stroke={INK} strokeWidth={1.600} />
          <rect x={x - 1.500} y={62} width={9} height={3.500} fill="#ffffff" stroke={INK} strokeWidth={1.200} />
        </g>
      ))}
      <rect x={90} y={100} width={30} height={4} fill="#f3ead6" stroke={INK} strokeWidth={1.400} />
      {/* The pool in front, to the right: a white rim, water, ripples and a ladder. */}
      <rect x={126} y={103} width={64} height={15} rx={7.500} fill="#ffffff" stroke={INK} strokeWidth={1.800} />
      <rect x={130} y={106} width={56} height={9} rx={4.500} fill={`url(#${water})`} stroke="#1b6aa8" strokeWidth={1.200} />
      <path d="M137 110q4-3 8 0t8 0t8 0M150 113q4-3 8 0t8 0" fill="none" stroke="#fff" strokeWidth={1.200} strokeLinecap="round" opacity={0.85} />
      <path d="M180 101v9M184 101v9M180 104h4M180 108h4" stroke="#c9d2dc" strokeWidth={1.400} strokeLinecap="round" />
      {/* A gold trophy on the lawn in front of the house. */}
      <g transform="translate(68 87)">
        <path d="M-8 0h16v5c0 5-3.500 8-8 8s-8-3-8-8Z" fill="#ffd23a" stroke={INK} strokeWidth={1.600} strokeLinejoin="round" />
        <path d="M-8 2h-4c0 6 2.500 8 6 8M8 2h4c0 6-2.500 8-6 8" fill="none" stroke={INK} strokeWidth={1.500} strokeLinecap="round" />
        <path d="M-5 3v5" stroke="#fff6b0" strokeWidth={1.600} strokeLinecap="round" />
        <rect x={-2} y={13} width={4} height={4} fill="#e0a61a" stroke={INK} strokeWidth={1.200} />
        <rect x={-6} y={17} width={12} height={4} rx={1} fill="#b87a10" stroke={INK} strokeWidth={1.400} />
      </g>
      {/* A glint: it is a very dear house. */}
      <path d="M176 22v10M171 27h10" stroke="#fff6b0" strokeWidth={2.200} strokeLinecap="round" />
      <path d="M36 20v7M32.500 23.500h7" stroke="#fff6b0" strokeWidth={1.800} strokeLinecap="round" />
    </Frame>
  );
}
