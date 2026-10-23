// Shared game types. The whole save is one GameState object, kept plain
// (no classes, no Maps) so it survives JSON and structuredClone.
import type {SetPiece, SetPieceInput, SetPieceOutcome} from "./setpieces";

export const ATTRIBUTES = [
  "pace",
  "passing",
  "finishing",
  "technique",
  "defending",
  "physical",
  "stamina",
  "goalkeeping",
  "vision",
] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export type Attributes = Record<Attribute, number>;

export const POSITIONS = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"] as const;
export type Position = (typeof POSITIONS)[number];

export const SQUAD_ROLES = ["key", "rotation", "reserve", "youth"] as const;
export type SquadRole = (typeof SQUAD_ROLES)[number];

export const MENTALITIES = ["defensive", "balanced", "attacking"] as const;
export type Mentality = (typeof MENTALITIES)[number];

export const TRAINING_FOCUSES = [
  "attack",
  "defense",
  "passing",
  "physical",
  "conditioning",
  "technique",
  "goalkeeping",
  "recovery",
] as const;
export type TrainingFocus = (typeof TRAINING_FOCUSES)[number];

export const INTENSITIES = ["light", "normal", "hard"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export interface Contract {
  /** Weekly wage. */
  wage: number;
  /** The contract runs out at the end of this season. */
  expiresSeason: number;
  signingBonus: number;
  goalBonus: number;
  appearanceBonus: number;
  releaseClause: number | null;
  role: SquadRole;
}

export interface PlayerStats {
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  ratingSum: number;
}

export interface Loan {
  parentClubId: string;
  /** Share of the wage the borrowing club pays, 0..1. */
  wageShare: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  nationality: string;
  position: Position;
  attrs: Attributes;
  potential: number;
  /** 0..100, 50 is neutral. Follows recent match ratings. */
  form: number;
  /** Physical condition 0..100. */
  fitness: number;
  /** Short-term mood 0..100, moves with results. */
  morale: number;
  /** Match sharpness 0..100, rises with minutes played. */
  sharpness: number;
  /** Long-term satisfaction 0..100. */
  happiness: number;
  /** Relationship with the manager 0..100. */
  relation: number;
  /** Hidden trait 0..100: how well they take criticism and hard training. */
  professionalism: number;
  clubId: string | null;
  contract: Contract;
  injuryWeeks: number;
  suspension: number;
  yellowCount: number;
  stats: PlayerStats;
  value: number;
  /** Did they start each of the club's last matches? Newest last, max 5. */
  recentStarts: boolean[];
  /** Attribute changes from last week's training and ageing. */
  weeklyChange: Partial<Attributes>;
  seasonStartAttrs: Attributes;
  transferListed: boolean;
  loanListed: boolean;
  wantsToLeave: boolean;
  /** Weeks of resentment left after a rejected transfer. */
  rejectedTransferWeeks: number;
  /** Broken promises still weighing on them. */
  brokenPromises: number;
  lastTalkWeek: number;
  lastComplaintWeek: number;
  loan: Loan | null;
  individualFocus: Attribute | null;
}

export interface Installment {
  /** Who receives it. */
  toClubId: string;
  amount: number;
  weeksLeft: number;
}

export interface Club {
  id: string;
  name: string;
  short: string;
  color: string;
  color2: string;
  reputation: number;
  capacity: number;
  ticketPrice: number;
  facilities: number;
  cash: number;
  transferBudget: number;
  /** Max total weekly wages. */
  wageBudget: number;
  sponsorWeekly: number;
  formation: FormationId;
  mentality: Mentality;
  /** Player ids in formation slot order (11). */
  lineup: string[];
  bench: string[];
  installments: Installment[];
}

export const FORMATION_IDS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-5-1"] as const;
export type FormationId = (typeof FORMATION_IDS)[number];

export interface Fixture {
  id: string;
  round: number;
  homeId: string;
  awayId: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
}

export type Side = "home" | "away";

export type MatchEventType =
  | "kickoff"
  | "goal"
  | "saved"
  | "missed"
  | "penalty"
  | "freekick"
  | "blocked"
  | "yellow"
  | "red"
  | "injury"
  | "sub"
  | "halftime"
  | "fulltime";

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  side?: Side;
  playerId?: string;
  /** Assist for goals, incoming player for subs. */
  otherId?: string;
}

export type TouchKind = "kickoff" | "pass" | "dribble" | "tackle" | "setpiece" | "save" | "goal" | "out";

/**
 * One touch of the ball for the replay: where the ball goes and who plays it.
 * Coordinates are 0..100 from the home side's view. Older saves only have
 * minute/x/y/possession.
 */
export interface Frame {
  minute: number;
  x: number;
  y: number;
  possession: Side;
  playerId?: string;
  kind?: TouchKind;
}

export interface MatchReport {
  fixtureId: string;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  frames: Frame[];
  ratings: Record<string, number>;
  possessionHome: number;
  shots: [number, number];
  onTarget: [number, number];
  lineups: {home: string[]; away: string[]};
  formations: {home: FormationId; away: FormationId};
  /** Penalties and free kicks, with where the ball went. Missing in old saves. */
  setPieces?: (SetPiece & SetPieceOutcome)[];
}

/** The user's match while it's being played live. */
export interface LiveMatchState {
  fixtureId: string;
  seed: number;
  /** The user's choices at set pieces, by set-piece index. */
  inputs: Record<number, SetPieceInput>;
}

export interface PlayingTimePromise {
  id: string;
  playerId: string;
  /** User matches left before it's judged. */
  matchesLeft: number;
  requiredStarts: number;
  starts: number;
}

export type MessageKind = "news" | "player" | "transfer" | "finance" | "match";

export type MessageAction =
  | {type: "player"; playerId: string}
  | {type: "incomingBid"; bidId: string}
  | {type: "transferRequest"; playerId: string}
  | {type: "contract"; playerId: string}
  | {type: "match"; fixtureId: string};

export interface Message {
  id: string;
  absWeek: number;
  kind: MessageKind;
  /** i18n key, rendered in the current language. */
  key: string;
  params: Record<string, string | number>;
  read: boolean;
  action?: MessageAction;
  /** Set once an action like accepting a bid is done. */
  resolved?: boolean;
}

export interface IncomingBid {
  id: string;
  fromClubId: string;
  playerId: string;
  fee: number;
  loan: boolean;
  /** For loans: share of wage they pay. */
  wageShare: number;
  expiresWeek: number;
  rounds: number;
}

export const FINANCE_CATEGORIES = [
  "tickets",
  "sponsor",
  "prize",
  "sales",
  "premium",
  "wages",
  "bonuses",
  "transfers",
  "signing",
  "scouting",
  "operations",
] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];
export type FinanceLines = Partial<Record<FinanceCategory, number>>;

export interface FinanceReport {
  season: number;
  week: number;
  lines: FinanceLines;
}

export interface Monetization {
  energy: number;
  /** Timestamp the next energy point counts from. */
  energyAt: number;
  diamonds: number;
  exchangesThisSeason: number;
  extraTrainingsThisWeek: number;
  lastDailyBonus: string;
}

export interface SeasonHistory {
  season: number;
  championId: string;
  userPosition: number;
}

export interface GameState {
  version: number;
  rngState: number;
  managerName: string;
  userClubId: string;
  leagueName: string;
  season: number;
  /** Week within the season, 1-based. */
  week: number;
  /** Weeks since the game started; used for timers. */
  absWeek: number;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  fixtures: Fixture[];
  /** Player id -> absWeek they were scouted. */
  scouted: Record<string, number>;
  scoutQueue: string[];
  inbox: Message[];
  promises: PlayingTimePromise[];
  incomingBids: IncomingBid[];
  reports: MatchReport[];
  finance: {
    weeks: FinanceReport[];
    season: FinanceLines;
    current: FinanceLines;
  };
  training: {focus: TrainingFocus; intensity: Intensity};
  monetization: Monetization;
  history: SeasonHistory[];
  nextId: number;
  /** Set between starting a match week and finishing it. Missing in old saves. */
  liveMatch?: LiveMatchState | null;
}
