// Today's three tasks, their diamonds, and the bonus pack for doing all three.
import {useState} from "react";
import {STREAK_PACKS, dayBefore, ENERGY_VIDEOS_PER_DAY, TASKS, claimDailyBonus, claimTask, taskDone, taskProgress, videoForEnergy, type TaskKind} from "../game/daily";
import type {PlayerPackId} from "../game/packs";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Card} from "./common";
import {VideoAd} from "./VideoAd";
import {PackReveal} from "./PackReveal";
import {diamondBurst} from "./effects";

const ICONS: Record<TaskKind, string> = {win: "🏆", goals: "⚽", order: "📣", talk: "🗣️", train: "🏋️", pack: "🎁", video: "🎬"};

export const today = () => new Date().toISOString().slice(0, 10);

export function DailyTasks() {
  const {t, tx} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const [watching, setWatching] = useState(false);
  // The bonus pack being opened.
  const [bonusPlayer, setBonusPlayer] = useState<{id: string; pack: PlayerPackId} | null>(null);
  const [open, setOpen] = useState(false);
  const daily = game.daily;
  if (!daily) return null;
  // Today's streak, if it's still alive (done yesterday or today).
  const streak = game.dailyStreak && (game.dailyStreak.lastDay === daily.day || game.dailyStreak.lastDay === dayBefore(daily.day)) ? game.dailyStreak.count : 0;
  const allClaimed = daily.tasks.every((task) => task.claimed);

  const claim = (i: number, from: Element) => {
    const n = act((g) => claimTask(g, i));
    if (n > 0) diamondBurst(from, n);
  };
  const bonus = () => {
    const res = act((g, rng) => claimDailyBonus(g, rng));
    if ("error" in res) return notify(res.error, undefined, "error");
    setBonusPlayer({id: res.playerId, pack: res.pack});
  };
  // The video task is done by watching one: it gives the energy point too, if there's room.
  const watched = () => {
    setWatching(false);
    const err = act((g) => videoForEnergy(g, today(), Date.now()));
    // Energy full or today's energy videos used up: the task still counts.
    if (err) act((g) => taskProgress(g, "video"));
    notify(err ? "toast.videoThanks" : "toast.videoEnergy", undefined, "good");
  };

  // All done for today: folded up behind a tick, to open again if wanted.
  if (daily.bonusClaimed && !open) {
    return (
      <Card title={<>📋 {t("daily.title")}{streak > 0 && <span className="daily-streak">🔥 {t("daily.streak", {n: streak})}</span>} <span className="daily-tick">✓</span></>} className="span-2 daily-folded" actions={<button className="btn small" onClick={() => setOpen(true)}>{t("daily.show")}</button>}>
        <p className="muted small">{t("daily.allDone")}</p>
        {/* The bonus pack just claimed folds the card; its reveal still shows. */}
        {bonusPlayer && <PackReveal playerId={bonusPlayer.id} pack={bonusPlayer.pack} onClose={() => setBonusPlayer(null)} />}
      </Card>
    );
  }

  return (
    <Card
      title={<>📋 {t("daily.title")}{streak > 0 && <span className="daily-streak">🔥 {t("daily.streak", {n: streak})}</span>}{daily.bonusClaimed && <span className="daily-tick">✓</span>}</>}
      className="span-2"
      actions={daily.bonusClaimed ? <button className="btn small" onClick={() => setOpen(false)}>{t("daily.hide")}</button> : undefined}
    >
      <ul className="daily-tasks">
        {daily.tasks.map((task, i) => {
          const goal = TASKS[task.kind];
          const done = taskDone(task);
          return (
            <li key={task.kind} className={task.claimed ? "daily-task claimed" : "daily-task"}>
              <span className="daily-icon" aria-hidden>{ICONS[task.kind]}</span>
              <span className="daily-text">
                {tx(`daily.task.${task.kind}`, {n: goal.target})}
                <span className="daily-bar"><span style={{width: `${(task.progress / goal.target) * 100}%`}} /></span>
                <small className="muted">{task.progress}/{goal.target}</small>
              </span>
              {task.claimed ? (
                <span className="daily-done">✓</span>
              ) : done ? (
                <button className="btn primary small" onClick={(e) => claim(i, e.currentTarget)}>{t("daily.claim", {n: goal.reward})}</button>
              ) : task.kind === "video" ? (
                <button className="btn small" onClick={() => setWatching(true)}>🎬 {t("daily.watch")}</button>
              ) : (
                <span className="daily-reward">💎 {goal.reward}</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="daily-bonus">
        <span>🎁 {daily.bonusClaimed ? t("daily.bonusDone") : t("daily.bonus")}</span>
        {!daily.bonusClaimed && <button className="btn primary small" disabled={!allClaimed} onClick={bonus}>{t("daily.bonusClaim")}</button>}
      </div>
      {/* The streak ladder: what keeping it going can bring, and how far to the next step. */}
      <div className="streak-ladder">
        {[...STREAK_PACKS].reverse().map((s) => (
          <div key={s.pack} className={`streak-step ppack-${s.pack} ${streak >= s.days ? "reached" : ""}`}>
            <strong>{streak >= s.days ? "✓ " : ""}{t("daily.streakDays", {n: s.days})}</strong>
            <span>{t("daily.streakChance", {pct: Math.round(s.chance * 100), pack: t(`pack.${s.pack}`)})}</span>
          </div>
        ))}
      </div>
      {(() => {
        const next = [...STREAK_PACKS].reverse().find((s) => streak < s.days);
        return next ? (
          <p className="streak-next">🔥 {t("daily.streakNext", {n: next.days - streak, pack: t(`pack.${next.pack}`)})}</p>
        ) : (
          <p className="streak-next">🔥 {t("daily.streakMax")}</p>
        );
      })()}
      <p className="muted small">{t("daily.videos", {n: ENERGY_VIDEOS_PER_DAY - daily.energyVideos})}</p>
      {watching && <VideoAd onReward={watched} onClose={() => setWatching(false)} />}
      {bonusPlayer && <PackReveal playerId={bonusPlayer.id} pack={bonusPlayer.pack} onClose={() => setBonusPlayer(null)} />}
    </Card>
  );
}
