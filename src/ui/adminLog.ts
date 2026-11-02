// What the admin gets to see: errors in the game and real-money purchases (to be able to give a refund).
// Written to Firestore (collections errorLogs and purchases; see firestore.rules: the game can only add to
// them, only the admin reads them, in the Firebase console). A device is only known by its random id and
// its friend code, never by a name. Whatever cannot be sent (offline) waits in the browser and goes next time.
import {collection, doc, setDoc} from "firebase/firestore";
import {useGame} from "../store";
import {db, deviceId} from "./friendCupApi";
import {myFriendCode} from "./palsApi";
import {BUILD_ID} from "./updates";

const QUEUE_KEY = "manager2d.adminQueue";
/** The most that waits in the browser, and the most error reports from one visit. */
const QUEUE_MAX = 30;
const ERRORS_PER_VISIT = 15;

type Entry = {collection: "errorLogs" | "purchases"; data: Record<string, unknown>};

function readQueue(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Entry[];
  } catch {
    return [];
  }
}

function writeQueue(list: Entry[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-QUEUE_MAX)));
  } catch {
    // Nothing to do.
  }
}

async function send(entry: Entry): Promise<boolean> {
  try {
    await setDoc(doc(collection(db(), entry.collection)), entry.data);
    return true;
  } catch {
    return false;
  }
}

/** Sends it, or keeps it for the next visit. */
async function deliver(entry: Entry): Promise<void> {
  if (!(await send(entry))) writeQueue([...readQueue(), entry]);
}

/** Where in the game this happened (just numbers and a page name). */
function context(): Record<string, unknown> {
  const s = useGame.getState();
  return {
    at: Date.now(),
    device: deviceId(),
    friendCode: myFriendCode() ?? "",
    build: BUILD_ID,
    view: s.view,
    season: s.game?.season ?? 0,
    week: s.game?.week ?? 0,
  };
}

let reported = new Set<string>();

/** An error in the game, once for each kind (and a few a visit). */
export function logError(kind: string, error: unknown, extra = ""): void {
  const message = String((error as {message?: string})?.message ?? error).slice(0, 500);
  const stack = String((error as {stack?: string})?.stack ?? "").slice(0, 2000);
  const key = `${kind}|${message}|${stack.split("\n")[1] ?? ""}`;
  if (reported.has(key) || reported.size >= ERRORS_PER_VISIT) return;
  reported.add(key);
  void deliver({collection: "errorLogs", data: {...context(), kind, message, stack, extra: extra.slice(0, 500), agent: (navigator.userAgent ?? "").slice(0, 200)}});
}

/** A purchase with real money: what, how much it cost and what it gave. */
export function logPurchase(what: "diamonds" | "money", packId: string, eur: number, got: number): void {
  const total = useGame.getState().game?.purchases;
  void deliver({collection: "purchases", data: {...context(), what, packId, eur, got, totalEur: total?.eur ?? 0}});
}

/** Once at the start: listens for errors, and sends what waited from the last visit. */
export function startAdminLog(): void {
  reported = new Set();
  window.addEventListener("error", (e) => logError("error", e.error ?? e.message, `${e.filename ?? ""}:${e.lineno ?? ""}`));
  window.addEventListener("unhandledrejection", (e) => logError("promise", e.reason));
  const waiting = readQueue();
  if (waiting.length === 0) return;
  writeQueue([]);
  waiting.forEach((entry) => void deliver(entry));
}
