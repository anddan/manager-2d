// The transfer market: scouting, bids, loans, AI clubs buying and selling.
import {
  BID_EXPIRY_WEEKS,
  DIAMONDS_SCOUT_COST,
  SALE_TO_BUDGET_SHARE,
  SCOUT_COST,
  SEASON_WEEKS,
  SQUAD_MAX,
  SQUAD_MIN,
  SQUAD_TEMPLATE,
} from "./constants";
import {interest} from "./contracts";
import {assignRoles} from "./generate";
import {addMessage, book, newId, playerName} from "./helpers";
import {clubPlayers, clubStrength, expectedWage, overall, wageBill} from "./ratings";
import {Rng, clamp} from "./rng";
import {POSITIONS, type Club, type GameState, type IncomingBid, type Player, type Position} from "./types";

/** The user knows their own players and the ones they've scouted. */
export function isKnown(state: GameState, p: Player): boolean {
  return p.clubId === state.userClubId || state.scouted[p.id] !== undefined;
}

/** Fuzzy overall shown for unscouted players: a stable range around the truth. */
export function estimatedOverall(state: GameState, p: Player): {low: number; high: number} {
  const ovr = overall(p);
  if (isKnown(state, p)) return {low: ovr, high: ovr};
  const hash = [...p.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const spread = 3 + (hash % 4);
  const shift = (hash % 5) - 2;
  return {low: clamp(ovr - spread + shift, 1, 99), high: clamp(ovr + spread + shift, 1, 99)};
}

/** Scouting costs money and takes a week, or diamonds for an instant report. */
export function scoutPlayer(state: GameState, playerId: string, instant: boolean): string | null {
  if (state.scouted[playerId] !== undefined) return "tr.alreadyScouted";
  if (instant) {
    if (state.monetization.diamonds < DIAMONDS_SCOUT_COST) return "shop.notEnoughDiamonds";
    state.monetization.diamonds -= DIAMONDS_SCOUT_COST;
    state.scouted[playerId] = state.absWeek;
    return null;
  }
  if (state.scoutQueue.includes(playerId)) return "tr.alreadyScouting";
  book(state, state.userClubId, "scouting", -SCOUT_COST);
  state.scoutQueue.push(playerId);
  return null;
}

function rankInClub(state: GameState, p: Player): number {
  if (!p.clubId) return 99;
  return clubPlayers(state, p.clubId).filter((o) => overall(o) > overall(p)).length;
}

/** What the owning club wants for a player. Free agents cost nothing. */
export function askingPrice(state: GameState, p: Player): number {
  if (!p.clubId) return 0;
  const club = state.clubs[p.clubId];
  const rank = rankInClub(state, p);
  let price = p.value * (rank < 11 ? 1.4 : rank < 17 ? 1.15 : 1);
  const yearsLeft = p.contract.expiresSeason - state.season;
  if (yearsLeft <= 0) price *= 0.6;
  else if (yearsLeft === 1) price *= 0.85;
  if (club.cash < 1_000_000) price *= 0.85;
  if (p.wantsToLeave) price *= 0.85;
  if (p.transferListed) price *= 0.9;
  return Math.round(price / 10_000) * 10_000;
}

function positionCount(state: GameState, clubId: string, pos: Position): number {
  return clubPlayers(state, clubId).filter((p) => p.position === pos).length;
}

export interface BidTerms {
  playerId: string;
  fee: number;
  /** Share paid now, the rest spread over `installmentWeeks`. */
  upfrontShare: number;
  installmentWeeks: number;
}

export type BidResult =
  | {status: "accepted"}
  | {status: "counter"; fee: number}
  | {status: "rejected"; reason: string};

/** An AI club judges a bid. `round` counts earlier counters on this player. */
export function evaluateBid(state: GameState, terms: BidTerms, round: number): BidResult {
  const p = state.players[terms.playerId];
  if (!p.clubId) return {status: "accepted"};
  const club = state.clubs[p.clubId];
  if (p.contract.releaseClause !== null && terms.fee >= p.contract.releaseClause && terms.upfrontShare >= 1) {
    return {status: "accepted"};
  }
  const asking = askingPrice(state, p);
  // Money later is worth less than money now.
  const deferred = terms.fee * (1 - terms.upfrontShare);
  const value = terms.fee * terms.upfrontShare + deferred * (terms.installmentWeeks > 26 ? 0.8 : 0.9);
  const ratio = value / Math.max(asking, 1);
  // Selling the last cover at a position needs a premium.
  const thin = positionCount(state, club.id, p.position) <= Math.ceil(SQUAD_TEMPLATE[p.position] / 2);
  const needed = thin ? 1.3 : 1;
  if (ratio >= needed) return {status: "accepted"};
  if (ratio < 0.7 * needed || round >= 3) return {status: "rejected", reason: round >= 3 ? "tr.reject.done" : "tr.reject.low"};
  // They come down a bit each round.
  return {status: "counter", fee: Math.round((asking * needed * (1 - 0.04 * round)) / 10_000) * 10_000};
}

/** Moves a player and the money. Contract terms are set by the caller. */
export function completeTransfer(
  state: GameState,
  playerId: string,
  toClubId: string,
  fee: number,
  upfrontShare = 1,
  installmentWeeks = 0
): void {
  const p = state.players[playerId];
  const fromId = p.clubId;
  const upfront = Math.round(fee * upfrontShare);
  const rest = fee - upfront;
  book(state, toClubId, "transfers", -upfront);
  state.clubs[toClubId].transferBudget -= fee;
  if (fromId) {
    book(state, fromId, "sales", upfront);
    state.clubs[fromId].transferBudget += Math.round(fee * SALE_TO_BUDGET_SHARE);
    if (rest > 0 && installmentWeeks > 0) {
      state.clubs[toClubId].installments.push({
        toClubId: fromId,
        amount: Math.round(rest / installmentWeeks),
        weeksLeft: installmentWeeks,
      });
    }
  }
  p.clubId = toClubId;
  p.loan = null;
  p.transferListed = false;
  p.loanListed = false;
  p.wantsToLeave = false;
  p.rejectedTransferWeeks = 0;
  p.brokenPromises = 0;
  p.recentStarts = [];
  p.happiness = clamp(Math.max(p.happiness, 60) + 10, 0, 100);
  p.relation = 50;
  p.individualFocus = null;
  state.incomingBids = state.incomingBids.filter((b) => b.playerId !== playerId);
  state.promises = state.promises.filter((pr) => pr.playerId !== playerId);
  for (const id of [fromId, toClubId]) {
    if (!id) continue;
    const club = state.clubs[id];
    club.lineup = club.lineup.map((pid) => (pid === playerId ? "" : pid));
    club.bench = club.bench.filter((pid) => pid !== playerId);
  }
  if (toClubId === state.userClubId) state.scouted[playerId] = state.absWeek;
  if (fromId === state.userClubId || toClubId === state.userClubId) {
    addMessage(state, {
      kind: "transfer",
      key: fromId === state.userClubId ? "msg.playerSold" : "msg.playerBought",
      params: {
        name: playerName(state, playerId),
        club: state.clubs[fromId === state.userClubId ? toClubId : fromId ?? toClubId]?.name ?? "",
        fee,
      },
      action: {type: "player", playerId},
    });
  } else if (fee >= 1_500_000) {
    addMessage(state, {
      kind: "news",
      key: "msg.bigTransfer",
      params: {name: playerName(state, playerId), from: fromId ? state.clubs[fromId].name : "", to: state.clubs[toClubId].name, fee},
    });
  }
}

/** Loans run to the end of the season. */
export function completeLoan(state: GameState, playerId: string, toClubId: string, wageShare: number): void {
  const p = state.players[playerId];
  const parent = p.clubId!;
  p.loan = {parentClubId: parent, wageShare};
  p.clubId = toClubId;
  p.loanListed = false;
  p.transferListed = false;
  p.recentStarts = [];
  state.incomingBids = state.incomingBids.filter((b) => b.playerId !== playerId);
  for (const id of [parent, toClubId]) {
    const club = state.clubs[id];
    club.lineup = club.lineup.map((pid) => (pid === playerId ? "" : pid));
    club.bench = club.bench.filter((pid) => pid !== playerId);
  }
  if (toClubId === state.userClubId) state.scouted[playerId] = state.absWeek;
  if (parent === state.userClubId || toClubId === state.userClubId) {
    addMessage(state, {
      kind: "transfer",
      key: parent === state.userClubId ? "msg.loanedOut" : "msg.loanedIn",
      params: {name: playerName(state, playerId), club: state.clubs[parent === state.userClubId ? toClubId : parent].name},
      action: {type: "player", playerId},
    });
  }
}

/** Clubs lend players who don't play and want most of the wage covered. */
export function evaluateLoanRequest(state: GameState, playerId: string, wageShare: number): boolean {
  const p = state.players[playerId];
  if (!p.clubId || p.loan) return false;
  return rankInClub(state, p) >= 14 && wageShare >= 0.5;
}

/** The user answers an AI club's bid on one of their players. */
export function respondToBid(
  state: GameState,
  rng: Rng,
  bidId: string,
  action: "accept" | "reject" | "counter",
  counterFee = 0
): string {
  const bid = state.incomingBids.find((b) => b.id === bidId);
  if (!bid) return "tr.bidGone";
  const p = state.players[bid.playerId];
  const buyer = state.clubs[bid.fromClubId];
  const user = state.clubs[state.userClubId];
  const resolve = () => {
    state.incomingBids = state.incomingBids.filter((b) => b.id !== bidId);
    for (const m of state.inbox) if (m.action?.type === "incomingBid" && m.action.bidId === bidId) m.resolved = true;
  };

  if (action === "accept") {
    resolve();
    if (bid.loan) {
      completeLoan(state, p.id, buyer.id, bid.wageShare);
      return "tr.loanDone";
    }
    const willing = buyer.reputation >= user.reputation - 10 || p.wantsToLeave || p.happiness < 50 || rng.chance(0.5);
    if (!willing) {
      addMessage(state, {kind: "transfer", key: "msg.playerRefusedMove", params: {name: playerName(state, p.id), club: buyer.name}});
      return "tr.playerRefused";
    }
    aiSignTerms(state, p);
    completeTransfer(state, p.id, buyer.id, bid.fee);
    return "tr.sold";
  }

  if (action === "reject") {
    resolve();
    // Turning down a bigger club annoys a player who wants to go.
    if (!bid.loan && (p.wantsToLeave || (buyer.reputation > user.reputation + 5 && bid.fee >= p.value))) {
      p.rejectedTransferWeeks = 8;
      p.happiness = clamp(p.happiness - 10, 0, 100);
      addMessage(state, {kind: "player", key: "msg.upsetRejectedBid", params: {name: playerName(state, p.id), club: buyer.name}, action: {type: "player", playerId: p.id}});
    }
    return "tr.rejected";
  }

  // Counter: they pay up to their own valuation if the budget allows.
  const max = Math.min(p.value * 1.35, buyer.transferBudget);
  if (counterFee <= max) {
    bid.fee = counterFee;
    return respondToBid(state, rng, bidId, "accept");
  }
  if (bid.rounds >= 2) {
    resolve();
    addMessage(state, {kind: "transfer", key: "msg.bidWithdrawn", params: {club: buyer.name, name: playerName(state, p.id)}});
    return "tr.withdrawn";
  }
  bid.rounds++;
  bid.fee = Math.round(((bid.fee + Math.min(counterFee, max)) / 2) / 10_000) * 10_000;
  bid.expiresWeek = state.absWeek + BID_EXPIRY_WEEKS;
  return "tr.newOffer";
}

/** AI-to-AI and free agent signings get a straightforward contract. */
function aiSignTerms(state: GameState, p: Player): void {
  const wage = expectedWage(p) * (1 + interest(p) * 0.2);
  p.contract = {
    ...p.contract,
    wage: Math.round(wage / 50) * 50,
    expiresSeason: state.season + (p.age < 28 ? 3 : 1),
    releaseClause: null,
  };
}

function biggestNeed(state: GameState, club: Club): Position {
  const squad = clubPlayers(state, club.id);
  let need: Position = "CM";
  let worst = Infinity;
  for (const pos of POSITIONS) {
    const players = squad.filter((p) => p.position === pos);
    const best = players.length ? Math.max(...players.map(overall)) : 0;
    // Missing bodies count most, then a weak best option.
    const score = (players.length - SQUAD_TEMPLATE[pos]) * 10 + best;
    if (score < worst) {
      worst = score;
      need = pos;
    }
  }
  return need;
}

function canAffordWage(state: GameState, club: Club, wage: number): boolean {
  return wageBill(state, club.id) + wage <= club.wageBudget * 1.02;
}

/** Weekly market: scouting reports, AI deals, bids for the user's players. */
export function weeklyTransfers(state: GameState, rng: Rng): void {
  // Scouting reports land a week after they're ordered.
  for (const id of state.scoutQueue) {
    state.scouted[id] = state.absWeek;
    addMessage(state, {kind: "transfer", key: "msg.scoutReport", params: {name: playerName(state, id)}, action: {type: "player", playerId: id}});
  }
  state.scoutQueue = [];

  // Bids the user left unanswered lapse.
  for (const bid of state.incomingBids) {
    if (bid.expiresWeek <= state.absWeek) {
      for (const m of state.inbox) if (m.action?.type === "incomingBid" && m.action.bidId === bid.id) m.resolved = true;
    }
  }
  state.incomingBids = state.incomingBids.filter((b) => b.expiresWeek > state.absWeek);

  const players = Object.values(state.players);
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId) continue;
    const squad = clubPlayers(state, club.id);

    // Too many players: release the weakest veteran or reserve.
    if (squad.length > SQUAD_MAX - 2) {
      const surplus = squad.sort((a, b) => overall(a) - b.age / 10 - (overall(b) - a.age / 10))[0];
      if (surplus && !surplus.loan) {
        surplus.clubId = null;
        club.lineup = club.lineup.map((id) => (id === surplus.id ? "" : id));
        club.bench = club.bench.filter((id) => id !== surplus.id);
      }
    }

    // Buy for the biggest need now and then.
    const shopping = squad.length < SQUAD_MIN ? 0.6 : 0.12;
    if (squad.length < SQUAD_MAX && rng.chance(shopping)) {
      const need = biggestNeed(state, club);
      const level = clubStrength(state, club.id);
      const targets = players.filter(
        (p) =>
          p.clubId !== club.id &&
          !p.loan &&
          p.position === need &&
          p.age <= 32 &&
          overall(p) >= level - 4 &&
          overall(p) <= level + 8 &&
          askingPrice(state, p) <= club.transferBudget &&
          canAffordWage(state, club, expectedWage(p))
      );
      if (targets.length > 0) {
        const target = rng.weighted(targets, (p) => Math.max(1, overall(p) - level + 6) * (p.age < 27 ? 1.5 : 1));
        const fee = askingPrice(state, target);
        if (!target.clubId) {
          aiSignTerms(state, target);
          completeTransfer(state, target.id, club.id, 0);
        } else if (target.clubId === state.userClubId) {
          // Not listed? Then they need to tempt the user.
          const offer = target.transferListed ? fee * rng.range(0.85, 1) : fee * rng.range(0.95, 1.25);
          createIncomingBid(state, club.id, target.id, Math.min(offer, club.transferBudget), false, 0);
        } else if (evaluateBid(state, {playerId: target.id, fee, upfrontShare: 1, installmentWeeks: 0}, 0).status === "accepted") {
          aiSignTerms(state, target);
          completeTransfer(state, target.id, club.id, fee);
        }
      }
    }

    // Offers for the user's listed players, if they'd fit in.
    for (const p of players) {
      if (p.clubId !== state.userClubId || p.loan) continue;
      const fits = overall(p) >= clubStrength(state, club.id) - 12;
      if (p.loanListed && fits && rng.chance(0.08)) {
        createIncomingBid(state, club.id, p.id, 0, true, rng.pick([0.5, 0.75, 1]));
      }
      const price = askingPrice(state, p);
      if (p.transferListed && fits && price * 0.8 <= club.transferBudget && rng.chance(0.05)) {
        createIncomingBid(state, club.id, p.id, Math.min(price * rng.range(0.75, 1), club.transferBudget), false, 0);
      }
    }

    // Keep the important players from walking out on a free.
    if (state.week >= SEASON_WEEKS - 8) {
      for (const p of squad) {
        if (p.contract.expiresSeason === state.season && p.contract.role !== "reserve" && p.age < 33 && p.happiness >= 30 && rng.chance(0.3)) {
          const wage = expectedWage(p);
          if (canAffordWage(state, club, wage - p.contract.wage)) {
            p.contract.wage = wage;
            p.contract.expiresSeason = state.season + (p.age < 28 ? 3 : 2);
          }
        }
      }
    }
  }
  for (const club of Object.values(state.clubs)) if (club.id !== state.userClubId) assignRoles(state, club.id);
}

export function createIncomingBid(
  state: GameState,
  fromClubId: string,
  playerId: string,
  fee: number,
  loan: boolean,
  wageShare: number
): void {
  if (state.incomingBids.some((b) => b.playerId === playerId && b.fromClubId === fromClubId)) return;
  const bid: IncomingBid = {
    id: newId(state, "b"),
    fromClubId,
    playerId,
    fee: Math.round(fee / 10_000) * 10_000,
    loan,
    wageShare,
    expiresWeek: state.absWeek + BID_EXPIRY_WEEKS,
    rounds: 0,
  };
  state.incomingBids.push(bid);
  addMessage(state, {
    kind: "transfer",
    key: loan ? "msg.loanOffer" : "msg.incomingBid",
    params: {club: state.clubs[fromClubId].name, name: playerName(state, playerId), fee: bid.fee, share: Math.round(wageShare * 100)},
    action: {type: "incomingBid", bidId: bid.id},
  });
}
