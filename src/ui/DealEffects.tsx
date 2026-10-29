// Buying and selling, shown wherever it happens: when a deal brings money in (a player sold, a loan),
// the coins fly to the club's money; when one costs (a player bought, kit, building, a pack paid
// in diamonds), the sum drops out of its counter. It watches the money booked for deals and the
// diamonds rather than each button, so nothing is missed; the week's own bookings (wages,
// tickets…) get none, and rewards with an effect of their own aren't shown twice.
import {useEffect, useRef} from "react";
import type {FinanceCategory, GameState} from "../game/types";
import {useT} from "../i18n";
import {useGame} from "../store";
import {diamondBurst, moneyBurst, rewardShownLately, spendBurst, spendShownLately} from "./effects";

/** The finance lines that are deals the manager makes. */
const DEALS: FinanceCategory[] = ["sales", "transfers", "signing", "equipment", "construction", "premium", "loan", "scouting"];

function dealTotal(game: GameState): number {
  return DEALS.reduce((n, c) => n + (game.finance.current[c] ?? 0), 0);
}

export function DealEffects() {
  const game = useGame((s) => s.game);
  const {money} = useT();
  const last = useRef<{week: number; club: string; deals: number; diamonds: number; energy: number} | null>(null);
  // What was pressed last (and when): the deal's effect starts there.
  const pressed = useRef<{el: Element; at: number} | null>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest("button, [role=button], a");
      if (el) pressed.current = {el, at: Date.now()};
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, []);
  useEffect(() => {
    if (!game) {
      last.current = null;
      return;
    }
    const now = {week: game.absWeek, club: game.userClubId, deals: dealTotal(game), diamonds: game.monetization.diamonds, energy: game.monetization.energy};
    const before = last.current;
    last.current = now;
    // A new week (its books start afresh) or a new game: nothing to show.
    if (!before || before.week !== now.week || before.club !== now.club) return;
    const at = pressed.current && Date.now() - pressed.current.at < 3000 ? pressed.current.el : null;
    const change = now.deals - before.deals;
    // Money or diamonds that came in with their own effect just now (a task, a prize) aren't shown twice.
    const shown = rewardShownLately();
    if (change > 0 && !shown) moneyBurst(at, money(change));
    else if (change < 0) spendBurst("money", money(-change), at);
    if (now.diamonds < before.diamonds) spendBurst("diamonds", String(before.diamonds - now.diamonds), at);
    // Diamonds coming in from something pressed just now (a diamond pack bought, kit sold back).
    else if (now.diamonds > before.diamonds && at && !shown) diamondBurst(at, now.diamonds - before.diamonds);
    // Energy: spent on something pressed (an extra session, a match, Forza!), or got from a video or a
    // refill. (It also comes back by itself over time: that, with nothing pressed, shows nothing.)
    if (now.energy < before.energy && !spendShownLately()) spendBurst("energy", String(before.energy - now.energy), at);
    // (Energy coming in has its own effect where it's given: a video, a refill. It also trickles in by itself, and that must not look like a reward.)
  }, [game, money]);
  return null;
}
