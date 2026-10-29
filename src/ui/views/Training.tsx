import {ENERGY_COST_EXTRA_TRAINING, MAX_EXTRA_TRAININGS} from "../../game/constants";
import {Icon, type IconName, iconize} from "../Icon";
import {listName, userClub} from "../../game/helpers";
import {taskProgress} from "../../game/daily";
import {spendEnergy} from "../../game/monetization";
import {clubPlayers, overall} from "../../game/ratings";
import {extraTraining, FOCUS_ATTRIBUTES, trainingPlan} from "../../game/training";
import {ATTRIBUTES, INTENSITIES, POSITIONS, TRAINING_FOCUSES, type Attribute, type Intensity, type Player, type TrainingFocus} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {FocusPicker} from "../FocusPicker";
import {Bar, Card, Delta, PosBadge, SortTh, sortRows, useSort, Hint} from "../common";

type TrainingSort = "pos" | "name" | "age" | "ovr" | "fitness" | "change" | "focus";

const FOCUS_ICONS: Record<string, IconName> = {
  attack: "target", defense: "shield", passing: "swap", physical: "dumbbell", conditioning: "run", technique: "sparkle", goalkeeping: "glove", recovery: "moon",
};
const MODE_ICONS = {auto: "sparkle", rest: "moon", own: "target"} as const;

function totalChange(p: Player): number {
  return Object.values(p.weeklyChange).reduce((s, v) => s + (v ?? 0), 0);
}

export function Training() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const openPlayer = useGame((s) => s.openPlayer);
  const club = userClub(game);
  const {focus, intensity, auto} = game.training;
  // What this week's training will be (the assistant's pick on auto).
  const plan = trainingPlan(game);
  const mode: "auto" | "rest" | "own" = auto ? "auto" : focus === "recovery" ? "rest" : "own";
  const setMode = (m: "auto" | "rest" | "own") =>
    act((g) => {
      g.training.auto = m === "auto";
      if (m === "rest") {
        g.training.focus = "recovery";
        g.training.intensity = "light";
      }
      // Picking it yourself starts from what's on now (not rest).
      if (m === "own" && g.training.focus === "recovery") {
        g.training.focus = plan.focus === "recovery" ? "technique" : plan.focus;
        g.training.intensity = plan.focus === "recovery" ? "normal" : plan.intensity;
      }
    });
  const squad = clubPlayers(game, club.id).sort((a, b) => totalChange(b) - totalChange(a));
  const extrasLeft = MAX_EXTRA_TRAININGS - game.monetization.extraTrainingsThisWeek;

  const extra = () => {
    const ok = act((g, rng) => {
      if (g.monetization.extraTrainingsThisWeek >= MAX_EXTRA_TRAININGS) return "limit";
      if (!spendEnergy(g.monetization, ENERGY_COST_EXTRA_TRAINING, Date.now())) return "energy";
      g.monetization.extraTrainingsThisWeek++;
      extraTraining(g, rng);
      taskProgress(g, "train");
      return "ok";
    });
    if (ok === "ok") notify("toast.extraTraining", undefined, "good");
    else notify(ok === "energy" ? "err.noEnergy" : "train.extraLimit", undefined, "error");
  };

  // Sortable by any column; biggest weekly gain first to start with.
  const sort = useSort<TrainingSort>("change", true);
  const trainingValue = (p: Player, key: TrainingSort): number | string => {
    switch (key) {
      case "pos": return POSITIONS.indexOf(p.position);
      case "name": return listName(p);
      case "age": return p.age;
      case "ovr": return overall(p);
      case "fitness": return p.fitness;
      case "change": return totalChange(p);
      case "focus": return p.individualFocus ?? "";
    }
  };
  const th = (key: TrainingSort, label: string, descFirst = true, title?: string) => (
    <SortTh label={label} title={title} active={sort.key === key} desc={sort.desc} onClick={() => sort.onSort(key, descFirst)} />
  );

  return (
    <div className="grid">
      <Card title={t("train.programme")}>
        {/* One tap: let the assistant plan it, rest, or choose. */}
        <div className="real-tabs" role="tablist" aria-label={t("train.programme")}>
          {(["auto", "rest", "own"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "real-tab active" : "real-tab"} onClick={() => setMode(m)}>
              <Icon name={MODE_ICONS[m]} size={18} />
              <span>{iconize(t(`train.mode.${m}`))}</span>
            </button>
          ))}
        </div>
        <p className="muted small">{iconize(t(`train.mode.${mode}Hint`))}</p>

        {mode === "own" && (
          <>
            <h4 className="train-sub">{iconize(t("train.focus"))}</h4>
            <div className="train-focuses">
              {TRAINING_FOCUSES.filter((f) => f !== "recovery").map((f) => (
                <button key={f} className={`train-focus ${focus === f ? "active" : ""}`} aria-pressed={focus === f} onClick={() => act((g) => { g.training.focus = f as TrainingFocus; })}>
                  <Icon name={FOCUS_ICONS[f]} size={18} /> {iconize(t(`focus.${f}`))}
                </button>
              ))}
            </div>
            <h4 className="train-sub">{iconize(t("train.intensity"))}</h4>
            <div className="speed-group train-intensity" role="group" aria-label={t("train.intensity")}>
              {INTENSITIES.map((i) => (
                <button key={i} className={intensity === i ? "chip active" : "chip"} onClick={() => act((g) => { g.training.intensity = i as Intensity; })}>{iconize(t(`intensity.${i}`))}</button>
              ))}
            </div>
          </>
        )}

        {/* This week, in words: what it trains and how hard. */}
        <div className="train-plan">
          <span className="train-plan-icon" aria-hidden><Icon name={FOCUS_ICONS[plan.focus]} size={26} /></span>
          <div>
            <strong>{iconize(t("train.thisWeek", {focus: t(`focus.${plan.focus}`), intensity: t(`intensity.${plan.intensity}`)}))}</strong>
            {plan.reason && <div className="small">{iconize(t(`train.reason.${plan.reason}`))}</div>}
            <div className="muted small">
              {Object.keys(FOCUS_ATTRIBUTES[plan.focus]).map((a) => t(`attr.${a as Attribute}`)).join(", ") || t("train.restores")} · {iconize(t(`intensity.${plan.intensity}Hint`))}
            </div>
          </div>
        </div>
      </Card>

      <Card title={t("train.extra")}>
        <Hint>{iconize(t("train.extraHint", {cost: ENERGY_COST_EXTRA_TRAINING, left: extrasLeft}))}</Hint>
        <button className="btn primary" disabled={extrasLeft <= 0} onClick={extra}><Icon name="bolt" size={18} /> {iconize(t("train.extraButton"))}</button>
      </Card>

      <Card title={t("train.lastWeek")} className="span-2">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {th("pos", t("col.pos"), false)}{th("name", t("col.name"), false)}{th("age", t("col.age"), false)}{th("ovr", t("col.ovr"), true, t("col.ovrHint"))}
                {th("fitness", t("col.fitness"))}{th("change", t("train.change"))}<th>{iconize(t("train.biggest"))}</th>{th("focus", t("pl.individualFocus"), false)}
              </tr>
            </thead>
            <tbody>
              {sortRows(squad, (p) => trainingValue(p, sort.key), sort.desc).map((p) => {
                const changes = ATTRIBUTES.map((a) => ({a, d: p.weeklyChange[a] ?? 0})).filter((c) => Math.abs(c.d) >= 0.05).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
                return (
                  <tr key={p.id}>
                    <td><PosBadge pos={p.position} /></td>
                    <td><button className="link" onClick={() => openPlayer(p.id)}>{listName(p)}</button>{p.injuryWeeks > 0 && <> {iconize("🩹")}</>}</td>
                    <td>{p.age}</td>
                    <td className="num strong">{overall(p)}</td>
                    <td><Bar value={p.fitness} small /></td>
                    <td><Delta value={totalChange(p)} digits={2} /></td>
                    <td className="small">
                      {changes.slice(0, 2).map((c) => (
                        <span key={c.a} className="change-tag">{iconize(t(`attr.${c.a}`))} <Delta value={c.d} digits={2} /></span>
                      ))}
                    </td>
                    <td>
                      <FocusPicker player={p} compact />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
