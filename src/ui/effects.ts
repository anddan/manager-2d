// Little reward effects, drawn straight into the page (no state to keep).
import {chime, kaching} from "./sound";

/**
 * Diamonds earned: "+N" with a diamond pops up where they were won and a handful of
 * diamonds fly to the diamond count in the top bar (or the top-right corner
 * when it's hidden, on phones), which then gives a pulse.
 */
/** The line icons (as in the menus) drawn in the effects, which are made outside React. */
const DIAMOND_SVG = `<svg class="icon" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 3.5h12l4.5 6.5L12 21.5 1.5 10Z" fill="currentColor"/><path d="M6 3.5h12l4.5 6.5h-21Z" fill="#fff" opacity=".3"/><path d="M1.5 10h21L12 21.5Z" fill="#000" opacity=".18"/><path d="M12 21.5 7.5 10h9Z" fill="#fff" opacity=".2"/><path d="M6 3.5h12l4.5 6.5L12 21.5 1.5 10Z" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".9" stroke-linejoin="round"/><path d="M7.8 5h3.6L9.3 8.6Z" fill="#fff" opacity=".8"/></svg>`;
const COINS_SVG = `<svg class="icon" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">${[15.5, 10.5, 5.5].map((cy) => `<path d="M4 ${cy}v3a8 3.2 0 0 0 16 0v-3Z" fill="currentColor"/><path d="M4 ${cy}v3a8 3.2 0 0 0 16 0v-3Z" fill="#000" opacity=".26"/><ellipse cx="12" cy="${cy}" rx="8" ry="3.2" fill="currentColor"/><ellipse cx="12" cy="${cy}" rx="8" ry="3.2" fill="#fff" opacity=".28"/><ellipse cx="12" cy="${cy}" rx="5.5" ry="2" fill="none" stroke="#000" stroke-opacity=".22" stroke-width=".7"/>`).join("")}</svg>`;
const BOLT_SVG = `<svg class="icon" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M13.5 1.5 4 13.5h6.5L9 22.5l11-13.5h-6.5Z" fill="currentColor"/><path d="M13.5 1.5 4 13.5h6.5l1.8-12Z" fill="#fff" opacity=".34"/><path d="M13.5 9H20L9 22.5l1.5-9h3.5Z" fill="#000" opacity=".2"/><path d="M13.5 1.5 4 13.5h6.5L9 22.5l11-13.5h-6.5Z" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".9" stroke-linejoin="round"/></svg>`;

export function diamondBurst(from: Element | null | undefined, amount: number): void {
  if (amount <= 0) return;
  // One diamond flying for each (up to ten), so a few look like a few.
  rewardBurst(from, `+${amount}`, DIAMOND_SVG, ".hud-diamonds", Math.min(10, amount), "");
}

/** Money earned: the same, with coins flying to the club's money in the top bar. `label` is the sum, written out. */
export function moneyBurst(from: Element | null | undefined, label: string, coins = 8): void {
  rewardBurst(from, `+${label}`, COINS_SVG, ".hud-cash", coins, " coins");
}

/** What was just pressed (the sale's button), so a sale's coins fly from there. */
export function pressedElement(): Element | null {
  return typeof document === "undefined" ? null : document.activeElement;
}

/**
 * Several players sold at once: a big burst of coins (more the more players) and a till that rings
 * once for each, one after the other. (The deals' watcher sees this one has been shown and keeps quiet.)
 */
export function multiSaleBurst(from: Element | null | undefined, label: string, players: number): void {
  moneyBurst(from, label, Math.min(26, 8 + players * 4));
  for (let i = 1; i < players && i < 8; i++) setTimeout(() => { try { kaching(); } catch { /* no sound */ } }, i * 170);
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
  if (kind !== "energy") { try { kaching(); } catch { /* the sound must never stop the picture */ } }
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
// The effects are on to begin with: a device that had them switched off before gets them on once (and can switch them off again).
try {
  if (typeof localStorage !== "undefined" && localStorage.getItem("manager2d.effectsDefault") !== "on") {
    localStorage.setItem("manager2d.effects", "on");
    localStorage.setItem("manager2d.effectsDefault", "on");
  }
} catch {
  // Only for now.
}

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
  try { chime(); } catch { /* the sound must never stop the picture */ }
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

/** Confetti raining over the whole screen (and a few streamers), for a big win. */
export function confettiBurst(pieces = 90): void {
  if (typeof document === "undefined" || !effectsOn()) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const layer = document.createElement("div");
  layer.className = "fx-confetti";
  const colours = ["#fde047", "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#38bdf8", "#4ade80", "#ffffff"];
  for (let i = 0; i < pieces; i++) {
    const bit = document.createElement("span");
    bit.className = i % 5 === 0 ? "fx-piece streamer" : i % 3 === 0 ? "fx-piece round" : "fx-piece";
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colours[i % colours.length];
    bit.style.setProperty("--dx", `${(Math.random() - 0.5) * 220}px`);
    bit.style.setProperty("--rot", `${(Math.random() - 0.5) * 1440}deg`);
    bit.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
    bit.style.animationDelay = `${Math.random() * 0.7}s`;
    layer.appendChild(bit);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 5000);
}

/** A bright flash over the screen that fades (the moment a big prize lands). */
export function screenFlash(colour = "#fde047"): void {
  if (typeof document === "undefined" || !effectsOn()) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const flash = document.createElement("div");
  flash.className = "fx-flash";
  flash.style.background = `radial-gradient(circle at 50% 45%, ${colour}, transparent 70%)`;
  document.body.appendChild(flash);
  flash.addEventListener("animationend", () => flash.remove());
}
