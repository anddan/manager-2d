// Cartoon portraits. A player's look comes from their id, so the same player
// always looks the same; skin and hair lean on nationality and the shirt uses
// the club colours. The manager's look is picked when starting a new game.
// The face follows the mood: a big grin when happy, a frown when unhappy and
// angry brows when they're furious.
import {LEGEND_ID, THEO_ID} from "../game/legend";
import {Rng} from "../game/rng";
import type {ManagerLook, Player} from "../game/types";

export const SKIN = ["#f6d5bd", "#ebbd9c", "#d49c74", "#b37a52", "#8a5638", "#5d3923"];
const SKIN_WEIGHTS: Record<string, number[]> = {
  north: [30, 32, 16, 8, 8, 6],
  south: [10, 26, 30, 16, 11, 7],
  BR: [8, 15, 22, 22, 18, 15],
  NG: [0, 0, 4, 14, 36, 46],
  asia: [22, 40, 28, 8, 2, 0],
  maghreb: [6, 18, 34, 28, 11, 3],
};
const REGION: Record<string, keyof typeof SKIN_WEIGHTS> = {
  SE: "north", NO: "north", DK: "north", FI: "north", DE: "north", NL: "north", GB: "north",
  ES: "south", FR: "south", IT: "south", AR: "south", BR: "BR", NG: "NG",
  PT: "south", BE: "north", HR: "north", PL: "north", CH: "north", AT: "north", IS: "north", RS: "north",
  TR: "south", UY: "south", CO: "BR", MX: "south", JP: "asia", KR: "asia", MA: "maghreb",
  SN: "NG", GH: "NG", CI: "NG", CM: "NG",
};
export const HAIR = ["#1c1714", "#3b2618", "#6b4226", "#b8863b", "#e3c27a", "#a8471f", "#9ca3af"];
/** Men's styles; the order matters, players' looks are picked from it. */
const MALE_STYLES = ["short", "buzz", "afro", "sidepart", "mohawk", "bald", "long", "spiky", "curly"] as const;
const FEMALE_STYLES = ["long", "ponytail", "bun", "bob", "braids", "curly", "afro", "pixie"] as const;
// The newer styles (a top knot, a quiff, a neat side sweep, coils, half up, a fade, dreads) are picked in the look editors only,
// so everyone's generated look stays as it was.
export const HAIR_STYLES = [...MALE_STYLES, "ponytail", "bun", "bob", "braids", "pixie", "topknot", "quiff", "swept", "coils", "halfup", "fade", "dreads"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const FACE_SHAPES = ["oval", "round", "jaw", "pointed", "cleft"] as const;
export type FaceShape = (typeof FACE_SHAPES)[number];
/** Headband colours to pick from. */
export const HEADBANDS = ["#f8fafc", "#111827", "#dc2626", "#2563eb", "#facc15", "#16a34a", "#ec4899", "#7c3aed"];
export const BEARDS = ["none", "stubble", "beard", "moustache"] as const;
export type Beard = (typeof BEARDS)[number];
/** Eye colours: brown (the default), hazel, green, blue, grey. */
export const EYES = ["#4a2c17", "#8a5a2b", "#3f7d3a", "#2f6db5", "#6b7b8c"];
export const SUITS = ["#1f2937", "#1e3a8a", "#374151", "#3f2a1d", "#14532d", "#7f1d1d"];

export interface Look {
  skin: string;
  hair: string;
  style: HairStyle;
  beard: Beard;
  brows: number;
  eyeGap: number;
  glasses?: boolean;
  lashes?: boolean;
  /** Blond highlights in the hair. */
  highlights?: boolean;
  shape?: FaceShape;
  /** A headband in this colour. */
  headband?: string;
  /** Eye colour; missing means brown. */
  eyes?: string;
}

function seedOf(id: string): number {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Hand-made players with a look of their own rather than one drawn from their id. */
const FIXED_LOOKS: Record<string, Look> = {
  // Léon Dani: short brown hair, clean-shaven.
  [LEGEND_ID]: {skin: SKIN[1], hair: HAIR[2], style: "short", beard: "none", brows: 0, eyeGap: 8},
  // Theo Bergqvist: blond, swept to the side, clean-shaven, blue eyes.
  [THEO_ID]: {skin: SKIN[0], hair: HAIR[4], style: "sidepart", beard: "none", brows: 0, eyeGap: 8, eyes: EYES[3]},
};

/** The player's fixed look. */
export function lookFor(p: Player): Look {
  const base = bornLook(p);
  const own = p.look;
  if (!own) return base;
  // The manager's pick, over what the player came with (unknown styles fall back).
  return {
    ...base,
    skin: own.skin,
    hair: own.hair,
    style: (HAIR_STYLES as readonly string[]).includes(own.style) ? (own.style as HairStyle) : base.style,
    beard: (BEARDS as readonly string[]).includes(own.beard) ? (own.beard as Beard) : base.beard,
    eyes: own.eyes ?? base.eyes,
    glasses: own.glasses,
    lashes: own.lashes,
    highlights: own.highlights,
    shape: (FACE_SHAPES as readonly string[]).includes(own.shape ?? "") ? (own.shape as FaceShape) : undefined,
    headband: own.headband,
  };
}

/** The look a player comes with: from their id, nationality, age and gender. */
function bornLook(p: Player): Look {
  return {...bornFace(p), eyes: bornEyes(p)};
}

/** Eye colour from its own seed (so the rest of everyone's look stays as it was): light eyes mostly up north. */
function bornEyes(p: Player): string {
  const id = p.lookId ?? p.id;
  if (FIXED_LOOKS[id]) return FIXED_LOOKS[id].eyes ?? EYES[0];
  const rng = new Rng(seedOf(id + ":eyes"));
  const north = REGION[p.nationality] === "north";
  return rng.weighted(EYES, (e) => (e === EYES[0] ? (north ? 3 : 8) : e === EYES[1] ? 2 : north ? 2 : 0.3));
}

function bornFace(p: Player): Look {
  const id = p.lookId ?? p.id;
  const fixed = FIXED_LOOKS[id];
  if (fixed) return fixed;
  const rng = new Rng(seedOf(id));
  const weights = SKIN_WEIGHTS[REGION[p.nationality] ?? "south"];
  const skinIndex = rng.weighted(SKIN.map((_, i) => i), (i) => weights[i]);
  // Darker skin mostly goes with dark hair; blond and red hair mostly up north.
  const light = skinIndex <= 1;
  const hairIndex = rng.weighted(HAIR.slice(0, 6).map((_, i) => i), (i) =>
    i <= 1 ? 4 : i === 2 ? 3 : light ? (i === 5 ? 1 : 2.5) : 0.15
  );
  let hair = HAIR[hairIndex];
  if (p.gender === "f") {
    let style: HairStyle = rng.pick(FEMALE_STYLES);
    if (style === "afro" && skinIndex < 3) style = "curly";
    return {skin: SKIN[skinIndex], hair, style, beard: "none", brows: rng.range(-1, 1), eyeGap: rng.range(7, 8.5), lashes: true};
  }
  if (p.age >= 33 && rng.chance(0.45)) hair = "#9ca3af";
  let style: HairStyle = rng.pick(MALE_STYLES);
  if (style === "afro" && skinIndex < 3 && rng.chance(0.7)) style = "curly";
  if (style === "bald" && p.age < 24 && rng.chance(0.7)) style = "buzz";
  const beard = rng.weighted(BEARDS, (b) =>
    b === "none" ? (p.age < 21 ? 10 : 5) : b === "stubble" ? 3 : b === "beard" ? (p.age > 25 ? 2.5 : 0.8) : 0.6
  );
  return {skin: SKIN[skinIndex], hair, style, beard, brows: rng.range(-1.5, 1.5), eyeGap: rng.range(7, 9)};
}

/** A starting look for the manager, from their name. */
export function defaultManagerLook(name: string): ManagerLook {
  const rng = new Rng(seedOf(name || "manager"));
  return {
    skin: rng.pick(SKIN.slice(0, 4)),
    hair: rng.pick(HAIR.slice(0, 4)),
    style: rng.pick(["short", "sidepart", "buzz"]),
    beard: rng.pick(["none", "stubble"]),
    glasses: false,
    suit: SUITS[0],
  };
}

/** The manager's look as a face to draw. */
export function managerFace(m: ManagerLook): Look {
  return {
    skin: m.skin,
    hair: m.hair,
    style: (HAIR_STYLES as readonly string[]).includes(m.style) ? (m.style as HairStyle) : "short",
    beard: (BEARDS as readonly string[]).includes(m.beard) ? (m.beard as Beard) : "none",
    eyes: m.eyes,
    brows: 0,
    eyeGap: 8,
    glasses: m.glasses,
    lashes: m.lashes,
    highlights: m.highlights,
    shape: (FACE_SHAPES as readonly string[]).includes(m.shape ?? "") ? (m.shape as FaceShape) : undefined,
    headband: m.headband,
  };
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
  if (look.style === "ponytail") {
    return (
      <g fill={look.hair}>
        <path d="M60 22 Q88 20 84 46 Q82 62 74 70 Q79 52 72 34Z" />
        <circle cx={66} cy={24} r={3} fill="#f43f5e" />
      </g>
    );
  }
  if (look.style === "bun") return <circle cx={50} cy={15} r={9} fill={look.hair} />;
  // A knot on top of the head, the rest pulled back.
  if (look.style === "topknot") {
    return (
      <g fill={look.hair}>
        <ellipse cx={50} cy={11} rx={7.200} ry={8} />
        <path d="M43.500 17 Q50 21 56.500 17" fill="none" stroke={look.hair} strokeWidth={2.400} />
      </g>
    );
  }
  // Long hair behind, a small knot up top.
  if (look.style === "halfup") {
    return (
      <g fill={look.hair}>
        <path d="M28 40 Q25 66 34 75 L66 75 Q75 66 72 40Z" />
        <circle cx={50} cy={14} r={6.500} />
      </g>
    );
  }
  // Dreadlocks hanging round the head, thick ropes of different lengths with their twists marked.
  if (look.style === "dreads") {
    const locks: [number, number, number][] = [[25, 30, 40], [29.500, 32, 46], [34, 34, 36], [38.500, 36, 30], [61.500, 36, 30], [66, 34, 36], [70.500, 32, 46], [75, 30, 40]];
    return (
      <g>
        {locks.map(([x, y, h]) => (
          <g key={x}>
            <rect x={x - 2.600} y={y} width={5.200} height={h} rx={2.600} fill={look.hair} />
            {[0.25, 0.45, 0.65, 0.85].map((k) => (
              <path key={k} d={`M${x - 2.400} ${y + h * k} L${x + 2.400} ${y + h * k - 1.200}`} stroke="#000" strokeOpacity={0.22} strokeWidth={0.7} />
            ))}
          </g>
        ))}
      </g>
    );
  }
  return null;
}

function HairFront({look}: {look: Look}) {
  const f = look.hair;
  switch (look.style) {
    case "short":
    case "long":
      return <path d="M29 42 Q29 17 50 17 Q71 17 71 42 Q67 30 50 29 Q33 30 29 42Z" fill={f} />;
    case "buzz":
      return <path d="M30 40 Q30 19 50 19 Q70 19 70 40 Q66 30 50 29 Q34 30 30 40Z" fill={f} opacity={0.8} />;
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
      // A cap of hair under the spikes, so no scalp shows between them.
      return (
        <g fill={f}>
          <path d="M29 40 Q29 18 50 18 Q71 18 71 40 Q66 30 50 29 Q34 30 29 40Z" />
          <path d="M29 40 L31 24 L37 28 L40 16 L46 25 L50 13 L54 25 L60 16 L63 28 L69 24 L71 40 Q61 30 50 30 Q39 30 29 40Z" />
        </g>
      );
    case "curly":
      return (
        <g fill={f}>
          <path d="M29 40 Q29 18 50 18 Q71 18 71 40 Q66 30 50 29 Q34 30 29 40Z" />
          {[30, 36, 43, 50, 57, 64, 70].map((x, i) => (
            <circle key={x} cx={x} cy={i === 0 || i === 6 ? 32 : i === 3 ? 19 : 23} r={7} />
          ))}
        </g>
      );
    case "afro":
      // A full cap of hair, so no scalp shows between the curls behind.
      return <path d="M29 40 Q29 18 50 18 Q71 18 71 40 Q66 30 50 29 Q34 30 29 40Z" fill={f} />;
    // Short at the sides, a textured block on top.
    case "fade":
      return (
        <g fill={look.hair}>
          <path d="M30 42 Q29 22 50 20 Q71 22 70 42 Q66 33 50 31 Q34 33 30 42Z" opacity={0.5} />
          <path d="M35 31 Q37 17 50 16 Q63 17 65 31 Q58 24 50 24 Q42 24 35 31Z" />
        </g>
      );
    // Neat and swept to one side, with a parting.
    case "swept":
      return (
        <g>
          <path d="M29 43 Q27 17 51 16 Q73 17 71 42 Q69 31 59 27 Q49 24 41 29 Q33 32 29 43Z" fill={f} />
          <path d="M45 17.500 Q49 24 43 29.500" fill="none" stroke={shade(f, -0.4)} strokeWidth={0.9} strokeLinecap="round" />
        </g>
      );
    // Swept up and back with some height at the front.
    case "quiff":
      return (
        <g>
          <path d="M29 42 Q26 23 37 14 Q46 7 59 9 Q71 12 72 30 L71 42 Q66 31 50 29 Q35 31 29 42Z" fill={f} />
          <path d="M40 15 Q50 6 65 12" fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={1.600} strokeLinecap="round" />
        </g>
      );
    // Tight coils, twisted all over the top.
    case "coils":
      return (
        <g fill={f}>
          <path d="M29 40 Q29 19 50 19 Q71 19 71 40 Q66 31 50 30 Q34 31 29 40Z" />
          {([[34, 27], [40, 22], [47, 19], [54, 19], [61, 22], [67, 27], [37, 33], [44, 26], [51, 24], [58, 26], [65, 32]] as const).map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={3.600} />
          ))}
        </g>
      );
    case "topknot":
    case "halfup":
      // Pulled back from the face.
      return <path d="M29 42 Q29 17 50 17 Q71 17 71 42 Q67 27 50 26 Q33 27 29 42Z" fill={f} />;
    case "dreads":
      return (
        <g fill={f}>
          <path d="M29 40 Q29 17 50 17 Q71 17 71 40 Q66 30 50 29 Q34 30 29 40Z" />
          {[33, 39.500, 60.500, 67].map((x, i) => (
            <rect key={x} x={x - 2.600} y={22 + (i % 2) * 2} width={5.200} height={13 + (i % 2) * 3} rx={2.600} />
          ))}
        </g>
      );
    case "bald":
      // Cropped right down: a shadow of hair over the head, never bare scalp.
      return <path d="M29 40 Q29 18 50 18 Q71 18 71 40 Q66 30 50 29 Q34 30 29 40Z" fill={f} opacity={0.5} />;
    case "ponytail":
    case "bun":
    case "braids":
      // Pulled back from the face.
      return <path d="M29 42 Q29 17 50 17 Q71 17 71 42 Q67 27 50 26 Q33 27 29 42Z" fill={f} />;
    case "bob":
      return <path d="M29 42 Q29 17 50 17 Q71 17 71 42 Q70 33 62 31 Q52 35 40 31 Q31 33 29 42Z" fill={f} />;
    case "pixie":
      return <path d="M29 44 Q27 15 52 16 Q73 17 71 40 Q66 27 52 29 Q44 34 35 33 Q31 37 29 44Z" fill={f} />;
  }
}

/** Highlights, very subtle: a lighter shade of the hair itself. Curls get a few lighter curls among them; straighter hair a few fine streaks along the way it falls. */
function Highlights({style, hair}: {style: HairStyle; hair: string}) {
  // Based on the chosen hair: the same colour a good deal lighter and a little warmer, so it only just shows.
  const gold = shade(hair, 0.42);
  // Golden curls among the dark ones, inside the head of hair: open arcs, each turned its own way, as a curl catches the light.
  const tips = (spots: readonly (readonly [number, number])[], r: number) => (
    <g fill="none" strokeLinecap="round" stroke={gold} strokeWidth={r * 0.34} opacity={0.5}>
      {spots.map(([x, y], i) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} strokeDasharray={`${(2 * Math.PI * r) * 0.66} ${(2 * Math.PI * r) * 0.34}`} transform={`rotate(${(i * 83) % 360} ${x} ${y})`} />
      ))}
    </g>
  );
  if (style === "coils") return tips([[38, 26], [45, 22.500], [53, 21.500], [60, 24], [66, 29], [35, 31], [49, 27]], 2.300);
  if (style === "curly") return tips([[34, 29], [41, 23.500], [48, 21], [56, 21.500], [62, 24], [68, 30], [38, 31], [52, 26], [58, 30]], 2.800);
  if (style === "afro") return tips([[36, 21], [44, 16], [53, 14], [61, 18], [67, 26], [32, 30], [40, 26], [58, 25], [47, 22]], 3.400);
  // A fine streak tapering to a point: from the hairline up and back, as the hair falls.
  const streak = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number) => `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1} Q${cx + w} ${cy + w * 0.6} ${x0 + w} ${y0}Z`;
  const streaks = [
    streak(36, 30.500, 35.500, 23.500, 41.500, 18.500, 1.600),
    streak(42, 29, 42, 22, 48, 17.500, 1.400),
    streak(49, 28.500, 50, 21, 56, 17, 1.700),
    streak(56, 28.500, 58.500, 22.500, 64.500, 21, 1.400),
    streak(33, 35, 32, 28, 36.500, 23, 1.200),
    streak(64, 31, 67.500, 26.500, 69, 33, 1.100),
  ];
  return (
    <g fill={gold} opacity={0.5}>
      {streaks.map((d, i) => <path key={i} d={d} />)}
    </g>
  );
}

function BeardShape({look}: {look: Look}) {
  if (look.beard === "none") return null;
  // The moustache, over the lip and under the nose.
  const MOUSTACHE = "M40.500 58.600 Q44.500 54.800 50 56.600 Q55.500 54.800 59.500 58.600 Q55.500 57.400 50 58.800 Q44.500 57.400 40.500 58.600Z";
  if (look.beard === "moustache") return <path d={MOUSTACHE} fill={look.hair} stroke={look.hair} strokeWidth={1.6} strokeLinejoin="round" />;
  const stubble = look.beard === "stubble";
  return (
    <g opacity={stubble ? 0.3 : 0.95}>
      {/* The beard: sideburns, the jaw and chin, and up over the mouth to the moustache. */}
      <path d="M30 46 Q31 72 50 73 Q69 72 70 46 Q68 55 62 58.500 Q56 55.600 50 56.600 Q44 55.600 38 58.500 Q32 55 30 46Z" fill={look.hair} />
      <path d={MOUSTACHE} fill={look.hair} stroke={look.hair} strokeWidth={1.400} strokeLinejoin="round" />
    </g>
  );
}

export type MoodFace = "elated" | "happy" | "content" | "sad" | "upset";

/** Happiness 0..100 as a face. */
export function moodFace(mood: number): MoodFace {
  return mood >= 75 ? "elated" : mood >= 55 ? "happy" : mood >= 40 ? "content" : mood >= 22 ? "sad" : "upset";
}

function Mouth({face}: {face: MoodFace}) {
  const lip = "#9b3b3b";
  const line = "#5c1f1f";
  switch (face) {
    case "elated":
      // A big smile with teeth.
      return (
        <g>
          <path d="M40.5 57.6 Q50 71 59.5 57.6 Q50 60 40.5 57.6Z" fill="#5c1f1f" />
          <path d="M42.4 58.6 Q50 60.6 57.6 58.6 L57 60.6 Q50 62.2 43 60.6Z" fill="#fff" />
          <path d="M44.5 65.4 Q50 68.4 55.5 65.4" fill="none" stroke={lip} strokeWidth={1.4} strokeLinecap="round" />
        </g>
      );
    case "happy":
      return (
        <g>
          <path d="M42.6 59 Q50 66 57.4 59 Q50 62.4 42.6 59Z" fill={lip} />
          <path d="M42.6 59 Q50 62.4 57.4 59" fill="none" stroke={line} strokeWidth={1.1} strokeLinecap="round" />
        </g>
      );
    case "content":
      return (
        <g>
          <path d="M44 60.2 Q50 63.6 56 60.2 Q50 61.6 44 60.2Z" fill={lip} />
          <path d="M43.6 60.2 Q50 61.8 56.4 60.2" fill="none" stroke={line} strokeWidth={1.2} strokeLinecap="round" />
        </g>
      );
    case "sad":
      return <path d="M43.5 63 Q50 58 56.5 63" fill="none" stroke={line} strokeWidth={1.6} strokeLinecap="round" />;
    case "upset":
      return <path d="M42 64.5 Q50 56 58 64.5" fill="none" stroke={line} strokeWidth={2} strokeLinecap="round" />;
  }
}

/** A colour a little darker (negative) or lighter (positive), for shading and edges. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** The head's outline: rounder on top, a jaw narrowing to the chin. */
const HEAD = "M29 44 Q28 21 50 20 Q72 21 71 44 Q71 58 63 66 Q57 70.5 50 70.5 Q43 70.5 37 66 Q29 58 29 44Z";
/** The three face shapes: oval (as it always was), round (fuller cheeks, a softer chin), a strong jaw (broad and square). */
const HEADS: Record<FaceShape, string> = {
  oval: HEAD,
  round: "M28 45 Q27 21 50 20 Q73 21 72 45 Q73 60 62.500 67.500 Q56 70 50 70 Q44 70 37.500 67.500 Q27 60 28 45Z",
  // A narrower face down to a pointed chin.
  pointed: "M29 44 Q28 21 50 20 Q72 21 71 44 Q70 56 61 65 Q55 72 50 74 Q45 72 39 65 Q30 56 29 44Z",
  // The oval, with a dimple in the chin (drawn below).
  cleft: HEAD,
  jaw: "M29 44 Q28 21 50 20 Q72 21 71 44 L70.500 57 L66 66 Q63 70.500 58 70.800 L42 70.800 Q37 70.500 34 66 L29.500 57Z",
};

/** Shading shared by every face (no colours of its own, so one set of ids serves all). */
function FaceDefs() {
  return (
    <defs>
      <radialGradient id="face-shade" cx="0.42" cy="0.36" r="0.72">
        <stop offset="0.55" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.22" />
      </radialGradient>
      <radialGradient id="face-light" cx="0.4" cy="0.3" r="0.35">
        <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/** The head and face in a 100x100 box, centred at (50, 45). For use inside any SVG. */
export function Face({look, mood = 60, neck = false}: {look: Look; mood?: number; neck?: boolean}) {
  const face = moodFace(mood);
  // Worried brows lift in the middle; furious ones drop.
  const browTilt = face === "sad" ? 2.2 : face === "upset" ? -2.6 : face === "elated" ? -0.5 + look.brows * 0.3 : look.brows;
  const browLift = face === "elated" ? -1.2 : 0;
  const gap = look.eyeGap;
  const browColor = look.hair === "#e3c27a" ? "#8a6a2a" : look.style === "bald" && look.hair === "#9ca3af" ? "#6b7280" : look.hair;
  const droopy = face === "sad" || face === "upset";
  const squint = face === "elated";
  const edge = shade(look.skin, -0.28);
  const hairEdge = shade(look.hair, -0.4);
  const eyeY = droopy ? 46.2 : 45.4;
  // A brow: thick at the inner end, thin at the outer (`side` -1 left, 1 right).
  const brow = (side: number) => {
    const inner = 50 + side * (gap - 3.2);
    const outer = 50 + side * (gap + 4.2);
    const yIn = 38.4 - browTilt + browLift;
    const yOut = 39.2 + browTilt + browLift;
    const mid = (inner + outer) / 2;
    const top = Math.min(yIn, yOut);
    // Upper edge over an arch to the outer tip, lower edge back to a thicker inner end.
    return `M${inner} ${yIn - 1.2} Q${mid} ${top - 2.8} ${outer} ${yOut} Q${mid} ${top - 0.6} ${inner} ${yIn + 0.9}Z`;
  };
  return (
    <g>
      <FaceDefs />
      <g stroke={hairEdge} strokeWidth={0.7} strokeOpacity={0.6}>
        <HairBack look={look} />
      </g>
      {/* The neck, in front of long hair behind it but under the head. */}
      {neck && (
        <g>
          <rect x={43} y={60} width={14} height={20} rx={4} fill={look.skin} />
          <rect x={43} y={60} width={14} height={14} rx={4} fill="#000" opacity={0.18} />
        </g>
      )}
      {/* Ears, with the fold inside. */}
      {[29, 71].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={47} rx={4.3} ry={5} fill={look.skin} stroke={edge} strokeWidth={0.7} />
          <path d={x < 50 ? "M30.2 44.5 Q27.6 47 30 50" : "M69.8 44.5 Q72.4 47 70 50"} fill="none" stroke={edge} strokeWidth={0.8} strokeLinecap="round" />
        </g>
      ))}
      {/* The head, shaded at the edges and lit on the forehead, with a fine outline. */}
      <path d={HEADS[look.shape ?? "oval"]} fill={look.skin} />
      <path d={HEADS[look.shape ?? "oval"]} fill="url(#face-shade)" />
      <ellipse cx={46} cy={34} rx={14} ry={10} fill="url(#face-light)" />
      <path d={HEADS[look.shape ?? "oval"]} fill="none" stroke={edge} strokeWidth={0.8} />
      {look.shape === "cleft" && (
        <g fill="none" strokeLinecap="round">
          <path d="M50 66.200 L50 69" stroke={edge} strokeWidth={1.100} opacity={0.55} />
          <path d="M51.400 66.600 L51.400 69" stroke="#fff" strokeWidth={0.6} opacity={0.18} />
        </g>
      )}
      {/* Cheekbones catching the light, and a soft shadow under the jaw. */}
      <ellipse cx={36.500} cy={50.500} rx={4.200} ry={2.600} fill="#fff" opacity={0.1} />
      <ellipse cx={63.500} cy={50.500} rx={4.200} ry={2.600} fill="#fff" opacity={0.1} />
      {look.shape !== "pointed" && <path d="M36 65.500 Q50 74 64 65.500" fill="none" stroke={edge} strokeWidth={1.600} strokeLinecap="round" opacity={0.18} />}
      <BeardShape look={look} />
      <g stroke={hairEdge} strokeWidth={0.7} strokeOpacity={0.6}>
        <HairFront look={look} />
      </g>
      {/* Blond highlights: bleached tips on the curls, fine streaks swept through straighter hair. */}
      {look.highlights && look.style !== "bald" && look.style !== "buzz" && <Highlights style={look.style} hair={look.hair} />}
      {/* A headband across the forehead, over the hair. */}
      {look.headband && (
        <g>
          <path d="M29.200 34.500 Q50 26.500 70.800 34.500 L70.600 39 Q50 31 29.400 39Z" fill={look.headband} stroke={shade(look.headband, -0.35)} strokeWidth={0.6} strokeLinejoin="round" />
          <path d="M33 33.500 Q50 27.500 67 33.500" fill="none" stroke="#fff" strokeOpacity={0.28} strokeWidth={0.9} strokeLinecap="round" />
        </g>
      )}
      {/* A shine on the hair. */}
      {look.style !== "bald" && look.style !== "buzz" && (
        <path d="M38 24 Q47 19.5 58 22.5" fill="none" stroke="#fff" strokeOpacity={0.28} strokeWidth={1.6} strokeLinecap="round" />
      )}
      <g fill={browColor}>
        <path d={brow(-1)} />
        <path d={brow(1)} />
      </g>
      {squint ? (
        <g stroke="#2a1d16" strokeWidth={1.8} fill="none" strokeLinecap="round">
          <path d={`M${50 - gap - 3.4} 46 Q${50 - gap} 42.6 ${50 - gap + 3.4} 46`} />
          <path d={`M${50 + gap - 3.4} 46 Q${50 + gap} 42.6 ${50 + gap + 3.4} 46`} />
        </g>
      ) : (
        <>
          {[50 - gap, 50 + gap].map((x) => (
            // Almond eye: the white, a coloured iris with pupil and glint, the upper lid line.
            <g key={x}>
              <path d={`M${x - 4.5} 45.4 Q${x} 40.8 ${x + 4.5} 45.4 Q${x} 49.4 ${x - 4.5} 45.4Z`} fill="#fff" />
              <circle cx={x + 0.4} cy={eyeY} r={2.9} fill={look.eyes ?? EYES[0]} />
              <circle cx={x + 0.4} cy={eyeY} r={2.9} fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={0.5} />
              <circle cx={x + 0.4} cy={eyeY} r={1.35} fill="#0b0f19" />
              <circle cx={x + 1.3} cy={eyeY - 0.9} r={0.75} fill="#fff" />
              <path d={`M${x - 4.7} 45.6 Q${x} 40.4 ${x + 4.7} 45.2`} fill="none" stroke="#2a1d16" strokeWidth={1.3} strokeLinecap="round" />
              {/* The lower lid, a soft line under the eye. */}
              <path d={`M${x - 3.2} 48.200 Q${x} 49.800 ${x + 3.2} 48.200`} fill="none" stroke={edge} strokeWidth={0.5} strokeLinecap="round" opacity={0.45} />
              {/* The crease of the lid above. */}
              <path d={`M${x - 3.6} 42.6 Q${x} 39.8 ${x + 3.6} 42.4`} fill="none" stroke={edge} strokeWidth={0.6} strokeLinecap="round" opacity={0.7} />
              {droopy && <path d={`M${x - 4} 44.6 Q${x} 42.4 ${x + 4} 44.4 L${x + 4} 41 L${x - 4} 41Z`} fill={look.skin} />}
            </g>
          ))}
        </>
      )}
      {look.lashes && (
        // Lashes along the outer half of the upper lid, longer towards the corner (also on a smiling, closed eye).
        <g stroke="#1f2937" strokeWidth={0.75} strokeLinecap="round">
          {([-1, 1] as const).map((side) => (
            <path
              key={side}
              d={[0.5, 0.72, 0.9, 1].map((t) => {
                const px = 50 + side * (gap + t * 4.5);
                const py = squint ? 46 - 3.4 * (1 - t * t) : 45.4 - 2.4 * (1 - t * t);
                return `M${px.toFixed(2)} ${py.toFixed(2)} l${(side * (0.7 + t * 1.5)).toFixed(2)} ${(-2.1 + t * 0.4).toFixed(2)}`;
              }).join(" ")}
            />
          ))}
        </g>
      )}
      {look.glasses && (
        // Rounded frames with a tinted glass and a glint, a bridge over the nose and the arms to the ears.
        <g strokeLinejoin="round" strokeLinecap="round">
          <g fill="none" stroke="#1f2937" strokeWidth={1.2}>
            <path d={`M${50 - gap - 5.8} 44.200 L29.500 43.600`} />
            <path d={`M${50 + gap + 5.8} 44.200 L70.500 43.600`} />
            <path d={`M${50 - gap + 5.8} 43.600 Q50 41.600 ${50 + gap - 5.8} 43.600`} />
          </g>
          {[50 - gap, 50 + gap].map((x) => (
            <g key={x}>
              <rect x={x - 5.8} y={40.600} width={11.600} height={9} rx={3.600} fill="#bfe3ff" fillOpacity={0.16} stroke="#1f2937" strokeWidth={1.400} />
              <path d={`M${x - 3.600} 48 L${x - 1.200} 42.400`} stroke="#fff" strokeOpacity={0.55} strokeWidth={0.9} />
              <path d={`M${x - 1.600} 48.400 L${x + 0.200} 44.200`} stroke="#fff" strokeOpacity={0.35} strokeWidth={0.7} />
            </g>
          ))}
        </g>
      )}
      {/* The nose: a shadow down one side, the tip and the nostrils. */}
      <path d="M49.2 48 Q47.6 51.8 48.4 53.4" fill="none" stroke={edge} strokeWidth={1.1} strokeLinecap="round" />
      <path d="M47.2 54 Q50 55.6 52.8 54" fill="none" stroke={edge} strokeWidth={1.1} strokeLinecap="round" />
      <ellipse cx={51} cy={52.6} rx={1.6} ry={1} fill="#fff" opacity={0.18} />
      <Mouth face={face} />
      <circle cx={38} cy={53.5} r={3.2} fill="#f87171" opacity={face === "elated" ? 0.32 : 0.15} />
      <circle cx={62} cy={53.5} r={3.2} fill="#f87171" opacity={face === "elated" ? 0.32 : 0.15} />
    </g>
  );
}

/** A player's portrait; the face follows their happiness unless `mood` is given. */
export function Avatar({player, shirt, trim, size = 96, mood}: {player: Player; shirt: string; trim: string; size?: number; mood?: number}) {
  return <KitAvatar look={lookFor(player)} keeper={player.position === "GK"} shirt={shirt} trim={trim} size={size} mood={mood ?? player.happiness} />;
}

/** A player's face and shoulders in the kit, for any look (the look editor draws with it too). */
export function KitAvatar({look, keeper = false, shirt, trim, size = 96, mood = 70}: {look: Look; keeper?: boolean; shirt: string; trim: string; size?: number; mood?: number}) {
  const kit = keeper ? "#16a34a" : shirt;
  const kitTrim = keeper ? "#facc15" : trim;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="avatar" aria-hidden>
      <path d="M14 100 Q16 80 34 76 L66 76 Q84 80 86 100Z" fill={kit} />
      <path d="M40 76 L50 86 L60 76" fill="none" stroke={kitTrim} strokeWidth={3} strokeLinejoin="round" />
      <Face look={look} mood={mood} neck />
    </svg>
  );
}

/** A player's look in the editor's shape (it edits the manager's look, which has a suit too). */
export function editableLook(p: Player): ManagerLook {
  const l = lookFor(p);
  return {skin: l.skin, hair: l.hair, style: l.style, beard: l.beard, eyes: l.eyes, glasses: !!l.glasses, lashes: !!l.lashes, highlights: !!l.highlights, shape: l.shape, headband: l.headband, suit: "#1f2937"};
}

/** The editor's look back into a full look (with the face's fixed details from the player). */
export function lookFromEditor(p: Player, m: ManagerLook): Look {
  return {...lookFor({...p, look: {skin: m.skin, hair: m.hair, style: m.style, beard: m.beard, eyes: m.eyes, glasses: m.glasses, lashes: m.lashes, highlights: m.highlights, shape: m.shape, headband: m.headband}})};
}

/** The manager in a suit and tie. */
export function ManagerAvatar({look, size = 96, mood = 70, tie = "#dc2626"}: {look: ManagerLook; size?: number; mood?: number; tie?: string}) {
  const face = managerFace(look);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="avatar" aria-hidden>
      <path d="M12 100 Q14 80 34 76 L66 76 Q86 80 88 100Z" fill={look.suit} />
      <path d="M40 76 L50 92 L60 76Z" fill="#f8fafc" />
      <path d="M48 79 L52 79 L53.5 92 L50 96 L46.5 92Z" fill={tie} />
      <path d="M34 76 L44 77 L50 92 L40 100 Z M66 76 L56 77 L50 92 L60 100Z" fill="#000" opacity={0.18} />
      <rect x={43} y={64} width={14} height={13} rx={4} fill={face.skin} />
      <rect x={43} y={64} width={14} height={8} rx={4} fill="#000" opacity={0.18} />
      <Face look={face} mood={mood} />
    </svg>
  );
}
