import {ENERGY_COST_EXTRA_TRAINING, MAX_EXTRA_TRAININGS} from "../../game/constants";
import {userClub} from "../../game/helpers";
import {spendEnergy} from "../../game/monetization";
import {clubPlayers, overall} from "../../game/ratings";
import {extraTraining, FOCUS_ATTRIBUTES} from "../../game/training";
import {ATTRIBUTES, INTENSITIES, TRAINING_FOCUSES, type Attribute, type Player} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Bar, Card, Delta, PosBadge} from "../common";

const FOCUS_ICONS: Record<string, string> = {
  attack: "🎯", defense: "🛡️", passing: "🔀", physical: "💪", conditioning: "🫁", technique: "✨", goalkeeping: "🧤", recovery: "🛌",
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
      return "ok";
    });
    if (ok === "ok") notify("toast.extraTraining", undefined, "good");
    else notify(ok === "energy" ? "err.noEnergy" : "train.extraLimit", undefined, "error");
  };

  return (
    <div className="grid">
      <Card title={t("train.programme")}>
        <div className="focus-grid">
          {TRAINING_FOCUSES.map((f) => (
            <button key={f} className={f === focus ? "focus-btn active" : "focus-btn"} onClick={() => act((g) => { g.training.focus = f; })}>
              <span className="focus-icon">{FOCUS_ICONS[f]}</span>
              <span>{t(`focus.${f}`)}</span>
              <small className="muted">
                {Object.keys(FOCUS_ATTRIBUTES[f]).map((a) => t(`attr.${a as Attribute}`)).join(", ") || t("train.restores")}
              </small>
            </button>
          ))}
        </div>
        <h3>{t("train.intensity")}</h3>
        <div className="btn-row">
          {INTENSITIES.map((i) => (
            <button key={i} className={i === intensity ? "chip active" : "chip"} onClick={() => act((g) => { g.training.intensity = i; })}>
              {t(`intensity.${i}`)}
            </button>
          ))}
        </div>
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
                <th>{t("col.pos")}</th><th>{t("col.name")}</th><th>{t("col.age")}</th><th>{t("col.ovr")}</th><th>{t("col.pot")}</th>
                <th>{t("col.fitness")}</th><th>{t("train.change")}</th><th>{t("train.biggest")}</th><th>{t("pl.individualFocus")}</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => {
                const changes = ATTRIBUTES.map((a) => ({a, d: p.weeklyChange[a] ?? 0})).filter((c) => Math.abs(c.d) >= 0.05).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
                return (
                  <tr key={p.id}>
                    <td><PosBadge pos={p.position} /></td>
                    <td><button className="link" onClick={() => openPlayer(p.id)}>{p.firstName.charAt(0)}. {p.lastName}</button>{p.injuryWeeks > 0 && " 🩹"}</td>
                    <td>{p.age}</td>
                    <td className="num strong">{overall(p)}</td>
                    <td className="num">{p.potential}</td>
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
