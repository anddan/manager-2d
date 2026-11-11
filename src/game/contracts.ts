// Contract demands and negotiation. Players (via agents) accept, counter or
// walk away depending on quality, age, form, interest and happiness.
import {addMessage, book, playerName} from "./helpers";
import {CONTRACT_XP, addManagerXp} from "./manager";
import {clubPlayers, deservedRole, expectedWage, overall, wageBill} from "./ratings";
import {clamp} from "./rng";
import type {Contract, GameState, Player, SquadRole} from "./types";

export interface ContractOffer {
  wage: number;
  years: number;
  signingBonus: number;
  goalBonus: number;
  appearanceBonus: number;
  releaseClause: number | null;
  role: SquadRole;
}

export type NegotiationKind = "renewal" | "transfer" | "freeAgent";

export interface Negotiation {
  playerId: string;
  clubId: string;
  kind: NegotiationKind;
  demand: ContractOffer;
  round: number;
  /** Transfer fee already agreed with the selling club. */
  fee: number;
  installmentWeeks: number;
  upfrontShare: number;
  loan: {wageShare: number} | null;
}

export type NegotiationResult =
  | {status: "accepted"}
  | {status: "counter"; demand: ContractOffer}
  | {status: "rejected"; reason: string};

const ROLE_RANK: Record<SquadRole, number> = {key: 3, rotation: 2, reserve: 1, youth: 0};

/** How sought-after a player is, 0..1. */
export function interest(p: Player): number {
  return clamp(((overall(p) - 58) / 30) * (0.6 + p.form / 125), 0, 1);
}

function round50(n: number): number {
  return Math.round(n / 50) * 50;
}

/** What the player asks for, or a reason they won't talk. */
export function startNegotiation(
  state: GameState,
  playerId: string,
  clubId: string,
  kind: NegotiationKind,
  fee = 0
): Negotiation | {refused: string} {
  const p = state.players[playerId];
  const club = state.clubs[clubId];
  if (kind === "renewal") {
    if (p.wantsToLeave) return {refused: "neg.refuse.wantsToLeave"};
    if (p.happiness < 30) return {refused: "neg.refuse.unhappy"};
  } else if (p.clubId && !p.wantsToLeave) {
    // A big step down only tempts players who want out.
    if (state.clubs[p.clubId].reputation - club.reputation > 30) return {refused: "neg.refuse.smallClub"};
  }
  // Players ask a little less than what they are worth on paper, so a contract is not a fight every time.
  let wage = expectedWage(p) * DEMAND_EASE * (1 + interest(p) * 0.25) * (0.92 + p.form / 600);
  if (kind === "renewal") {
    if (p.happiness < 50) wage *= 1 + (50 - p.happiness) / 100;
    if (p.happiness > 75) wage *= 0.95;
    // Never ask for less than they earn now.
    wage = Math.max(wage, p.contract.wage);
  } else {
    const from = p.clubId ? state.clubs[p.clubId] : undefined;
    // Stepping down to a smaller club costs extra.
    const gap = from ? from.reputation - club.reputation : 0;
    if (gap > 0) wage *= 1 + gap / 80;
    if (kind === "freeAgent") wage *= 1.05;
  }
  const role = deservedRole(state, {...p, clubId}, club);
  // At least two years until they are well on in years (a one-year contract is up before it has started).
  const years = p.age < 24 ? 4 : p.age < 29 ? 3 : p.age < 36 ? 2 : 1;
  const demand: ContractOffer = {
    wage: round50(wage),
    years,
    signingBonus: round50(wage * (kind === "renewal" ? 4 : 8)),
    goalBonus: ["ST", "W", "AM"].includes(p.position) ? round50(wage * 0.12) : 0,
    appearanceBonus: round50(wage * 0.06),
    releaseClause: null,
    role,
  };
  return {playerId, clubId, kind, demand, round: 0, fee, installmentWeeks: 0, upfrontShare: 1, loan: null};
}

/** Scores an offer against the demand; 1 means it's as good as asked. */
export function offerScore(demand: ContractOffer, offer: ContractOffer): number {
  const ratio = (a: number, b: number, cap: number) => (b <= 0 ? 1 : Math.min(a / b, cap));
  const roleGap = ROLE_RANK[demand.role] - ROLE_RANK[offer.role];
  const role = roleGap <= 0 ? 1 : roleGap === 1 ? 0.75 : 0.4;
  const years = clamp(1 - Math.abs(offer.years - demand.years) * 0.25, 0, 1);
  const bonuses = ratio(offer.goalBonus + offer.appearanceBonus, demand.goalBonus + demand.appearanceBonus, 1.5);
  let score =
    0.6 * ratio(offer.wage, demand.wage, 1.3) +
    0.12 * ratio(offer.signingBonus, demand.signingBonus, 1.5) +
    0.1 * bonuses +
    0.12 * role +
    0.06 * years;
  // A release clause is a way out, players like that.
  if (offer.releaseClause !== null) score *= 1.03;
  return score;
}

/** The parts of an offer that fall short of what the player asks (what the agent won't accept as it is). */
export function offerShortfalls(demand: ContractOffer, offer: ContractOffer): (keyof ContractOffer)[] {
  const bad: (keyof ContractOffer)[] = [];
  if (offer.wage < demand.wage) bad.push("wage");
  if (offer.years !== demand.years) bad.push("years");
  if (offer.signingBonus < demand.signingBonus) bad.push("signingBonus");
  if (offer.goalBonus < demand.goalBonus) bad.push("goalBonus");
  if (offer.appearanceBonus < demand.appearanceBonus) bad.push("appearanceBonus");
  if (ROLE_RANK[offer.role] < ROLE_RANK[demand.role]) bad.push("role");
  return bad;
}

/** How much of the expected wage players ask for (a little under, to make contracts easier). */
const DEMAND_EASE = 0.88;

export function evaluateOffer(state: GameState, neg: Negotiation, offer: ContractOffer): NegotiationResult {
  const p = state.players[neg.playerId];
  const score = offerScore(neg.demand, offer);
  neg.round++;
  // Sought-after players are pickier.
  const accept = 0.97 + interest(p) * 0.03;
  if (score >= accept) return {status: "accepted"};
  if (score < 0.72 || neg.round >= 4) {
    if (neg.kind === "renewal") p.happiness = clamp(p.happiness - 3, 0, 100);
    return {status: "rejected", reason: neg.round >= 4 ? "neg.reject.patience" : "neg.reject.insulting"};
  }
  // The agent gives a little ground on the wage each round.
  const giveWage = neg.demand.wage - (neg.demand.wage - offer.wage) * 0.4;
  neg.demand = {
    ...neg.demand,
    wage: round50(Math.max(giveWage, neg.demand.wage * 0.92)),
    signingBonus: round50(neg.demand.signingBonus * 0.95),
  };
  return {status: "counter", demand: neg.demand};
}

/** Total wages after this deal compared with the budget. */
export function wageBudgetCheck(state: GameState, clubId: string, playerId: string, wage: number) {
  const club = state.clubs[clubId];
  const p = state.players[playerId];
  const current = p.clubId === clubId ? p.contract.wage : 0;
  const after = wageBill(state, clubId) - current + wage;
  return {after, budget: club.wageBudget, over: after > club.wageBudget};
}

/** Applies a signed contract. The transfer fee itself is handled in transfers. */
export function signContract(state: GameState, playerId: string, clubId: string, offer: ContractOffer): void {
  const p = state.players[playerId];
  const contract: Contract = {
    wage: offer.wage,
    expiresSeason: state.season + offer.years - 1,
    signingBonus: offer.signingBonus,
    goalBonus: offer.goalBonus,
    appearanceBonus: offer.appearanceBonus,
    releaseClause: offer.releaseClause,
    role: offer.role,
  };
  p.contract = contract;
  if (offer.signingBonus > 0) book(state, clubId, "signing", -offer.signingBonus);
  if (clubId === state.userClubId) {
    p.happiness = clamp(p.happiness + 8, 0, 100);
    p.relation = clamp(p.relation + 4, 0, 100);
    p.wantsToLeave = false;
    addManagerXp(state, CONTRACT_XP);
    addMessage(state, {
      kind: "player",
      key: "msg.contractSigned",
      params: {name: playerName(state, playerId), wage: offer.wage, years: offer.years},
      action: {type: "player", playerId},
    });
  }
}

/** What the automatic renewal does with one player whose contract runs out this season. */
export interface AutoRenewItem {
  playerId: string;
  /** The new contract (what the player asks for), if it is to be renewed. */
  offer?: ContractOffer;
  /** Why not, if it isn't (an i18n key under con.auto.reason). */
  reason?: "refuses" | "old" | "weak" | "budget" | "cash";
}

/**
 * Works out which expiring contracts to renew, smartly: the most important first (key players, then the best),
 * on what each player asks for (always accepted), while the wage bill stays within the budget and the club can
 * pay the signing bonuses. Players who won't stay, the old and the weak are left to go.
 */
/** `ignoreBudget`: renew even if the contracts break the wage budget (the manager has said so). */
export function autoRenewPlan(state: GameState, ignoreBudget = false): AutoRenewItem[] {
  const club = state.clubs[state.userClubId];
  const squad = clubPlayers(state, club.id);
  const median = squad.map(overall).sort((a, b) => a - b)[Math.floor(squad.length / 2)] ?? 0;
  const expiring = squad
    .filter((p) => p.contract.expiresSeason <= state.season)
    .sort((a, b) => ROLE_RANK[b.contract.role] - ROLE_RANK[a.contract.role] || overall(b) - overall(a));
  let bill = wageBill(state, club.id);
  let cash = club.cash;
  const items: AutoRenewItem[] = [];
  for (const p of expiring) {
    const neg = startNegotiation(state, p.id, club.id, "renewal");
    if ("refused" in neg) {
      items.push({playerId: p.id, reason: "refuses"});
      continue;
    }
    const ovr = overall(p);
    const promising = p.age <= 21 && p.potential - ovr >= 6;
    const worth = promising || ROLE_RANK[p.contract.role] >= 2 || ovr >= median;
    if (p.age >= 34 && p.contract.role !== "key") {
      items.push({playerId: p.id, reason: "old"});
      continue;
    }
    if (!worth) {
      items.push({playerId: p.id, reason: "weak"});
      continue;
    }
    const offer = neg.demand;
    const nextBill = bill - p.contract.wage + offer.wage;
    // The same room the club gives itself when it signs (a little over the budget is let through).
    if (offer.wage > p.contract.wage && nextBill > club.wageBudget * 1.02 && !ignoreBudget) {
      items.push({playerId: p.id, reason: "budget"});
      continue;
    }
    if (offer.signingBonus > cash) {
      items.push({playerId: p.id, reason: "cash"});
      continue;
    }
    bill = nextBill;
    cash -= offer.signingBonus;
    items.push({playerId: p.id, offer});
  }
  return items;
}

/** Renews what the plan says; how many were renewed. */
export function autoRenew(state: GameState, ignoreBudget = false): number {
  let n = 0;
  for (const item of autoRenewPlan(state, ignoreBudget)) {
    if (!item.offer) continue;
    signContract(state, item.playerId, state.userClubId, item.offer);
    n++;
  }
  return n;
}
