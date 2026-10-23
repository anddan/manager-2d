// A cartoon portrait drawn from the player's id, so the same player always
// looks the same. Skin and hair lean on nationality; the shirt uses the club
// colours; the mouth follows the player's happiness.
import {Rng} from "../game/rng";
import type {Player} from "../game/types";

const SKIN = ["#f6d5bd", "#ebbd9c", "#d49c74", "#b37a52", "#8a5638", "#5d3923"];
const SKIN_WEIGHTS: Record<string, number[]> = {
  north: [30, 32, 16, 8, 8, 6],
  south: [10, 26, 30, 16, 11, 7],
  BR: [8, 15, 22, 22, 18, 15],
  NG: [0, 0, 4, 14, 36, 46],
};
const REGION: Record<string, keyof typeof SKIN_WEIGHTS> = {
  SE: "north", NO: "north", DK: "north", FI: "north", DE: "north", NL: "north", GB: "north",
  ES: "south", FR: "south", AR: "south", BR: "BR", NG: "NG",
};
const HAIR = ["#1c1714", "#3b2618", "#6b4226", "#b8863b", "#e3c27a", "#a8471f"];
const HAIR_STYLES = ["short", "buzz", "afro", "sidepart", "mohawk", "bald", "long", "spiky", "curly"] as const;
type HairStyle = (typeof HAIR_STYLES)[number];

export interface Look {
  skin: string;
  hair: string;
  style: HairStyle;
  beard: "none" | "stubble" | "beard" | "moustache";
  brows: number;
  eyeGap: number;
}

function seedOf(id: string): number {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** The player's fixed look. */
export function lookFor(p: Player): Look {
  const rng = new Rng(seedOf(p.id));
  const weights = SKIN_WEIGHTS[REGION[p.nationality] ?? "south"];
  const skinIndex = rng.weighted(SKIN.map((_, i) => i), (i) => weights[i]);
  // Darker skin mostly goes with dark hair; blond and red hair mostly up north.
  const light = skinIndex <= 1;
  const hairIndex = rng.weighted(HAIR.map((_, i) => i), (i) =>
    i <= 1 ? 4 : i === 2 ? 3 : light ? (i === 5 ? 1 : 2.5) : 0.15
  );
  let hair = HAIR[hairIndex];
  if (p.age >= 33 && rng.chance(0.45)) hair = "#9ca3af";
  let style = rng.pick(HAIR_STYLES);
  if (style === "afro" && skinIndex < 3 && rng.chance(0.7)) style = "curly";
  if (style === "bald" && p.age < 24 && rng.chance(0.7)) style = "buzz";
  const beard = rng.weighted(["none", "stubble", "beard", "moustache"] as const, (b) =>
    b === "none" ? (p.age < 21 ? 10 : 5) : b === "stubble" ? 3 : b === "beard" ? (p.age > 25 ? 2.5 : 0.8) : 0.6
  );
  return {skin: SKIN[skinIndex], hair, style, beard, brows: rng.range(-1.5, 1.5), eyeGap: rng.range(7, 9)};
}

function HairBack({look}: {look: Look}) {
  if (look.style === "afro") {
    return (
      <g fill={look.hair}>
        <circle cx={36} cy={30} r={13} />
        <circle cx={50} cy={23} r={15} />
        <circle cx={64} cy={30} r={13} />
        <circle cx={29} cy={42} r={9} />
        <circle cx={71} cy={42} r={9} />
      </g>
    );
  }
  if (look.style === "long") return <path d="M27 40 Q24 70 33 76 L67 76 Q76 70 73 40Z" fill={look.hair} />;
  return null;
}

function HairFront({look}: {look: Look}) {
  const f = look.hair;
  switch (look.style) {
    case "short":
    case "long":
      return <path d="M29 42 Q29 17 50 17 Q71 17 71 42 Q67 30 50 29 Q33 30 29 42Z" fill={f} />;
    case "buzz":
      return <path d="M30 40 Q30 19 50 19 Q70 19 70 40 Q66 30 50 29 Q34 30 30 40Z" fill={f} opacity={0.55} />;
    case "sidepart":
      return <path d="M29 44 Q27 16 52 16 Q73 17 71 41 L69 33 Q60 26 44 28 Q35 31 31 44Z" fill={f} />;
    case "mohawk":
      return (
        <g fill={f}>
          <path d="M31 38 Q31 21 50 20 Q69 21 69 38 Q64 30 50 29 Q36 30 31 38Z" opacity={0.45} />
          <path d="M44 29 Q45 10 50 7 Q55 10 56 29Z" />
        </g>
      );
    case "spiky":
      return <path d="M29 40 L31 24 L37 28 L40 16 L46 25 L50 13 L54 25 L60 16 L63 28 L69 24 L71 40 Q61 30 50 30 Q39 30 29 40Z" fill={f} />;
    case "curly":
      return (
        <g fill={f}>
          {[30, 36, 43, 50, 57, 64, 70].map((x, i) => (
            <circle key={x} cx={x} cy={i === 0 || i === 6 ? 32 : i === 3 ? 19 : 23} r={7} />
          ))}
        </g>
      );
    case "afro":
      return <path d="M30 38 Q32 26 50 25 Q68 26 70 38 Q62 31 50 31 Q38 31 30 38Z" fill={f} />;
    case "bald":
      return <ellipse cx={42} cy={27} rx={5} ry={2.5} fill="#fff" opacity={0.25} />;
  }
}

function Beard({look}: {look: Look}) {
  if (look.beard === "none") return null;
  if (look.beard === "moustache") return <path d="M42 56 Q50 52 58 56 Q50 55 42 56Z" fill={look.hair} stroke={look.hair} strokeWidth={1.6} strokeLinejoin="round" />;
  return (
    <path
      d="M30 48 Q31 72 50 73 Q69 72 70 48 Q66 60 58 62 Q50 57 42 62 Q34 60 30 48Z"
      fill={look.hair}
      opacity={look.beard === "stubble" ? 0.3 : 0.95}
    />
  );
}

export function Avatar({player, shirt, trim, size = 96, mood}: {player: Player; shirt: string; trim: string; size?: number; mood?: number}) {
  const look = lookFor(player);
  const happy = mood ?? 60;
  const mouth = happy >= 60 ? "M43 59 Q50 65 57 59" : happy >= 35 ? "M44 60 L56 60" : "M43 62 Q50 56 57 62";
  const browTilt = happy < 35 ? 2 : look.brows;
  const keeper = player.position === "GK";
  const kit = keeper ? "#16a34a" : shirt;
  const kitTrim = keeper ? "#facc15" : trim;
  const gap = look.eyeGap;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="avatar" aria-hidden>
      {/* Shirt and shoulders */}
      <path d="M14 100 Q16 80 34 76 L66 76 Q84 80 86 100Z" fill={kit} />
      <path d="M40 76 L50 86 L60 76" fill="none" stroke={kitTrim} strokeWidth={3} strokeLinejoin="round" />
      <rect x={43} y={64} width={14} height={14} rx={4} fill={look.skin} />
      <HairBack look={look} />
      {/* Head */}
      <circle cx={29} cy={47} r={4.5} fill={look.skin} />
      <circle cx={71} cy={47} r={4.5} fill={look.skin} />
      <ellipse cx={50} cy={45} rx={21} ry={24} fill={look.skin} />
      <Beard look={look} />
      <HairFront look={look} />
      {/* Brows, eyes, nose, mouth */}
      <g stroke={look.hair === "#e3c27a" ? "#8a6a2a" : look.hair} strokeWidth={2} strokeLinecap="round">
        <line x1={50 - gap - 4} y1={39 + browTilt} x2={50 - gap + 3} y2={38 - browTilt} />
        <line x1={50 + gap - 3} y1={38 - browTilt} x2={50 + gap + 4} y2={39 + browTilt} />
      </g>
      <ellipse cx={50 - gap} cy={45} rx={3.4} ry={3.8} fill="#fff" />
      <ellipse cx={50 + gap} cy={45} rx={3.4} ry={3.8} fill="#fff" />
      <circle cx={50 - gap + 0.6} cy={45.6} r={1.9} fill="#1f2937" />
      <circle cx={50 + gap + 0.6} cy={45.6} r={1.9} fill="#1f2937" />
      <path d="M50 48 Q47 53 50 54" fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={1.4} strokeLinecap="round" />
      <path d={mouth} fill="none" stroke="#7a2e2e" strokeWidth={2} strokeLinecap="round" />
      <circle cx={38} cy={53} r={3} fill="#f87171" opacity={0.18} />
      <circle cx={62} cy={53} r={3} fill="#f87171" opacity={0.18} />
    </svg>
  );
}
