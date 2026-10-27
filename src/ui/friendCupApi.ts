// The friends' cup online (Firebase Firestore). A cup is one document (its name, members, the
// order they play in and how many rounds are done); each member's team snapshot is a document
// under it, sent whenever they like; each round played is a document with its results.
//
// No accounts: a device is known by a random id kept in the browser. The cup's creator plays
// the rounds (on their device, from everyone's latest snapshot) and stores the results, so
// everyone reads the same scores.
import {getApps, initializeApp} from "firebase/app";
import {collection, doc, getDoc, getDocs, getFirestore, onSnapshot, setDoc, updateDoc, type Firestore} from "firebase/firestore";
import {friendFixtures, newCupCode, playFriendRound, type FriendResult, type TeamSnapshot} from "../game/friendCup";

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
}

export interface FriendRoundDoc {
  round: number;
  results: FriendResult[];
  playedAt: number;
}

const DEVICE_KEY = "manager2d.deviceId";
const CUP_KEY = "manager2d.friendCup";

/** This device's id in cups (made up once, kept in the browser). */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `d${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "d-local";
  }
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
  const results = playFriendRound(rounds[cup.round], teams, (cup.seed + cup.round * 104729) >>> 0);
  const round: FriendRoundDoc = {round: cup.round + 1, results, playedAt: Date.now()};
  await setDoc(doc(db(), "cups", cup.code, "rounds", String(cup.round + 1)), round);
  await updateDoc(doc(db(), "cups", cup.code), {round: cup.round + 1});
  return results;
}

/** Follows a cup: the cup itself, the rounds played and when each member last sent their team. */
export function watchCup(
  code: string,
  on: {cup: (cup: FriendCupDoc | null) => void; rounds: (rounds: FriendRoundDoc[]) => void; sent: (sent: Record<string, number>) => void; error: (e: unknown) => void}
): () => void {
  const d = db();
  const stops = [
    onSnapshot(doc(d, "cups", code), (s) => on.cup(s.exists() ? (s.data() as FriendCupDoc) : null), on.error),
    onSnapshot(collection(d, "cups", code, "rounds"), (s) => on.rounds(s.docs.map((x) => x.data() as FriendRoundDoc).sort((a, b) => a.round - b.round)), on.error),
    onSnapshot(collection(d, "cups", code, "teams"), (s) => on.sent(Object.fromEntries(s.docs.map((x) => [x.id, (x.data() as {sentAt: number}).sentAt]))), on.error),
  ];
  return () => stops.forEach((stop) => stop());
}
