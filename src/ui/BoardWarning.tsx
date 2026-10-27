// The board's warnings, impossible to miss: a pop-up when one is given (the last one says the
// next is the sack), and a red line on the overview and finances while the club is in danger.
import {Icon, iconize} from "./Icon";
import {BOARD_WARNINGS, weeksToNextWarning} from "../game/finance";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Modal} from "./common";

export function BoardWarningPopup() {
  const {t} = useT();
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setView = useGame((s) => s.setView);
  const alert = game?.boardAlert;
  if (!game || !alert || game.gameOver) return null;
  const last = alert.n >= alert.max - 1;
  const close = () => act((g) => { delete g.boardAlert; });
  return (
    <Modal compact title={<><Icon name="warn" size={20} /> {iconize(t("board.title", {n: alert.n, max: alert.max}))}</>} onClose={close}>
      <div className={`board-alert ${last ? "last" : ""}`}>
        <p>{iconize(t("board.text", {cash: alert.cash, club: game.clubs[game.userClubId].name}))}</p>
        <p className="strong">{last ? t("board.last") : t("board.left", {n: alert.max - alert.n})}</p>
        <p className="muted small">{iconize(t("board.hint"))}</p>
      </div>
      <div className="btn-row dialog-actions">
        <button className="btn" onClick={close}>{iconize(t("board.ok"))}</button>
        <button className="btn primary" onClick={() => { close(); setView("finance"); }}><Icon name="coins" size={18} /> {iconize(t("board.toFinance"))}</button>
      </div>
    </Modal>
  );
}

/** A red line while the club is in the red with the board counting: how many warnings, and how long until the next. */
export function BoardWarningBanner() {
  const {t} = useT();
  const game = useGameState();
  const weeks = weeksToNextWarning(game);
  const warnings = game.board?.warnings ?? 0;
  if (weeks === null) return null;
  const next = warnings + 1 >= BOARD_WARNINGS ? t("board.bannerSack", {weeks}) : t("board.bannerNext", {weeks});
  return (
    <div className="board-banner span-2" role="alert">
      ⚠️ <strong>{iconize(t("board.banner", {n: warnings, max: BOARD_WARNINGS}))}</strong> {next}
    </div>
  );
}
