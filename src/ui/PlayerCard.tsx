// Collectible-style player card: tier by overall, cartoon portrait, six key
// attributes. Unscouted players show an estimated overall and question marks.
import {Icon, iconize} from "./Icon";
import {overall} from "../game/ratings";
import {shortName} from "../game/helpers";
import {isKnown} from "../game/transfers";
import type {Attribute, GameState, Player} from "../game/types";
import {useT} from "../i18n";
import {Flag, estimatedOvr} from "./common";
import {Avatar} from "./Avatar";
import {TraitMarks} from "./Traits";
import {GearPicture} from "./Gear";

/** The talent's star: blue and filling up while they grow, gold and shining when they've got there. */
function TalentStar({grown, growth, className}: {grown: boolean; growth: number; className: string}) {
  return (
    <svg className={`fut-star${grown ? " gold" : ""}${className}`} viewBox="0 0 24 24" width={24} height={24} aria-hidden>
      <defs>
        <linearGradient id="star-fill" x1="0" y1="1" x2="0" y2="0">
          <stop offset={growth} stopColor="#38bdf8" />
          <stop offset={growth} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill={grown ? "#fde047" : "url(#star-fill)"} stroke={grown ? "#92400e" : "#38bdf8"} strokeWidth={grown ? 1.9 : 1.4} strokeLinejoin="round" />
    </svg>
  );
}

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
/** `kit`: a legend's own colours for the card and the shirt on it (in the shop). */
export function PlayerCard({game, player, reveal, stage, forClubId, kit}: {game: GameState; player: Player; reveal?: boolean; stage?: number; forClubId?: string; kit?: {color: string; trim: string; theme: string}}) {
  const {t} = useT();
  const known = reveal || isKnown(game, player);
  const ovr = known ? overall(player) : estimatedOvr(game, player);
  const tier = tierFor(ovr);
  // A big gap to potential in a young player earns the talent shine.
  const talent = known && player.age <= 21 && player.potential - overall(player) >= 12;
  // A pack player not signed yet shows the club they're joining.
  const club = player.clubId ? game.clubs[player.clubId] : forClubId ? game.clubs[forClubId] : null;
  const attrs = player.position === "GK" ? KEEPER : OUTFIELD;
  // Talent: a star that fills as they grow and turns gold when they get to their potential. Veterans
  // (33 and over, still good) get the legend frame.
  const isTalent = known && (!!player.talent || talent);
  const grown = known && !!player.talent && overall(player) >= player.potential - 1;
  const growth = Math.max(0.08, Math.min(1, overall(player) / Math.max(1, player.potential)));
  const legendFrame = known && player.age >= 33 && overall(player) >= 68;
  const staged = stage !== undefined;
  // Each part pops in at its step; until then it's invisible but keeps its place.
  const step = (n: number) => (staged ? (stage >= n ? " step shown" : " step") : "");

  return (
    <div className={`fut-card tier-${staged && stage < 4 ? "hidden" : tier} ${talent && (!staged || stage >= 6) ? "talent" : ""}${staged ? " staged" : ""}${kit ? ` card-${kit.theme}` : ""}${grown ? " grown" : ""}${legendFrame ? " legend-frame" : ""}`}>
      <div className="fut-top">
        <div className="fut-rating">
          <span className={(known ? "fut-ovr" : "fut-ovr estimated") + step(4)} title={known ? undefined : t("pl.estimated")}>{ovr}</span>
          <span className={"fut-pos" + step(3)}>{iconize(t(`pos.${player.position}`))}</span>
          <span className={"fut-flag" + step(2)}><Flag code={player.nationality} size={24} /></span>
          {club && (
            <span className={"fut-crest" + step(1)} style={{background: club.color, color: club.color2}}>{club.short}</span>
          )}
        </div>
        <div className={"fut-portrait" + step(6)}>
          <Avatar
            player={player}
            shirt={kit?.color ?? club?.color ?? "#64748b"}
            trim={kit?.trim ?? club?.color2 ?? "#e2e8f0"}
            size={120}
          />
        </div>
      </div>
      {/* The name, with the kit worn either side: boots (or gloves) left, shin guards right. */}
      <div className={"fut-name" + step(5)}>
        <span className="fut-kit">{player.gear && <GearPicture item={player.gear} size={player.gear.kind === "gloves" ? 16 : 24} />}</span>
        <span className="fut-name-text">{shortName(player)}</span>
        <span className="fut-kit">{player.shin && <GearPicture item={player.shin} size={16} />}</span>
      </div>
      {isTalent && <TalentStar grown={grown} growth={growth} className={step(6)} />}
      {known && <TraitMarks player={player} />}
      {legendFrame ? (
        <div className={"fut-badge legend" + step(6)}><Icon name="trophy" size={18} /> {iconize(t("card.legend"))}</div>
      ) : grown ? (
        <div className={"fut-badge grown" + step(6)}><Icon name="star" size={18} /> {iconize(t("card.grown"))}</div>
      ) : talent ? (
        <div className={"fut-badge" + step(6)}><Icon name="sparkle" size={18} /> {iconize(t("card.talent"))}</div>
      ) : null}
      <div className={"fut-stats" + step(6)}>
        {attrs.map((a) => (
          <div key={a} className="fut-stat">
            <strong>{known ? Math.round(player.attrs[a]) : "?"}</strong>
            <span>{iconize(t(`card.${a}`))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
