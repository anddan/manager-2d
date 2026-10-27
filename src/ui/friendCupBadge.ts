// The menu's number for the friends' cup: how many things there are to do in it right now
// (offers to answer, matches not seen, a pack or prize to collect, and for the host a cup to
// start or a round to play). Follows the cup online while this device is in one.
import {useEffect, useState} from "react";
import {friendFixtures, friendPack, friendTable} from "../game/friendCup";
import {CUP_EVENT, deviceId, loadSeen, matchKey, myCupCode, watchCup, watchOffers, type FriendCupDoc, type FriendRoundDoc, type TradeOfferDoc} from "./friendCupApi";

export function friendCupTodo(code: string, cup: FriendCupDoc, rounds: FriendRoundDoc[], offers: TradeOfferDoc[], seen: Set<string>): number {
  const me = deviceId();
  if (!cup.members[me] || cup.left?.includes(me)) return 0;
  let n = offers.filter((o) => o.to === me && o.status === "open").length;
  const unseen = rounds.reduce((k, r) => k + r.results.filter((_, i) => !seen.has(matchKey(code, r.round, i))).length, 0);
  n += unseen;
  const members = Object.keys(cup.members);
  if (cup.creator === me && !cup.order && members.length >= 2) n++;
  if (cup.order) {
    const finished = cup.round >= friendFixtures(cup.order).length;
    if (cup.creator === me && !finished) n++;
    if (finished && friendPack(cup.order.length) && !cup.packsTaken?.[me]) n++;
    if (finished && unseen === 0 && !cup.prizeClaimed && friendTable(cup.order, rounds.flatMap((r) => r.results))[0]?.id === me) n++;
  }
  return n;
}

export function useFriendCupBadge(): number {
  const [code, setCode] = useState<string | null>(() => (typeof window === "undefined" ? null : myCupCode()));
  const [seen, setSeen] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : loadSeen()));
  const [cup, setCup] = useState<FriendCupDoc | null>(null);
  const [rounds, setRounds] = useState<FriendRoundDoc[]>([]);
  const [offers, setOffers] = useState<TradeOfferDoc[]>([]);
  // Joining, leaving or seeing a match changes what's left to do.
  useEffect(() => {
    const changed = () => {
      setCode(myCupCode());
      setSeen(loadSeen());
    };
    window.addEventListener(CUP_EVENT, changed);
    return () => window.removeEventListener(CUP_EVENT, changed);
  }, []);
  useEffect(() => {
    setCup(null);
    setRounds([]);
    setOffers([]);
    if (!code) return;
    const stopCup = watchCup(code, {cup: setCup, rounds: setRounds, sent: () => undefined, error: () => undefined});
    const stopOffers = watchOffers(code, setOffers);
    return () => {
      stopCup();
      stopOffers();
    };
  }, [code]);
  return code && cup ? friendCupTodo(code, cup, rounds, offers, seen) : 0;
}
