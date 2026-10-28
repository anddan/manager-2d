// A player's individual focus: an attribute to work extra on, or rest. A button with the
// choice's icon; tapping it opens the choices, each with its own icon.
import {useState} from "react";
import {ATTRIBUTES, type Attribute, type Player} from "../game/types";
import {useT} from "../i18n";
import {useGame} from "../store";
import {Modal} from "./common";
import {Icon, iconize, type IconName} from "./Icon";

type Focus = Player["individualFocus"];

export const FOCUS_ICONS: Record<Attribute | "rest", IconName> = {
  pace: "run",
  finishing: "target",
  passing: "plane",
  technique: "sparkle",
  defending: "shield",
  physical: "hammer",
  stamina: "bolt",
  vision: "eye",
  goalkeeping: "glove",
  rest: "moon",
};

export function FocusPicker({player: p, compact}: {player: Player; compact?: boolean}) {
  const {t} = useT();
  const act = useGame((s) => s.act);
  const [open, setOpen] = useState(false);
  const label = (f: Focus) => (f === "rest" ? t("train.rest") : f ? t(`attr.${f}`) : t("common.none"));
  const set = (f: Focus) => {
    act((g) => {
      g.players[p.id].individualFocus = f;
    });
    setOpen(false);
  };
  const choices: Focus[] = [null, "rest", ...ATTRIBUTES];
  return (
    <>
      <button type="button" className={compact ? "focus-btn compact" : "focus-btn"} title={t("pl.individualFocus")} onClick={() => setOpen(true)}>
        <Icon name={p.individualFocus ? FOCUS_ICONS[p.individualFocus] : "close"} size={16} />
        <span>{iconize(label(p.individualFocus))}</span>
      </button>
      {open && (
        <Modal compact title={iconize(t("pl.individualFocus"))} onClose={() => setOpen(false)}>
          <div className="focus-choices">
            {choices.map((f) => (
              <button key={f ?? "none"} type="button" className={f === p.individualFocus ? "focus-choice on" : "focus-choice"} onClick={() => set(f)}>
                <Icon name={f ? FOCUS_ICONS[f] : "close"} size={20} />
                <span>{iconize(label(f))}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
