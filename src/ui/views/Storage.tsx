// The kit room: boots and gloves in the bag (put one on a player straight from
// here), and who is wearing what (take it off again).
import {Icon, iconize} from "../Icon";
import {useState} from "react";
import {gearResale, sellGear, equipGear, gearFits, gearIn, gearSlot, unequipGear, wornGear, type GearItem, type GearSlot, groupBag} from "../../game/gear";
import {effectiveRating} from "../../game/ratings";
import type {Player} from "../../game/types";
import {listName} from "../../game/helpers";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Avatar} from "../Avatar";
import {Bar, Card, Empty, Flag, FormArrow, Modal, PosBadge, StatusIcons, Hint} from "../common";
import {GearCard, GearPicture} from "../Gear";

export function Storage() {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const setView = useGame((s) => s.setView);
  const openPlayer = useGame((s) => s.openPlayer);
  const bag = game.gearBag ?? [];
  const squad = Object.values(game.players)
    .filter((p) => p.clubId === game.userClubId)
    .sort((a, b) => a.lastName.localeCompare(b.lastName));
  const wearing = squad.flatMap((p) => wornGear(p).map((w) => ({player: p, ...w})));
  // The pair being given away (its place in the bag), while the player picker is open.
  const [giving, setGiving] = useState<number | null>(null);
  const putOn = (bagIndex: number, playerId: string) => {
    const err = act((g) => equipGear(g, playerId, bagIndex));
    setGiving(null);
    if (err) notify(err, undefined, "error");
  };
  const givingItem = giving === null ? undefined : bag[giving];
  // The piece being sold, while the "are you sure?" is open.
  const [selling, setSelling] = useState<number | null>(null);
  const sellingItem = selling === null ? undefined : bag[selling];
  const sell = () => {
    if (selling === null) return;
    const err = act((g) => sellGear(g, selling));
    setSelling(null);
    notify(err ?? "storage.sold", undefined, err ? "error" : "good");
  };
  const resale = (item: GearItem) => {
    const back = gearResale(item);
    return back.diamonds ? `💎 ${back.diamonds}` : `💰 ${money(back.money ?? 0)}`;
  };

  return (
    <div className="grid">
      <Card title={<><Icon name="boot" size={20} /> {iconize(t("storage.bag", {n: bag.length}))}</>} className="span-2" actions={<button className="btn small" onClick={() => setView("shop")}><Icon name="cart" size={18} /> {iconize(t("nav.shop"))}</button>}>
        <Hint>{iconize(t("storage.hint"))}</Hint>
        {bag.length === 0 ? (
          <Empty>{iconize(t("storage.empty"))}</Empty>
        ) : (
          <div className="gear-cards storage-cards">
            {groupBag(bag).map(({item, index: i, count}) => (
              <div key={i} className="gear-offer">
                <GearCard item={item} count={count} />
                <div className="btn-row storage-actions">
                  <button className="btn primary small" onClick={() => setGiving(i)}><Icon name="plus" size={16} /> {iconize(t("storage.give"))}</button>
                  <button className="btn small" onClick={() => setSelling(i)}><Icon name="coins" size={18} /> {iconize(t("storage.sell"))}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {givingItem && giving !== null && (
        <Modal title={t("storage.giveTitle", {item: `${t(`gear.kind.${givingItem.kind}`)} · ${t(`gear.tier.${givingItem.tier}`)}`})} onClose={() => setGiving(null)}>
          <GivePicker item={givingItem} squad={squad} onPick={(id) => putOn(giving, id)} />
        </Modal>
      )}

      {sellingItem && (
        <Modal compact title={<><Icon name="coins" size={20} /> {iconize(t("storage.sellTitle"))}</>} onClose={() => setSelling(null)}>
          <div className="storage-sell">
            <GearCard item={sellingItem} small />
            <p>{iconize(t("storage.sellText", {item: `${t(`gear.kind.${sellingItem.kind}`)} · ${t(`gear.tier.${sellingItem.tier}`)}`, price: resale(sellingItem)}))}</p>
          </div>
          <div className="btn-row dialog-actions">
            <button className="btn" onClick={() => setSelling(null)}>{iconize(t("common.cancel"))}</button>
            <button className="btn primary" onClick={sell}>{iconize(t("storage.sellYes", {price: resale(sellingItem)}))}</button>
          </div>
        </Modal>
      )}

      <Card title={<><Icon name="run" size={20} /> {iconize(t("storage.wearing", {n: wearing.length}))}</>} className="span-2">
        {wearing.length === 0 ? (
          <Empty>{iconize(t("storage.nobody"))}</Empty>
        ) : (
          <ul className="plain-list storage-list">
            {wearing.map(({player: p, slot, item}) => (
              <li key={p.id + slot} className="storage-row">
                <span className="storage-pic"><GearPicture item={item} size={item.kind === "gloves" ? 44 : item.kind === "shin" ? 46 : 66} /></span>
                <span className="storage-what">
                  <strong>{iconize(t(`gear.kind.${item.kind}`))} · {iconize(t(`gear.tier.${item.tier}`))}</strong>
                  <button className="link" onClick={() => openPlayer(p.id)}>
                    <PosBadge pos={p.position} /> {listName(p)}
                  </button>
                </span>
                <button className="btn small" onClick={() => act((g) => unequipGear(g, p.id, slot))}>{iconize(t("gear.takeOff"))}</button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/**
 * Who to give a pair to, like Tactics' player picker: those it fits, best first, with
 * their rating now and with the pair on, and what they wear already.
 */
function GivePicker({item, squad, onPick}: {item: GearItem; squad: Player[]; onPick: (playerId: string) => void}) {
  const {t} = useT();
  const game = useGameState();
  const club = game.clubs[game.userClubId];
  const slot = gearSlot(item.kind);
  // Those it visibly lifts first, the best of them at the top: the top of the list is the best choice.
  const withIt = (p: Player) => (slot === "shin" ? {...p, shin: item} : {...p, gear: item});
  const lifts = (p: Player) => (Math.round(effectiveRating(withIt(p), p.position)) > Math.round(effectiveRating(p, p.position)) ? 1 : 0);
  const fits = squad
    .filter((p) => gearFits(p, item.kind))
    .sort((a, b) => lifts(b) - lifts(a) || effectiveRating(b, b.position) - effectiveRating(a, a.position));
  if (fits.length === 0) return <Empty>{iconize(t("storage.nobodyFits"))}</Empty>;
  return (
    <ul className="pick-list give-picker">
      {fits.map((p) => {
        const now = Math.round(effectiveRating(p, p.position));
        const after = Math.round(effectiveRating(withIt(p), p.position));
        return (
          <li key={p.id} className="pick-row">
            <button className="pick" onClick={() => onPick(p.id)}>
              <PosBadge pos={p.position} />
              <span className="pick-name"><Flag code={p.nationality} size={15} /> {listName(p)} <StatusIcons player={{...p, gear: undefined, shin: undefined}} /></span>
              {/* What they wear now, as the picture (the pair they would swap out). */}
              <PickGear player={p} slot={slot} />
              <FormArrow form={p.form} />
              <span className="num strong">{now}{after !== now && <small className="gear-plus"> → {after}</small>}</span>
              <Bar value={p.fitness} small />
            </button>
            <span className="pick-avatar" aria-hidden>
              <Avatar player={p} shirt={club.color} trim={club.color2} size={34} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** In the picker: what the player has in that place now, as the picture. */
function PickGear({player: p, slot}: {player: Player; slot: GearSlot}) {
  const {t} = useT();
  const now = gearIn(p, slot);
  return (
    <span className="pick-gear" title={now ? t("storage.has", {tier: `${t(`gear.kind.${now.kind}`)} · ${t(`gear.tier.${now.tier}`)}`}) : undefined}>
      {now && <GearPicture item={now} size={now.kind === "gloves" ? 22 : now.kind === "shin" ? 16 : 30} />}
    </span>
  );
}
