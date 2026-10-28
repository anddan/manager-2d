// Tips from the coach: on easy, now and then (every other week, once the guide is done) the
// assistant has a word of advice. "OK" puts it away, "No more tips" turns them all off.
import {useLayoutEffect, useState, type ReactNode} from "react";
import {TUTORIAL_STEPS} from "../game/tutorial";
import {difficulty} from "../game/helpers";
import {useT, type TKey} from "../i18n";
import {useGame} from "../store";
import {Icon, iconize} from "./Icon";

export const COACH_TIPS = 18;

export function CoachTips() {
  const {t} = useT();
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  if (!game) return null;
  const tips = game.coachTips ?? {};
  const guideDone = !game.tutorial || game.tutorial.step >= TUTORIAL_STEPS.length;
  const due = difficulty(game) === "easy" && !tips.off && guideDone && !game.liveMatch && game.absWeek > 1 && game.absWeek % 2 === 0 && tips.lastWeek !== game.absWeek;
  if (!due) return null;
  const n = (tips.next ?? 0) % COACH_TIPS;
  const done = (off: boolean) =>
    act((g) => {
      const now = g.coachTips ?? {};
      g.coachTips = {...now, lastWeek: g.absWeek, next: ((now.next ?? 0) + 1) % COACH_TIPS, ...(off ? {off: true} : {})};
    });
  return <TipBubble text={iconize(t(`tips.${n}` as TKey))} onOk={() => done(false)} onOff={() => done(true)} okLabel={iconize(t("tips.ok"))} offLabel={iconize(t("tips.off"))} />;
}

/** A speech bubble from the manager in the top bar, its tail pointing at him; he bobs while it's up. */
function TipBubble({text, onOk, onOff, okLabel, offLabel}: {text: ReactNode; onOk: () => void; onOff: () => void; okLabel: ReactNode; offLabel: ReactNode}) {
  const [at, setAt] = useState<{top: number; tail: number} | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const m = document.querySelector<HTMLElement>(".topbar-manager");
      if (!m) return;
      const r = m.getBoundingClientRect();
      setAt({top: r.bottom + 12, tail: window.innerWidth - (r.left + r.width / 2)});
      m.classList.add("talking");
    };
    place();
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      document.querySelector(".topbar-manager")?.classList.remove("talking");
    };
  }, []);
  if (!at) return null;
  return (
    <div className="coach-tip" role="status" style={{top: at.top, ["--tail" as string]: `${at.tail}px`}}>
      <p>{text}</p>
      <div className="tour-actions">
        <button className="btn small" onClick={onOff}><Icon name="close" size={14} /> {offLabel}</button>
        <button className="btn primary small" onClick={onOk}>{okLabel}</button>
      </div>
    </div>
  );
}
