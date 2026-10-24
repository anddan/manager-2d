// Balance knobs in one place. Tune here, not inside the systems.
import type {FormationId, Position} from "./types";

export const SAVE_VERSION = 1;

// League and season
export const LEAGUE_SIZE = 14;
export const ROUNDS = (LEAGUE_SIZE - 1) * 2;
export const PRESEASON_WEEKS = 2;
/** Champions Cup weeks (round of 16, quarters, semis, final), about every month and a half; no league games then. */
export const CUP_WEEKS = [8, 14, 20, 26];
export const SEASON_WEEKS = PRESEASON_WEEKS + ROUNDS + CUP_WEEKS.length;
export const FIRST_SEASON = 2026;
export const SQUAD_MIN = 18;
export const SQUAD_MAX = 30;
export const MAX_SUBS = 5;
export const BENCH_SIZE = 7;

// Prize money by final position (index 0 = champion)
export const PRIZE_MONEY = [
  4_500_000, 3_500_000, 2_800_000, 2_300_000, 1_900_000, 1_600_000, 1_400_000,
  1_200_000, 1_050_000, 900_000, 800_000, 700_000, 600_000, 500_000,
];

// Champions Cup: 16 clubs, knockout. Your league sends its top four.
export const CUP_SIZE = 16;
export const CUP_FROM_LEAGUE = 4;
/** Paid for each round won (index = stage won: round of 16, quarters, semis, final). */
export const CUP_PRIZE = [1_000_000, 1_600_000, 2_500_000, 4_000_000];
/** Just for taking part. */
export const CUP_ENTRY = 800_000;
export const CUP_DIAMONDS = 60;

// Training
export const TRAINING_BASE_GAIN = 0.42;
export const NATURAL_GAIN_SHARE = 0.25;
export const TRAINING_INJURY_CHANCE = 0.005;

// Transfers
export const SCOUT_COST = 15_000;
export const SALE_TO_BUDGET_SHARE = 0.7;
export const BID_EXPIRY_WEEKS = 2;

// Monetization: energy for matches and extra training, diamonds as premium currency.
export const ENERGY_MAX = 5;
/** One ⚡ back every 9 min 59 s. */
export const ENERGY_REGEN_MS = (9 * 60 + 59) * 1000;
export const ENERGY_COST_MATCH = 1;
export const ENERGY_COST_EXTRA_TRAINING = 1;
export const MAX_EXTRA_TRAININGS = 2;
export const DIAMONDS_START = 30;
export const DIAMONDS_REFILL_COST = 10;
export const DIAMONDS_SCOUT_COST = 3;
export const DIAMONDS_DAILY_BONUS = 5;
export const DIAMONDS_PER_WIN = 1;
/** Season-end diamonds by final position bucket. */
export const DIAMONDS_SEASON = {champion: 40, top3: 20, rest: 8};
/** Swap diamonds for club money, capped per season so money can't buy everything. */
export const EXCHANGE = {diamonds: 50, money: 1_000_000, maxPerSeason: 3};
/** Real-money packs. Only a mock checkout exists; see monetization.ts. */
export const DIAMOND_PACKS = [
  {id: "small", diamonds: 80, bonus: 0, priceEur: 0.99},
  {id: "medium", diamonds: 500, bonus: 50, priceEur: 4.99},
  {id: "large", diamonds: 1200, bonus: 200, priceEur: 9.99},
] as const;
/** Real-money packs of club money; it goes to the cash and the transfer budget. Same mock checkout. */
export const MONEY_PACKS = [
  {id: "cash-small", money: 500_000, bonus: 0, priceEur: 0.99},
  {id: "cash-medium", money: 3_000_000, bonus: 300_000, priceEur: 4.99},
  {id: "cash-large", money: 7_500_000, bonus: 1_500_000, priceEur: 9.99},
] as const;

// Formations: slot positions and where they stand (x along pitch 0..100 own goal -> opponent, y 0..100).
export interface Slot {
  pos: Position;
  x: number;
  y: number;
}

export const FORMATIONS: Record<FormationId, Slot[]> = {
  "4-4-2": [
    {pos: "GK", x: 5, y: 50},
    {pos: "FB", x: 22, y: 12}, {pos: "CB", x: 20, y: 37}, {pos: "CB", x: 20, y: 63}, {pos: "FB", x: 22, y: 88},
    {pos: "W", x: 48, y: 12}, {pos: "CM", x: 45, y: 38}, {pos: "CM", x: 45, y: 62}, {pos: "W", x: 48, y: 88},
    {pos: "ST", x: 72, y: 40}, {pos: "ST", x: 72, y: 60},
  ],
  "4-3-3": [
    {pos: "GK", x: 5, y: 50},
    {pos: "FB", x: 22, y: 12}, {pos: "CB", x: 20, y: 37}, {pos: "CB", x: 20, y: 63}, {pos: "FB", x: 22, y: 88},
    {pos: "DM", x: 38, y: 50}, {pos: "CM", x: 48, y: 30}, {pos: "CM", x: 48, y: 70},
    {pos: "W", x: 70, y: 15}, {pos: "ST", x: 75, y: 50}, {pos: "W", x: 70, y: 85},
  ],
  "4-2-3-1": [
    {pos: "GK", x: 5, y: 50},
    {pos: "FB", x: 22, y: 12}, {pos: "CB", x: 20, y: 37}, {pos: "CB", x: 20, y: 63}, {pos: "FB", x: 22, y: 88},
    {pos: "DM", x: 38, y: 38}, {pos: "DM", x: 38, y: 62},
    {pos: "W", x: 60, y: 15}, {pos: "AM", x: 58, y: 50}, {pos: "W", x: 60, y: 85},
    {pos: "ST", x: 76, y: 50},
  ],
  "3-5-2": [
    {pos: "GK", x: 5, y: 50},
    {pos: "CB", x: 20, y: 25}, {pos: "CB", x: 18, y: 50}, {pos: "CB", x: 20, y: 75},
    {pos: "FB", x: 45, y: 8}, {pos: "DM", x: 38, y: 50}, {pos: "CM", x: 48, y: 32}, {pos: "CM", x: 48, y: 68}, {pos: "FB", x: 45, y: 92},
    {pos: "ST", x: 72, y: 40}, {pos: "ST", x: 72, y: 60},
  ],
  "5-3-2": [
    {pos: "GK", x: 5, y: 50},
    {pos: "FB", x: 25, y: 8}, {pos: "CB", x: 18, y: 30}, {pos: "CB", x: 17, y: 50}, {pos: "CB", x: 18, y: 70}, {pos: "FB", x: 25, y: 92},
    {pos: "CM", x: 45, y: 30}, {pos: "DM", x: 40, y: 50}, {pos: "CM", x: 45, y: 70},
    {pos: "ST", x: 70, y: 40}, {pos: "ST", x: 70, y: 60},
  ],
  "4-5-1": [
    {pos: "GK", x: 5, y: 50},
    {pos: "FB", x: 22, y: 12}, {pos: "CB", x: 20, y: 37}, {pos: "CB", x: 20, y: 63}, {pos: "FB", x: 22, y: 88},
    {pos: "W", x: 50, y: 12}, {pos: "CM", x: 45, y: 35}, {pos: "DM", x: 38, y: 50}, {pos: "CM", x: 45, y: 65}, {pos: "W", x: 50, y: 88},
    {pos: "ST", x: 74, y: 50},
  ],
};

/** Ideal squad make-up used when generating clubs and judging needs. */
export const SQUAD_TEMPLATE: Record<Position, number> = {
  GK: 3, CB: 4, FB: 4, DM: 2, CM: 3, AM: 2, W: 3, ST: 3,
};
