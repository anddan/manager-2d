// Picks how the manager looks: skin, hair, eyes, beard, glasses and suit. Styles
// and beards are shown as little faces rather than words.
import {Icon, iconize} from "./Icon";
import type {ReactNode} from "react";
import type {ManagerLook} from "../game/types";
import {useT, type TKey} from "../i18n";
import {faceParts} from "./ToonAvatar";
import {BEARDS, EYES, HAIR, HAIR_STYLES, HEADBANDS, ManagerAvatar, SKIN, SUITS} from "./Avatar";

/** How a look is drawn in the editor: the manager in a suit by default, or e.g. a player in the kit. */
type Draw = (look: ManagerLook, size: number) => ReactNode;
const inSuit: Draw = (look, size) => <ManagerAvatar look={look} size={size} />;

/**
 * A row for one part of the look: `‹` the previous, `›` the next (round and round). The picture of the choice is the
 * big one at the top, so only a colour has its dot beside the buttons.
 */
export function Stepper({label, onStep, children}: {label: string; onStep: (by: -1 | 1) => void; children?: ReactNode}) {
  const {t} = useT();
  return (
    <div className="look-row" role="group" aria-label={label}>
      <span className="look-label">{label}</span>
      <div className="look-stepper">
        <button type="button" className="step-btn" aria-label={t("look.previous")} onClick={() => onStep(-1)}>‹</button>
        {children && <span className="step-now">{children}</span>}
        <button type="button" className="step-btn" aria-label={t("look.next")} onClick={() => onStep(1)}>›</button>
      </div>
    </div>
  );
}

export const stepTo = (n: number, index: number, by: -1 | 1) => (((index < 0 ? (by > 0 ? -1 : 0) : index) + by + n) % n);

function Swatches({colors, value, label, onPick, none}: {colors: string[]; value: string; label: string; onPick: (c: string) => void; none?: string}) {
  const all = none !== undefined ? ["", ...colors] : colors;
  const index = all.indexOf(value);
  return (
    <Stepper label={label} onStep={(by) => onPick(all[stepTo(all.length, index, by)])}>
      {value === "" ? <span className="swatch none active" title={none}><Icon name="close" size={14} /></span> : <span className="swatch active" style={{background: value}} />}
    </Stepper>
  );
}

function Faces<T extends string>({options, value, label, onPick}: {options: readonly T[]; value: string; label: string; onPick: (o: T) => void; preview?: (o: T) => ManagerLook; draw?: Draw; name?: (o: T) => string}) {
  const index = options.indexOf(value as T);
  return <Stepper label={label} onStep={(by) => onPick(options[stepTo(options.length, index, by)])} />;
}

/** The hairstyles in one run: the short ones, then the long and curly, the most alike next to each other. */
const HAIR_SHORT = ["buzz", "fade", "bald", "short", "spiky", "quiff", "cristiano", "swept", "sidepart", "messi", "pixie", "jamal", "mohawk", "topknot"];
const HAIR_LONG = ["long", "halfup", "haaland", "bob", "ponytail", "bun", "braids", "dreads", "curly", "coils", "afro"];
/** The heads, the ears and the brows: every one can be combined with every other. */
const HEADS_ = ["oval", "wide", "dimple", "wideDimple"] as const;
const EARS_ = ["normal", "small", "tilted", "long", "big"] as const;
const BROWS_ = ["normal", "thin", "thick", "soft", "angled", "thinAngled", "high"] as const;

/** `draw` and `noSuit`: for a player (drawn in the kit, no suit to pick). */
/** The head as one of the four heads (an older face shape is the head it had). */
function headValue(look: ManagerLook): string {
  if (look.shape === "narrow" || look.shape === "square") return look.shape;
  const p = faceParts(look);
  return p.wide ? (p.dimple ? "wideDimple" : "wide") : p.dimple ? "dimple" : "oval";
}

export function ManagerEditor({look, onChange, draw = inSuit, noSuit = false}: {look: ManagerLook; onChange: (look: ManagerLook) => void; draw?: Draw; noSuit?: boolean}) {
  const {t} = useT();
  const set = (patch: Partial<ManagerLook>) => onChange({...look, ...patch});
  const parts = faceParts(look);
  const random = () => {
    const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
    const lashes = Math.random() < 0.5;
    onChange({skin: pick(SKIN), hair: pick(HAIR), style: pick(HAIR_STYLES), beard: lashes ? "none" : pick(BEARDS), eyes: pick(EYES), glasses: Math.random() < 0.3, suit: pick(SUITS), lashes});
  };
  return (
    <div className="manager-editor">
      <div className="manager-preview">
        {draw(look, 150)}
        <button type="button" className="btn small" onClick={random}><Icon name="dice" size={18} /> {iconize(t("look.random"))}</button>
      </div>
      <div className="look-controls">
        <Swatches colors={SKIN} value={look.skin} label={t("look.skin")} onPick={(skin) => set({skin})} />
        <Faces options={[...HAIR_SHORT, ...HAIR_LONG].filter((h) => (HAIR_STYLES as readonly string[]).includes(h)) as (typeof HAIR_STYLES)[number][]} value={look.style} label={t("look.hairStyle")} preview={(style) => ({...look, style})} onPick={(style) => set({style})} draw={draw} name={(o) => t(`hair.${o}` as TKey)} />
        <Swatches colors={HEADBANDS} value={look.headband ?? ""} label={t("look.headband")} none={t("look.none")} onPick={(c) => set({headband: c || undefined})} />
        {/* The head: stepping it keeps the ears and the brows as they are (older looks have them from their old face shape). */}
        <Faces options={HEADS_} value={headValue(look)} label={t("look.shape")} onPick={(shape) => set({shape, ears: parts.ears, browStyle: parts.brows})} />
        <Faces options={EARS_} value={parts.ears} label={t("look.ears")} onPick={(ears) => set({ears, shape: headValue(look), browStyle: parts.brows})} />
        <Faces options={BROWS_} value={parts.brows} label={t("look.browStyle")} onPick={(browStyle) => set({browStyle, shape: headValue(look), ears: parts.ears})} />
        <Swatches colors={HAIR} value={look.hair} label={t("look.hairColor")} onPick={(hair) => set({hair})} />
        <Swatches colors={EYES} value={look.eyes ?? EYES[0]} label={t("look.eyes")} onPick={(eyes) => set({eyes})} />
        <Faces options={BEARDS} value={look.beard} label={t("look.beard")} preview={(beard) => ({...look, beard})} onPick={(beard) => set(beard !== "none" ? {beard, lashes: false} : {beard})} draw={draw} name={(o) => t(`beard.${o}` as TKey)} />
        {!noSuit && <Swatches colors={SUITS} value={look.suit} label={t("look.suit")} onPick={(suit) => set({suit})} />}
        <div className="btn-row">
          <label className="toggle">
            <input type="checkbox" checked={look.glasses} onChange={(e) => set({glasses: e.target.checked})} /> {iconize(t("look.glasses"))}
          </label>
          <label className="toggle">
            <input type="checkbox" checked={!!look.lashes} onChange={(e) => set(e.target.checked ? {lashes: true, beard: "none"} : {lashes: false})} /> {iconize(t("look.lashes"))}
          </label>
          <label className="toggle">
            <input type="checkbox" checked={!!look.highlights} onChange={(e) => set({highlights: e.target.checked})} /> {iconize(t("look.highlights"))}
          </label>
        </div>
      </div>
    </div>
  );
}
