// The presents, drawn as illustrations: a sports car, a sport bike and a gold diver's watch,
// with gradients and gloss, and only thin dark outlines.
import {useId, type ReactNode} from "react";
import {Icon} from "./Icon";

const INK = "#14080a";

function Frame({width, children}: {width: number; children: ReactNode}) {
  return (
    <svg viewBox="0 0 210 120" width={width} height={(width * 120) / 210} aria-hidden>
      {children}
    </svg>
  );
}

/** A present as a picture: drawn for the watch, the motorcycle and the sports car, an icon for the money. */
export function GiftPicture({id, width = 80}: {id: string; width?: number}) {
  if (id === "sportsCar") return <SportsCarArt width={width} />;
  if (id === "motorcycle") return <MotorcycleArt width={width} />;
  if (id === "watch") return <WatchArt width={width * 1.05} />;
  if (id === "gaming") return <GamingArt width={width} />;
  return <Icon name="coins" size={Math.round(width * 0.5)} />;
}

/** Gaming gear: a TV with a game on it, a speaker on each side, a controller and headphones in front. */
export function GamingArt({width = 96}: {width?: number}) {
  const id = useId();
  const body = `${id}-body`;
  const screen = `${id}-screen`;
  const glow = `${id}-glow`;
  const speaker = (x: number) => (
    <g key={x}>
      <rect x={x} y={22} width={24} height={64} rx={4.500} fill={`url(#${body})`} stroke={INK} strokeWidth={1.500} />
      <circle cx={x + 12} cy={32} r={3.800} fill="#0b0d11" stroke="#7b8494" strokeWidth={1.200} />
      <circle cx={x + 12} cy={62} r={8.500} fill="#0b0d11" stroke="#9aa6bb" strokeWidth={1.600} />
      <circle cx={x + 12} cy={62} r={4.200} fill="#2a2f3a" stroke="#566074" strokeWidth={1} />
      <circle cx={x + 12} cy={78} r={1.600} fill="#7fd4ff" />
    </g>
  );
  return (
    <Frame width={width}>
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a5160" />
          <stop offset="0.5" stopColor="#262a33" />
          <stop offset="1" stopColor="#101217" />
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
      <path d="M94 78 L98 90 H112 L116 78Z" fill="#2b2f38" stroke={INK} strokeWidth={1.200} strokeLinejoin="round" />
      <rect x={82} y={89} width={46} height={5} rx={2.500} fill="#3a4150" stroke={INK} strokeWidth={1.200} />
      <rect x={42} y={12} width={126} height={68} rx={4.500} fill="#101217" stroke={INK} strokeWidth={1.800} />
      <rect x={46} y={16} width={118} height={60} rx={2.500} fill={`url(#${screen})`} />
      <circle cx={136} cy={32} r={9} fill="#ffe7a1" opacity={0.9} />
      <path d="M46 58 L66 47 L86 56 L110 41 L134 54 L164 45 V76 H46Z" fill="#1b1148" opacity={0.85} />
      <path d="M46 66 H164 V76 H46Z" fill="#12301f" opacity={0.9} />
      <path d="M68 66 L72 57 L76 66Z" fill="#3ddc84" stroke={INK} strokeWidth={0.800} strokeLinejoin="round" />
      <circle cx={72} cy={53} r={3.200} fill="#ffd23a" stroke={INK} strokeWidth={0.800} />
      <path d="M50 21 L82 19" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.35} />
      {/* The controller in front, to the right. */}
      <g transform="translate(97 52) scale(0.5 0.6)">
        <path d="M62 66 C72 56 138 56 148 66 C160 74 168 100 160 106 C152 112 142 98 134 90 L76 90 C68 98 58 112 50 106 C42 100 50 74 62 66Z" fill={`url(#${body})`} stroke={INK} strokeWidth={2.800} strokeLinejoin="round" />
        <path d="M70 66 C84 60 126 60 140 66" stroke="#9aa6bb" strokeWidth={2.800} strokeLinecap="round" fill="none" opacity={0.6} />
        <circle cx={105} cy={73} r={9} fill={`url(#${glow})`} />
        <circle cx={105} cy={73} r={3.200} fill="#7fd4ff" stroke={INK} strokeWidth={1} />
        <path d="M76 70 h8 v5 h5 v8 h-5 v5 h-8 v-5 h-5 v-8 h5Z" fill="#12151b" stroke="#566074" strokeWidth={1.400} strokeLinejoin="round" />
        <circle cx={134} cy={66} r={4.200} fill="#3ddc84" stroke={INK} strokeWidth={1.200} />
        <circle cx={142} cy={74} r={4.200} fill="#ff4b4b" stroke={INK} strokeWidth={1.200} />
        <circle cx={126} cy={74} r={4.200} fill="#3b82f6" stroke={INK} strokeWidth={1.200} />
        <circle cx={134} cy={82} r={4.200} fill="#ffd23a" stroke={INK} strokeWidth={1.200} />
        <circle cx={92} cy={86} r={7} fill="#12151b" stroke="#566074" strokeWidth={1.400} />
        <circle cx={92} cy={86} r={3.600} fill="#2c313c" />
        <circle cx={118} cy={86} r={7} fill="#12151b" stroke="#566074" strokeWidth={1.400} />
        <circle cx={118} cy={86} r={3.600} fill="#2c313c" />
      </g>
      {/* The headphones in front, to the left: a band and two ear cups with a blue ring. */}
      <path d="M38 106 C36 78 68 78 66 106" stroke={INK} strokeWidth={8} strokeLinecap="round" fill="none" />
      <path d="M38 106 C36 78 68 78 66 106" stroke="#3a4150" strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M44 94 C48 84 60 84 62 94" stroke="#8fa0b8" strokeWidth={1.600} strokeLinecap="round" fill="none" opacity={0.7} />
      <rect x={31} y={95} width={12} height={20} rx={5.500} fill={`url(#${body})`} stroke={INK} strokeWidth={1.500} />
      <rect x={61} y={95} width={12} height={20} rx={5.500} fill={`url(#${body})`} stroke={INK} strokeWidth={1.500} />
      <ellipse cx={37} cy={105} rx={3} ry={6.500} fill="#1d7bd6" opacity={0.85} />
      <ellipse cx={67} cy={105} rx={3} ry={6.500} fill="#1d7bd6" opacity={0.85} />
    </Frame>
  );
}

/** A sports wheel: a thin tyre, a silver rim with five double spokes, a drilled disc and a coloured caliper. */
function SportWheel({cx, cy, r, rim, caliper = "#f5c400"}: {cx: number; cy: number; r: number; rim: string; caliper?: string}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1b1b1d" stroke={INK} strokeWidth={1.500} />
      <circle cx={cx} cy={cy} r={r * 0.84} fill="#2a2a2e" />
      <circle cx={cx} cy={cy} r={r * 0.74} fill={`url(#${rim})`} stroke="#59606a" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={r * 0.5} fill="#3a3d44" />
      <path d={`M${cx + r * 0.1} ${cy - r * 0.48} A${r * 0.5} ${r * 0.5} 0 0 1 ${cx + r * 0.5} ${cy - r * 0.05} L${cx + r * 0.36} ${cy + r * 0.05} A${r * 0.4} ${r * 0.4} 0 0 0 ${cx + r * 0.08} ${cy - r * 0.38}Z`} fill={caliper} stroke={INK} strokeWidth={0.800} />
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
      <circle cx={cx} cy={cy} r={r * 0.13} fill="#d7dde5" stroke={INK} strokeWidth={0.800} />
    </g>
  );
}

/** A red supercar in side view: low, long bonnet, cab-forward glass, side intake, split-spoke wheels. */
export function SportsCarArt({width = 96}: {width?: number}) {
  const id = useId();
  const body = `${id}-body`;
  const glass = `${id}-glass`;
  const rim = `${id}-rim`;
  const gloss = `${id}-gloss`;
  return (
    <Frame width={width}>
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff3a2e" />
          <stop offset="0.45" stopColor="#d80a0a" />
          <stop offset="1" stopColor="#6e0505" />
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
      <path d="M17 88 C15 76 19 66 31 62 L62 56 C76 52 84 43 99 39 C113 35 127 38 137 44 L152 55 C166 59 182 61 195 65 C205 68 208 75 206 83 C205 89 200 92 193 92 L22 92 C19 92 17 91 17 88Z" fill={`url(#${body})`} stroke={INK} strokeWidth={1.600} strokeLinejoin="round" />
      {/* A big rear wing on two posts, with end plates. */}
      <path d="M30 62 L32 46 M46 58 L48 46" stroke="#1b1b1f" strokeWidth={3.400} strokeLinecap="round" />
      <path d="M6 41 L62 34 L64 40 L9 47Z" fill="#17171b" stroke={INK} strokeWidth={1.300} strokeLinejoin="round" />
      <path d="M8 41 L62 34" stroke="#ff5a4a" strokeWidth={1.400} strokeLinecap="round" />
      <path d="M5 33 L20 31 L23 50 L8 52Z" fill="#c70909" stroke={INK} strokeWidth={1.300} strokeLinejoin="round" />
      {/* A front splitter and a side skirt. */}
      <path d="M182 90 L209 86 L209 91 L186 94Z" fill="#141416" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <path d="M72 91 L150 91" stroke="#141416" strokeWidth={3} strokeLinecap="round" />
      {/* The glass: a low teardrop. */}
      <path d="M84 57 C92 47 104 42 118 41 C128 41 135 45 141 50 L148 57Z" fill={`url(#${glass})`} stroke={INK} strokeWidth={1.400} strokeLinejoin="round" />
      <path d="M112 42 L109 57" stroke={INK} strokeWidth={1.400} />
      <path d="M91 52 C97 47 105 45 111 44" stroke="#fff" strokeWidth={1.800} strokeLinecap="round" fill="none" opacity={0.7} />
      {/* The shoulder line, the door and the shine along the body. */}
      <path d="M26 72 C70 64 128 62 196 70" stroke="#ff8b7a" strokeWidth={1.600} fill="none" opacity={0.7} strokeLinecap="round" />
      <path d="M97 58 C95 70 95 80 97 90" stroke="#4a0505" strokeWidth={1.300} fill="none" />
      <rect x={101} y={65} width={10} height={2.600} rx={1.300} fill="#3b0707" />
      <path d="M40 70 C80 63 130 62 180 68 L180 72 C130 67 80 68 40 75Z" fill={`url(#${gloss})`} />
      {/* The side intake with its fins. */}
      <path d="M70 70 L96 66 L100 82 L74 84Z" fill="#1d0808" stroke={INK} strokeWidth={1} />
      <path d="M78 72 L97 69 M79 77 L98 74 M80 82 L99 79" stroke="#5b1a1a" strokeWidth={1.200} />
      {/* The bonnet: shine and vents. */}
      <path d="M140 47 C156 53 172 58 190 62" stroke="#fff" strokeWidth={2.600} opacity={0.55} fill="none" strokeLinecap="round" />
      <path d="M160 58 L170 60 M163 62 L173 64" stroke="#7a0707" strokeWidth={1.400} strokeLinecap="round" />
      {/* The nose: lights, a black lip and a small badge. */}
      <path d="M185 63 C193 63 201 66 205 71 L191 72Z" fill="#eaf4ff" stroke={INK} strokeWidth={1.200} strokeLinejoin="round" />
      <path d="M186 82 L206 79 L206 86 L190 89Z" fill="#141416" stroke={INK} strokeWidth={1} />
      <ellipse cx={192} cy={76} rx={3} ry={3.400} fill="#ffd400" stroke={INK} strokeWidth={0.800} />
      {/* The tail: lamp and diffuser. */}
      <path d="M17 70 L29 66 L28 76 L18 77Z" fill="#ff2b2b" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <path d="M17 90 L40 90 L38 94 L19 94Z" fill="#141416" />
      {/* A wing mirror. */}
      <path d="M141 50 L150 48 L151 53 L143 54Z" fill="#b00808" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      {/* The wheel arches and the wheels. */}
      <path d="M32 92 A21 21 0 0 1 74 92Z" fill="#150404" />
      <path d="M139 92 A21 21 0 0 1 181 92Z" fill="#150404" />
      <SportWheel cx={53} cy={91} r={19} rim={rim} />
      <SportWheel cx={160} cy={91} r={19} rim={rim} />
    </Frame>
  );
}

/** A gold diver's watch with a blue dial and bezel, a date window and an Oyster-type gold bracelet. */
export function WatchArt({width = 96}: {width?: number}) {
  const id = useId();
  const gold = `${id}-gold`;
  const goldV = `${id}-goldv`;
  const dial = `${id}-dial`;
  const bezel = `${id}-bezel`;
  const links = (y0: number, y1: number, top: boolean) => {
    const rows: ReactNode[] = [];
    for (let y = y0; y < y1; y += 8) rows.push(<path key={y} d={`M${top ? 85 : 84} ${y} H${top ? 125 : 126}`} stroke="#7a5200" strokeWidth={1} opacity={0.7} />);
    return rows;
  };
  return (
    <Frame width={width}>
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0a6" />
          <stop offset="0.45" stopColor="#e9b21c" />
          <stop offset="1" stopColor="#9c6a06" />
        </linearGradient>
        <linearGradient id={goldV} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b98206" />
          <stop offset="0.35" stopColor="#ffe38a" />
          <stop offset="0.7" stopColor="#e2a914" />
          <stop offset="1" stopColor="#9c6a06" />
        </linearGradient>
        <radialGradient id={dial} cx="0.35" cy="0.3" r="0.95">
          <stop offset="0" stopColor="#5f8cff" />
          <stop offset="0.6" stopColor="#1d4fd6" />
          <stop offset="1" stopColor="#0c2a86" />
        </radialGradient>
        <linearGradient id={bezel} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b6df0" />
          <stop offset="1" stopColor="#0a2275" />
        </linearGradient>
      </defs>
      <ellipse cx={105} cy={115} rx={46} ry={4} fill="#000" opacity={0.28} />
      {/* The bracelet: gold links in three columns, top and bottom. */}
      <path d="M82 2 H128 L125 34 H85Z" fill={`url(#${goldV})`} stroke={INK} strokeWidth={1.400} strokeLinejoin="round" />
      <path d="M85 88 H125 L128 118 H82Z" fill={`url(#${goldV})`} stroke={INK} strokeWidth={1.400} strokeLinejoin="round" />
      {links(8, 34, true)}
      {links(94, 118, false)}
      <path d="M96 3 V34 M114 3 V34 M96 88 V118 M114 88 V118" stroke="#7a5200" strokeWidth={1} opacity={0.75} />
      {/* The crown with its guards. */}
      <rect x={147} y={52} width={13} height={16} rx={3} fill={`url(#${gold})`} stroke={INK} strokeWidth={1.400} />
      <path d="M149 55 H158 M149 60 H158 M149 65 H158" stroke="#7a5200" strokeWidth={1} />
      {/* The case, the blue bezel with its markers and the dial. */}
      <circle cx={105} cy={60} r={46} fill={`url(#${gold})`} stroke={INK} strokeWidth={1.600} />
      <circle cx={105} cy={60} r={39} fill={`url(#${bezel})`} stroke={INK} strokeWidth={1.200} />
      {Array.from({length: 12}, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const cx = 105 + Math.sin(a) * 34.500;
        const cy = 60 - Math.cos(a) * 34.500;
        return i === 0 ? <path key={i} d={`M${cx} ${cy - 3} L${cx + 3} ${cy + 2} L${cx - 3} ${cy + 2}Z`} fill="#fff7d0" stroke={INK} strokeWidth={0.600} /> : <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2.200 : 1.500} fill="#f6e7a5" />;
      })}
      <circle cx={105} cy={60} r={29.500} fill={`url(#${dial})`} stroke={INK} strokeWidth={1.200} />
      {[0, 60, 90, 120, 180, 240, 270, 300].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return <circle key={deg} cx={105 + Math.sin(a) * 23.500} cy={60 - Math.cos(a) * 23.500} r={deg % 90 === 0 ? 3 : 2.200} fill="#f7efc0" stroke="#b58910" strokeWidth={0.800} />;
      })}
      {/* The date window at three o'clock. */}
      <rect x={118} y={55.500} width={9} height={9} rx={1} fill="#fff" stroke={INK} strokeWidth={0.900} />
      <text x={122.500} y={62.500} textAnchor="middle" fontSize={6.500} fontWeight={700} fill="#111" fontFamily="sans-serif">17</text>
      {/* The hands. */}
      <path d="M105 60 L105 36" stroke="#f1d46a" strokeWidth={3} strokeLinecap="round" />
      <path d="M105 60 L121 70" stroke="#f1d46a" strokeWidth={3.600} strokeLinecap="round" />
      <path d="M105 60 L92 50" stroke="#fff" strokeWidth={1.200} strokeLinecap="round" />
      <circle cx={105} cy={60} r={3.600} fill="#f1d46a" stroke={INK} strokeWidth={1} />
      <path d="M78 46 A31 31 0 0 1 97 32" stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.55} />
    </Frame>
  );
}

/** A green sport bike: full fairing and windscreen, black seat, a silver muffler on this side, drilled brake discs. */
export function MotorcycleArt({width = 96}: {width?: number}) {
  const id = useId();
  const green = `${id}-green`;
  const rim = `${id}-rim`;
  const metal = `${id}-metal`;
  const dark = `${id}-dark`;
  const wheel = (cx: number, r: number, disc: boolean) => (
    <g key={cx}>
      <circle cx={cx} cy={84} r={r} fill="#1b1b1d" stroke={INK} strokeWidth={1.500} />
      <circle cx={cx} cy={84} r={r * 0.82} fill="#2a2a2e" />
      <circle cx={cx} cy={84} r={r * 0.72} fill={`url(#${rim})`} stroke="#59606a" strokeWidth={1} />
      <circle cx={cx} cy={84} r={r * 0.5} fill="#3a3d44" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line key={a} x1={cx} y1={84} x2={cx + Math.cos((a * Math.PI) / 180) * r * 0.68} y2={84 + Math.sin((a * Math.PI) / 180) * r * 0.68} stroke="#e4e9ef" strokeWidth={r * 0.1} strokeLinecap="round" />
      ))}
      {disc && <circle cx={cx} cy={84} r={r * 0.48} fill="none" stroke="#c9d0d8" strokeWidth={2} strokeDasharray="2 2.600" />}
      <circle cx={cx} cy={84} r={r * 0.14} fill="#d7dde5" stroke={INK} strokeWidth={0.800} />
    </g>
  );
  return (
    <Frame width={width}>
      <defs>
        <linearGradient id={green} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8ff4d" />
          <stop offset="0.5" stopColor="#58d10e" />
          <stop offset="1" stopColor="#1f7a05" />
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
      <path d="M80 58 L130 55 L134 94 L86 96Z" fill={`url(#${dark})`} stroke={INK} strokeWidth={1.400} strokeLinejoin="round" />
      <path d="M84 64 H130 M85 70 H131 M86 76 H132" stroke="#6b737d" strokeWidth={1.600} />
      <path d="M96 86 L126 84 L128 94 L98 95Z" fill={`url(#${metal})`} stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <circle cx={106} cy={78} r={11} fill={`url(#${metal})`} stroke={INK} strokeWidth={1.200} />
      <circle cx={106} cy={78} r={7} fill="#2b2f36" stroke="#ff9d2e" strokeWidth={1.800} />
      <circle cx={106} cy={78} r={2.400} fill="#d7dde5" />
      <path d="M82 60 L106 46 L136 52 M86 92 L74 74 L82 60" stroke="#8d949e" strokeWidth={2.600} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M100 84 L142 86 L126 99 L100 97Z" fill={`url(#${dark})`} stroke={INK} strokeWidth={1.300} strokeLinejoin="round" />
      {/* The tail, the seat and the tank. */}
      {/* The tail: an upswept cowl over the passenger seat, a pointed tail lamp, and the stepped rider seat. */}
      <path d="M8 34 C20 28 42 30 62 38 L72 50 L70 58 L30 58 C14 58 4 46 8 34Z" fill={`url(#${green})`} stroke={INK} strokeWidth={1.500} strokeLinejoin="round" />
      <path d="M8 34 L16 38 L10 42Z" fill="#ff2b2b" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <path d="M20 36 C32 33 46 36 58 41" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.6} />
      <path d="M52 44 C60 42 70 43 86 47 L86 58 L58 58 C52 56 50 48 52 44Z" fill="#1d1f24" stroke={INK} strokeWidth={1.400} strokeLinejoin="round" />
      <path d="M58 46 C66 45 74 46 84 49" stroke="#5a606a" strokeWidth={1.400} strokeLinecap="round" fill="none" />
      <path d="M78 40 C94 29 118 29 136 36 L130 55 L84 60Z" fill={`url(#${green})`} stroke={INK} strokeWidth={1.400} strokeLinejoin="round" />
      <path d="M88 38 C102 33 118 33 130 39" stroke="#fff" strokeWidth={2.200} strokeLinecap="round" fill="none" opacity={0.65} />
      {/* The fairing with the windscreen and the headlight. */}
      <path d="M128 36 C144 27 166 33 180 46 C184 51 182 58 174 60 L152 66 L138 82 L112 84 C106 70 112 54 120 44Z" fill={`url(#${green})`} stroke={INK} strokeWidth={1.500} strokeLinejoin="round" />
      <path d="M148 36 L162 18 C165 15 170 18 168 23 L160 42Z" fill="#cfe6f7" stroke={INK} strokeWidth={1.200} strokeLinejoin="round" opacity={0.92} />
      <path d="M170 49 C176 49 182 52 181 57 L170 59Z" fill="#fff6c0" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <path d="M122 52 C138 52 152 56 168 62" stroke="#15171b" strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d="M124 40 C132 36 140 36 148 40" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.6} />
      {/* The fork, the handlebar and the front brake. */}
      <path d="M152 60 L168 90" stroke="#4a4f57" strokeWidth={6} strokeLinecap="round" />
      <path d="M152 60 L168 90" stroke={`url(#${metal})`} strokeWidth={2.600} strokeLinecap="round" />
      <path d="M146 38 L156 34 M150 36 L154 30" stroke={INK} strokeWidth={2.600} strokeLinecap="round" />
      {wheel(46, 22, false)}
      {wheel(168, 22, true)}
      {/* A narrow black mudguard over the front wheel. */}
      <path d="M149 70 C155 61 181 61 188 71 L185 74 C178 67 159 67 153 74Z" fill="#15171b" stroke={INK} strokeWidth={1.200} strokeLinejoin="round" />
      {/* The exhaust on this side, drawn over the rear wheel: a pipe from the engine to a big silver muffler. */}
      <path d="M102 91 L28 72" stroke={INK} strokeWidth={13} strokeLinecap="round" fill="none" />
      <path d="M102 91 L28 72" stroke={`url(#${metal})`} strokeWidth={10} strokeLinecap="round" fill="none" />
      <path d="M98 89 L32 72" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
      <path d="M44 66 L46 77 M52 68 L54 79 M60 70 L62 81" stroke="#59606a" strokeWidth={1.600} strokeLinecap="round" />
      <ellipse cx={26} cy={71.500} rx={2.800} ry={5.500} transform="rotate(-14 26 71.500)" fill="#1a1c20" stroke={INK} strokeWidth={1} />
    </Frame>
  );
}
