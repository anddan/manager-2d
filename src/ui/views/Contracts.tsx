import {useState} from "react";
import {autoRenew, autoRenewPlan, startNegotiation} from "../../game/contracts";
import {Icon, iconize} from "../Icon";
import {listName, shortName, userClub} from "../../game/helpers";
import {clubPlayers, expectedWage, overall, wageBill} from "../../game/ratings";
import {useT, type TKey} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Bar, Card, Face, Modal, PosBadge, SortTh, sortRows, useSort, Hint} from "../common";
import {chime} from "../sound";
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
  const act = useGame((s) => s.act);
  // The automatic renewal: what would be done, shown before it is.
  const [auto, setAuto] = useState(false);
  // The manager has said to renew although the contracts break the wage budget (one tick at the top).
  const [overBudget, setOverBudget] = useState(false);
  const plan = auto ? autoRenewPlan(game, overBudget) : [];
  const blocked = auto && autoRenewPlan(game, false).some((i) => i.reason === "budget");
  const renewable = plan.filter((i) => i.offer);
  const expiringNow = clubPlayers(game, game.userClubId).filter((p) => p.contract.expiresSeason <= game.season).length;
  const doAuto = () => {
    const n = act((g) => autoRenew(g, overBudget));
    setAuto(false);
    setOverBudget(false);
    try { chime(); } catch { /* no sound */ }
    notify("con.auto.done", {n}, "good");
  };
  // Less to begin with (on a phone): who, wage and when it ends; "Show more" opens out age, rating, market wage, role and mood.
  const [more, setMore] = useState(false);
  const club = userClub(game);
  const bill = wageBill(game, club.id);
  // How much of the budget the wages use, in percent: green under 75, yellow up to 100, red above.
  const used = (bill / Math.max(1, club.wageBudget)) * 100;
  // Soonest-expiring first to start with, best first among them; any column sorts.
  const sort = useSort<ContractSort>("contract");
  const base = clubPlayers(game, club.id).sort((a, b) => a.contract.expiresSeason - b.contract.expiresSeason || overall(b) - overall(a));
  const players = sortRows(base, (p) => contractValue(p, sort.key), sort.desc);
  const th = (key: ContractSort, label: string, descFirst = true, title?: string) => (
    <SortTh label={label} title={title} className={key === "pos" ? "col-pos" : undefined} active={sort.key === key} desc={sort.desc} onClick={() => sort.onSort(key, descFirst)} />
  );

  const negotiate = (id: string) => {
    const neg = startNegotiation(game, id, club.id, "renewal");
    if ("refused" in neg) notify(neg.refused, {name: shortName(game.players[id])}, "error");
    else setNegotiation(neg);
  };

  return (
    <div className="grid">
      <Card title={t("con.wageBudget")}>
        {/* The bar shows how much of the budget the wages use: half full is half used (green under 75 %, yellow up to 100 %, red above). */}
        <Bar value={used} color={used < 75 ? "good" : used <= 100 ? "mid" : "bad"} label={t("con.used")} />
        <p>
          {iconize(t("con.billOfBudget", {bill, budget: club.wageBudget}))}
          {/* Over the budget: how much, in red with a minus. */}
          {bill > club.wageBudget && <strong className="neg over-budget"> −{money(bill - club.wageBudget)} {t("con.overBudget")}</strong>}
        </p>
        <Hint>
          <p>{iconize(t("con.hint"))}</p>
          {/* The colours of the bar, shown rather than told. */}
          <p className="budget-legend">
            <span><i className="legend-dot good" /> 0–75 %</span>
            <span><i className="legend-dot mid" /> 75–100 %</span>
            <span><i className="legend-dot bad" /> 100 %+</span>
          </p>
        </Hint>
      </Card>
      <Card
        title={t("nav.contracts")}
        className="span-2"
        actions={
          <>
            <button type="button" className={expiringNow > 0 ? "btn primary small" : "btn small"} disabled={expiringNow === 0} onClick={() => setAuto(true)}><Icon name="sparkle" size={16} /> {iconize(t("con.auto"))}{expiringNow > 0 ? ` (${expiringNow})` : ""}</button>
            <button type="button" className="btn small" aria-expanded={more} onClick={() => setMore(!more)}>{iconize(t(more ? "tbl.showLess" : "tbl.showMore"))}</button>
          </>
        }
      >
        <div className="table-wrap">
          <table className="table flush">
            <thead>
              <tr>
                {th("pos", t("col.pos"), false)}{th("name", t("col.name"), false)}{more && th("age", t("col.age"), false)}{more && th("ovr", t("col.ovr"), true, t("col.ovrHint"))}
                {th("wage", t("col.wage"))}{more && th("market", t("con.market"))}{th("contract", t("col.contract"), false)}{more && th("role", t("col.role"), false)}{more && th("happiness", t("col.happiness"))}<th />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const expiring = p.contract.expiresSeason <= game.season;
                return (
                  <tr key={p.id} className={expiring ? "warn-row" : ""}>
                    <td><PosBadge pos={p.position} /></td>
                    <td><button className="link" onClick={() => openPlayer(p.id)}>{listName(p)}</button></td>
                    {more && <td>{p.age}</td>}
                    {more && <td className="num strong">{overall(p)}</td>}
                    <td className="num">{money(p.contract.wage)}</td>
                    {more && <td className="num muted">{money(expectedWage(p))}</td>}
                    <td className="num">{p.contract.expiresSeason}{expiring && " ⚠️"}</td>
                    {more && <td>{iconize(t(`role.${p.contract.role}`))}</td>}
                    {more && <td><Face value={p.happiness} /></td>}
                    <td><button className="btn small" title={t("con.negotiate")} aria-label={t("con.negotiate")} onClick={() => negotiate(p.id)}><Icon name="pen" size={18} />{more && <> {iconize(t("con.negotiate"))}</>}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {auto && (
        <Modal wide title={<><Icon name="sparkle" size={20} /> {iconize(t("con.auto"))} <Hint inline>{iconize(t("con.auto.hint"))}</Hint></>} onClose={() => { setAuto(false); setOverBudget(false); }}>
          {/* One tick at the top: send the ones that break the wage budget anyway. */}
          {(blocked || overBudget) && (
            <label className="toggle warn auto-force">
              <input type="checkbox" checked={overBudget} onChange={(e) => setOverBudget(e.target.checked)} /> {iconize(t("con.auto.force"))}
            </label>
          )}
          {plan.length === 0 ? (
            <p className="muted">{iconize(t("con.auto.none"))}</p>
          ) : (
            <>
              <ul className="auto-renew">
                {plan.map((i) => {
                  const p = game.players[i.playerId];
                  if (!p) return null;
                  return (
                    <li key={i.playerId} className={i.offer ? "auto-row ok" : "auto-row skip"}>
                      <PosBadge pos={p.position} />
                      <span className="auto-name"><button type="button" className="link" onClick={() => openPlayer(p.id)}><strong>{listName(p)}</strong></button> <span className="muted small">{p.age} · {overall(p)}</span></span>
                      {i.offer ? (
                        <span className="auto-deal">
                          <span className="num">{money(i.offer.wage)}</span>
                          <span className={i.offer.wage > p.contract.wage ? "neg small" : "pos-num small"}>{i.offer.wage >= p.contract.wage ? "+" : ""}{money(i.offer.wage - p.contract.wage)}</span>
                          <span className="muted small">{t("con.auto.years", {n: i.offer.years})}</span>
                        </span>
                      ) : (
                        <span className="auto-why muted small"><Icon name="close" size={14} /> {iconize(t(`con.auto.reason.${i.reason}` as TKey))}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {renewable.length > 0 && (
                <p className="small">
                  {iconize(t("con.auto.total", {bill: renewable.reduce((b, i) => b + i.offer!.wage - game.players[i.playerId].contract.wage, wageBill(game, club.id)), budget: club.wageBudget}))}
                  <br />
                  {iconize(t("con.auto.bonus", {sum: renewable.reduce((s, i) => s + i.offer!.signingBonus, 0)}))}
                </p>
              )}
              <div className="btn-row dialog-actions">
                <button className="btn" onClick={() => { setAuto(false); setOverBudget(false); }}>{t("common.cancel")}</button>
                <button className="btn primary" disabled={renewable.length === 0} onClick={doAuto}>{iconize(t("con.auto.renew", {n: renewable.length}))}</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
