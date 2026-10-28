// The friends' cup online (Firebase Firestore). A cup is one document (its name, members, the
// order they play in and how many rounds are done); each member's team snapshot is a document
// under it, sent whenever they like; each round played is a document with its results.
//
// No accounts: a device is known by a random id kept in the browser. The cup's creator plays
// the rounds (on their device, from everyone's latest snapshot) and stores the results, so
// everyone reads the same scores.
import {getApps, initializeApp} from "firebase/app";
import {arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, getFirestore, onSnapshot, runTransaction, setDoc, updateDoc, type Firestore} from "firebase/firestore";
import type {Player} from "../game/types";
import {friendFixtures, newCupCode, playFriendRound, snapshotOvr, type FriendPrize, type FriendResult, type TeamSnapshot} from "../game/friendCup";

const CONFIG = {
  apiKey: "AIzaSyD0xd1I1oUjHZu3n-wG7pMH7MlZGaYQ7d4",
  authDomain: "forza-manager.firebaseapp.com",
  projectId: "forza-manager",
  storageBucket: "forza-manager.firebasestorage.app",
  messagingSenderId: "997961071440",
  appId: "1:997961071440:web:5bdaf1ccaef19e06f08a55",
};

function db(): Firestore {
  return getFirestore(getApps()[0] ?? initializeApp(CONFIG));
}

export interface CupMember {
  manager: string;
  club: {name: string; short: string; color: string; color2: string};
  joinedAt: number;
}

export interface FriendCupDoc {
  code: string;
  name: string;
  creator: string;
  createdAt: number;
  members: Record<string, CupMember>;
  /** Set when the cup starts: the members in the order the fixtures are drawn from. */
  order?: string[];
  /** Rounds played so far. */
  round: number;
  seed: number;
  /** Members who have left a started cup (they stay in it, for its fixtures and table). */
  left?: string[];
  /** The prize the winner took, once taken. */
  prizeClaimed?: FriendPrize;
  /** Members who have opened their pack for the finished cup. */
  packsTaken?: Record<string, boolean>;
}

export interface FriendRoundDoc {
  round: number;
  results: FriendResult[];
  playedAt: number;
  /** The round's seed and the teams as they were (JSON), to watch its matches again. */
  seed?: number;
  teams?: string;
}

const DEVICE_KEY = "manager2d.deviceId";
const CUP_KEY = "manager2d.friendCup";
/** Fired when this device joins or leaves a cup, or sees a match (the menu's number follows). */
export const CUP_EVENT = "manager2d.friendCup";

/** This device's id in cups (made up once, kept in the browser). */
let device: string | null = null;
export function deviceId(): string {
  // Kept in memory too: the same id all visit, even where the browser won't store it.
  if (device) return device;
  try {
    device = localStorage.getItem(DEVICE_KEY);
  } catch {
    device = null;
  }
  if (!device) {
    device = `d${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    try {
      localStorage.setItem(DEVICE_KEY, device);
    } catch {
      // Only for this visit then.
    }
  }
  return device;
}

/** The cup this device is in (its code), if any. */
export function myCupCode(): string | null {
  try {
    return localStorage.getItem(CUP_KEY);
  } catch {
    return null;
  }
}
export function setMyCupCode(code: string | null): void {
  try {
    if (code) localStorage.setItem(CUP_KEY, code);
    else localStorage.removeItem(CUP_KEY);
    window.dispatchEvent(new Event(CUP_EVENT));
  } catch {
    // Only for this visit then.
  }
}

/** Makes a new cup with this device in it; returns its code. */
export async function createCup(name: string, me: CupMember): Promise<string> {
  const d = db();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCupCode();
    const ref = doc(d, "cups", code);
    if ((await getDoc(ref)).exists()) continue;
    const cup: FriendCupDoc = {code, name, creator: deviceId(), createdAt: Date.now(), members: {[deviceId()]: me}, round: 0, seed: Math.floor(Math.random() * 2 ** 31)};
    await setDoc(ref, cup);
    return code;
  }
  throw new Error("friends.err.busy");
}

/** Joins a cup by its code (not once it has started). */
export async function joinCup(code: string, me: CupMember): Promise<void> {
  const ref = doc(db(), "cups", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("friends.err.noCup");
  const cup = snap.data() as FriendCupDoc;
  if (cup.order && !cup.members[deviceId()]) throw new Error("friends.err.started");
  await updateDoc(ref, {[`members.${deviceId()}`]: me});
}

/** Sends (or replaces) this device's team for the coming rounds. */
export async function sendTeam(code: string, team: TeamSnapshot): Promise<void> {
  await setDoc(doc(db(), "cups", code, "teams", deviceId()), {json: JSON.stringify(team), sentAt: Date.now()});
}

/**
 * The winner takes their prize: marked on the cup first (only once, whichever device asks), so
 * it can't be taken twice. Returns false if it was already taken.
 */
export async function claimPrize(code: string, kind: FriendPrize): Promise<boolean> {
  const ref = doc(db(), "cups", code);
  return runTransaction(db(), async (tx) => {
    const cup = (await tx.get(ref)).data() as FriendCupDoc | undefined;
    if (!cup || cup.prizeClaimed) return false;
    tx.update(ref, {prizeClaimed: kind});
    return true;
  });
}

/** This member takes their pack for the finished cup (only once). Returns false if already taken. */
export async function claimPack(code: string): Promise<boolean> {
  const ref = doc(db(), "cups", code);
  const me = deviceId();
  return runTransaction(db(), async (tx) => {
    const cup = (await tx.get(ref)).data() as FriendCupDoc | undefined;
    if (!cup?.members[me] || cup.packsTaken?.[me]) return false;
    tx.update(ref, {[`packsTaken.${me}`]: true});
    return true;
  });
}

/** A member's team as they last sent it (null if not sent). */
export async function fetchTeam(code: string, member: string): Promise<TeamSnapshot | null> {
  const snap = await getDoc(doc(db(), "cups", code, "teams", member));
  return snap.exists() ? (JSON.parse((snap.data() as {json: string}).json) as TeamSnapshot) : null;
}

/** The creator starts the cup: the order everyone plays in is fixed. */
export async function startCup(cup: FriendCupDoc): Promise<void> {
  const ids = Object.keys(cup.members).sort((a, b) => cup.members[a].joinedAt - cup.members[b].joinedAt);
  await updateDoc(doc(db(), "cups", cup.code), {order: ids, round: 0});
}

/** The creator plays the next round from everyone's latest team, and stores the results. */
export async function playNextRound(cup: FriendCupDoc): Promise<FriendResult[]> {
  const order = cup.order ?? [];
  const rounds = friendFixtures(order);
  if (cup.round >= rounds.length) throw new Error("friends.err.done");
  const teamDocs = await getDocs(collection(db(), "cups", cup.code, "teams"));
  const teams: Record<string, TeamSnapshot> = {};
  teamDocs.forEach((t) => {
    try {
      teams[t.id] = JSON.parse((t.data() as {json: string}).json) as TeamSnapshot;
    } catch {
      // A broken team plays as not sent.
    }
  });
  const seed = (cup.seed + cup.round * 104729) >>> 0;
  const results = playFriendRound(rounds[cup.round], teams, seed);
  // The teams that played, as they were: anyone can watch the round's matches again.
  const playing = Object.fromEntries(rounds[cup.round].flat().filter((id) => teams[id]).map((id) => [id, teams[id]]));
  const round: FriendRoundDoc = {round: cup.round + 1, results, playedAt: Date.now(), seed, teams: JSON.stringify(playing)};
  await setDoc(doc(db(), "cups", cup.code, "rounds", String(cup.round + 1)), round);
  await updateDoc(doc(db(), "cups", cup.code), {round: cup.round + 1});
  return results;
}

/**
 * Leaves a cup. Before it starts the member is simply taken out (with their team); once it has
 * started they're marked as left. If the host leaves, the next one still in takes over; when the
 * last one leaves, the whole cup (teams and rounds too) is cleared away.
 */
export async function leaveCup(code: string): Promise<void> {
  const d = db();
  const me = deviceId();
  const ref = doc(d, "cups", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const cup = snap.data() as FriendCupDoc;
  if (!cup.members[me]) return;
  const byJoined = Object.keys(cup.members).sort((a, b) => cup.members[a].joinedAt - cup.members[b].joinedAt);
  const gone = new Set([...(cup.left ?? []), me]);
  const staying = cup.order ? byJoined.filter((id) => !gone.has(id)) : byJoined.filter((id) => id !== me);
  if (staying.length === 0) {
    await clearCup(code, cup.order ? {left: [...gone]} : {[`members.${me}`]: deleteField()});
    return;
  }
  const host = cup.creator === me ? {creator: staying[0]} : {};
  if (cup.order) {
    await updateDoc(ref, {left: arrayUnion(me), ...host});
  } else {
    await updateDoc(ref, {[`members.${me}`]: deleteField(), ...host});
    await deleteDoc(doc(d, "cups", code, "teams", me));
  }
}

/** Clears a cup no one is in any more: first marks it so (`last`), then its teams, rounds and itself. */
async function clearCup(code: string, last: Record<string, unknown>): Promise<void> {
  const d = db();
  await updateDoc(doc(d, "cups", code), last);
  for (const sub of ["teams", "rounds", "offers"]) {
    const docs = await getDocs(collection(d, "cups", code, sub));
    await Promise.all(docs.docs.map((x) => deleteDoc(x.ref)));
  }
  await deleteDoc(doc(d, "cups", code));
}

/** An offer for a friend's player: money, a player of the buyer's in swap, or both. */
export interface TradeOfferDoc {
  id: string;
  /** The buyer and the seller (device ids). */
  from: string;
  to: string;
  /** The player wanted, by their id in the seller's game. */
  playerId: string;
  playerName: string;
  price: number;
  /** The buyer's player offered in swap (JSON), already gone from the buyer's squad. */
  swap?: string;
  swapName?: string;
  status: "open" | "accepted" | "declined" | "cancelled";
  /** The player sold (JSON), once accepted. */
  player?: string;
  createdAt: number;
}

/** Sends an offer (the buyer has already put up their side). */
export async function makeOffer(code: string, offer: Omit<TradeOfferDoc, "id" | "from" | "status" | "createdAt">): Promise<string> {
  const ref = doc(collection(db(), "cups", code, "offers"));
  const full: TradeOfferDoc = {...offer, id: ref.id, from: deviceId(), status: "open", createdAt: Date.now()};
  await setDoc(ref, full);
  return ref.id;
}

/** Answers or withdraws an open offer: false if it wasn't open any more. `player` goes with a yes. */
export async function closeOffer(code: string, id: string, status: "accepted" | "declined" | "cancelled", player?: string): Promise<boolean> {
  const ref = doc(db(), "cups", code, "offers", id);
  return runTransaction(db(), async (tx) => {
    const offer = (await tx.get(ref)).data() as TradeOfferDoc | undefined;
    if (!offer || offer.status !== "open") return false;
    tx.update(ref, player ? {status, player} : {status});
    return true;
  });
}

/** Follows the offers to and from this device in a cup. */
export function watchOffers(code: string, on: (offers: TradeOfferDoc[]) => void): () => void {
  const me = deviceId();
  return onSnapshot(collection(db(), "cups", code, "offers"), (s) =>
    on(s.docs.map((x) => x.data() as TradeOfferDoc).filter((o) => o.from === me || o.to === me).sort((a, b) => b.createdAt - a.createdAt))
  );
}

/**
 * A player sold with a code: the seller puts them up (they leave the seller's club then), and
 * whoever has the code can buy them. Not tied to a cup.
 */
export interface SaleDoc {
  code: string;
  seller: string;
  /** The player (JSON), as they left the seller's club. */
  player: string;
  playerName: string;
  price: number;
  /** The seller's club, shown in the player's profile. */
  clubName?: string;
  /** Paid in club money or diamonds (missing: money). */
  currency?: "money" | "diamonds";
  status: "open" | "sold" | "cancelled";
  buyer?: string;
  createdAt: number;
}

/** Puts a player up for sale; returns the code to give to a friend. */
export async function createSale(player: Player, playerName: string, price: number, currency: "money" | "diamonds", clubName: string): Promise<string> {
  const d = db();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCupCode();
    const ref = doc(d, "sales", code);
    if ((await getDoc(ref)).exists()) continue;
    const sale: SaleDoc = {code, seller: deviceId(), player: JSON.stringify(player), playerName, clubName, price, currency, status: "open", createdAt: Date.now()};
    await setDoc(ref, sale);
    return code;
  }
  throw new Error("friends.err.busy");
}

export async function fetchSale(code: string): Promise<SaleDoc | null> {
  const snap = await getDoc(doc(db(), "sales", code));
  return snap.exists() ? (snap.data() as SaleDoc) : null;
}

/** Buys a player by their code (only while still for sale); null if it wasn't. */
export async function buySale(code: string): Promise<SaleDoc | null> {
  const ref = doc(db(), "sales", code);
  return runTransaction(db(), async (tx) => {
    const sale = (await tx.get(ref)).data() as SaleDoc | undefined;
    if (!sale || sale.status !== "open") return null;
    tx.update(ref, {status: "sold", buyer: deviceId()});
    return sale;
  });
}

/** The seller takes a player back off sale; their sale if it was still open (then it's gone). */
export async function cancelSale(code: string): Promise<SaleDoc | null> {
  const ref = doc(db(), "sales", code);
  const sale = await runTransaction(db(), async (tx) => {
    const s = (await tx.get(ref)).data() as SaleDoc | undefined;
    if (!s || s.status !== "open") return null;
    tx.update(ref, {status: "cancelled"});
    return s;
  });
  if (sale) await deleteDoc(ref);
  return sale;
}

/** Follows a sale of this device's; once it's sold and paid for here, `clearSale` removes it. */
export function watchSale(code: string, on: (sale: SaleDoc | null) => void): () => void {
  return onSnapshot(doc(db(), "sales", code), (s) => on(s.exists() ? (s.data() as SaleDoc) : null), () => undefined);
}
export async function clearSale(code: string): Promise<void> {
  await deleteDoc(doc(db(), "sales", code));
}

/** Follows a cup: the cup itself, the rounds played and when each member last sent their team. */
export function watchCup(
  code: string,
  on: {cup: (cup: FriendCupDoc | null) => void; rounds: (rounds: FriendRoundDoc[]) => void; sent: (sent: Record<string, number>, ovrs: Record<string, number>) => void; error: (e: unknown) => void}
): () => void {
  const d = db();
  const stops = [
    onSnapshot(doc(d, "cups", code), (s) => on.cup(s.exists() ? (s.data() as FriendCupDoc) : null), on.error),
    onSnapshot(collection(d, "cups", code, "rounds"), (s) => on.rounds(s.docs.map((x) => x.data() as FriendRoundDoc).sort((a, b) => a.round - b.round)), on.error),
    onSnapshot(
      collection(d, "cups", code, "teams"),
      (s) => {
        const docs = s.docs.map((x) => ({id: x.id, ...(x.data() as {sentAt: number; json: string})}));
        // Each team's strength, from the team as sent.
        const ovr = (json: string) => {
          try {
            return snapshotOvr(JSON.parse(json) as TeamSnapshot);
          } catch {
            return 0;
          }
        };
        on.sent(Object.fromEntries(docs.map((x) => [x.id, x.sentAt])), Object.fromEntries(docs.map((x) => [x.id, ovr(x.json)])));
      },
      on.error
    ),
  ];
  return () => stops.forEach((stop) => stop());
}

/** A match's key among the seen ones: the cup, the round and its place in the round. */
export function matchKey(code: string, round: number, i: number): string {
  return `${code}:${round}:${i}`;
}
const SEEN_KEY = "manager2d.friendSeen";
export function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
export function saveSeen(seen: Set<string>): Set<string> {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    window.dispatchEvent(new Event(CUP_EVENT));
  } catch {
    // Only for this visit then.
  }
  return seen;
}
