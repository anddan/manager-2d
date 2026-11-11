// Shared game types. The whole save is one GameState object, kept plain
// (no classes, no Maps) so it survives JSON and structuredClone.
import type {Slot} from "./constants";
import type {StadiumState} from "./stadium";
import type {Daily} from "./daily";
import type {Album} from "./album";
import type {Spending} from "./spending";
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
  /** Their shirt number in the club (no two in a club share one). */
  shirt?: number;
  /** The number they want, if they care; not getting it makes them a little unhappy. */
  wantShirt?: number;
  /** The wish has been drawn (so a player who doesn't care isn't drawn again). */
  wishSet?: boolean;
  /** Boots (or a keeper's gloves) worn: a bonus on a couple of attributes while they're on. */
  gear?: GearItem;
  /** Shin guards worn: a bonus, and fewer injuries. */
  shin?: GearItem;
  /** The id their looks are drawn from, when they came from another game (their id here is new). */
  lookId?: string;
  /** Came up through the user's own academy (for the album's rare ones). */
  homegrown?: boolean;
  /** A look the manager picked (skin, hair, beard…); missing means the one the player came with. */
  look?: {skin: string; hair: string; style: string; beard: string; eyes?: string; glasses?: boolean; lashes?: boolean; highlights?: boolean; shape?: string; ears?: string; browStyle?: string; headband?: string};
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
  /** The presents the manager has given them (newest last): shown round their card. */
  gifts?: string[];
  /** Hidden trait 0..100: how well they take criticism and hard training. */
  professionalism: number;
  clubId: string | null;
  contract: Contract;
  injuryWeeks: number;
  /** Marked as a young talent (young, with a long way to their potential): the star on their card turns gold when they get there. */
  talent?: boolean;
  /** What they're injured with (missing in older saves, or when they're not injured). */
  injury?: {kind: string; total: number; source: "match" | "training"};
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

export const SHIRT_PATTERNS = ["solid", "stripes", "hoops", "pinstripes", "checks", "halves", "sash", "yoke", "sleeves", "tonal", "waves", "chevron"] as const;
export type ShirtPattern = (typeof SHIRT_PATTERNS)[number];

export const COLLARS = ["round", "v", "polo", "upolo"] as const;
export type Collar = (typeof COLLARS)[number];
export const SLEEVES = ["short", "rolled", "long", "none"] as const;
export type Sleeves = (typeof SLEEVES)[number];

/** A set of shirt colours and style: the home kit is the club's own fields, the away kit is kept apart. */
export interface Kit {
  color: string;
  color2: string;
  color3?: string;
  pattern?: ShirtPattern;
  collar?: Collar;
  sleeves?: Sleeves;
}

export interface Club {
  id: string;
  name: string;
  short: string;
  color: string;
  color2: string;
  /** A third colour for the collar and cuffs (missing: the detail colour). */
  color3?: string;
  /** The away kit (missing: the home colours turned round). */
  away?: Kit;
  /** How the shirt is patterned, in the club's two colours (missing: plain). */
  pattern?: ShirtPattern;
  /** The shirt's neck (missing: round, a U) and sleeves (missing: short). */
  collar?: Collar;
  sleeves?: Sleeves;
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
  | {minute: number; type: "forza"}
  /** A new formation for the managed team: the players on the pitch are moved to the best places in it. */
  | {minute: number; type: "formation"; formation: FormationId}
  /** Two players on the pitch swap places (`bId` "slot:N": a player takes an empty place, e.g. after a red card, and leaves his own empty). */
  | {minute: number; type: "swap"; aId: string; bId: string}
  /** A player takes another spot on the pitch (a custom formation): x along the pitch from own goal, y across. */
  | {minute: number; type: "place"; playerId: string; x: number; y: number};

export type TouchKind = "kickoff" | "pass" | "dribble" | "tackle" | "setpiece" | "save" | "goal" | "nogoal" | "out" | "goalkick" | "throwin";

/**
 * One touch of the ball for the replay: where the ball goes and who plays it.
 * Coordinates are 0..100 from the home side's view. Older saves only have
 * minute/x/y/possession.
 */
export interface Frame {
  /** On the touch that ends a shot: what kind of chance it was (a header from a cross, a ball in behind, a shot from distance and so on). */
  chance?: "close" | "box" | "cutback" | "through" | "header" | "long";
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
  /** A tackle that is a foul (the one who had the ball goes down; a free kick or a penalty follows). */
  foul?: boolean;
  /** A move with the ball: a spin past a defender (the 3D view plays the spin animation). */
  skill?: "spin";
  /** A pass that is a keeper's throw (by hand, low and short or a long overarm throw); the one in the frame is who it is thrown to. */
  throw?: boolean;
  /** A ball cleared by a defender (booted away): the one in the frame is who gets to it. */
  clear?: boolean;
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
  /** What the chances were worth (expected goals), home and away. */
  xg?: [number, number];
  /** The tick engine's match statistics (home, away): passes, passes that came off, tackles, interceptions, fouls, offsides and corners. */
  stats?: Record<string, [number, number]>;
  lineups: {home: string[]; away: string[]};
  formations: {home: FormationId; away: FormationId};
  /** The slots each side played in (custom formations included). Missing in old saves. */
  slots?: {home: Slot[]; away: Slot[]};
  /** A formation change during the match: from this minute the places (same numbering as the lineup) stand as given. */
  slotChanges?: {minute: number; side: Side; slots: Slot[]}[];
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
  /** Which engine plays the match (missing: the old, minute by minute one). */
  engine?: "minute" | "tick";
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
  | {type: "match"; fixtureId: string}
  | {type: "nationalOffer"; country: string}
  | {type: "ack"};

/** One match of the national team. `what`: "friendly", or "wc.qf" … "ec.final". */
export interface NationalResult {
  season: number;
  week: number;
  opponent: string;
  what: string;
  /** Goals [ours, theirs]. */
  goals: [number, number];
  pens?: [number, number];
  scorers: string[];
}

/** The manager's second job: coach of a country (see national.ts). */
export interface NationalJob {
  country: string;
  since: number;
  formation: FormationId;
  mentality: Mentality;
  /** The eleven the manager has picked (player ids by place, "" for an empty place); missing: the best eleven. */
  lineup?: string[];
  /** A free-form formation (the places dragged about on the pitch), instead of the formation. */
  customSlots?: Slot[];
  results: NationalResult[];
  /** The tournament this season (32 countries: eight groups of four, then the last sixteen, quarter-finals, semi-finals, final). */
  tournament?: {
    comp: "wc" | "ec" | "copa" | "gold" | "afcon" | "asia";
    season: number;
    /** Still in it (false once out, or when it is over). */
    alive: boolean;
    /** The groups (country codes), and each country's table. */
    groups: string[][];
    table: Record<string, {pl: number; gf: number; ga: number; pts: number}>;
    /** The countries still in the knockout, in pairing order (empty during the groups). */
    bracket: string[];
    /** The knockout rounds already played: who met, the goals, and who went on. */
    rounds?: {a: string; b: string; ga: number; gb: number; w: string}[][];
    champion?: string;
    /** Who scored and set up the goals, all through the tournament (every country's players; made-up ones for the countries without a team). */
    stats?: Record<string, {name: string; country: string; pos: string; goals: number; assists: number}>;
    /** The awards when it is over: keys into the stats. */
    awards?: {scorer?: string; assists?: string; player?: string; keeper?: string};
  };
}

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
  /** Lit up so it is not missed (an award for one of ours). */
  highlight?: boolean;
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
  "motm",
  "fines",
  "sales",
  "loan",
  "premium",
  "wages",
  "bonuses",
  "transfers",
  "loanRepay",
  "signing",
  "wheel",
  "reward",
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
  /** Blond highlights in the hair. */
  highlights?: boolean;
  /** The shape of the head (oval, wide, with or without a dimple in the chin; older saves have the older face shapes). */
  shape?: string;
  /** The ears and the brows, chosen on their own (missing: the ones the older face shape had). */
  ears?: string;
  browStyle?: string;
  /** A headband in this colour (missing: none). */
  headband?: string;
  /** Eye colour; missing means brown. */
  eyes?: string;
}

export interface GameState {
  version: number;
  rngState: number;
  managerName: string;
  /** Missing in older saves; a default look is used then. */
  managerLook?: ManagerLook;
  /** The manager's XP and the titles whose present has been given (see manager.ts). Missing in older saves (a rookie). */
  manager?: {xp: number; claimed: number[]};
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
  /** The scouting reports that have been looked at (a player's profile opened); the rest are new. Missing in older saves: all of them count as seen. */
  scoutedSeen?: string[];
  /** Reports cleared from the list (the player stays scouted: his numbers are still known). */
  scoutHidden?: string[];
  scoutQueue: string[];
  /** The wage budget warning last mailed (yellow from 75 % of the budget, red above it); missing when the wages are under 75 %. */
  wageAlert?: "yellow" | "red";
  /** A week with more spent than earned has been mailed (until a week is back under). */
  econAlert?: boolean;
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
  /** The country the manager coaches besides the club, if any. */
  national?: NationalJob;
  /**
   * A national team match being played live. While it lasts the two countries are clubs of their own, `userClubId`
   * is the manager's country, and the match is played like any other; when it ends everything is put back.
   */
  nationalMatch?: {
    /** The manager's real club, to go back to. */
    realClubId: string;
    fixture: CupFixture;
    what: string;
    opponent: string;
    knockout: boolean;
    /** Players made up for a country without a team of its own (removed when the match is over). */
    tempPlayers: string[];
  };
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
  /** The collector's album: presents, kit, packs and trophies had so far. */
  album?: Album;
  /** What has been spent this week, towards the weekly spending package. */
  spending?: Spending;
  /** The lucky wheel: today's spins. */
  wheel?: {day: string; used: number};
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
  celebrations?: ({kind: "league" | "cup"; season: number} | {kind: "tournament"; season: number; comp: "wc" | "ec" | "copa" | "gold" | "afcon" | "asia"; place: 1 | 2 | 3; country: string} | {kind: "award"; season: number; awards: {key: "player" | "keeper" | "talent" | "manager"; playerId?: string; name: string; /** The winner's team, and whether it is ours. */ team?: string; mine?: boolean}[]})[];
  /** Set when the manager is sacked: the game is over. */
  gameOver?: {season: number; week: number; reason: "debt"};
  /** The last few post-match team talks, oldest first: the same words every week wear thin. */
  talkHistory?: string[];
  /** This season's Champions Cup. Missing in old saves until it's set up. */
  cup?: CupState;
}
