// "Answer first": the questions waiting in the mail, each with its buttons; the dialog closes by itself when
// the last one is answered (then the game can go on).
import {useEffect} from "react";
import {iconize} from "./Icon";
import {useT} from "../i18n";
import {useGameState} from "../store";
import {Modal} from "./common";
import {pendingDecisions} from "./decisions";
import {AwardsList, MessageAction, MessageText} from "./views/Inbox";

export function DecisionsDialog({onClose}: {onClose: () => void}) {
  const {t} = useT();
  const game = useGameState();
  const pending = pendingDecisions(game);
  useEffect(() => {
    if (pending.length === 0) onClose();
  }, [pending.length, onClose]);
  return (
    <Modal title={<></>} onClose={onClose}>
      <p className="muted small">{iconize(t("decisions.hint"))}</p>
      <ul className="decisions">
        {pending.map((m) => (
          <li key={m.id}>
            <p><MessageText message={m} /></p>
            {m.key === "msg.awards" ? <AwardsList message={m} /> : <MessageAction message={m} />}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
