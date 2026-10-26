// Cartoon portraits. A player's look comes from their id, so the same player
// always looks the same; skin and hair lean on nationality and the shirt uses
// the club colours. The manager's look is picked when starting a new game.
// The face follows the mood: a big grin when happy, a frown when unhappy and
// angry brows when they're furious.
import {LEGEND_ID} from "../game/legend";
import {Rng} from "../game/rng";
import type {ManagerLook, Player} from "../game/types";

export const SKIN = ["#f6d5bd", "#ebbd9c", "#d49c74", "#b37a52", "#8a5638", "#5d3923"];
const SKIN_WEIGHTS: Record<string, number[]> = {
  north: [30, 32, 16, 8, 8, 6],
  south: [10, 26, 30, 16, 11, 7],
  BR: [8, 15, 22, 22, 18, 15],
  NG: [0, 0, 4, 14, 36, 46],
};
const REGION: Record<string, keyof typeof SKIN_WEIGHTS> = {
  SE: "north", NO: "north", DK: "north", FI: "north", DE: "north", NL: "north", GB: "north",
  ES: "south", FR: "south", IT: "south", AR: "south", BR: "BR", NG: "NG",
};
export const HAIR = ["#1c1714", "#3b2618", "#6b4226", "#b8863b", "#e3c27a", "#a8471f", "#9ca3af"];
/** Men's styles; the order matters, players' looks are picked from it. */
const MALE_STYLES = ["short", "buzz", "afro", "sidepart", "mohawk", "bald", "long", "spiky", "curly"] as const;
const FEMALE_STYLES = ["long", "ponytail", "bun", "bob", "braids", "curly", "afro", "pixie"] as const;
export const HAIR_STYLES = [...MALE_STYLES, "ponytail", "bun", "bob", "braids", "pixie"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
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
  };
}

/** The look a player comes with: from their id, nationality, age and gender. */
function bornLook(p: Player): Look {
  return {...bornFace(p), eyes: bornEyes(p)};
}

/** Eye colour from its own seed (so the rest of everyone's look stays as it was): light eyes mostly up north. */
function bornEyes(p: Player): string {
  if (FIXED_LOOKS[p.id]) return FIXED_LOOKS[p.id].eyes ?? EYES[0];
  const rng = new Rng(seedOf(p.id + ":eyes"));
  const north = REGION[p.nationality] === "north";
  return rng.weighted(EYES, (e) => (e === EYES[0] ? (north ? 3 : 8) : e === EYES[1] ? 2 : north ? 2 : 0.3));
}

function bornFace(p: Player): Look {
  const fixed = FIXED_LOOKS[p.id];
  if (fixed) return fixed;
  const rng = new Rng(seedOf(p.id));
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
  if (look.style === "bob") return <path d="M26 40 Q25 15 50 14 Q75 15 74 40 L76 63 Q70 67 64 63 L36 63 Q30 67 24 63Z" fill={look.hair} />;
  if (look.style === "braids") {
    return (
      <g fill={look.hair}>
        {[50, 56, 62, 68, 74].map((y) => (
          <g key={y}>
            <ellipse cx={28} cy={y} rx={4} ry={3.6} />
            <ellipse cx={72} cy={y} rx={4} ry={3.6} />
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

function BeardShape({look}: {look: Look}) {
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

export type MoodFace = "elated" | "happy" | "content" | "sad" | "upset";

/** Happiness 0..100 as a face. */
export function moodFace(mood: number): MoodFace {
  return mood >= 75 ? "elated" : mood >= 55 ? "happy" : mood >= 40 ? "content" : mood >= 22 ? "sad" : "upset";
}

function Mouth({face}: {face: MoodFace}) {
  const lip = "#7a2e2e";
  switch (face) {
    case "elated":
      return (
        <g>
          <path d="M41 57.5 Q50 70 59 57.5 Z" fill={lip} />
          <path d="M42.6 58.2 L57.4 58.2 Q56.6 60.6 55 61 L45 61 Q43.4 60.6 42.6 58.2Z" fill="#fff" />
        </g>
      );
    case "happy":
      return <path d="M43 59 Q50 65.5 57 59" fill="none" stroke={lip} strokeWidth={2} strokeLinecap="round" />;
    case "content":
      return <path d="M44 60.5 Q50 62 56 60.5" fill="none" stroke={lip} strokeWidth={2} strokeLinecap="round" />;
    case "sad":
      return <path d="M43.5 63 Q50 57.5 56.5 63" fill="none" stroke={lip} strokeWidth={2} strokeLinecap="round" />;
    case "upset":
      return <path d="M42 64.5 Q50 55.5 58 64.5" fill="none" stroke={lip} strokeWidth={2.4} strokeLinecap="round" />;
  }
}

/** The head and face in a 100x100 box, centred at (50, 45). For use inside any SVG. */
export function Face({look, mood = 60}: {look: Look; mood?: number}) {
  const face = moodFace(mood);
  // Worried brows lift in the middle; furious ones drop.
  const browTilt = face === "sad" ? 2.2 : face === "upset" ? -2.6 : face === "elated" ? -0.5 + look.brows * 0.3 : look.brows;
  const browLift = face === "elated" ? -1.2 : 0;
  const gap = look.eyeGap;
  const browColor = look.hair === "#e3c27a" ? "#8a6a2a" : look.style === "bald" && look.hair === "#9ca3af" ? "#6b7280" : look.hair;
  const droopy = face === "sad" || face === "upset";
  const squint = face === "elated";
  return (
    <g>
      <HairBack look={look} />
      <circle cx={29} cy={47} r={4.5} fill={look.skin} />
      <circle cx={71} cy={47} r={4.5} fill={look.skin} />
      <ellipse cx={50} cy={45} rx={21} ry={24} fill={look.skin} />
      <BeardShape look={look} />
      <HairFront look={look} />
      <g stroke={browColor} strokeWidth={look.lashes ? 1.5 : 2} strokeLinecap="round">
        <line x1={50 - gap - 4} y1={39 + browTilt + browLift} x2={50 - gap + 3} y2={38 - browTilt + browLift} />
        <line x1={50 + gap - 3} y1={38 - browTilt + browLift} x2={50 + gap + 4} y2={39 + browTilt + browLift} />
      </g>
      {squint ? (
        <g stroke="#1f2937" strokeWidth={2} fill="none" strokeLinecap="round">
          <path d={`M${50 - gap - 3} 46 Q${50 - gap} 42.5 ${50 - gap + 3} 46`} />
          <path d={`M${50 + gap - 3} 46 Q${50 + gap} 42.5 ${50 + gap + 3} 46`} />
        </g>
      ) : (
        <>
          <ellipse cx={50 - gap} cy={45} rx={3.4} ry={3.8} fill="#fff" />
          <ellipse cx={50 + gap} cy={45} rx={3.4} ry={3.8} fill="#fff" />
          {[50 - gap + 0.6, 50 + gap + 0.6].map((x) => (
            // Coloured iris, dark pupil, a glint.
            <g key={x}>
              <circle cx={x} cy={droopy ? 46.4 : 45.6} r={2.2} fill={look.eyes ?? EYES[0]} />
              <circle cx={x} cy={droopy ? 46.4 : 45.6} r={1.1} fill="#111827" />
              <circle cx={x + 0.7} cy={droopy ? 45.6 : 44.8} r={0.55} fill="#fff" />
            </g>
          ))}
          {droopy && (
            // Heavy eyelids.
            <g fill={look.skin}>
              <rect x={50 - gap - 3.6} y={40.8} width={7.2} height={3.4} />
              <rect x={50 + gap - 3.6} y={40.8} width={7.2} height={3.4} />
            </g>
          )}
        </>
      )}
      {look.lashes && !squint && (
        <g stroke="#1f2937" strokeWidth={1.1} strokeLinecap="round">
          <path d={`M${50 - gap - 3.4} 43.4 l-1.6 -1.4 M${50 - gap - 2.2} 41.9 l-1 -1.7`} />
          <path d={`M${50 + gap + 3.4} 43.4 l1.6 -1.4 M${50 + gap + 2.2} 41.9 l1 -1.7`} />
        </g>
      )}
      {look.glasses && (
        <g fill="rgb(255 255 255 / 0.12)" stroke="#111827" strokeWidth={1.4}>
          <circle cx={50 - gap} cy={45} r={5.4} />
          <circle cx={50 + gap} cy={45} r={5.4} />
          <line x1={50 - gap + 5.4} y1={44.5} x2={50 + gap - 5.4} y2={44.5} />
        </g>
      )}
      <path d="M50 48 Q47 53 50 54" fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={1.4} strokeLinecap="round" />
      <Mouth face={face} />
      <circle cx={38} cy={53} r={3} fill="#f87171" opacity={face === "elated" ? 0.35 : 0.18} />
      <circle cx={62} cy={53} r={3} fill="#f87171" opacity={face === "elated" ? 0.35 : 0.18} />
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
      <rect x={43} y={64} width={14} height={14} rx={4} fill={look.skin} />
      <Face look={look} mood={mood} />
    </svg>
  );
}

/** A player's look in the editor's shape (it edits the manager's look, which has a suit too). */
export function editableLook(p: Player): ManagerLook {
  const l = lookFor(p);
  return {skin: l.skin, hair: l.hair, style: l.style, beard: l.beard, eyes: l.eyes, glasses: !!l.glasses, lashes: !!l.lashes, suit: "#1f2937"};
}

/** The editor's look back into a full look (with the face's fixed details from the player). */
export function lookFromEditor(p: Player, m: ManagerLook): Look {
  return {...lookFor({...p, look: {skin: m.skin, hair: m.hair, style: m.style, beard: m.beard, eyes: m.eyes, glasses: m.glasses, lashes: m.lashes}})};
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
      <Face look={face} mood={mood} />
    </svg>
  );
}
