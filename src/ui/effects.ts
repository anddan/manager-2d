// Little reward effects, drawn straight into the page (no state to keep).

/**
 * Diamonds earned: "+N 💎" pops up where they were won and a handful of
 * diamonds fly to the diamond count in the top bar (or the top-right corner
 * when it's hidden, on phones), which then gives a pulse.
 */
export function diamondBurst(from: Element | null | undefined, amount: number): void {
  if (typeof document === "undefined" || amount <= 0) return;
  const start = from?.getBoundingClientRect();
  const sx = start ? start.left + start.width / 2 : window.innerWidth / 2;
  const sy = start ? start.top + start.height / 2 : window.innerHeight / 2;
  const counter = document.querySelector<HTMLElement>(".topbar-diamonds");
  const shown = counter && counter.offsetParent !== null ? counter.getBoundingClientRect() : null;
  const tx = shown ? shown.left + shown.width / 2 : window.innerWidth - 36;
  const ty = shown ? shown.top + shown.height / 2 : 28;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const text = document.createElement("div");
  text.className = "burst-text";
  text.textContent = `+${amount} 💎`;
  text.style.left = `${sx}px`;
  text.style.top = `${sy}px`;
  document.body.appendChild(text);
  text.addEventListener("animationend", () => text.remove());

  if (still) return;
  const count = Math.min(10, 3 + Math.floor(amount / 3));
  for (let i = 0; i < count; i++) {
    const gem = document.createElement("div");
    gem.className = "burst-gem";
    gem.textContent = "💎";
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
