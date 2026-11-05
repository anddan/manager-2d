// The weekly spending package, in the shop: spend diamonds and club money through the week and the levels open up;
// each open level lets you pick one reward from a few. The progress is shown as a bar with a chest for each level.
import {useEffect, useRef, useState} from "react";
import {MONEY_PER_POINT, SPEND_TIERS, claimSpending, openTiers, spendingOf, thisWeek} from "../game/spending";
import type {PlayerPackId} from "../game/packs";
import type {PrizeResult, WheelPrize} from "../game/wheel";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Card, Hint, Modal} from "./common";
import {confettiBurst, diamondBurst, moneyBurst, screenFlash} from "./effects";
import {GearCard} from "./Gear";
import {Icon, iconize, type IconName} from "./Icon";
import {PackReveal} from "./PackReveal";
import {fanfare} from "./sound";

const PACK_COLOR: Record<PlayerPackId, string> = {bronze: "#b45309", silver: "#94a3b8", gold: "#eab308", special: "#ec4899"};

function look(prize: WheelPrize): {color: string; icon: IconName} {
  if (prize.kind === "money") return {color: "#15803d", icon: "coins"};
  if (prize.kind === "diamonds") return {color: "#0284c7", icon: "diamond"};
  if (prize.kind === "pack") return {color: PACK_COLOR[prize.pack], icon: "gift"};
  return {color: prize.special ? "#ec4899" : prize.gold ? "#a21caf" : "#6d28d9", icon: "boot"};
}

export function SpendingPackages() {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const week = thisWeek();
  const spend = spendingOf(game, week);
  const open = openTiers(game, week);
  // The bar is true to the points: 50 and 200 come early, 1000 at the end.
  const top = SPEND_TIERS[SPEND_TIERS.length - 1].points;
  const at = (i: number) => (SPEND_TIERS[i].points / top) * 100;
  const fill = Math.min(100, (spend.points / top) * 100);
  /** The level being looked at (to pick from if it is open, else to see what it holds). */
  const [tier, setTier] = useState<number | null>(null);
  const [result, setResult] = useState<PrizeResult | null>(null);
  const [reveal, setReveal] = useState<{id: string; pack: PlayerPackId} | null>(null);
  const prizeRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  /** The choice just pressed: it lights up for a moment before the reward is handed out. */
  const [flash, setFlash] = useState<number | null>(null);

  const name = (p: WheelPrize) =>
    p.kind === "money" ? money(p.amount) : p.kind === "diamonds" ? t("wheel.prize.diamonds", {n: p.amount}) : p.kind === "pack" ? t("wheel.prize.pack", {pack: t(`pack.${p.pack}`)}) : t(p.special ? "spend.specialKit" : p.gold ? "wheel.prize.goldKit" : "wheel.prize.kit");

  const choose = (choice: number) => {
    if (flash !== null) return;
    setFlash(choice);
    window.setTimeout(() => {
      setFlash(null);
      pick(choice);
    }, 650);
  };
  const pick = (choice: number) => {
    if (tier === null) return;
    const res = act((g, rng) => claimSpending(g, rng, week, tier, choice));
    if ("error" in res) return notify(res.error, undefined, "error");
    setResult(res);
  };
  useEffect(() => {
    if (!result) return;
    const big = tier === SPEND_TIERS.length - 1;
    try { fanfare(big); } catch { /* no sound */ }
    screenFlash(big ? "#fde047" : "#7dd3fc");
    confettiBurst(big ? 140 : 70);
    const timer = window.setTimeout(() => {
      const p = result.prize;
      if (p.kind === "money") moneyBurst(prizeRef.current, money(p.amount), 10);
      else if (p.kind === "diamonds") diamondBurst(prizeRef.current, p.amount);
      else if (result.diamonds) diamondBurst(prizeRef.current, result.diamonds);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const close = () => { setTier(null); setResult(null); };
  const current = tier !== null ? SPEND_TIERS[tier] : null;
  const canPick = tier !== null && open.includes(tier);
  const l = result ? look(result.prize) : null;
  // Every level picked from: folded up to a line, to open again if wanted (not while a reward is on show).
  const allDone = spend.claimed.length >= SPEND_TIERS.length;
  if (allDone && !showAll && !result && !reveal) {
    return (
      <Card title={<><Icon name="gift" size={20} /> {iconize(t("spend.title"))} <span className="daily-tick">✓</span></>} className="span-2 spend-card daily-folded" actions={<button className="btn small" onClick={() => setShowAll(true)}>{iconize(t("spend.show"))}</button>}>
        <p className="muted small">{iconize(t("spend.allDone"))}</p>
      </Card>
    );
  }

  return (
    <Card title={<><Icon name="gift" size={20} /> {iconize(t("spend.title"))} <Hint>{iconize(t("spend.hint", {money: money(MONEY_PER_POINT)}))}</Hint></>} className="span-2 spend-card">
      <div className="spend-points"><strong>{iconize(t("spend.points", {n: spend.points}))}</strong><span className="muted small">{iconize(t("spend.resets"))}</span></div>
      <div className="spend-track">
        <span className="spend-bar"><span style={{width: `${fill}%`}} /></span>
        <div className="spend-tiers">
          {SPEND_TIERS.map((s, i) => {
            const done = spend.claimed.includes(i);
            const ready = open.includes(i);
            return (
              <button key={s.points} type="button" className={`spend-tier ${done ? "done" : ready ? "ready" : "locked"}`} style={{left: `${at(i)}%`}} onClick={() => setTier(i)} aria-label={t("spend.level", {n: i + 1})}>
                <span className="spend-chest"><Icon name={done ? "check" : ready ? "gift" : "lock"} size={24} /></span>
                <span className="spend-need">{s.points}</span>
              </button>
            );
          })}
        </div>
      </div>
      {open.length > 0 && <p className="spend-ready">{iconize(t("spend.ready", {n: open.length}))}</p>}

      {current && !result && (
        <Modal compact title={<><Icon name="gift" size={20} /> {iconize(t("spend.level", {n: (tier ?? 0) + 1}))}</>} onClose={close}>
          <p className="muted small">{iconize(canPick ? t("spend.choose") : spend.claimed.includes(tier!) ? t("spend.claimed") : t("spend.locked", {n: Math.max(0, current.points - spend.points)}))}</p>
          <div className="spend-choices">
            {current.choices.map((c, i) => {
              const lk = look(c);
              // What was picked here before is filled in; the others dim.
              const picked = spend.picks?.[tier!];
              const cls = ["spend-choice", canPick ? "pickable" : "", flash === i ? "chosen" : "", picked === i ? "picked" : picked !== undefined ? "dim" : ""].join(" ");
              return (
                <button key={i} type="button" className={cls} style={{borderColor: lk.color, ["--c" as string]: lk.color}} disabled={!canPick || flash !== null} onClick={() => choose(i)}>
                  <span className="spend-choice-icon" style={{color: lk.color}}><Icon name={lk.icon} size={34} /></span>
                  <strong>{name(c)}</strong>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {result && l && (
        <Modal compact title={<><Icon name="gift" size={20} /> {iconize(t("spend.reward"))}</>} onClose={close}>
          <div className="spend-win">
            <div className="wheel-rays" aria-hidden />
            <div className="wheel-win-body">
              <div className="wheel-win-title">{iconize(t("spend.reward"))}</div>
              <div ref={prizeRef} className="wheel-win-prize">
                {result.gear && result.prize.kind === "kit" ? <GearCard item={result.gear} small /> : <span style={{color: l.color}}><Icon name={l.icon} size={64} /></span>}
              </div>
              <div className="wheel-win-name">{name(result.prize)}</div>
              {result.diamonds ? <p className="muted small">{iconize(t("wheel.full", {n: result.diamonds}))}</p> : null}
              {result.prize.kind === "pack" && result.gear && <p className="small">{iconize(t("wheel.bonusKit"))}</p>}
              <div className="btn-row">
                {result.playerId && result.prize.kind === "pack" && <button className="btn primary" onClick={() => setReveal({id: result.playerId!, pack: (result.prize as {pack: PlayerPackId}).pack})}>{iconize(t("wheel.openPack"))}</button>}
                <button className={result.playerId ? "btn" : "btn primary"} onClick={close}>{iconize(t("wheel.great"))}</button>
              </div>
            </div>
          </div>
        </Modal>
      )}
      {reveal && <PackReveal playerId={reveal.id} pack={reveal.pack} onClose={() => { setReveal(null); close(); }} />}
    </Card>
  );
}
