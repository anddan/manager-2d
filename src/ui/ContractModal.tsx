// Contract negotiation with a player's agent: renewals, transfers and free
// agents. Offers above the wage budget need an explicit confirmation.
import {Icon, iconize} from "./Icon";
import {useState} from "react";
import {fullName, shortName} from "../game/helpers";
import {evaluateOffer, signContract, wageBudgetCheck, type ContractOffer} from "../game/contracts";
import {completeTransfer} from "../game/transfers";
import {SQUAD_ROLES, type SquadRole} from "../game/types";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Modal, NumberInput} from "./common";

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
      notify("toast.contractSigned", {name: shortName(p)}, "good");
      close();
      openPlayer(p.id);
    } else if (outcome.result.status === "counter") {
      setNegotiation(outcome.draft);
      setReply(t("neg.counter", {wage: outcome.result.demand.wage}));
    } else {
      // A failed transfer negotiation kills the whole deal.
      notify(neg.kind === "renewal" ? outcome.result.reason : "neg.dealCollapsed", {name: shortName(p)}, "error");
      close();
    }
  };

  const numberField = (key: "wage" | "signingBonus" | "goalBonus" | "appearanceBonus", step: number) => (
    <label className="field">
      <span>{iconize(t(`neg.${key}`))} <small className="muted">({t("neg.asks")} {money(neg.demand[key])})</small></span>
      <NumberInput step={step} value={offer[key]} onChange={(n) => set(key, n)} />
    </label>
  );

  return (
    <Modal title={<><Icon name="pen" size={20} /> {iconize(t(`neg.title.${neg.kind}`))}: {fullName(p)}</>} onClose={close}>
      {neg.fee > 0 && <p className="muted">{iconize(t("neg.agreedFee", {fee: neg.fee}))}</p>}
      <p className="muted">{iconize(t("neg.intro", {round: neg.round + 1}))}</p>
      {reply && <p className="callout">{reply}</p>}
      <div className="form-grid">
        {numberField("wage", 50)}
        <label className="field">
          <span>{iconize(t("neg.years"))} <small className="muted">({t("neg.asks")} {neg.demand.years})</small></span>
          <select value={offer.years} onChange={(e) => set("years", Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        {numberField("signingBonus", 500)}
        {numberField("goalBonus", 50)}
        {numberField("appearanceBonus", 50)}
        <label className="field">
          <span>{iconize(t("col.role"))} <small className="muted">({t("neg.asks")} {iconize(t(`role.${neg.demand.role}`))})</small></span>
          <select value={offer.role} onChange={(e) => set("role", e.target.value as SquadRole)}>
            {SQUAD_ROLES.map((r) => <option key={r} value={r}>{iconize(t(`role.${r}`))}</option>)}
          </select>
        </label>
        <label className="field">
          <span>
            <input type="checkbox" checked={offer.releaseClause !== null} onChange={(e) => set("releaseClause", e.target.checked ? Math.round(p.value * 2 / 10_000) * 10_000 : null)} />{" "}
            {iconize(t("pl.releaseClause"))}
          </span>
          {offer.releaseClause !== null && (
            <NumberInput step={50_000} value={offer.releaseClause} onChange={(n) => set("releaseClause", n)} />
          )}
        </label>
      </div>

      <p className={budget.over ? "callout error" : "muted"}>
        {iconize(t("neg.wageBill", {after: budget.after, budget: budget.budget}))}
      </p>
      {budget.over && (
        <label className="toggle warn">
          <input type="checkbox" checked={confirmOver} onChange={(e) => setConfirmOver(e.target.checked)} />
          {iconize(t("neg.confirmOver"))}
        </label>
      )}
      <div className="btn-row dialog-actions">
        <button className="btn" onClick={close}>{iconize(t("common.cancel"))}</button>
        <button className="btn primary" disabled={budget.over && !confirmOver} onClick={submit}>{iconize(t("neg.send"))}</button>
      </div>
      <p className="muted small">{iconize(tx("neg.hint"))}</p>
    </Modal>
  );
}
