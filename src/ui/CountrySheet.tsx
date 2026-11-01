// A country's team (in the World Cup or the Euros): its best eleven and bench in its kit, and their average rating.
import {countryTeam, nationalKit} from "../game/national";
import type {TKey} from "../i18n";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Flag, Modal} from "./common";
import {iconize} from "./Icon";
import {LineupSheet} from "./LineupSheet";

export function CountrySheet({code, onClose}: {code: string; onClose: () => void}) {
  const {t} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const team = countryTeam(game, code);
  const kit = nationalKit(code);
  return (
    <Modal title={<><Flag code={code} size={22} /> {t(`nat.${code}` as TKey)}</>} onClose={onClose}>
      <p className="muted small sheet-meta">
        <span className="team-ovr">{iconize(t("tac.teamOvr"))} <strong>{team.ovr}</strong></span>
      </p>
      {team.squad ? (
        <LineupSheet
          club={{name: t(`nat.${code}` as TKey), color: kit.color, color2: kit.color2, pattern: kit.pattern, formation: "4-4-2", mentality: "balanced", lineup: team.squad.lineup, bench: team.squad.bench}}
          player={(id) => game.players[id]}
          onPick={(p) => openPlayer(p.id)}
        />
      ) : (
        <p className="muted">{iconize(t("national.noSquad"))}</p>
      )}
    </Modal>
  );
}
