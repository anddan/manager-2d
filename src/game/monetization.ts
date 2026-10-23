// Energy and diamonds.
//
// Energy: playing a match week and extra training sessions cost energy.
// One point comes back every 20 minutes, up to the max. Diamonds refill it.
//
// Diamonds: earned by winning, daily logins and season finishes; can also be
// bought. They pay for energy refills, instant scouting and a capped swap
// into club money, so paying speeds you up without buying the league.
//
// Real payments are NOT implemented: `purchasePack` goes through a mock
// provider. On the web you'd plug in Stripe; in the App Store / Google Play
// apps digital goods must use their in-app purchases. Because saves are
// local, real-money balances also need a server before launch.
import {
  DIAMOND_PACKS,
  DIAMONDS_DAILY_BONUS,
  DIAMONDS_REFILL_COST,
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  EXCHANGE,
} from "./constants";
import {book} from "./helpers";
import type {GameState, Monetization} from "./types";

/** Adds energy that has regenerated since `energyAt`. */
export function regenerateEnergy(m: Monetization, now: number): void {
  if (m.energy >= ENERGY_MAX) {
    m.energyAt = now;
    return;
  }
  const gained = Math.floor((now - m.energyAt) / ENERGY_REGEN_MS);
  if (gained <= 0) return;
  m.energy = Math.min(ENERGY_MAX, m.energy + gained);
  m.energyAt = m.energy >= ENERGY_MAX ? now : m.energyAt + gained * ENERGY_REGEN_MS;
}

/** Milliseconds until the next point, or 0 when full. */
export function msToNextEnergy(m: Monetization, now: number): number {
  if (m.energy >= ENERGY_MAX) return 0;
  return Math.max(0, m.energyAt + ENERGY_REGEN_MS - now);
}

export function spendEnergy(m: Monetization, amount: number, now: number): boolean {
  regenerateEnergy(m, now);
  if (m.energy < amount) return false;
  // Start the clock when leaving a full bar.
  if (m.energy >= ENERGY_MAX) m.energyAt = now;
  m.energy -= amount;
  return true;
}

export function refillEnergy(m: Monetization, now: number): string | null {
  regenerateEnergy(m, now);
  if (m.energy >= ENERGY_MAX) return "shop.energyFull";
  if (m.diamonds < DIAMONDS_REFILL_COST) return "shop.notEnoughDiamonds";
  m.diamonds -= DIAMONDS_REFILL_COST;
  m.energy = ENERGY_MAX;
  m.energyAt = now;
  return null;
}

/** Once per calendar day. Returns the diamonds given, 0 if already claimed. */
export function claimDailyBonus(m: Monetization, today: string): number {
  if (m.lastDailyBonus === today) return 0;
  m.lastDailyBonus = today;
  m.diamonds += DIAMONDS_DAILY_BONUS;
  return DIAMONDS_DAILY_BONUS;
}

export function exchangeDiamonds(state: GameState): string | null {
  const m = state.monetization;
  if (m.exchangesThisSeason >= EXCHANGE.maxPerSeason) return "shop.exchangeLimit";
  if (m.diamonds < EXCHANGE.diamonds) return "shop.notEnoughDiamonds";
  m.diamonds -= EXCHANGE.diamonds;
  m.exchangesThisSeason++;
  book(state, state.userClubId, "premium", EXCHANGE.money);
  state.clubs[state.userClubId].transferBudget += EXCHANGE.money;
  return null;
}

export type PackId = (typeof DIAMOND_PACKS)[number]["id"];

/** Where a real checkout would go. The mock approves everything instantly. */
export interface PaymentProvider {
  purchase(packId: PackId, priceEur: number): Promise<{ok: boolean}>;
}

export const mockPaymentProvider: PaymentProvider = {
  async purchase() {
    return {ok: true};
  },
};

export function grantPack(m: Monetization, packId: PackId): number {
  const pack = DIAMOND_PACKS.find((p) => p.id === packId);
  if (!pack) return 0;
  const total = pack.diamonds + pack.bonus;
  m.diamonds += total;
  return total;
}
