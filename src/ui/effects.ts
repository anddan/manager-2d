// Little reward effects, drawn straight into the page (no state to keep).
import {chime} from "./sound";

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
  rewardBurst(from, `+${amount}`, DIAMOND_SVG, ".hud-diamonds", Math.min(10, 3 + Math.floor(amount / 3)), "");
}

/** Money earned: the same, with coins flying to the club's money in the top bar. `label` is the sum, written out. */
export function moneyBurst(from: Element | null | undefined, label: string): void {
  rewardBurst(from, `+${label}`, COINS_SVG, ".hud-cash", 8, " coins");
}

function rewardBurst(from: Element | null | undefined, label: string, icon: string, target: string, count: number, kind: string): void {
  if (typeof document === "undefined") return;
  chime();
  const start = from?.getBoundingClientRect();
  const sx = start ? start.left + start.width / 2 : window.innerWidth / 2;
  const sy = start ? start.top + start.height / 2 : window.innerHeight / 2;
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

/** Energy spent: "−N" with a bolt rises from where it was spent and fades. */
export function energySpent(from: Element | null | undefined, amount: number): void {
  if (typeof document === "undefined" || amount <= 0) return;
  const start = from?.getBoundingClientRect();
  const text = document.createElement("div");
  text.className = "burst-text energy";
  text.innerHTML = `−${amount} ${BOLT_SVG}`;
  text.style.left = `${start ? start.left + start.width / 2 : window.innerWidth / 2}px`;
  text.style.top = `${start ? start.top : window.innerHeight / 2}px`;
  document.body.appendChild(text);
  text.addEventListener("animationend", () => text.remove());
}
