// Shared game types. The whole save is one GameState object, kept plain
// (no classes, no Maps) so it survives JSON and structuredClone.
import type {Slot} from "./constants";
import type {StadiumState} from "./stadium";
import type {Daily} from "./daily";
import type {Tutorial} from "./tutorial";
import type {BankLoan} from "./loans";
import type {GearItem} from "./gear";
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

/** A player sold to (or looked at from) a friend, as listed: the price, and who they are at a glance. */
export interface FriendSaleEntry {
  name: string;
  price: number;
  currency?: "money" | "diamonds";
  ovr?: number;
  pos?: Position;
  nat?: string;
  /** The kit they come with. */
  gear?: GearItem;
  shin?: GearItem;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  /** What the manager calls them; shown instead of their name everywhere but their profile. */
  nickname?: string;
  /** Boots (or a keeper's gloves) worn: a bonus on a couple of attributes while they're on. */
  gear?: GearItem;
  /** Shin guards worn: a bonus, and fewer injuries. */
  shin?: GearItem;
  /** The id their looks are drawn from, when they came from another game (their id here is new). */
  lookId?: string;
  /** A look the manager picked (skin, hair, beard…); missing means the one the player came with. */
  look?: {skin: string; hair: string; style: string; beard: string; eyes?: string; glasses?: boolean; lashes?: boolean};
  age: number;
  /** "f" for women; missing means a man (older saves only had men). */
  gender?: "f";
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
  /** Extra work on one attribute, or "rest": a light week of recovery for this player alone. */
  individualFocus: Attribute | "rest" | null;
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
  /** The price is set for each home match (to fill the ground at the best price), moved by `ticketAdjust` percent. */
  ticketAuto?: boolean;
  /** The user's stadium, once it's been opened (see stadium.ts). */
  stadium?: StadiumState;
  ticketAdjust?: number;
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
  /** A bank loan being paid back (the user's club only). */
  loan?: BankLoan;
  /** Captain and set-piece takers; the best on the pitch steps in when they're off. Missing in old saves. */
  roles?: TeamRoles;
  /** The real name, when the manager has given the club a nickname (then `name` is the nickname). */
  officialName?: string;
  /** The manager's own positions (a custom formation); missing for a standard one. */
  customSlots?: Slot[];
  /** A club from another league, here only for the Champions Cup: not in the table, the market or the money. */
  guest?: true;
  /** For a guest club: the league it's from (flag). */
  country?: string;
}

export const TEAM_ROLES = ["captain", "penalties", "freekicks", "corners"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export type TeamRoles = Partial<Record<TeamRole, string>>;

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
  /** The crowd, and what their tickets brought the home side (once played). */
  attendance?: number;
  gate?: number;
}

/** A Champions Cup tie: one match, penalties if it's level. */
export interface CupFixture extends Fixture {
  /** 0–2 the group matchdays, 3 quarter-finals, 4 semi-finals, 5 the final. */
  stage: number;
  /** Group stage: which group (0 = A). */
  group?: number;
  /** Knockout: place in the bracket, top to bottom (winners of 0 and 1 meet next, and so on). */
  slot?: number;
  /** Shoot-out score, when it was level after the match. */
  penalties?: [number, number];
  winnerId?: string;
}

export interface CupState {
  season: number;
  /** Who's in it this season, user's league first. */
  clubIds: string[];
  /** The four groups of four (A–D). */
  groups: string[][];
  fixtures: CupFixture[];
  winnerId?: string;
}

export type Side = "home" | "away";

export type MatchEventType =
  | "kickoff"
  | "goal"
  | "saved"
  | "missed"
  | "penalty"
  | "freekick"
  | "corner"
  | "blocked"
  | "cleared"
  | "instruction"
  | "yellow"
  | "red"
  | "injury"
  | "sub"
  | "halftime"
  | "disallowed"
  | "fulltime";

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  side?: Side;
  playerId?: string;
  /** Assist for goals, incoming player for subs. */
  otherId?: string;
  /** Instructions: which one and which way, e.g. "shooting+". */
  note?: string;
}

/** Instructions the manager can shout to a player during a match. */
export const INSTRUCTIONS = ["passing", "dribbling", "shooting", "tackling", "position"] as const;
export type InstructionKey = (typeof INSTRUCTIONS)[number];
/** -1 less, 0 as normal, 1 more. */
export type InstructionLevel = -1 | 0 | 1;
export type Instructions = Partial<Record<InstructionKey, InstructionLevel>>;

/** Something the manager did during a live match, applied from `minute` on. */
export type MatchCommand =
  | {minute: number; type: "sub"; outId: string; inId: string}
  | {minute: number; type: "instruct"; playerId: string; key: InstructionKey; level: InstructionLevel}
  /** The same instruction for everyone on the pitch, overriding their own. */
  | {minute: number; type: "instructTeam"; key: InstructionKey; level: InstructionLevel}
  /** "Forza!": the manager fires up the whole team (free once a match, then paid for with energy). */
  | {minute: number; type: "forza"};

export type TouchKind = "kickoff" | "pass" | "dribble" | "tackle" | "setpiece" | "save" | "goal" | "nogoal" | "out" | "goalkick" | "throwin";

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
  /** How a pass travels: into space (through), a long ball or a cross (both in the air). Plain passes go to feet. */
  flight?: "through" | "long" | "cross";
  /** A tackle won with a slide (drawn stretched out at the ball). */
  slide?: boolean;
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
  /** The slots each side played in (custom formations included). Missing in old saves. */
  slots?: {home: Slot[]; away: Slot[]};
  /** The crowd (worked out before kick-off) and the home side's ticket money. Missing in old saves. */
  crowd?: {fans: number; rate: number; capacity: number; gate: number};
  /** Penalties and free kicks, with where the ball went. Missing in old saves. */
  setPieces?: (SetPiece & SetPieceOutcome)[];
  /**
   * Added time at the end of each half, in minutes. Match minutes in events and
   * frames run on without a break (the second half starts at 46 + first half's
   * added time); see clock.ts. Missing in old saves, which had none.
   */
  added?: [number, number];
}

/** The user's match while it's being played live. */
export interface LiveMatchState {
  fixtureId: string;
  seed: number;
  /** The user's choices at set pieces, by set-piece index. */
  inputs: Record<number, SetPieceInput>;
  /** Substitutions and instructions, in order. Missing in older saves. */
  commands?: MatchCommand[];
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
  "matchday",
  "sponsor",
  "prize",
  "sales",
  "loan",
  "premium",
  "wages",
  "bonuses",
  "transfers",
  "loanRepay",
  "signing",
  "scouting",
  "equipment",
  "operations",
  "construction",
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
  /** How far the user got in the Champions Cup: 0 round of 16 … 3 final, 4 won. Missing if not in it. */
  cup?: number;
}

export const PLAYERS_GENDERS = ["men", "women", "mix"] as const;
export type PlayersGender = (typeof PLAYERS_GENDERS)[number];

/** How the manager looks. Same shape as a player's look, plus the suit. */
export interface ManagerLook {
  skin: string;
  hair: string;
  style: string;
  beard: string;
  glasses: boolean;
  suit: string;
  /** Eyelashes and softer brows. Missing in older saves. */
  lashes?: boolean;
  /** Eye colour; missing means brown. */
  eyes?: string;
}

export interface GameState {
  version: number;
  rngState: number;
  managerName: string;
  /** Missing in older saves; a default look is used then. */
  managerLook?: ManagerLook;
  /** Who plays in the league: men, women or mixed teams. Missing in older saves (men). */
  playersGender?: PlayersGender;
  userClubId: string;
  leagueName: string;
  /** Which league (see leagues.ts); missing in older saves, which are Fantasiligan. */
  leagueId?: string;
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
  /** `auto`: the assistant plans each week (see trainingPlan); focus and intensity are the manager's own choice otherwise. */
  training: {focus: TrainingFocus; intensity: Intensity; auto?: boolean};
  monetization: Monetization;
  history: SeasonHistory[];
  nextId: number;
  /** Set between starting a match week and finishing it. Missing in old saves. */
  liveMatch?: LiveMatchState | null;
  /** The board's patience with debts: weeks in a row in the red, and warnings given. Missing in old saves. */
  board?: {debtWeeks: number; warnings: number};
  /** A board warning just given, shown as a pop-up until the manager has read it. */
  boardAlert?: {n: number; max: number; cash: number};
  /** Days in a row with all daily tasks done (and the last such day). */
  dailyStreak?: {count: number; lastDay: string};
  /** The guide for new players. Missing when it isn't running (old saves). */
  tutorial?: Tutorial;
  /** Today's tasks and videos watched. Missing in old saves. */
  daily?: Daily;
  /** A diamond pack opened but no player picked yet: the four to choose from (free agents until then). */
  packChoice?: string[];
  /** Boots and gloves bought and not worn by anyone. */
  gearBag?: GearItem[];
  /** The coach's tips (on easy): which comes next, the week one was last shown, and if they're off. */
  coachTips?: {next?: number; lastWeek?: number; off?: boolean};
  /** Trades with friends (by offer id) already settled here, so none is paid or received twice. */
  friendTrades?: Record<string, true>;
  /** Everything bought in the shop with real money: diamonds and club money got, and what it cost (euros). */
  purchases?: {diamonds: number; money: number; eur: number};
  /** Players put up for sale to a friend with a code (by code), until bought or taken back. */
  friendSales?: Record<string, FriendSaleEntry>;
  /** Friends' players looked at with a code and kept to decide on later (by code). */
  friendLooks?: Record<string, FriendSaleEntry>;
  /** Trophies won and not celebrated yet (shown once, then removed). */
  celebrations?: {kind: "league" | "cup"; season: number}[];
  /** Set when the manager is sacked: the game is over. */
  gameOver?: {season: number; week: number; reason: "debt"};
  /** The last few post-match team talks, oldest first: the same words every week wear thin. */
  talkHistory?: string[];
  /** This season's Champions Cup. Missing in old saves until it's set up. */
  cup?: CupState;
}
