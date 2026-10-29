// Little reward effects, drawn straight into the page (no state to keep).
import {chime, kaching} from "./sound";

/**
 * Diamonds earned: "+N" with a diamond pops up where they were won and a handful of
 * diamonds fly to the diamond count in the top bar (or the top-right corner
 * when it's hidden, on phones), which then gives a pulse.
 */
/** The line icons (as in the menus) drawn in the effects, which are made outside React. */
const svg = (paths: string) => `<svg class="icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const DIAMOND_SVG = svg(`<path d="M6 4h12l3 5-9 11L3 9l3-5Z" /><path d="M3 9h18M9 4l3 16M15 4l-3 16" />`);
const COINS_SVG = svg(`<ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />`);
const BOLT_SVG = svg(`<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />`);

export function diamondBurst(from: Element | null | undefined, amount: number): void {
  if (amount <= 0) return;
  // One diamond flying for each (up to ten), so a few look like a few.
  rewardBurst(from, `+${amount}`, DIAMOND_SVG, ".hud-diamonds", Math.min(10, amount), "");
}

/** Money earned: the same, with coins flying to the club's money in the top bar. `label` is the sum, written out. */
export function moneyBurst(from: Element | null | undefined, label: string): void {
  rewardBurst(from, `+${label}`, COINS_SVG, ".hud-cash", 8, " coins");
}

/**
 * Money or diamonds spent: the till rings, "−sum" shows where it was bought (the button pressed, or
 * under the counter), and coins (or diamonds) fly from the counter in the top bar to it.
 */
export function spendBurst(kind: "money" | "diamonds" | "energy", label: string, at?: Element | null): void {
  if (typeof document === "undefined") return;
  // One energy spent is one "−1": a second call for the same spend (the button's and the watcher's) shows nothing more.
  if (kind === "energy" && Date.now() - lastEnergyText < 1500) return;
  if (kind === "energy") lastEnergyText = Date.now();
  lastSpend = Date.now();
  if (!effectsOn()) return;
  // Energy isn't paid for: a whoosh-less burst, the till only for money and diamonds.
  if (kind !== "energy") kaching();
  const counter = document.querySelector<HTMLElement>(kind === "money" ? ".hud-cash" : kind === "diamonds" ? ".hud-diamonds" : ".hud-energy");
  const box = counter && counter.offsetParent !== null ? counter.getBoundingClientRect() : null;
  const sx = box ? box.left + box.width / 2 : window.innerWidth - 60;
  const sy = box ? box.top + box.height / 2 : 40;
  const end = at && document.contains(at) ? at.getBoundingClientRect() : null;
  // Kept inside the window: with the button gone (a dialog closed) the sum would otherwise sit half off the screen by the counter.
  const tx = inView(end ? end.left + end.width / 2 : sx, window.innerWidth);
  const ty = Math.max(70, Math.min(window.innerHeight - 70, end ? end.top + end.height / 2 : sy + 60));
  const icon = kind === "money" ? COINS_SVG : kind === "diamonds" ? DIAMOND_SVG : BOLT_SVG;
  const text = document.createElement("div");
  text.className = kind === "energy" ? "spend-text energy" : "spend-text";
  text.innerHTML = `−${label} ${icon}`;
  text.style.left = `${tx}px`;
  text.style.top = `${ty - 28}px`;
  document.body.appendChild(text);
  text.addEventListener("animationend", () => text.remove());
  // Energy: only the sum by the button (nothing flies from the counter, nothing pulses up there).
  if (kind === "energy" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  // Diamonds: one for each spent (up to ten); money: a handful of coins.
  const count = kind === "money" ? 6 : Math.max(1, Math.min(10, Number(label) || 1));
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("div");
    bit.className = `burst-gem spend-fly ${kind === "money" ? "coins" : ""}`;
    bit.innerHTML = icon;
    bit.style.left = `${sx}px`;
    bit.style.top = `${sy}px`;
    bit.style.setProperty("--sx", `${(i - (count - 1) / 2) * 10}px`);
    bit.style.setProperty("--dx", `${tx - sx}px`);
    bit.style.setProperty("--dy", `${ty - sy}px`);
    bit.style.animationDelay = `${i * 55}ms`;
    document.body.appendChild(bit);
    bit.addEventListener("animationend", () => bit.remove());
  }
  if (counter && box) {
    counter.classList.add("spend-pulse");
    setTimeout(() => counter.classList.remove("spend-pulse"), 600);
  }
}

/** Energy coming in (a video watched, a refill): "+N" and bolts flying to the energy count. */
export function energyBurst(from: Element | null | undefined, amount: number): void {
  if (amount <= 0) return;
  rewardBurst(from, `+${amount}`, BOLT_SVG, ".hud-energy", Math.min(10, amount), " energy");
}

let lastSpend = 0;

/** The flying coins, diamonds and energy can be turned off in the settings. */
export function effectsOn(): boolean {
  try {
    return localStorage.getItem("manager2d.effects") !== "off";
  } catch {
    return true;
  }
}

/** An x position kept clear of both edges (a sum is about 130 px wide). */
function inView(x: number, width: number): number {
  return Math.max(80, Math.min(width - 80, x));
}
let lastEnergyText = 0;
export function spendShownLately(): boolean {
  return Date.now() - lastSpend < 800;
}

/** When a reward was last shown (so the deals' watcher doesn't show the same one again). */
let lastReward = 0;
export function rewardShownLately(): boolean {
  return Date.now() - lastReward < 800;
}

function rewardBurst(from: Element | null | undefined, label: string, icon: string, target: string, count: number, kind: string): void {
  if (typeof document === "undefined") return;
  lastReward = Date.now();
  if (!effectsOn()) return;
  chime();
  // A button gone from the page (its dialog closed) has no place left: the middle of the screen then.
  const start = from && document.contains(from) ? from.getBoundingClientRect() : undefined;
  const sx = inView(start ? start.left + start.width / 2 : window.innerWidth / 2, window.innerWidth);
  const sy = Math.max(70, Math.min(window.innerHeight - 70, start ? start.top + start.height / 2 : window.innerHeight / 2));
  const counter = document.querySelector<HTMLElement>(target);
  const shown = counter && counter.offsetParent !== null ? counter.getBoundingClientRect() : null;
  const tx = shown ? shown.left + shown.width / 2 : window.innerWidth - 36;
  const ty = shown ? shown.top + shown.height / 2 : 28;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const text = document.createElement("div");
  text.className = "burst-text" + kind;
  text.innerHTML = `${label} ${icon}`;
  text.style.left = `${sx}px`;
  text.style.top = `${sy}px`;
  document.body.appendChild(text);
  text.addEventListener("animationend", () => text.remove());

  if (still) return;
  for (let i = 0; i < count; i++) {
    const gem = document.createElement("div");
    gem.className = "burst-gem" + kind;
    gem.innerHTML = icon;
    gem.style.left = `${sx}px`;
    gem.style.top = `${sy}px`;
    // Out in a little fan first, then off to the counter.
    gem.style.setProperty("--sx", `${(i - (count - 1) / 2) * 14}px`);
    gem.style.setProperty("--dx", `${tx - sx}px`);
    gem.style.setProperty("--dy", `${ty - sy}px`);
    gem.style.animationDelay = `${i * 55}ms`;
    document.body.appendChild(gem);
    gem.addEventListener("animationend", () => gem.remove());
  }
  if (counter && shown) {
    setTimeout(() => {
      counter.classList.add("gem-pulse");
      setTimeout(() => counter.classList.remove("gem-pulse"), 600);
    }, 750 + count * 55);
  }
}

/** Energy spent (a match, Forza!, an extra session): bolts fly from the energy count to what was pressed. */
export function energySpent(from: Element | null | undefined, amount: number): void {
  if (amount > 0) spendBurst("energy", String(amount), from);
}
