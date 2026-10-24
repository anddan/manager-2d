import {ENERGY_COST_EXTRA_TRAINING, MAX_EXTRA_TRAININGS} from "../../game/constants";
import {listName, userClub} from "../../game/helpers";
import {taskProgress} from "../../game/daily";
import {spendEnergy} from "../../game/monetization";
import {clubPlayers, overall} from "../../game/ratings";
import {extraTraining, FOCUS_ATTRIBUTES} from "../../game/training";
import {ATTRIBUTES, INTENSITIES, POSITIONS, TRAINING_FOCUSES, type Attribute, type Intensity, type Player, type TrainingFocus} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Bar, Card, Delta, PosBadge, SortTh, sortRows, useSort} from "../common";

type TrainingSort = "pos" | "name" | "age" | "ovr" | "fitness" | "change" | "focus";

const FOCUS_ICONS: Record<string, string> = {
  attack: "🎯", defense: "🛡️", passing: "🔀", physical: "💪", conditioning: "🏃", technique: "✨", goalkeeping: "🧤", recovery: "🛌",
};

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
  const {focus, intensity} = game.training;
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
        <div className="tac-pickers">
          <label className="field">
            <span>{t("train.focus")}</span>
            <select value={focus} onChange={(e) => act((g) => { g.training.focus = e.target.value as TrainingFocus; })}>
              {TRAINING_FOCUSES.map((f) => <option key={f} value={f}>{FOCUS_ICONS[f]} {t(`focus.${f}`)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t("train.intensity")}</span>
            <select value={intensity} onChange={(e) => act((g) => { g.training.intensity = e.target.value as Intensity; })}>
              {INTENSITIES.map((i) => <option key={i} value={i}>{t(`intensity.${i}`)}</option>)}
            </select>
          </label>
        </div>
        {/* What the chosen focus trains, and what the intensity means. */}
        <p className="muted small">
          {FOCUS_ICONS[focus]} {Object.keys(FOCUS_ATTRIBUTES[focus]).map((a) => t(`attr.${a as Attribute}`)).join(", ") || t("train.restores")}
        </p>
        <p className="muted small">{t(`intensity.${intensity}Hint`)}</p>
      </Card>

      <Card title={t("train.extra")}>
        <p className="muted">{t("train.extraHint", {cost: ENERGY_COST_EXTRA_TRAINING, left: extrasLeft})}</p>
        <button className="btn primary" disabled={extrasLeft <= 0} onClick={extra}>⚡ {t("train.extraButton")}</button>
      </Card>

      <Card title={t("train.lastWeek")} className="span-2">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {th("pos", t("col.pos"), false)}{th("name", t("col.name"), false)}{th("age", t("col.age"), false)}{th("ovr", t("col.ovr"), true, t("col.ovrHint"))}
                {th("fitness", t("col.fitness"))}{th("change", t("train.change"))}<th>{t("train.biggest")}</th>{th("focus", t("pl.individualFocus"), false)}
              </tr>
            </thead>
            <tbody>
              {sortRows(squad, (p) => trainingValue(p, sort.key), sort.desc).map((p) => {
                const changes = ATTRIBUTES.map((a) => ({a, d: p.weeklyChange[a] ?? 0})).filter((c) => Math.abs(c.d) >= 0.05).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
                return (
                  <tr key={p.id}>
                    <td><PosBadge pos={p.position} /></td>
                    <td><button className="link" onClick={() => openPlayer(p.id)}>{listName(p)}</button>{p.injuryWeeks > 0 && " 🩹"}</td>
                    <td>{p.age}</td>
                    <td className="num strong">{overall(p)}</td>
                    <td><Bar value={p.fitness} small /></td>
                    <td><Delta value={totalChange(p)} digits={2} /></td>
                    <td className="small">
                      {changes.slice(0, 2).map((c) => (
                        <span key={c.a} className="change-tag">{t(`attr.${c.a}`)} <Delta value={c.d} digits={2} /></span>
                      ))}
                    </td>
                    <td>
                      <select
                        value={p.individualFocus ?? ""}
                        aria-label={t("pl.individualFocus")}
                        onChange={(e) => act((g) => { g.players[p.id].individualFocus = (e.target.value || null) as Attribute | null; })}
                      >
                        <option value="">–</option>
                        {ATTRIBUTES.map((a) => <option key={a} value={a}>{t(`attr.${a}`)}</option>)}
                      </select>
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
