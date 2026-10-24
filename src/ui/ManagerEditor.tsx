// Picks how the manager looks: skin, hair, beard, glasses and suit. Styles
// and beards are shown as little faces rather than words.
import type {ManagerLook} from "../game/types";
import {useT} from "../i18n";
import {BEARDS, HAIR, HAIR_STYLES, ManagerAvatar, SKIN, SUITS} from "./Avatar";

function Swatches({colors, value, label, onPick}: {colors: string[]; value: string; label: string; onPick: (c: string) => void}) {
  return (
    <div className="look-row" role="radiogroup" aria-label={label}>
      <span className="look-label">{label}</span>
      <div className="look-options">
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

function Faces<T extends string>({options, value, label, preview, onPick}: {options: readonly T[]; value: string; label: string; preview: (o: T) => ManagerLook; onPick: (o: T) => void}) {
  return (
    <div className="look-row" role="radiogroup" aria-label={label}>
      <span className="look-label">{label}</span>
      <div className="look-options">
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === value} aria-label={o} className={o === value ? "look-face active" : "look-face"} onClick={() => onPick(o)}>
            <ManagerAvatar look={preview(o)} size={40} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ManagerEditor({look, onChange}: {look: ManagerLook; onChange: (look: ManagerLook) => void}) {
  const {t} = useT();
  const set = (patch: Partial<ManagerLook>) => onChange({...look, ...patch});
  const random = () => {
    const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
    const lashes = Math.random() < 0.5;
    onChange({skin: pick(SKIN), hair: pick(HAIR), style: pick(HAIR_STYLES), beard: lashes ? "none" : pick(BEARDS), glasses: Math.random() < 0.3, suit: pick(SUITS), lashes});
  };
  return (
    <div className="manager-editor">
      <div className="manager-preview">
        <ManagerAvatar look={look} size={112} />
        <button type="button" className="btn small" onClick={random}>🎲 {t("look.random")}</button>
      </div>
      <div className="look-controls">
        <Swatches colors={SKIN} value={look.skin} label={t("look.skin")} onPick={(skin) => set({skin})} />
        <Faces options={HAIR_STYLES} value={look.style} label={t("look.hairStyle")} preview={(style) => ({...look, style})} onPick={(style) => set({style})} />
        <Swatches colors={HAIR} value={look.hair} label={t("look.hairColor")} onPick={(hair) => set({hair})} />
        <Faces options={BEARDS} value={look.beard} label={t("look.beard")} preview={(beard) => ({...look, beard})} onPick={(beard) => set({beard})} />
        <Swatches colors={SUITS} value={look.suit} label={t("look.suit")} onPick={(suit) => set({suit})} />
        <div className="btn-row">
          <label className="toggle">
            <input type="checkbox" checked={look.glasses} onChange={(e) => set({glasses: e.target.checked})} /> {t("look.glasses")}
          </label>
          <label className="toggle">
            <input type="checkbox" checked={!!look.lashes} onChange={(e) => set({lashes: e.target.checked})} /> {t("look.lashes")}
          </label>
        </div>
      </div>
    </div>
  );
}
