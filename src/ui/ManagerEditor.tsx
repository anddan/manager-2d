// Picks how the manager looks: skin, hair, eyes, beard, glasses and suit. Styles
// and beards are shown as little faces rather than words.
import {Icon, iconize} from "./Icon";
import type {ReactNode} from "react";
import type {ManagerLook} from "../game/types";
import {useT, type TKey} from "../i18n";
import {BEARDS, EYES, FACE_SHAPES, HAIR, HAIR_STYLES, HEADBANDS, ManagerAvatar, SKIN, SUITS} from "./Avatar";

/** How a look is drawn in the editor: the manager in a suit by default, or e.g. a player in the kit. */
type Draw = (look: ManagerLook, size: number) => ReactNode;
const inSuit: Draw = (look, size) => <ManagerAvatar look={look} size={size} />;

function Swatches({colors, value, label, onPick, none}: {colors: string[]; value: string; label: string; onPick: (c: string) => void; none?: string}) {
  return (
    <div className="look-row" role="radiogroup" aria-label={label}>
      <span className="look-label">{label}</span>
      <div className="look-options">
        {none !== undefined && (
          <button type="button" role="radio" aria-checked={value === ""} aria-label={none} title={none} className={value === "" ? "swatch none active" : "swatch none"} onClick={() => onPick("")}>
            <Icon name="close" size={14} />
          </button>
        )}
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === value}
            aria-label={c}
            className={c === value ? "swatch active" : "swatch"}
            style={{background: c}}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
    </div>
  );
}

function Faces<T extends string>({options, value, label, preview, onPick, draw, name}: {options: readonly T[]; value: string; label: string; preview: (o: T) => ManagerLook; onPick: (o: T) => void; draw: Draw; name?: (o: T) => string}) {
  return (
    <div className="look-row" role="radiogroup" aria-label={label}>
      <span className="look-label">{label}</span>
      <div className="look-options">
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === value} aria-label={name ? name(o) : o} title={name ? name(o) : undefined} className={o === value ? "look-face active" : "look-face"} onClick={() => onPick(o)}>
            {draw(preview(o), 40)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** `draw` and `noSuit`: for a player (drawn in the kit, no suit to pick). */
export function ManagerEditor({look, onChange, draw = inSuit, noSuit = false}: {look: ManagerLook; onChange: (look: ManagerLook) => void; draw?: Draw; noSuit?: boolean}) {
  const {t} = useT();
  const set = (patch: Partial<ManagerLook>) => onChange({...look, ...patch});
  const random = () => {
    const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
    const lashes = Math.random() < 0.5;
    onChange({skin: pick(SKIN), hair: pick(HAIR), style: pick(HAIR_STYLES), beard: lashes ? "none" : pick(BEARDS), eyes: pick(EYES), glasses: Math.random() < 0.3, suit: pick(SUITS), lashes});
  };
  return (
    <div className="manager-editor">
      <div className="manager-preview">
        {draw(look, 112)}
        <button type="button" className="btn small" onClick={random}><Icon name="dice" size={18} /> {iconize(t("look.random"))}</button>
      </div>
      <div className="look-controls">
        <Swatches colors={SKIN} value={look.skin} label={t("look.skin")} onPick={(skin) => set({skin})} />
        <Faces options={HAIR_STYLES} value={look.style} label={t("look.hairStyle")} preview={(style) => ({...look, style})} onPick={(style) => set({style})} draw={draw} name={(o) => t(`hair.${o}` as TKey)} />
        <Swatches colors={HEADBANDS} value={look.headband ?? ""} label={t("look.headband")} none={t("look.none")} onPick={(c) => set({headband: c || undefined})} />
        <Faces options={FACE_SHAPES} value={look.shape ?? "oval"} label={t("look.shape")} preview={(shape) => ({...look, shape})} onPick={(shape) => set({shape})} draw={draw} name={(o) => t(`shape.${o}` as TKey)} />
        <Swatches colors={HAIR} value={look.hair} label={t("look.hairColor")} onPick={(hair) => set({hair})} />
        <Swatches colors={EYES} value={look.eyes ?? EYES[0]} label={t("look.eyes")} onPick={(eyes) => set({eyes})} />
        <Faces options={BEARDS} value={look.beard} label={t("look.beard")} preview={(beard) => ({...look, beard})} onPick={(beard) => set({beard})} draw={draw} name={(o) => t(`beard.${o}` as TKey)} />
        {!noSuit && <Swatches colors={SUITS} value={look.suit} label={t("look.suit")} onPick={(suit) => set({suit})} />}
        <div className="btn-row">
          <label className="toggle">
            <input type="checkbox" checked={look.glasses} onChange={(e) => set({glasses: e.target.checked})} /> {iconize(t("look.glasses"))}
          </label>
          <label className="toggle">
            <input type="checkbox" checked={!!look.lashes} onChange={(e) => set({lashes: e.target.checked})} /> {iconize(t("look.lashes"))}
          </label>
          <label className="toggle">
            <input type="checkbox" checked={!!look.highlights} onChange={(e) => set({highlights: e.target.checked})} /> {iconize(t("look.highlights"))}
          </label>
        </div>
      </div>
    </div>
  );
}
