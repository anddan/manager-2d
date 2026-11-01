// A second avatar style, drawn like an illustrated footballer. The proportions are measured from the references:
// a narrow, long head with a straight jaw and a small chin, thin ink outline, flat warm skin with one flat shadow on the
// right, big ears, thick angled brows, big brown eyes with a heavy upper lid, a flat rounded nose tip, a small smirk
// (or a smile with teeth), a black quiff with a grey streak, a short neck and a V-neck shirt with hands on the hips.
import {useId} from "react";
import type {Look} from "./Avatar";

const INK = "#1a1210";

export type AvatarStyle = "toon" | "classic";
const STYLE_KEY = "manager2d.avatarStyle";

/** Which avatar style is drawn (the illustrated one to begin with), remembered on this device. */
export function readAvatarStyle(): AvatarStyle {
  try {
    return localStorage.getItem(STYLE_KEY) === "classic" ? "classic" : "toon";
  } catch {
    return "toon";
  }
}

export function writeAvatarStyle(style: AvatarStyle): void {
  try {
    localStorage.setItem(STYLE_KEY, style);
  } catch {
    // Only for now.
  }
}

/** A colour a little darker (negative) or lighter (positive). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Skin with a little more colour and warmth, as in an illustration. */
function warm(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const avg = (r + g + b) / 3;
  const c = (v: number, bias = 0) => Math.max(0, Math.min(255, Math.round(avg + (v - avg) * 1.15 + bias)));
  return `#${((1 << 24) | (c(r, 5) << 16) | (c(g, 1) << 8) | c(b, -5)).toString(16).slice(1)}`;
}

type Mood = "elated" | "happy" | "content" | "sad" | "upset";
const moodOf = (m: number): Mood => (m >= 75 ? "elated" : m >= 55 ? "happy" : m >= 40 ? "content" : m >= 22 ? "sad" : "upset");

/** The face shapes: oval (straight cheeks down to a long jaw and a small chin), round, a strong square jaw, pointed; "cleft" is the oval with a dimple. */
const HEADS: Record<string, string> = {
  oval: "M31.500 40 C29.500 23 34 10.500 50 10.500 C66 10.500 70.500 23 68.500 40 L66.500 53 Q62.500 62.500 57 66 Q50.500 69.500 44 66 Q38.500 62.500 33.500 53Z",
  // A fuller jaw with a softer chin.
  round: "M33 22 Q31 11 50 10.500 Q69 11 67 22 Q69.500 31 68.500 40 Q69.500 52 64 61 Q58 68.500 50 69 Q42 68.500 36 61 Q30.500 52 31.500 40 Q30.500 31 33 22Z",
  // A square, strong jaw.
  jaw: "M33 22 Q31 11 50 10.500 Q69 11 67 22 Q69.500 31 68.500 40 L68.200 56 Q66.500 65.500 61 68.200 Q56 69.800 50 69.800 Q44 69.800 39 68.200 Q33.500 65.500 31.800 56 L31.500 40 Q30.500 31 33 22Z",
  // A narrower, longer chin.
  pointed: "M33 22 Q31 11 50 10.500 Q69 11 67 22 Q69.500 31 68.500 40 L65.500 53 Q60 63 54 70 Q50 74 46 70 Q40 63 34.500 53 L31.500 40 Q30.500 31 33 22Z",
};
/** Ears change a little with the face: smaller on a round face, longer on a pointed one. */
const EARS: Record<string, {rx: number; ry: number; cy: number; tilt?: number}> = {
  oval: {rx: 3.500, ry: 6.200, cy: 43.500},
  // Sticking out and up: the top of each ear leans away from the head.
  round: {rx: 3.500, ry: 6, cy: 42.500, tilt: 16},
  jaw: {rx: 3.600, ry: 6.400, cy: 44},
  pointed: {rx: 3.800, ry: 7, cy: 43},
  cleft: {rx: 3.500, ry: 6, cy: 42.500, tilt: 16},
};
// Every face shape has the same head: the shapes differ in the ears and the brows (see EARS and BROWS).
for (const k of ["round", "jaw", "cleft"]) HEADS[k] = HEADS.oval;
// The fourth shape is the same head a little wider at the cheeks (a few pixels each side).
HEADS.pointed = "M30 41 C28.500 23 33.500 10.500 50 10.500 C66.500 10.500 71.500 23 70 41 L67.800 53 Q62.500 62.500 57 66 Q50.500 69.500 44 66 Q38.500 62.500 32.200 53Z";
/** The brows by face shape: how thick, and how much they tilt (positive: lower at the inner end). */
const BROWS: Record<string, {thick: number; tilt: number; short?: number; lift?: number; apart?: number}> = {
  oval: {thick: 1, tilt: 0},
  round: {thick: 0.850, tilt: -0.600},
  jaw: {thick: 1.300, tilt: 0.700},
  pointed: {thick: 0.750, tilt: 1.100},
  // Shorter brows, set higher up.
  cleft: {thick: 0.950, tilt: -0.200, short: 3, lift: 1.800, apart: 2.200},
};
const headOf = (look: Look) => HEADS[look.shape ?? "oval"] ?? HEADS.oval;

/** Hair behind the head (long styles). */
export function HairBack({style, hair}: {style: string; hair: string}) {
  if (style === "dreads") {
    return (
      <g>
        <path d="M30 24 Q26 56 30 80 L70 80 Q74 56 70 24Z" fill={hair} stroke={INK} strokeWidth={0.600} strokeLinejoin="round" />
        <path d="M34 40 L33 78 M40 40 L40 80 M46 40 L46 80 M54 40 L54 80 M60 40 L60 80 M66 40 L67 78" stroke={shade(hair, -0.5)} strokeWidth={0.700} fill="none" />
      </g>
    );
  }
  if (style === "braids") {
    return (
      <g>
        <path d="M30 24 Q27 56 31 80 L69 80 Q73 56 70 24Z" fill={hair} stroke={INK} strokeWidth={0.600} strokeLinejoin="round" />
        {[35, 45, 55, 65].map((x) => <path key={x} d={`M${x} 44 l2 4 l-4 4 l4 4 l-4 4 l4 4 l-4 4 l2 4`} fill="none" stroke={shade(hair, -0.5)} strokeWidth={0.700} />)}
      </g>
    );
  }
  if (style === "haaland") {
    return <path d="M30.500 28 Q26.500 50 31 72 L39 67 Q35.500 50 36.500 30Z M69.500 28 Q73.500 50 69 72 L61 67 Q64.500 50 63.500 30Z" fill={hair} stroke={INK} strokeWidth={0.600} strokeLinejoin="round" />;
  }
  if (["long", "halfup"].includes(style)) return <path d="M30 24 Q26 56 30 78 L70 78 Q74 56 70 24Z" fill={hair} stroke={INK} strokeWidth={0.600} strokeLinejoin="round" />;
  if (style === "bob") return <path d="M30 24 Q27 50 31 64 L69 64 Q73 50 70 24Z" fill={hair} stroke={INK} strokeWidth={0.600} strokeLinejoin="round" />;
  if (style === "ponytail") return <path d="M62 14 Q80 16 76 44 Q74 56 68 62 Q70 44 64 28Z" fill={hair} stroke={INK} strokeWidth={0.600} strokeLinejoin="round" />;
  return null;
}

/** What a style is drawn with: filled outlines, circles, and a few lines for the details. */
interface HairShape {
  paths: string[];
  circles?: [number, number, number][];
  lines?: string[];
  /** The hair is partly see-through (a fade, a buzz). */
  opacity?: number;
  /** Parts drawn in the full hair colour over a see-through base (the strip of a mohawk). */
  extra?: string[];
  extraCircles?: [number, number, number][];
}

/** A smooth cap of hair with the hairline across the forehead (the base of the longer styles). */
const CAP = "M31.500 37 L30 27 Q28.500 11 50 9 Q71.500 11 70 27 L68.800 38 L67 31 Q65 25 50 24.500 Q35 25 33 31Z";

function hairShape(style: string): HairShape | null {
  switch (style) {
    case "bald":
      return null;
    case "buzz":
      // Cropped close: the whole top of the head in the hair colour, a little lighter.
      return {paths: ["M31 36 Q28 9 50 8 Q72 9 69 36 Q66 25 50 24.500 Q34 25 31 36Z"], opacity: 0.8};
    case "afro":
      return {paths: ["M29 40 Q27 9 50 6 Q73 9 71 40 L68.800 38 L67 31 Q65 25 50 24.500 Q35 25 33 31 L31.200 38Z"], circles: [[30, 24, 7], [32, 14, 8], [41, 7, 9], [50, 5, 9.500], [59, 7, 9], [68, 14, 8], [70, 24, 7], [50, 15, 9]]};
    case "curly":
      return {paths: ["M29 40 Q27 9 50 6 Q73 9 71 40 L68.800 38 L67 31 Q65 25 50 24.500 Q35 25 33 31 L31.200 38Z"], circles: [[36, 9, 5], [43, 7, 5], [50, 6, 5], [57, 7, 5], [64, 9, 5], [32, 15, 4.800], [39, 14, 4.800], [46, 13, 4.800], [54, 13, 4.800], [61, 14, 4.800], [68, 15, 4.800], [31, 24, 4], [69, 24, 4], [50, 16, 6]]};
    case "coils": {
      const c: [number, number, number][] = [];
      let row = 0;
      for (let y = 7; y <= 27; y += 4.200, row++) for (let x = 33 + (row % 2) * 2.100; x <= 67; x += 4.200) if (Math.pow((x - 50) / 20, 2) + Math.pow((y - 18) / 13, 2) <= 1.100) c.push([x, y, 2.700]);
      return {paths: ["M29 40 Q27 9 50 6 Q73 9 71 40 L68.800 38 L67 31 Q65 25 50 24.500 Q35 25 33 31 L31.200 38Z"], circles: c};
    }
    case "mohawk":
      // Shaved sides (a light stubble over the whole top) and the strip in the middle.
      return {paths: ["M31 36 Q28 9 50 8 Q72 9 69 36 Q66 25 50 24.500 Q34 25 31 36Z"], opacity: 0.4, extra: ["M43.500 24 L44.500 11 L47.500 13 L49 4 L51 4 L52.500 13 L55.500 11 L56.500 24Z"]};
    case "spiky":
      return {paths: ["M31.500 38 L29.500 27 Q28 21 31 16 L29.500 8 L37 13 L38.500 3.500 L45 11.500 L50 1.500 L55 11.500 L61.500 3.500 L63 13 L70.500 8 L69 16 Q72 21 70.500 27 L68.800 38 L67 31 Q65 25 50 24.500 Q35 25 33 31Z"], lines: ["M38 14 L40 24 M50 11 L50 23 M62 14 L60 24"]};
    case "quiff":
      return {paths: ["M31.500 37 L29.500 26 Q27 12 40 6 Q52 1 64 7 Q74 12 70.500 27 L68.800 38 L67 31 Q65 25 50 24 Q35 25 33 31Z"], lines: ["M36 18 Q46 8 62 10"]};
    case "swept":
      return {paths: ["M31.500 37 L29.500 27 Q27 10 50 7.500 Q73 10 70 30 L68.800 38 Q66 28 56 27 Q44 26 34.500 34Z"], lines: ["M34 22 Q48 12 66 16", "M40 28 Q52 20 66 24"]};
    case "sidepart":
      return {paths: ["M31.500 37 L29.500 27 Q28 10.500 50 8.500 Q72 10.500 70 30 L68.800 38 L67 31 Q62 25 50 24.500 Q40 24 36 28 Q34 31 33 33Z"], lines: ["M42 10.500 Q40 18 41 25"]};
    case "fade":
      return {paths: ["M36 30 L35 14 Q50 8 65 14 L64 30 Q50 25 36 30Z"], lines: ["M36 22 L64 22"]};
    case "pixie":
      return {paths: ["M31.500 37 L29.500 27 Q27 10.500 50 8 Q73 10.500 69.500 34 L67 36 Q64 29 55 27 L48 31 L42 26 L36 30 L34 36Z"]};
    // Short twists on top, faded sides.
    case "jamal":
      return {paths: ["M31.500 37 Q28 9 50 8 Q72 9 68.500 37 Q66 25 50 24.500 Q34 25 31.500 37Z"], opacity: 0.4, extra: ["M34 29 L33 17 Q50 9 67 17 L66 29 Q50 23 34 29Z"], extraCircles: [[38, 14, 3.600], [44, 10, 3.800], [50, 8.500, 3.800], [56, 10, 3.800], [62, 14, 3.600], [41, 19, 3.600], [47, 17, 3.600], [53, 17, 3.600], [59, 19, 3.600]]};
    // Gelled up and forward at the front, short faded sides.
    case "cristiano":
      return {paths: ["M31.500 37 Q28 9 50 8 Q72 9 68.500 37 Q66 25 50 24.500 Q34 25 31.500 37Z"], opacity: 0.45, extra: ["M34.500 30 L33.500 18 Q35 6 48 3.500 Q62 3.500 66.500 15 L65.500 30 Q58 20 50 21 Q42 20 34.500 30Z"], lines: ["M38 17 Q46 8 58 9", "M42 22 Q50 14 62 14"]};
    // A neat side parting, short on the sides, a little volume on top.
    case "messi":
      return {paths: ["M31.500 37 Q28 9 50 8 Q72 9 68.500 37 Q66 25 50 24.500 Q34 25 31.500 37Z"], opacity: 0.5, extra: ["M33 31 L32 19 Q40 8 54 8.500 Q66 9.500 68 20 L67.500 31 Q60 22 48 22 Q38 23 33 31Z"], lines: ["M44 9 Q41 17 43 22", "M50 10 Q58 11 64 16"]};
    // Long hair pulled up into a bun, a lock hanging down each side.
    case "haaland":
      return {paths: [CAP], circles: [[50, 5.500, 6]], lines: ["M42 11 L45 24 M58 11 L55 24"]};
    case "long":
      return {paths: [CAP], lines: ["M50 10 L50 24.500"]};
    case "halfup":
      return {paths: [CAP], circles: [[50, 6, 5]]};
    case "dreads":
      return {paths: [CAP], lines: ["M36 14 L36 30 M43 11 L43 26 M57 11 L57 26 M64 14 L64 30"]};
    case "braids":
      return {paths: [CAP], lines: ["M40 11 L40 26 M50 8 L50 25 M60 11 L60 26"]};
    case "bob":
      return {paths: ["M31.500 37 L29.500 27 Q27.500 10.500 50 8 Q72.500 10.500 70.500 30 L68.800 38 Q64 28 50 27 Q36 28 33 33Z"]};
    case "ponytail":
      return {paths: [CAP]};
    case "bun":
      return {paths: [CAP], circles: [[50, 5, 6.500]]};
    case "topknot":
      return {paths: ["M34 30 L33 17 Q50 9 67 17 L66 30 Q50 25 34 30Z"], circles: [[50, 6, 5]]};
    default:
      // short: the quiff with a tall tuft at the front left, swept right.
      return {paths: ["M31.500 37 L29.500 26 Q28.500 17 31.500 10.500 L33 8.500 L39.800 2.800 L38 12 L43.500 8 Q55 6.500 62 12 Q66.500 14.500 68 18.500 Q70 23 69.500 30 L68.800 38.500 L67 31 Q65 25 58 24 Q50 23.500 42.500 25 Q36.500 26.500 34.500 33Z"]};
  }
}

/** The hair on top. Blond highlights are streaks across the hair, cut off at its edge. */
function HairTop({style, hair, highlights}: {style: string; hair: string; highlights?: boolean}) {
  const uid = useId();
  const shape = hairShape(style);
  if (!shape) return <path d="M43 17 Q50 14.500 57 17" fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={0.900} strokeLinecap="round" />;
  const dark = ["#1c1714", "#3b2618"].includes(hair);
  const streak = dark ? "#6a6567" : shade(hair, -0.3);
  const inner = (
    <>
      {shape.paths.map((d, i) => <path key={i} d={d} />)}
      {(shape.circles ?? []).map(([x, y, r], i) => <circle key={"c" + i} cx={x} cy={y} r={r} />)}
    </>
  );
  return (
    <g>
      <clipPath id={`${uid}-hair`}>{inner}</clipPath>
      <g fill={shape.opacity ? shade(hair, 0.06) : hair} stroke={INK} strokeWidth={0.500} strokeLinejoin="round">{inner}</g>
      {(shape.extra ?? []).map((d, i) => <path key={"x" + i} d={d} fill={hair} stroke={INK} strokeWidth={0.500} strokeLinejoin="round" />)}
      {(shape.extraCircles ?? []).map(([x, y, r], i) => <circle key={"xc" + i} cx={x} cy={y} r={r} fill={hair} stroke={INK} strokeWidth={0.500} />)}
      {/* The grey streak of the quiffs, and the lines that make each style (a parting, ridges). */}
      {["short", "quiff", "spiky", "swept"].includes(style) && <path d="M41.500 11 L47.500 14.500 L45.500 12.500 L53 17 L50 14.500 L57 17.500 L51 12.500Z" fill={streak} opacity={dark ? 0.85 : 0.6} clipPath={`url(#${uid}-hair)`} />}
      <g fill="none" stroke={shade(hair, dark ? 0.3 : -0.4)} strokeWidth={0.600} strokeLinecap="round" clipPath={`url(#${uid}-hair)`}>
        {(shape.lines ?? []).map((d, i) => <path key={i} d={d} />)}
      </g>
      {highlights && (
        <g clipPath={`url(#${uid}-hair)`} fill="none" stroke="#e3c27a" strokeOpacity={0.5} strokeWidth={1} strokeLinecap="round">
          {[30, 36, 42, 48, 54, 60, 66, 72].map((x) => <path key={x} d={`M${x + 5} 0 L${x - 7} 42`} />)}
        </g>
      )}
    </g>
  );
}

/** The mouth: a small smirk for a middling mood, a smile with teeth when happy, a frown when low. */
function Mouth({mood}: {mood: Mood}) {
  if (mood === "elated") {
    // Delighted: white teeth, sitting low as before, not so wide.
    return (
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d="M44.500 61 Q50 62.600 55.500 61 Q50 61.700 44.500 61Z" fill="#000" opacity={0.16} />
        <path d="M42 54.200 Q50 56.900 58.500 54.200 Q57.200 59.200 50 59.500 Q42.800 59.200 42 54.200Z" fill="#fff" stroke={INK} strokeWidth={0.700} />
        <path d="M43.300 56.700 Q50 58.300 57.200 56.700" fill="none" stroke="#d9b8ae" strokeWidth={0.400} />
        <path d="M41.700 53.500 Q40.800 53.100 40.500 52.200 M58.800 53.500 Q59.700 53.100 60 52.200" fill="none" stroke={INK} strokeWidth={0.700} />
      </g>
    );
  }
  if (mood === "happy") {
    // Happy: the same, smaller and narrower.
    return (
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d="M46 59.300 Q50 60.400 54 59.300 Q50 59.900 46 59.300Z" fill="#000" opacity={0.14} />
        <path d="M43.400 54.600 Q50 56.800 56.600 54.600 Q55.500 58.400 50 58.700 Q44.500 58.400 43.400 54.600Z" fill="#fff" stroke={INK} strokeWidth={0.650} />
        <path d="M44.400 56.500 Q50 57.700 55.600 56.500" fill="none" stroke="#d9b8ae" strokeWidth={0.350} />
        <path d="M43.100 54 Q42.400 53.700 42.100 53 M56.900 54 Q57.600 53.700 57.900 53" fill="none" stroke={INK} strokeWidth={0.600} />
      </g>
    );
  }
  if (mood === "sad") return <path d="M42.500 58.500 Q50 54.500 58 58.500" fill="none" stroke="#3a1f14" strokeWidth={0.900} strokeLinecap="round" />;
  if (mood === "upset") return <path d="M42 59.500 Q50 53.500 58.500 59.500" fill="none" stroke="#3a1f14" strokeWidth={1.100} strokeLinecap="round" />;
  return (
    <g fill="none" stroke="#3a1f14" strokeLinecap="round" strokeLinejoin="round">
      <path d="M41.400 54.600 Q50 57.600 59 54.800" strokeWidth={0.800} />
      <path d="M40.900 53.800 Q40.400 54.800 41.100 55.600" strokeWidth={0.500} />
    </g>
  );
}

/** The head, face and hair in the 100x100 box (the neck and shoulders are drawn by the portrait). */
function ToonFace({look, mood}: {look: Look; mood: Mood}) {
  const uid = useId();
  const skin = warm(look.skin);
  const shadow = shade(skin, -0.12);
  const earIn = shade(skin, -0.18);
  const nose = shade(skin, -0.14);
  const browColor = look.hair === "#e3c27a" ? "#8a6a2a" : look.style === "bald" && look.hair === "#9ca3af" ? "#6b7280" : look.hair;
  const iris = look.eyes ?? "#8a5a2b";
  const sad = mood === "sad" || mood === "upset";
  // A brow: thick, arched, higher at the inner end (`side` -1 left, 1 right; the left is drawn, the right mirrors it).
  const brow = (side: -1 | 1) => {
    const x = (v: number) => (side === -1 ? v : 100 - v);
    const shape = BROWS[look.shape ?? "oval"] ?? BROWS.oval;
    const th = shape.thick;
    const tilt = (mood === "upset" ? 1.600 : mood === "sad" ? -1.600 : look.brows * 0.4) + shape.tilt;
    const sh = shape.short ?? 0;
    const ap = shape.apart ?? 0;
    // All brows sit a little higher (clear of the eyes), the outer ends a little more.
    const up = (shape.lift ?? 0) + 1.300;
    const out = 0.900;
    return `M${x(36 + sh)} ${37.400 - tilt - up - out} Q${x(41.500 + sh / 2)} ${33 + tilt - up} ${x(48.700 - ap)} ${36.400 + tilt - up} L${x(48.900 - ap)} ${36.400 + 2.400 * th + tilt - up} Q${x(42 + sh / 2)} ${33.800 + 2.200 * th + tilt - up} ${x(36.400 + sh)} ${37.400 + 2.200 * th - tilt - up - out}Z`;
  };
  const eyes = [41.900, 58.100] as const;
  const ear = EARS[look.shape ?? "oval"] ?? EARS.oval;
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {/* The ears, with the inside darker. */}
      {([29.500, 70.500] as const).map((x) => (
        <g key={x}>
          <g transform={`rotate(${(x < 50 ? -1 : 1) * (ear.tilt ?? 0)} ${x} ${ear.cy})`}>
            <ellipse cx={x} cy={ear.cy} rx={ear.rx} ry={ear.ry} fill={skin} stroke={INK} strokeWidth={0.600} />
            <ellipse cx={x < 50 ? x - 0.200 : x + 0.200} cy={ear.cy + 0.300} rx={ear.rx * 0.500} ry={ear.ry * 0.580} fill={earIn} />
          </g>
        </g>
      ))}
      {/* The head: flat skin, one flat shadow down the right side, a shadow under the hair. */}
      <clipPath id={`${uid}-head`}>
        <path d={headOf(look)} />
      </clipPath>
      <path d={headOf(look)} fill={skin} />
      <g clipPath={`url(#${uid}-head)`}>
        <path d="M65.500 22 L72 22 L72 72 L55 69 Q62 61 64.500 50 Q65.500 36 65.500 22Z" fill={shadow} />
        {look.style !== "bald" && <path d="M30 31 Q50 36 70 31 L70 12 L30 12Z" fill={shadow} />}
        <path d="M30 63 Q50 72 70 63 L70 72 L30 72Z" fill={shadow} opacity={0.6} />
      </g>
      <path d={headOf(look)} fill="none" stroke={INK} strokeWidth={0.600} />
      {/* A faint jaw bone: a soft line from each ear down towards the chin. */}
      <path d="M34 49 Q36.500 60 45 65.500 M66 49 Q63.500 60 55 65.500" fill="none" stroke={shade(skin, -0.22)} strokeWidth={0.600} strokeLinecap="round" opacity={look.shape === "jaw" ? 0.85 : 0.5} />
      {look.shape === "cleft" && <path d="M50 66 L50 68.200" stroke={shade(skin, -0.3)} strokeWidth={0.700} />}
      {look.beard === "stubble" && <path d="M32.500 48 Q35 66 50 69 Q65 66 67.500 48 Q62 58 56 58 Q50 57 44 58 Q38 58 32.500 48Z" fill={look.hair} opacity={0.28} />}
      {look.beard === "beard" && (
        <path d="M31.800 46 Q33 68 50 71 Q67 68 68.200 46 Q64 55 58.500 56.500 Q50 55 41.500 56.500 Q36 55 31.800 46Z" fill={look.hair} stroke={INK} strokeWidth={0.500} />
      )}
      {(look.beard === "moustache" || look.beard === "beard") && <path d="M43 53.500 Q47 51.500 50 53 Q53 51.500 57 53.500 Q53.500 55.500 50 54.500 Q46.500 55.500 43 53.500Z" fill={look.hair} stroke={INK} strokeWidth={0.400} />}
      <HairTop style={look.style} hair={look.hair} highlights={look.highlights} />
      {look.headband && <path d="M31 28 Q50 22 69 28 L69 32.500 Q50 27 31 32.500Z" fill={look.headband} stroke={INK} strokeWidth={0.500} />}
      {/* Brows. */}
      <g fill={browColor} stroke={INK} strokeWidth={0.400}>
        <path d={brow(-1)} />
        <path d={brow(1)} />
      </g>
      {/* Eyes: a white almond, a big iris with a small pupil and a glint, a thick upper lid, a thin lower lid. */}
      {eyes.map((x, i) => {
        const w = 4.600;
        const y = sad ? 41.200 : 40.300;
        const white = `M${x - w} ${y} Q${x} ${y - 6} ${x + w} ${y} Q${x} ${y + 3.800} ${x - w} ${y}Z`;
        return (
          <g key={x}>
            <clipPath id={`${uid}-eye${i}`}>
              <path d={white} />
            </clipPath>
            <path d={white} fill="#fff" />
            <g clipPath={`url(#${uid}-eye${i})`}>
              <circle cx={x + 0.200} cy={y - 0.300} r={3} fill={iris} />
              <circle cx={x + 0.200} cy={y - 0.300} r={1.400} fill={INK} />
              <circle cx={x + 1.100} cy={y - 1.200} r={0.850} fill="#fff" />
            </g>
            <path d={`M${x - w - 0.500} ${y + 0.300} Q${x} ${y - 6.200} ${x + w + 0.500} ${y + 0.300}`} fill="none" stroke={INK} strokeWidth={0.950} />
            <path d={`M${x - w + 0.800} ${y + 1.100} Q${x} ${y + 4.200} ${x + w - 0.800} ${y + 1.100}`} fill="none" stroke={shade(skin, -0.4)} strokeWidth={0.350} />
            {look.lashes && look.beard === "none" && <path d={`M${x + (i === 0 ? -w : w)} ${y} l${i === 0 ? -1.400 : 1.400} -1.600`} fill="none" stroke={INK} strokeWidth={0.600} />}
          </g>
        );
      })}
      {look.glasses && (
        <g fill="none" stroke={INK} strokeWidth={0.800}>
          {eyes.map((x) => <rect key={x} x={x - 6.800} y={34.500} width={13.600} height={10} rx={3.200} fill="#bfe3ff" fillOpacity={0.18} />)}
          <path d="M48.700 38.500 Q50 37.500 51.300 38.500 M35.100 38 L31 37.500 M64.900 38 L69 37.500" />
        </g>
      )}
      {/* The nose: a flat rounded tip, a faint line down the bridge. */}
      <path d="M50.700 43 Q51.600 46 51.200 48" fill="none" stroke={shade(skin, -0.2)} strokeWidth={0.350} />
      <ellipse cx={50.200} cy={49.800} rx={5.200} ry={2.500} fill={nose} />
      <Mouth mood={mood} />
      {/* A small shadow under the lip. */}
      <path d="M47.500 61.400 Q50.500 62.600 53.500 61.400" fill="none" stroke={shade(skin, -0.25)} strokeWidth={0.500} />
    </g>
  );
}

/** A player's portrait in the kit: the head, a short neck, a V-neck shirt with a badge, hands on the hips. */
export function ToonKitAvatar({look, keeper = false, shirt, trim, size = 96, mood = 70}: {look: Look; keeper?: boolean; shirt: string; trim: string; size?: number; mood?: number}) {
  const kit = keeper ? "#16a34a" : shirt;
  const kitTrim = keeper ? "#facc15" : trim;
  const skin = warm(look.skin);
  const shadow = shade(skin, -0.12);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="avatar" aria-hidden>
      <g transform="translate(6 7) scale(0.88)"><HairBack style={look.style} hair={look.hair} /></g>
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* The shoulders with the arms hanging at the sides: a short sleeve with a trim band, a bit of bare arm below. */}
        {[false, true].map((mirror) => (
          <g key={String(mirror)} transform={mirror ? "translate(100 0) scale(-1 1)" : undefined}>
            <path d="M23 91 Q21.500 96 23 100 L29.500 100 L30 92Z" fill={skin} stroke={INK} strokeWidth={0.600} />
            <path d="M30.500 75.500 Q23 77 21 87.500 L30 91.500Z" fill={kit} stroke={INK} strokeWidth={0.600} />
            <path d="M21.300 88.500 L29.700 92.300" stroke={kitTrim} strokeWidth={1.400} strokeLinecap="butt" fill="none" />
          </g>
        ))}
        {/* The shoulders and torso: the same stance as the manager's, in the kit, with a trim band at each sleeve. */}
        <path d="M30 76 Q38 70.500 50 70.500 Q62 70.500 70 76 L72 100 L28 100Z" fill={kit} stroke={INK} strokeWidth={0.700} />
        <path d="M60 71.500 Q66 73 70 76 L72 100 L62 100Z" fill="#000" opacity={0.14} />
        {/* The neck and the V collar. */}
        <path d="M43 62 L43 71 Q50 79 57 71 L57 62Z" fill={skin} />
        <path d="M43 62 L43 70.500 M57 62 L57 70.500" fill="none" stroke={INK} strokeWidth={0.600} />
        <path d="M43 62 L43 66.500 Q50 70.500 57 66.500 L57 62Z" fill={shadow} />
        <path d="M41.500 70.500 L50 77.500 L58.500 70.500Z" fill={skin} />
        <path d="M41.500 70.500 L50 77.500 L58.500 70.500" fill="none" stroke={kitTrim} strokeWidth={1.600} />
        <path d="M57 80 h5 v4 q0 3 -2.500 4 q-2.500 -1 -2.500 -4z" fill={kitTrim} stroke={INK} strokeWidth={0.400} />
      </g>
      <g transform="translate(6 7) scale(0.88)"><ToonFace look={look} mood={moodOf(mood)} /></g>
    </svg>
  );
}

/** The manager in a suit and tie. */
export function ToonManagerAvatar({look, suit, tie, size = 96, mood = 70}: {look: Look; suit: string; tie: string; size?: number; mood?: number}) {
  const skin = warm(look.skin);
  const shadow = shade(skin, -0.12);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="avatar" aria-hidden>
      <g transform="translate(6 7) scale(0.88)"><HairBack style={look.style} hair={look.hair} /></g>
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d="M30 76 Q38 70.500 50 70.500 Q62 70.500 70 76 L72 100 L28 100Z" fill={suit} stroke={INK} strokeWidth={0.700} />
        <path d="M43 62 L43 71 Q50 79 57 71 L57 62Z" fill={skin} />
        <path d="M43 62 L43 70.500 M57 62 L57 70.500" fill="none" stroke={INK} strokeWidth={0.600} />
        <path d="M43 62 L43 66.500 Q50 70.500 57 66.500 L57 62Z" fill={shadow} />
        <path d="M42 71 L50 82 L58 71 L50 74Z" fill="#f8fafc" stroke={INK} strokeWidth={0.500} />
        <path d="M48.500 74 L51.500 74 L52.500 83 L50 87 L47.500 83Z" fill={tie} stroke={INK} strokeWidth={0.500} />
        <path d="M36 73 L43 71.500 L48 87 L42 100 L32 100Z M64 73 L57 71.500 L52 87 L58 100 L68 100Z" fill="#000" opacity={0.2} />
      </g>
      <g transform="translate(6 7) scale(0.88)"><ToonFace look={look} mood={moodOf(mood)} /></g>
    </svg>
  );
}
