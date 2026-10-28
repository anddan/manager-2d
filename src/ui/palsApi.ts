// Friends (Firebase Firestore). Each device that opens Friends gets a profile: a friend code to
// share, its club and its team as it stands (sent again every week), and the friends it has.
// Adding a friend by their code makes it both ways at once. No accounts: a device is its own id
// (see friendCupApi), so friends live on the device like the friends' cup.
import {collection, deleteField, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where} from "firebase/firestore";
import {newCupCode, snapshotOvr, snapshotTeam, type TeamSnapshot} from "../game/friendCup";
import type {GameState} from "../game/types";
import {db, deviceId} from "./friendCupApi";

/** An invitation to a friends' cup, from a friend. */
export interface PalInvite {
  cup: string;
  club: string;
  manager: string;
  at: number;
}

export interface PalProfile {
  friendCode: string;
  manager: string;
  club: {name: string; short: string; color: string; color2: string};
  /** The team as last sent (JSON). */
  team: string;
  ovr: number;
  updatedAt: number;
  /** Friends, by device id (when added). */
  friends?: Record<string, number>;
  /** Invitations to friends' cups, by cup code. */
  invites?: Record<string, PalInvite>;
}

const CODE_KEY = "manager2d.friendCode";

/** This device's friend code, once it has a profile. */
export function myFriendCode(): string | null {
  try {
    return localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
}

function profileFields(game: GameState): Omit<PalProfile, "friendCode" | "friends"> {
  const club = game.clubs[game.userClubId];
  const team: TeamSnapshot = snapshotTeam(game);
  return {
    manager: game.managerName,
    club: {name: club.name, short: club.short, color: club.color, color2: club.color2},
    team: JSON.stringify(team),
    ovr: snapshotOvr(team),
    updatedAt: Date.now(),
  };
}

/** Makes this device's profile (with a new friend code) or brings it up to date. Returns the code. */
export async function publishProfile(game: GameState): Promise<string> {
  const ref = doc(db(), "profiles", deviceId());
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const code = (snap.data() as PalProfile).friendCode;
    await updateDoc(ref, profileFields(game));
    remember(code);
    return code;
  }
  for (let tries = 0; tries < 5; tries++) {
    const code = newCupCode();
    const taken = await getDocs(query(collection(db(), "profiles"), where("friendCode", "==", code)));
    if (!taken.empty) continue;
    await setDoc(ref, {friendCode: code, ...profileFields(game), friends: {}});
    remember(code);
    return code;
  }
  throw new Error("friends.err.busy");
}

function remember(code: string): void {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {
    // Read from the profile next time then.
  }
  window.dispatchEvent(new Event(PALS_EVENT));
}

/** Fired when this device gets its friends profile (the watcher starts then). */
export const PALS_EVENT = "manager2d.pals";

/** Adds a friend by their code, both ways. Their device id, or an error key. */
export async function addFriend(code: string): Promise<string> {
  const found = await getDocs(query(collection(db(), "profiles"), where("friendCode", "==", code.trim().toUpperCase())));
  if (found.empty) throw new Error("pals.noCode");
  const other = found.docs[0].id;
  const me = deviceId();
  if (other === me) throw new Error("pals.own");
  const at = Date.now();
  await updateDoc(doc(db(), "profiles", me), {[`friends.${other}`]: at});
  await updateDoc(doc(db(), "profiles", other), {[`friends.${me}`]: at});
  return other;
}

/** Ends a friendship, both ways. */
export async function removeFriend(other: string): Promise<void> {
  const me = deviceId();
  await updateDoc(doc(db(), "profiles", me), {[`friends.${other}`]: deleteField()});
  await updateDoc(doc(db(), "profiles", other), {[`friends.${me}`]: deleteField()}).catch(() => undefined);
}

/** Follows a profile (this device's or a friend's). */
export function watchProfile(id: string, on: (p: PalProfile | null) => void): () => void {
  return onSnapshot(doc(db(), "profiles", id), (s) => on(s.exists() ? (s.data() as PalProfile) : null), () => on(null));
}

/** Invites a friend to a friends' cup (shown under their Friends until they answer). */
export async function inviteFriend(friend: string, invite: PalInvite & {code: string}): Promise<void> {
  const {code, ...rest} = invite;
  await updateDoc(doc(db(), "profiles", friend), {[`invites.${code}`]: rest});
}

/** Takes an invitation off this device's list (joined, or said no to). */
export async function dismissInvite(code: string): Promise<void> {
  await updateDoc(doc(db(), "profiles", deviceId()), {[`invites.${code}`]: deleteField()});
}
