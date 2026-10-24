import {startNegotiation} from "../../game/contracts";
import {listName, shortName, userClub} from "../../game/helpers";
import {clubPlayers, expectedWage, overall, wageBill} from "../../game/ratings";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Bar, Card, Face, PosBadge} from "../common";

export function Contracts() {
  const {t, money} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const setNegotiation = useGame((s) => s.setNegotiation);
  const notify = useGame((s) => s.notify);
  const club = userClub(game);
  const bill = wageBill(game, club.id);
  const players = clubPlayers(game, club.id).sort(
    (a, b) => a.contract.expiresSeason - b.contract.expiresSeason || overall(b) - overall(a)
  );

  const negotiate = (id: string) => {
    const neg = startNegotiation(game, id, club.id, "renewal");
    if ("refused" in neg) notify(neg.refused, {name: shortName(game.players[id])}, "error");
    else setNegotiation(neg);
  };

  return (
    <div className="grid">
      <Card title={t("con.wageBudget")}>
        {/* The bar shows headroom: full means plenty left, empty means at or over budget. */}
        <Bar value={Math.max(0, 100 - (bill / Math.max(1, club.wageBudget)) * 100) * 5} label={t("con.headroom")} />
        <p>{t("con.billOfBudget", {bill, budget: club.wageBudget})}</p>
        <p className="muted small">{t("con.hint")}</p>
      </Card>
      <Card title={t("nav.contracts")} className="span-2">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.pos")}</th><th>{t("col.name")}</th><th>{t("col.age")}</th><th title={t("col.ovrHint")}>{t("col.ovr")}</th>
                <th>{t("col.wage")}</th><th>{t("con.market")}</th><th>{t("col.contract")}</th><th>{t("col.role")}</th><th>{t("col.happiness")}</th><th />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const expiring = p.contract.expiresSeason <= game.season;
                return (
                  <tr key={p.id} className={expiring ? "warn-row" : ""}>
                    <td><PosBadge pos={p.position} /></td>
                    <td><button className="link" onClick={() => openPlayer(p.id)}>{listName(p)}</button></td>
                    <td>{p.age}</td>
                    <td className="num strong">{overall(p)}</td>
                    <td className="num">{money(p.contract.wage)}</td>
                    <td className="num muted">{money(expectedWage(p))}</td>
                    <td className="num">{p.contract.expiresSeason}{expiring && " ⚠️"}</td>
                    <td>{t(`role.${p.contract.role}`)}</td>
                    <td><Face value={p.happiness} /></td>
                    <td><button className="btn small" onClick={() => negotiate(p.id)}>✍️ {t("con.negotiate")}</button></td>
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
