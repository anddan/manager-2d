import {startNegotiation} from "../../game/contracts";
import {Icon, iconize} from "../Icon";
import {listName, shortName, userClub} from "../../game/helpers";
import {clubPlayers, expectedWage, overall, wageBill} from "../../game/ratings";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Bar, Card, Face, PosBadge, SortTh, sortRows, useSort, Hint} from "../common";
import {POSITIONS, SQUAD_ROLES, type Player} from "../../game/types";

type ContractSort = "pos" | "name" | "age" | "ovr" | "wage" | "market" | "contract" | "role" | "happiness";

function contractValue(p: Player, key: ContractSort): number | string {
  switch (key) {
    case "pos": return POSITIONS.indexOf(p.position);
    case "name": return listName(p);
    case "age": return p.age;
    case "ovr": return overall(p);
    case "wage": return p.contract.wage;
    case "market": return expectedWage(p);
    case "contract": return p.contract.expiresSeason;
    case "role": return SQUAD_ROLES.indexOf(p.contract.role);
    case "happiness": return p.happiness;
  }
}

export function Contracts() {
  const {t, money} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const setNegotiation = useGame((s) => s.setNegotiation);
  const notify = useGame((s) => s.notify);
  const club = userClub(game);
  const bill = wageBill(game, club.id);
  // Soonest-expiring first to start with, best first among them; any column sorts.
  const sort = useSort<ContractSort>("contract");
  const base = clubPlayers(game, club.id).sort((a, b) => a.contract.expiresSeason - b.contract.expiresSeason || overall(b) - overall(a));
  const players = sortRows(base, (p) => contractValue(p, sort.key), sort.desc);
  const th = (key: ContractSort, label: string, descFirst = true, title?: string) => (
    <SortTh label={label} title={title} active={sort.key === key} desc={sort.desc} onClick={() => sort.onSort(key, descFirst)} />
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
        <p>{iconize(t("con.billOfBudget", {bill, budget: club.wageBudget}))}</p>
        <Hint>{iconize(t("con.hint"))}</Hint>
      </Card>
      <Card title={t("nav.contracts")} className="span-2">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {th("pos", t("col.pos"), false)}{th("name", t("col.name"), false)}{th("age", t("col.age"), false)}{th("ovr", t("col.ovr"), true, t("col.ovrHint"))}
                {th("wage", t("col.wage"))}{th("market", t("con.market"))}{th("contract", t("col.contract"), false)}{th("role", t("col.role"), false)}{th("happiness", t("col.happiness"))}<th />
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
                    <td>{iconize(t(`role.${p.contract.role}`))}</td>
                    <td><Face value={p.happiness} /></td>
                    <td><button className="btn small" onClick={() => negotiate(p.id)}><Icon name="pen" size={18} /> {iconize(t("con.negotiate"))}</button></td>
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
