// Small building blocks shared by the screens.
import {useEffect, type ReactNode} from "react";
import {flag} from "../game/names";
import {overall} from "../game/ratings";
import {estimatedOverall, isKnown} from "../game/transfers";
import type {GameState, Player, Position} from "../game/types";
import {useT} from "../i18n";
import {useGame} from "../store";

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

export function Modal({title, onClose, children, wide}: {title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean}) {
  const {t} = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
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

export function Flag({code}: {code: string}) {
  return <span className="flag" title={code}>{flag(code)}</span>;
}

/** Overall as a number, or a range for players the user hasn't scouted. */
export function Ovr({game, player}: {game: GameState; player: Player}) {
  if (isKnown(game, player)) return <span className="ovr">{overall(player)}</span>;
  const {low, high} = estimatedOverall(game, player);
  return <span className="ovr ovr-est">{low}–{high}</span>;
}

export function Pot({game, player}: {game: GameState; player: Player}) {
  return <span className="pot">{isKnown(game, player) ? player.potential : "?"}</span>;
}

export function PlayerLink({player}: {player: Player}) {
  const openPlayer = useGame((s) => s.openPlayer);
  return (
    <button className="link" onClick={() => openPlayer(player.id)}>
      {player.firstName.charAt(0)}. {player.lastName}
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
