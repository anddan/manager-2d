// Contract negotiation with a player's agent: renewals, transfers and free
// agents. Offers above the wage budget need an explicit confirmation.
import {useState} from "react";
import {evaluateOffer, signContract, wageBudgetCheck, type ContractOffer} from "../game/contracts";
import {completeTransfer} from "../game/transfers";
import {SQUAD_ROLES, type SquadRole} from "../game/types";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Modal} from "./common";

export function ContractModal() {
  const {t, tx, money} = useT();
  const game = useGameState();
  const neg = useGame((s) => s.negotiation)!;
  const setNegotiation = useGame((s) => s.setNegotiation);
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const openPlayer = useGame((s) => s.openPlayer);
  const p = game.players[neg.playerId];
  const [offer, setOffer] = useState<ContractOffer>(() => ({...neg.demand, wage: Math.round(neg.demand.wage * 0.9 / 50) * 50}));
  const [confirmOver, setConfirmOver] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  if (!p) return null;
  const budget = wageBudgetCheck(game, neg.clubId, p.id, offer.wage);
  const close = () => setNegotiation(null);
  const set = <K extends keyof ContractOffer>(key: K, value: ContractOffer[K]) => setOffer({...offer, [key]: value});

  const submit = () => {
    const outcome = act((g) => {
      const draft = structuredClone(neg);
      const result = evaluateOffer(g, draft, offer);
      if (result.status === "accepted") {
        if (neg.kind !== "renewal") completeTransfer(g, p.id, neg.clubId, neg.fee, neg.upfrontShare, neg.installmentWeeks);
        signContract(g, p.id, neg.clubId, offer);
      }
      return {result, draft};
    });
    if (outcome.result.status === "accepted") {
      notify("toast.contractSigned", {name: p.lastName}, "good");
      close();
      openPlayer(p.id);
    } else if (outcome.result.status === "counter") {
      setNegotiation(outcome.draft);
      setReply(t("neg.counter", {wage: outcome.result.demand.wage}));
    } else {
      // A failed transfer negotiation kills the whole deal.
      notify(neg.kind === "renewal" ? outcome.result.reason : "neg.dealCollapsed", {name: p.lastName}, "error");
      close();
    }
  };

  const numberField = (key: "wage" | "signingBonus" | "goalBonus" | "appearanceBonus", step: number) => (
    <label className="field">
      <span>{t(`neg.${key}`)} <small className="muted">({t("neg.asks")} {money(neg.demand[key])})</small></span>
      <input type="number" min={0} step={step} value={offer[key]} onChange={(e) => set(key, Math.max(0, Number(e.target.value)))} />
    </label>
  );

  return (
    <Modal title={`✍️ ${t(`neg.title.${neg.kind}`)}: ${p.firstName} ${p.lastName}`} onClose={close}>
      {neg.fee > 0 && <p className="muted">{t("neg.agreedFee", {fee: neg.fee})}</p>}
      <p className="muted">{t("neg.intro", {round: neg.round + 1})}</p>
      {reply && <p className="callout">{reply}</p>}
      <div className="form-grid">
        {numberField("wage", 50)}
        <label className="field">
          <span>{t("neg.years")} <small className="muted">({t("neg.asks")} {neg.demand.years})</small></span>
          <select value={offer.years} onChange={(e) => set("years", Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        {numberField("signingBonus", 500)}
        {numberField("goalBonus", 50)}
        {numberField("appearanceBonus", 50)}
        <label className="field">
          <span>{t("col.role")} <small className="muted">({t("neg.asks")} {t(`role.${neg.demand.role}`)})</small></span>
          <select value={offer.role} onChange={(e) => set("role", e.target.value as SquadRole)}>
            {SQUAD_ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>
            <input type="checkbox" checked={offer.releaseClause !== null} onChange={(e) => set("releaseClause", e.target.checked ? Math.round(p.value * 2 / 10_000) * 10_000 : null)} />{" "}
            {t("pl.releaseClause")}
          </span>
          {offer.releaseClause !== null && (
            <input type="number" min={0} step={50_000} value={offer.releaseClause} onChange={(e) => set("releaseClause", Math.max(0, Number(e.target.value)))} />
          )}
        </label>
      </div>

      <p className={budget.over ? "callout error" : "muted"}>
        {t("neg.wageBill", {after: budget.after, budget: budget.budget})}
      </p>
      {budget.over && (
        <label className="toggle warn">
          <input type="checkbox" checked={confirmOver} onChange={(e) => setConfirmOver(e.target.checked)} />
          {t("neg.confirmOver")}
        </label>
      )}
      <div className="btn-row">
        <button className="btn primary" disabled={budget.over && !confirmOver} onClick={submit}>{t("neg.send")}</button>
        <button className="btn" onClick={close}>{t("common.cancel")}</button>
      </div>
      <p className="muted small">{tx("neg.hint")}</p>
    </Modal>
  );
}
