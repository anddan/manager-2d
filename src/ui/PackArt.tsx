// A pack in the shop: player packs and the kit pack.
import {Icon} from "./Icon";

/**
 * A pack as a pack: a foil wrapper in the tier's colours, crimped at both ends, with a moving
 * shine, a card silhouette with a "?" (who's in it?), the tier and what overall it holds.
 */
export function PackArt({tier, name, range, note}: {tier: string; name: string; range: string; note?: string}) {
  return (
    <div className={`pack-art pack-${tier}`}>
      <span className="pack-crimp top" aria-hidden />
      <span className="pack-shine" aria-hidden />
      <div className="pack-emblem" aria-hidden>
        <svg viewBox="0 0 40 52" width={44} height={57}>
          <path d="M6 3 L20 0 L34 3 L37 10 V44 L20 52 L3 44 V10 Z" fill="rgb(255 255 255 / 0.18)" stroke="rgb(255 255 255 / 0.65)" strokeWidth={1.6} />
          <text x="20" y="34" textAnchor="middle" fontSize="22" fontWeight={900} fill="#fff">?</text>
        </svg>
      </div>
      <strong className="pack-name">{tier === "diamond" ? <><Icon name="diamond" size={16} /> {name}</> : name}</strong>
      <span className="pack-range">{range}</span>
      {note && <span className="pack-note">{note}</span>}
      <span className="pack-crimp bottom" aria-hidden />
    </div>
  );
}
