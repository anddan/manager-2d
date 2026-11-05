// The season's awards, like the Ballon d'Or: player, goalkeeper, young talent and manager of the year.
// Given at the end of the season, from the season's ratings, goals and assists (and how each club did
// against what its squad should manage). One mail tells who won; if someone of ours did, it lights up
// and a celebration is shown.
import {collectTrophy} from "./album";
import {addMessage, fullName} from "./helpers";
import {clubStrength} from "./ratings";
import type {GameState, Player} from "./types";

export type AwardKey = "player" | "keeper" | "talent" | "manager";

/** Who won each award (ids of players, or of the club whose manager won). */
export interface SeasonAwards {
  player?: string;
  keeper?: string;
  talent?: string;
  managerClub?: string;
}

/** A player's season in one number: the average rating, with goals and assists counting a little. */
function seasonScore(p: Player): number {
  const s = p.stats;
  return s.ratingSum / s.apps + s.goals * 0.04 + s.assists * 0.025;
}

function best(players: Player[], minApps: number, pick: (p: Player) => boolean): string | undefined {
  let top: Player | undefined;
  for (const p of players) {
    if (p.stats.apps < minApps || !pick(p)) continue;
    if (!top || seasonScore(p) > seasonScore(top)) top = p;
  }
  return top?.id;
}

/** Works out the winners from the season just played (`order`: the club ids by final position). */
export function seasonAwards(state: GameState, order: string[]): SeasonAwards {
  const players = Object.values(state.players).filter((p) => p.clubId && !state.clubs[p.clubId]?.guest);
  // The manager of the year: whose club did best against its strength (a title counts extra).
  const byStrength = [...order].sort((a, b) => clubStrength(state, b) - clubStrength(state, a));
  let managerClub: string | undefined;
  let top = -Infinity;
  order.forEach((id, position) => {
    const score = byStrength.indexOf(id) - position + (position === 0 ? 3 : 0);
    if (score > top) {
      top = score;
      managerClub = id;
    }
  });
  return {
    player: best(players, 8, () => true),
    keeper: best(players, 8, (p) => p.position === "GK"),
    talent: best(players, 5, (p) => p.age <= 21),
    managerClub,
  };
}

/** Sends the mail with the winners; whatever is ours is marked, the mail lit up, and a celebration queued. */
export function announceAwards(state: GameState, awards: SeasonAwards): void {
  const mine = (id?: string) => !!id && state.players[id]?.clubId === state.userClubId;
  const label = (id?: string) => {
    const p = id ? state.players[id] : undefined;
    return p ? `${fullName(p)} (${p.clubId ? state.clubs[p.clubId].name : "–"})` : "–";
  };
  const managerMine = awards.managerClub === state.userClubId;
  // Everybody who wins one, with their team; the ones that are ours are marked.
  const winner = (key: AwardKey, id?: string) => {
    const p = id ? state.players[id] : undefined;
    return p ? [{key, playerId: id, name: fullName(p), team: p.clubId ? state.clubs[p.clubId].name : undefined, mine: mine(id)}] : [];
  };
  const everyone: {key: AwardKey; playerId?: string; name: string; team?: string; mine?: boolean}[] = [
    ...winner("player", awards.player),
    ...winner("keeper", awards.keeper),
    ...winner("talent", awards.talent),
    ...(awards.managerClub ? [{key: "manager" as const, name: managerMine ? state.managerName : state.clubs[awards.managerClub].name, team: state.clubs[awards.managerClub].name, mine: managerMine}] : []),
  ];
  const ours = everyone.filter((a) => a.mine);
  addMessage(state, {
    kind: "news",
    key: "msg.awards",
    params: {
      season: state.season,
      player: label(awards.player), playerId: awards.player ?? "", playerMine: mine(awards.player) ? 1 : 0,
      keeper: label(awards.keeper), keeperId: awards.keeper ?? "", keeperMine: mine(awards.keeper) ? 1 : 0,
      talent: label(awards.talent), talentId: awards.talent ?? "", talentMine: mine(awards.talent) ? 1 : 0,
      manager: awards.managerClub ? (managerMine ? `${state.managerName} (${state.clubs[awards.managerClub].short})` : state.clubs[awards.managerClub].name) : "–",
      managerMine: managerMine ? 1 : 0,
    },
    action: {type: "ack"},
  });
  for (const a of everyone) if (a.mine) collectTrophy(state, `award.${a.key}`);
  if (ours.length > 0) state.celebrations = [...(state.celebrations ?? []), {kind: "award", season: state.season, awards: everyone}];
}
