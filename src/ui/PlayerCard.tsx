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

export function PlayerCard({game, player, reveal}: {game: GameState; player: Player; reveal?: boolean}) {
  const {t} = useT();
  const known = reveal || isKnown(game, player);
  const ovr = known ? overall(player) : estimatedOvr(game, player);
  const tier = tierFor(ovr);
  // A big gap to potential in a young player earns the talent shine.
  const talent = known && player.age <= 21 && player.potential - overall(player) >= 12;
  const club = player.clubId ? game.clubs[player.clubId] : null;
  const attrs = player.position === "GK" ? KEEPER : OUTFIELD;

  return (
    <div className={`fut-card tier-${tier} ${talent ? "talent" : ""}`}>
      <div className="fut-top">
        <div className="fut-rating">
          <span className={known ? "fut-ovr" : "fut-ovr estimated"} title={known ? undefined : t("pl.estimated")}>{ovr}</span>
          <span className="fut-pos">{t(`pos.${player.position}`)}</span>
          <Flag code={player.nationality} size={24} />
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
          />
        </div>
      </div>
      <div className="fut-name">{shortName(player)}</div>
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
