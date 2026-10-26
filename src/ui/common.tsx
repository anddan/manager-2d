// Small building blocks shared by the screens.
import {GearPicture} from "./Gear";
import {wornGear} from "../game/gear";
import {useEffect, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {listName} from "../game/helpers";
import {overall} from "../game/ratings";
import {estimatedOverall, isKnown} from "../game/transfers";
import type {GameState, Player, Position} from "../game/types";
import {useT} from "../i18n";
import {useGame} from "../store";
import {FlagIcon} from "./Flag";

export function Card({title, actions, children, className = ""}: {title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * A dialog. `backdropCloses` false keeps a click beside it from closing it (✕ and Escape still do).
 * `compact`: a short question, kept small in the middle of a phone instead of filling the screen.
 */
export function Modal({title, onClose, children, wide, compact, backdropCloses = true}: {title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; compact?: boolean; backdropCloses?: boolean}) {
  const {t} = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const dialog = (
    <div className={compact ? "modal-backdrop compact" : "modal-backdrop"} onClick={backdropCloses ? onClose : undefined}>
      <div className={`modal ${wide ? "modal-wide" : ""} ${compact ? "modal-compact" : ""}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
  // On the page's top layer, whatever opened it (a dialog opened from the top bar would otherwise
  // sit under the phone's bottom menu). Drawn in place where there's no page (rendering on the server).
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}

/** A 0..100 meter; colours go red -> amber -> green. */
export function Bar({value, label, small}: {value: number; label?: string; small?: boolean}) {
  const tone = value < 35 ? "bad" : value < 60 ? "mid" : "good";
  return (
    <div className={`bar ${small ? "bar-small" : ""}`} title={label ? `${label}: ${Math.round(value)}` : String(Math.round(value))}>
      <div className={`bar-fill ${tone}`} style={{width: `${Math.max(2, Math.min(100, value))}%`}} />
    </div>
  );
}

export function Face({value}: {value: number}) {
  const face = value >= 75 ? "😄" : value >= 55 ? "🙂" : value >= 35 ? "😐" : value >= 20 ? "😟" : "😠";
  return <span className="face" title={String(Math.round(value))}>{face}</span>;
}

export function PosBadge({pos}: {pos: Position}) {
  const {t} = useT();
  return <span className={`pos pos-${pos}`}>{t(`pos.${pos}`)}</span>;
}

/** Flag with the country's name as tooltip; `named` also writes the name out. */
export function Flag({code, named, size}: {code: string; named?: boolean; size?: number}) {
  const {tx} = useT();
  const name = tx(`nat.${code}`);
  if (!named) return <FlagIcon code={code} title={name} size={size} />;
  return (
    <span className="nation">
      <FlagIcon code={code} title={name} size={size} /> {name}
    </span>
  );
}

/** Overall as a number; for players the user hasn't scouted, an estimate (shown fainter). */
export function Ovr({game, player}: {game: GameState; player: Player}) {
  const {t} = useT();
  if (isKnown(game, player)) return <span className="ovr">{overall(player)}</span>;
  return <span className="ovr ovr-est" title={t("pl.estimated")}>{estimatedOvr(game, player)}</span>;
}

/** The middle of the scouting estimate. */
export function estimatedOvr(game: GameState, player: Player): number {
  const {low, high} = estimatedOverall(game, player);
  return Math.round((low + high) / 2);
}

export function PlayerLink({player}: {player: Player}) {
  const openPlayer = useGame((s) => s.openPlayer);
  return (
    <button className="link" onClick={() => openPlayer(player.id)}>
      {listName(player)}
    </button>
  );
}

export function StatusIcons({player}: {player: Player}) {
  const {t} = useT();
  return (
    <span className="status-icons">
      {player.injuryWeeks > 0 && <span title={t("status.injured", {weeks: player.injuryWeeks})}>🩹</span>}
      {player.suspension > 0 && <span title={t("status.suspended")}>🟥</span>}
      {player.transferListed && <span title={t("status.listed")}>🏷️</span>}
      {player.loanListed && <span title={t("status.loanListed")}>🔁</span>}
      {player.wantsToLeave && <span title={t("status.wantsOut")}>✈️</span>}
      {player.loan && <span title={t("status.onLoan")}>📎</span>}
      {/* The boot (or glove) itself, small: its colour says the kind, its trim the tier. */}
      {wornGear(player).map(({slot, item}) => (
        <span key={slot} className="gear-mini" title={`${t(`gear.kind.${item.kind}`)} · ${t(`gear.tier.${item.tier}`)}`}>
          <GearPicture item={item} size={item.kind === "gloves" ? 16 : item.kind === "shin" ? 12 : 24} />
        </span>
      ))}
    </span>
  );
}

/** "+0.4" in green or "-0.2" in red, nothing for tiny changes. */
export function Delta({value, digits = 1}: {value: number | undefined; digits?: number}) {
  const {num} = useT();
  if (value === undefined || Math.abs(value) < 0.05) return null;
  return <span className={value > 0 ? "delta up" : "delta down"}>{value > 0 ? "▲" : "▼"}{num(Math.abs(value), digits)}</span>;
}

export function Tabs<T extends string>({value, options, onChange}: {value: T; options: {id: T; label: ReactNode}[]; onChange: (v: T) => void}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={o.id === value} className={o.id === value ? "tab active" : "tab"} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({children}: {children: ReactNode}) {
  return <p className="empty">{children}</p>;
}

/**
 * Sorting a table by a column. Clicking the column sorted by flips it;
 * another column starts high-to-low for numbers (`descFirst`) and A–Z otherwise.
 */
export function useSort<K extends string>(initial: K, initialDesc = false) {
  const [key, setKey] = useState<K>(initial);
  const [desc, setDesc] = useState(initialDesc);
  const onSort = (k: K, descFirst: boolean) => {
    if (k === key) setDesc(!desc);
    else {
      setKey(k);
      setDesc(descFirst);
    }
  };
  return {key, desc, onSort};
}

/** Rows sorted by a value; ties keep their order. */
export function sortRows<T>(rows: T[], value: (row: T) => number | string, desc: boolean): T[] {
  return rows
    .map((row, i) => ({row, i, v: value(row)}))
    .sort((a, b) => {
      const cmp = typeof a.v === "string" ? a.v.localeCompare(String(b.v)) : a.v - Number(b.v);
      return (desc ? -cmp : cmp) || a.i - b.i;
    })
    .map((x) => x.row);
}

/** A header cell that sorts by its column, with ▲ / ▼ on the one in use. */
export function SortTh({label, active, desc, onClick, title}: {label: ReactNode; active: boolean; desc: boolean; onClick: () => void; title?: string}) {
  return (
    <th title={title}>
      <button className="th-btn" onClick={onClick}>
        {label}{active ? (desc ? " ▼" : " ▲") : ""}
      </button>
    </th>
  );
}

/**
 * A number input that can be cleared while typing (a plain controlled
 * number input snaps back to 0 and you can't type over it). Empty counts as 0.
 */
export function NumberInput({value, onChange, min = 0, max, step, placeholder, ariaLabel}: {value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; placeholder?: string; ariaLabel?: string}) {
  const [text, setText] = useState(String(value));
  // Follow changes from outside (a counter-offer, a reset), but not while the text already says it.
  useEffect(() => {
    if ((text === "" ? 0 : Number(text)) !== value) setText(String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = e.target.value === "" ? 0 : Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.max(min, max !== undefined ? Math.min(max, n) : n));
      }}
      onBlur={() => text === "" && setText(String(value))}
    />
  );
}

/** Form in five steps, from top form down. Thresholds on the 0–100 form value. */
const FORM_STEPS = [
  {min: 70, angle: -90, color: "#16a34a"},
  {min: 57, angle: -45, color: "#84cc16"},
  {min: 43, angle: 0, color: "#eab308"},
  {min: 30, angle: 45, color: "#f97316"},
  {min: -Infinity, angle: 90, color: "#ef4444"},
];

/**
 * A player's form as an arrow, so it can't be mistaken for fitness (a bar):
 * up green, up-right light green, right yellow, down-right orange, down red.
 */
export function FormArrow({form, size = 16}: {form: number; size?: number}) {
  const {tx} = useT();
  const step = FORM_STEPS.findIndex((s) => form >= s.min);
  const {angle, color} = FORM_STEPS[step];
  const label = tx(`formLevel.${step}`);
  return (
    <svg className="form-arrow" width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={label}>
      <title>{label}</title>
      <circle cx={8} cy={8} r={7.5} fill={color} />
      <path d="M4 8h7M8 4.5 11.5 8 8 11.5" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" transform={`rotate(${angle} 8 8)`} />
    </svg>
  );
}
