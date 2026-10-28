// A player's traits: small chips with an icon and a name (the effect when you hold or hover), and
// just the icons (tiny) on the card.
import {useState} from "react";
import type {Trait} from "../game/traits";
import {traitsOf} from "../game/traits";
import type {Player} from "../game/types";
import {useT, type TKey} from "../i18n";
import {Modal} from "./common";
import {Icon, iconize, type IconName} from "./Icon";

export const TRAIT_ICONS: Record<Trait, IconName> = {
  poacher: "target",
  playmaker: "swap",
  cool: "sparkle",
  engine: "run",
  fragile: "medical",
  steady: "shield",
  late: "trend",
};

export function TraitChips({player}: {player: Pick<Player, "id" | "lookId" | "position">}) {
  const {t} = useT();
  const traits = traitsOf(player);
  // The trait whose pill was pressed: its explanation in a small dialog.
  const [open, setOpen] = useState<Trait | null>(null);
  if (traits.length === 0) return null;
  return (
    <div className="trait-chips">
      {traits.map((x) => (
        <button key={x} type="button" className={x === "fragile" ? "trait-chip bad" : "trait-chip"} onClick={() => setOpen(x)}>
          <Icon name={TRAIT_ICONS[x]} size={15} /> {iconize(t(`trait.${x}` as TKey))}
        </button>
      ))}
      {open && (
        <Modal compact title={<><Icon name={TRAIT_ICONS[open]} size={20} /> {iconize(t(`trait.${open}` as TKey))}</>} onClose={() => setOpen(null)}>
          <p>{iconize(t(`trait.${open}.desc` as TKey))}</p>
          <div className="btn-row dialog-actions">
            <button className="btn primary" onClick={() => setOpen(null)}>{iconize(t("common.ok"))}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function TraitMarks({player}: {player: Pick<Player, "id" | "lookId" | "position">}) {
  const {t} = useT();
  const traits = traitsOf(player);
  if (traits.length === 0) return null;
  return (
    <div className="fut-traits" aria-hidden>
      {traits.map((x) => (
        <span key={x} title={t(`trait.${x}` as TKey)}><Icon name={TRAIT_ICONS[x]} size={13} /></span>
      ))}
    </div>
  );
}
