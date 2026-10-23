// Collectible-style player card: tier by overall, cartoon portrait, six key
// attributes. Unscouted players show a range and question marks.
import {overall} from "../game/ratings";
import {estimatedOverall, isKnown} from "../game/transfers";
import type {Attribute, GameState, Player} from "../game/types";
import {useT} from "../i18n";
import {Flag} from "./common";
import {Avatar} from "./Avatar";

const OUTFIELD: Attribute[] = ["pace", "finishing", "passing", "technique", "defending", "physical"];
const KEEPER: Attribute[] = ["goalkeeping", "vision", "passing", "physical", "pace", "stamina"];

type Tier = "bronze" | "silver" | "gold";

export function tierFor(ovr: number): Tier {
  return ovr >= 72 ? "gold" : ovr >= 60 ? "silver" : "bronze";
}

export function PlayerCard({game, player}: {game: GameState; player: Player}) {
  const {t} = useT();
  const known = isKnown(game, player);
  const est = estimatedOverall(game, player);
  const ovr = known ? overall(player) : Math.round((est.low + est.high) / 2);
  const tier = tierFor(ovr);
  // A big gap to potential in a young player earns the talent shine.
  const talent = known && player.age <= 21 && player.potential - overall(player) >= 12;
  const club = player.clubId ? game.clubs[player.clubId] : null;
  const attrs = player.position === "GK" ? KEEPER : OUTFIELD;
  const own = player.clubId === game.userClubId;

  return (
    <div className={`fut-card tier-${tier} ${talent ? "talent" : ""}`}>
      <div className="fut-top">
        <div className="fut-rating">
          <span className="fut-ovr">{known ? ovr : `${est.low}-${est.high}`}</span>
          <span className="fut-pos">{t(`pos.${player.position}`)}</span>
          <Flag code={player.nationality} />
          {club && (
            <span className="fut-crest" style={{background: club.color, color: club.color2}}>{club.short}</span>
          )}
        </div>
        <div className="fut-portrait">
          <Avatar
            player={player}
            shirt={club?.color ?? "#64748b"}
            trim={club?.color2 ?? "#e2e8f0"}
            size={120}
            mood={own ? player.happiness : undefined}
          />
        </div>
      </div>
      <div className="fut-name">{player.lastName}</div>
      {talent && <div className="fut-badge">✨ {t("card.talent")}</div>}
      <div className="fut-stats">
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
