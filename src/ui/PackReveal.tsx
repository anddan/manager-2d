// A pack being opened: the new player's card shown bit by bit (club, flag,
// position, overall, name, then the picture and skills), as in the shop.
// Also used for the free bronze pack from the daily tasks.
import {useEffect, useState} from "react";
import {fullName} from "../game/helpers";
import type {PlayerPackId} from "../game/packs";
import {useT} from "../i18n";
import {useGameState} from "../store";
import {Modal} from "./common";
import {PlayerCard} from "./PlayerCard";

export function PackReveal({playerId, pack, onClose}: {playerId: string; pack: PlayerPackId; onClose: () => void}) {
  const {t} = useT();
  const game = useGameState();
  // How much of the card is showing (see PlayerCard's stage); 6 is all of it.
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= 6) return;
    // A longer wait before the overall, for the suspense.
    const id = setTimeout(() => setStage((s) => s + 1), stage === 0 ? 900 : stage === 3 ? 1300 : 750);
    return () => clearTimeout(id);
  }, [stage]);
  const player = game.players[playerId];
  if (!player) return null;
  return (
    <Modal title={`🎁 ${t(`pack.${pack}`)}`} onClose={onClose}>
      <div className="pack-reveal">
        <div className="pack-flip">
          <PlayerCard game={game} player={player} reveal stage={stage} />
        </div>
        {stage >= 6 ? (
          <>
            <h3 className="pack-got">{t("pack.got", {name: fullName(player)})}</h3>
            <button className="btn primary" onClick={onClose}>{t("pack.great")}</button>
          </>
        ) : (
          <button className="btn" onClick={() => setStage(6)}>{t("pack.showAll")}</button>
        )}
      </div>
    </Modal>
  );
}
