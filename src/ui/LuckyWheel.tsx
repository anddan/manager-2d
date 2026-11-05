// The lucky wheel: one free spin a day (one more for a video). The wheel spins on, ticking past the pegs,
// slows down and stops on a prize: money, diamonds, a player pack or a piece of kit.
import {useEffect, useRef, useState} from "react";
import {TUTORIAL_STEPS} from "../game/tutorial";
import {WHEEL, wheelStatus, spinWheel, type WheelPrize, type WheelResult} from "../game/wheel";
import type {PlayerPackId} from "../game/packs";
import {useT, type TKey} from "../i18n";
import {useGame, useGameState} from "../store";
import {Card, Hint, Modal} from "./common";
import {today} from "./DailyTasks";
import {confettiBurst, diamondBurst, moneyBurst, screenFlash} from "./effects";
import {GearCard} from "./Gear";
import {Icon, iconize, type IconName} from "./Icon";
import {PackReveal} from "./PackReveal";
import {fanfare, wheelTick} from "./sound";
import {VideoAd} from "./VideoAd";

const PACK_COLOR: Record<PlayerPackId, string> = {bronze: "#b45309", silver: "#94a3b8", gold: "#eab308", special: "#ec4899"};
const N = WHEEL.length;
const STEP = 360 / N;
const SPIN_MS = 5400;

/** A place's colour, icon and short words. */
function look(prize: WheelPrize): {color: string; icon: IconName; key: string} {
  if (prize.kind === "money") return {color: "#15803d", icon: "coins", key: "money"};
  if (prize.kind === "diamonds") return {color: "#0284c7", icon: "diamond", key: "diamonds"};
  if (prize.kind === "pack") return {color: PACK_COLOR[prize.pack], icon: "gift", key: "pack"};
  return {color: prize.gold ? "#a21caf" : "#6d28d9", icon: "boot", key: prize.gold ? "goldKit" : "kit"};
}

const compact = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1000}k`);

/** The point of a wedge on the circle (0° at the top, clockwise). */
const pt = (r: number, deg: number) => `${(150 + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)} ${(150 - r * Math.cos((deg * Math.PI) / 180)).toFixed(2)}`;

/** The wheel itself, drawn as a picture (it is turned from outside). */
export function WheelFace({short}: {short: (p: WheelPrize) => string}) {
  return (
    <svg className="wheel-face-svg" viewBox="0 0 300 300" aria-hidden>
      {WHEEL.map((w, i) => {
        const a0 = i * STEP - STEP / 2;
        const a1 = i * STEP + STEP / 2;
        const l = look(w.prize);
        return (
          <g key={i}>
            <path d={`M150 150 L${pt(138, a0)} A138 138 0 0 1 ${pt(138, a1)} Z`} fill={l.color} stroke="#fff" strokeOpacity={0.55} strokeWidth={1.5} />
            <path d={`M150 150 L${pt(138, a0)} A138 138 0 0 1 ${pt(138, a1)} Z`} fill="#fff" opacity={i % 2 ? 0.1 : 0} />
            <g transform={`rotate(${i * STEP} 150 150)`} style={{color: "#fff"}}>
              <g transform="translate(135 28)"><Icon name={l.icon} size={30} /></g>
              <text x={150} y={80} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff" stroke="#000" strokeOpacity={0.35} strokeWidth={0.6} paintOrder="stroke">{short(w.prize)}</text>
            </g>
          </g>
        );
      })}
      <circle cx={150} cy={150} r={138} fill="none" stroke="#0f172a" strokeOpacity={0.35} strokeWidth={3} />
    </svg>
  );
}

/** The things that don't turn: the rim with its blinking lights, the pointer. */
function WheelFrame({ticking, spinning}: {ticking: boolean; spinning: boolean}) {
  return (
    <svg className={spinning ? "wheel-frame spinning" : "wheel-frame"} viewBox="0 0 300 300" aria-hidden>
      <circle cx={150} cy={150} r={146} fill="none" stroke="#facc15" strokeWidth={9} />
      <circle cx={150} cy={150} r={146} fill="none" stroke="#a16207" strokeWidth={9} strokeOpacity={0.35} strokeDasharray="1 3" />
      {Array.from({length: 24}, (_, k) => (
        <circle key={k} className={k % 2 ? "wheel-bulb b" : "wheel-bulb a"} cx={150 + 146 * Math.sin((k * 15 * Math.PI) / 180)} cy={150 - 146 * Math.cos((k * 15 * Math.PI) / 180)} r={3.4} />
      ))}
      <g className={ticking ? "wheel-pointer tick" : "wheel-pointer"}>
        <path d="M150 34 L137 4 Q150 -4 163 4 Z" fill="#ef4444" stroke="#fff" strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx={150} cy={12} r={3} fill="#fff" />
      </g>
    </svg>
  );
}

/** A small card for the overview: the day's spin, ready or used. */
export function LuckyWheelCard() {
  const {t} = useT();
  const game = useGameState();
  const [open, setOpen] = useState(false);
  const status = wheelStatus(game, today());
  const ready = status.free || status.video;
  return (
    <>
      {/* All spun for today: folded up to a line, to open again if wanted. */}
      {!ready && !open ? (
        <Card title={<><Icon name="dice" size={18} /> {iconize(t("wheel.title"))} <span className="daily-tick">✓</span></>} className="wheel-card daily-folded" actions={<button className="btn small" onClick={() => setOpen(true)}>{iconize(t("wheel.look"))}</button>}>
          <p className="muted small">{iconize(t("wheel.done"))}</p>
        </Card>
      ) : (
      <Card title={<><Icon name="dice" size={18} /> {iconize(t("wheel.title"))}</>} className="wheel-card">
        <div className="wheel-card-body">
          <div className={ready ? "wheel-mini ready" : "wheel-mini"}><WheelFace short={() => ""} /></div>
          <div className="wheel-card-text">
            <p>{iconize(t(status.free ? "wheel.ready" : status.video ? "wheel.videoReady" : "wheel.done"))}</p>
            <button className={status.free ? "btn primary wheel-open" : "btn wheel-open"} onClick={() => setOpen(true)}>{iconize(t(ready ? "wheel.open" : "wheel.look"))}</button>
          </div>
        </div>
      </Card>
      )}
      {open && <WheelDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function WheelDialog({onClose}: {onClose: () => void}) {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [result, setResult] = useState<WheelResult | null>(null);
  const [won, setWon] = useState(false);
  const [watching, setWatching] = useState(false);
  const [reveal, setReveal] = useState<{id: string; pack: PlayerPackId} | null>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const prizeRef = useRef<HTMLDivElement>(null);
  const status = wheelStatus(game, today());
  // Back to the wheel after a win (the dialog stays open, so the extra spin for a video can be seen).
  const again = () => {
    setResult(null);
    setWon(false);
  };

  const short = (p: WheelPrize) => (p.kind === "money" ? compact(p.amount) : p.kind === "diamonds" ? String(p.amount) : p.kind === "pack" ? t(`pack.${p.pack}`) : t(p.gold ? "wheel.short.goldKit" : "wheel.short.kit"));
  const name = (p: WheelPrize) => (p.kind === "money" ? money(p.amount) : p.kind === "diamonds" ? t("wheel.prize.diamonds", {n: p.amount}) : p.kind === "pack" ? t("wheel.prize.pack", {pack: t(`pack.${p.pack}`)}) : t(p.gold ? "wheel.prize.goldKit" : "wheel.prize.kit"));

  // While it turns: a click each time a wedge's edge passes the pointer (read from the wheel's turn on screen).
  useEffect(() => {
    if (!spinning) return;
    let raf = 0;
    let last = -1;
    let tickOff = 0;
    const loop = () => {
      const el = faceRef.current;
      if (el) {
        const m = getComputedStyle(el).transform;
        const v = m && m !== "none" ? m.match(/matrix\(([^)]+)\)/)?.[1].split(",").map(Number) : undefined;
        if (v) {
          const deg = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
          const edge = Math.floor((deg + 360 + STEP / 2) / STEP);
          if (last !== -1 && edge !== last) {
            try { wheelTick(); } catch { /* no sound */ }
            setTicking(true);
            clearTimeout(tickOff);
            tickOff = window.setTimeout(() => setTicking(false), 90);
          }
          last = edge;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tickOff);
    };
  }, [spinning]);

  const spin = (video: boolean) => {
    if (spinning || result) return;
    const res = act((g, rng) => spinWheel(g, rng, today(), video));
    if ("error" in res) return notify(res.error, undefined, "error");
    // Whole turns, then to the wedge under the pointer (a little off the middle, so it looks like luck).
    const jitter = (Math.random() - 0.5) * (STEP - 8);
    setRotation((r) => Math.ceil(r / 360) * 360 + 360 * 6 - res.index * STEP + jitter);
    setResult(res);
    setSpinning(true);
    window.setTimeout(() => {
      setSpinning(false);
      setWon(true);
    }, SPIN_MS + 150);
  };

  // The win: fanfare, flash, confetti, and the prize flying to where it goes.
  const winKey = won && result ? WHEEL[result.index].weight : 99;
  const big = won && winKey <= 4;
  useEffect(() => {
    if (!won || !result) return;
    try { fanfare(big); } catch { /* no sound */ }
    screenFlash(big ? "#fde047" : "#7dd3fc");
    confettiBurst(big ? 160 : 70);
    const timer = window.setTimeout(() => {
      const p = result.prize;
      if (p.kind === "money") moneyBurst(prizeRef.current, money(p.amount), big ? 16 : 9);
      else if (p.kind === "diamonds") diamondBurst(prizeRef.current, p.amount);
      else if (result.diamonds) diamondBurst(prizeRef.current, result.diamonds);
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const prize = result?.prize;
  const l = prize ? look(prize) : null;
  return (
    <>
    <Modal compact title={<><Icon name="dice" size={20} /> {iconize(t("wheel.title"))} <Hint inline>{iconize(t("wheel.hint"))}</Hint></>} onClose={() => !spinning && onClose()} backdropCloses={!spinning}>
      <div className={big ? "wheel-stage shake" : "wheel-stage"}>
        <div className="wheel-box">
          <div ref={faceRef} className="wheel-face" style={{transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.62, 0.06, 1)` : "none"}}>
            <WheelFace short={short} />
          </div>
          <WheelFrame ticking={ticking} spinning={spinning} />
          {!result && (
            <button className={status.free || status.video ? "wheel-hub ready" : "wheel-hub"} disabled={spinning || (!status.free && !status.video)} onClick={() => (status.free ? spin(false) : setWatching(true))}>
              {!status.free && status.video && <Icon name="video" size={18} />} {iconize(t("wheel.spin"))}
            </button>
          )}
          {won && prize && l && (
            <div className={big ? "wheel-win big" : "wheel-win"} role="status">
              <div className="wheel-rays" aria-hidden />
              <div className="wheel-win-body">
                <div className="wheel-win-title">{iconize(t(big ? "wheel.jackpot" : "wheel.win"))}</div>
                <div ref={prizeRef} className="wheel-win-prize">
                  {result?.gear && prize.kind === "kit" ? <GearCard item={result.gear} small /> : <span style={{color: l.color}}><Icon name={l.icon} size={64} /></span>}
                </div>
                <div className="wheel-win-name">{name(prize)}</div>
                {result?.diamonds ? <p className="muted small">{iconize(t("wheel.full", {n: result.diamonds}))}</p> : null}
                {prize.kind === "pack" && result?.gear && <p className="small">{iconize(t("wheel.bonusKit"))}</p>}
                <div className="btn-row">
                  {result?.playerId && <button className="btn primary" onClick={() => setReveal({id: result.playerId!, pack: (prize as {pack: PlayerPackId}).pack})}>{iconize(t("wheel.openPack"))}</button>}
                  <button className={result?.playerId ? "btn" : "btn primary"} onClick={again}>{iconize(t("wheel.great"))}</button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* The line under the wheel always takes its room, so the dialog never changes height while the wheel turns (the page would jump). */}
        <p className="muted small wheel-note">{result ? "" : iconize(t(status.free ? "wheel.tap" : status.video ? "wheel.videoNote" : "wheel.done"))}</p>
      </div>
      {reveal && <PackReveal playerId={reveal.id} pack={reveal.pack} onClose={() => { setReveal(null); again(); }} />}
    </Modal>
    {/* The advert covers the whole screen, on top of the dialog (not inside it, where it could not be closed). */}
    {watching && <VideoAd onReward={() => { setWatching(false); spin(true); }} onClose={() => setWatching(false)} />}
    </>
  );
}

export type { TKey };

/** On the first visit of a new day the wheel opens by itself (once a day, and not during the guide or a match). */
export function DailyWheelPopup() {
  const game = useGameState();
  const [open, setOpen] = useState(false);
  const day = today();
  const guideOn = !!game.tutorial && game.tutorial.step < TUTORIAL_STEPS.length;
  const canShow = wheelStatus(game, day).free && !guideOn && !game.liveMatch && !game.gameOver;
  useEffect(() => {
    if (!canShow || open) return;
    let seen = "";
    try { seen = localStorage.getItem("manager2d.wheelShown") ?? ""; } catch { /* private window */ }
    if (seen === day) return;
    try { localStorage.setItem("manager2d.wheelShown", day); } catch { /* only this visit */ }
    // A moment after the game has drawn itself.
    const timer = window.setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, [canShow, open, day]);
  return open ? <WheelDialog onClose={() => setOpen(false)} /> : null;
}
