// Friends, followed all the time while the app is open (once this device has a friends profile):
// its own profile (friends, invitations) and the offers between friends. The menu's number and the
// settling of answered offers read from here.
import {useEffect, useSyncExternalStore} from "react";
import {deviceId, watchPalOffers, type TradeOfferDoc} from "./friendCupApi";
import {myFriendCode, PALS_EVENT, watchProfile, type PalProfile} from "./palsApi";
import {useSettleTrades} from "./views/FriendTrades";

interface PalState {
  me: PalProfile | null;
  offers: TradeOfferDoc[];
}
let state: PalState = {me: null, offers: []};
const listeners = new Set<() => void>();
function set(next: Partial<PalState>): void {
  state = {...state, ...next};
  listeners.forEach((l) => l());
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePals(): PalState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** What waits for this manager under Friends: offers to answer and invitations. */
export function palsTodo(s: PalState): number {
  const me = deviceId();
  return s.offers.filter((o) => o.to === me && o.status === "open").length + Object.keys(s.me?.invites ?? {}).length;
}

/** A club's name in an offer between friends (each offer carries both). */
export const palClub = (id: string, o: TradeOfferDoc): string => (id === o.from ? o.fromName : o.toName) ?? "?";

/** Mounted once in the app: follows the profile and the offers, and settles answered offers. */
export function PalWatcher() {
  const {offers} = usePals();
  useEffect(() => {
    let stops: (() => void)[] = [];
    const start = () => {
      stops.forEach((s) => s());
      stops = [];
      if (!myFriendCode()) return;
      stops = [watchProfile(deviceId(), (me) => set({me})), watchPalOffers((o) => set({offers: o}))];
    };
    start();
    window.addEventListener(PALS_EVENT, start);
    return () => {
      window.removeEventListener(PALS_EVENT, start);
      stops.forEach((s) => s());
    };
  }, []);
  useSettleTrades(offers, palClub);
  return null;
}
