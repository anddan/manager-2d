// Tips from the coach: on easy, now and then (every other week, once the guide is done) the
// assistant has a word of advice. "OK" puts it away, "No more tips" turns them all off.
import {TUTORIAL_STEPS} from "../game/tutorial";
import {difficulty} from "../game/helpers";
import {useT, type TKey} from "../i18n";
import {useGame} from "../store";
import {ManagerAvatar, defaultManagerLook} from "./Avatar";
import {Icon, iconize} from "./Icon";

export const COACH_TIPS = 12;

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
  return (
    <div className="coach-tip" role="status">
      <div className="tour-head">
        <ManagerAvatar look={defaultManagerLook("Assistent")} size={36} tie="#16a34a" />
        <strong>{iconize(t("tips.title"))}</strong>
      </div>
      <p>{iconize(t(`tips.${n}` as TKey))}</p>
      <div className="tour-actions">
        <button className="btn small" onClick={() => done(true)}><Icon name="close" size={14} /> {iconize(t("tips.off"))}</button>
        <button className="btn primary small" onClick={() => done(false)}>{iconize(t("tips.ok"))}</button>
      </div>
    </div>
  );
}
