// Collectible-style player card: tier by overall, cartoon portrait, six key
// attributes. Unscouted players show an estimated overall and question marks.
import {overall} from "../game/ratings";
import {shortName} from "../game/helpers";
import {isKnown} from "../game/transfers";
import type {Attribute, GameState, Player} from "../game/types";
import {useT} from "../i18n";
import {Flag, estimatedOvr} from "./common";
import {Avatar} from "./Avatar";

const OUTFIELD: Attribute[] = ["pace", "finishing", "passing", "technique", "defending", "physical"];
const KEEPER: Attribute[] = ["goalkeeping", "vision", "passing", "physical", "pace", "stamina"];

/** Bronze, silver and gold by overall; 92 and up is a special card. */
type Tier = "bronze" | "silver" | "gold" | "special";

export function tierFor(ovr: number): Tier {
  return ovr >= 92 ? "special" : ovr >= 72 ? "gold" : ovr >= 60 ? "silver" : "bronze";
}

/**
 * `stage`, when given, shows the card bit by bit (a pack being opened): 1 the
 * club, 2 the flag, 3 the position, 4 the overall (and the card's colour),
 * 5 the name, 6 the picture and attributes. Hidden parts keep their place.
 */
export function PlayerCard({game, player, reveal, stage, forClubId}: {game: GameState; player: Player; reveal?: boolean; stage?: number; forClubId?: string}) {
  const {t} = useT();
  const known = reveal || isKnown(game, player);
  const ovr = known ? overall(player) : estimatedOvr(game, player);
  const tier = tierFor(ovr);
  // A big gap to potential in a young player earns the talent shine.
  const talent = known && player.age <= 21 && player.potential - overall(player) >= 12;
  // A pack player not signed yet shows the club they're joining.
  const club = player.clubId ? game.clubs[player.clubId] : forClubId ? game.clubs[forClubId] : null;
  const attrs = player.position === "GK" ? KEEPER : OUTFIELD;
  const staged = stage !== undefined;
  // Each part pops in at its step; until then it's invisible but keeps its place.
  const step = (n: number) => (staged ? (stage >= n ? " step shown" : " step") : "");

  return (
    <div className={`fut-card tier-${staged && stage < 4 ? "hidden" : tier} ${talent && (!staged || stage >= 6) ? "talent" : ""}${staged ? " staged" : ""}`}>
      <div className="fut-top">
        <div className="fut-rating">
          <span className={(known ? "fut-ovr" : "fut-ovr estimated") + step(4)} title={known ? undefined : t("pl.estimated")}>{ovr}</span>
          <span className={"fut-pos" + step(3)}>{t(`pos.${player.position}`)}</span>
          <span className={"fut-flag" + step(2)}><Flag code={player.nationality} size={24} /></span>
          {club && (
            <span className={"fut-crest" + step(1)} style={{background: club.color, color: club.color2}}>{club.short}</span>
          )}
        </div>
        <div className={"fut-portrait" + step(6)}>
          <Avatar
            player={player}
            shirt={club?.color ?? "#64748b"}
            trim={club?.color2 ?? "#e2e8f0"}
            size={120}
          />
        </div>
      </div>
      <div className={"fut-name" + step(5)}>{shortName(player)}</div>
      {talent && <div className={"fut-badge" + step(6)}>✨ {t("card.talent")}</div>}
      <div className={"fut-stats" + step(6)}>
        {attrs.map((a) => (
          <div key={a} className="fut-stat">
            <strong>{known ? Math.round(player.attrs[a]) : "?"}</strong>
            <span>{t(`card.${a}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
