// Keeps this manager's friends profile up to date: once a friends' profile exists (Friends was
// opened), the team is sent again each new week, so friends always see it as it stands.
import {useEffect} from "react";
import {useGameState} from "../store";
import {myFriendCode, publishProfile} from "./palsApi";

export function ProfileSync() {
  const game = useGameState();
  useEffect(() => {
    if (!myFriendCode()) return;
    publishProfile(game).catch(() => undefined);
    // Once a week (and when the game opens), not on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.absWeek]);
  return null;
}
