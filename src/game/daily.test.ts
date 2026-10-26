// Daily tasks and rewarded videos.
import {describe, expect, it} from "vitest";
import {ENERGY_VIDEOS_PER_DAY, TASKS, TASKS_PER_DAY, WIN_VIDEO_DIAMONDS, claimDailyBonus, claimTask, dailyToCollect, dayBefore, ensureDaily, streakPack, taskProgress, videoAfterWin, videoForEnergy} from "./daily";
import {newGame} from "./generate";
import {Rng} from "./rng";

describe("daily tasks", () => {
  it("counts the rewards waiting to be collected, the bonus once all tasks are", () => {
    const g = newGame("Daily", 3, 4);
    const daily = ensureDaily(g, "2026-10-26");
    expect(dailyToCollect(daily)).toBe(0);
    for (const t of daily.tasks) taskProgress(g, t.kind, TASKS[t.kind].target);
    expect(dailyToCollect(daily)).toBe(daily.tasks.length);
    daily.tasks.forEach((_, i) => claimTask(g, i));
    expect(dailyToCollect(daily)).toBe(1);
    claimDailyBonus(g, new Rng(1));
    expect(dailyToCollect(daily)).toBe(0);
  });

  it("gives three different tasks a day, the same all day, new the next", () => {
    const g = newGame("Daily", 3, 4);
    const a = ensureDaily(g, "2026-10-24").tasks.map((t) => t.kind);
    expect(new Set(a).size).toBe(TASKS_PER_DAY);
    expect(ensureDaily(g, "2026-10-24").tasks.map((t) => t.kind)).toEqual(a);
    const days = ["2026-10-25", "2026-10-26", "2026-10-27"].map((d) => ensureDaily(g, d).tasks.map((t) => t.kind).join());
    expect(new Set([a.join(), ...days]).size).toBeGreaterThan(1);
  });

  it("pays a finished task once, and the bonus pack when all three are collected", () => {
    const g = newGame("Daily", 3, 4);
    for (const p of Object.values(g.players).filter((x) => x.clubId === g.userClubId).slice(0, 2)) p.clubId = null;
    const daily = ensureDaily(g, "2026-10-24");
    const start = g.monetization.diamonds;
    expect(claimTask(g, 0)).toBe(0); // Not done yet.
    expect(claimDailyBonus(g, new Rng(1))).toEqual({error: "daily.notYet"});
    let earned = 0;
    for (const [i, task] of daily.tasks.entries()) {
      taskProgress(g, task.kind, TASKS[task.kind].target);
      earned += claimTask(g, i);
      expect(claimTask(g, i)).toBe(0); // Only once.
    }
    expect(g.monetization.diamonds).toBe(start + earned);
    const bonus = claimDailyBonus(g, new Rng(1));
    expect("playerId" in bonus).toBe(true);
    // The pack was free.
    expect(g.monetization.diamonds).toBe(start + earned);
    expect(claimDailyBonus(g, new Rng(1))).toEqual({error: "daily.notYet"});
  });
});

describe("rewarded videos", () => {
  it("gives an energy point a few times a day", () => {
    const g = newGame("Video", 3, 4);
    g.monetization.energy = 0;
    const now = Date.now();
    g.monetization.energyAt = now;
    for (let i = 0; i < ENERGY_VIDEOS_PER_DAY; i++) expect(videoForEnergy(g, "2026-10-24", now)).toBeNull();
    expect(g.monetization.energy).toBe(ENERGY_VIDEOS_PER_DAY);
    expect(videoForEnergy(g, "2026-10-24", now)).toBe("video.limit");
    // A new day, new videos.
    expect(videoForEnergy(g, "2026-10-25", now)).toBeNull();
  });

  it("gives bonus diamonds once per won match", () => {
    const g = newGame("Video", 3, 4);
    const start = g.monetization.diamonds;
    expect(videoAfterWin(g, "2026-10-24", "f1")).toBeNull();
    expect(videoAfterWin(g, "2026-10-24", "f1")).toBe("video.done");
    expect(g.monetization.diamonds).toBe(start + WIN_VIDEO_DIAMONDS);
  });
});

describe("daily streak", () => {
  it("counts days in a row, starts again after a missed day, and upgrades the pack sometimes", () => {
    const g = newGame("Streak", 3, 4);
    for (const p of Object.values(g.players).filter((x) => x.clubId === g.userClubId).slice(0, 8)) p.clubId = null;
    const finishDay = (day: string, seed: number) => {
      const daily = ensureDaily(g, day);
      daily.tasks.forEach((t, i) => { taskProgress(g, t.kind, TASKS[t.kind].target); claimTask(g, i); });
      return claimDailyBonus(g, new Rng(seed));
    };
    expect(finishDay("2026-10-01", 1)).toMatchObject({streak: 1, pack: "bronze"});
    expect(finishDay("2026-10-02", 1)).toMatchObject({streak: 2});
    expect(finishDay("2026-10-04", 1)).toMatchObject({streak: 1}); // Missed the 3rd.
    expect(dayBefore("2026-11-01")).toBe("2026-10-31");
    // Long streaks: better packs now and then, never before their day count.
    const counts: Record<string, number> = {};
    for (let s = 1; s <= 400; s++) { const p = streakPack(new Rng(s), 30); counts[p] = (counts[p] ?? 0) + 1; }
    expect(counts.special).toBeGreaterThan(10);
    expect(counts.bronze).toBeGreaterThan(200);
    for (let s = 1; s <= 200; s++) expect(streakPack(new Rng(s), 6)).toBe("bronze");
  });
});
