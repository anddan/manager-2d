// A rewarded video. For now a stand-in advert (mockAdProvider) that runs a few
// seconds; the reward comes only once it has run. Clearly marked as an advert.
import {iconize} from "./Icon";
import {useEffect, useState} from "react";
import {mockAdProvider} from "../game/daily";
import {useT} from "../i18n";

export function VideoAd({onReward, onClose}: {onReward: () => void; onClose: () => void}) {
  const {t} = useT();
  const [left, setLeft] = useState(mockAdProvider.seconds);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  const done = left <= 0;
  return (
    <div className="video-ad" role="dialog" aria-label={t("video.label")}>
      <div className="video-top">
        <span className="video-label">{iconize(t("video.label"))}</span>
        {!done && <span className="video-timer">{iconize(t("video.wait", {s: left}))}</span>}
      </div>
      <div className="video-screen" aria-hidden>
        <div className="video-ball">⚽</div>
        <p className="video-mock">{iconize(t("video.mock"))}</p>
        <div className="video-progress"><span style={{width: `${((mockAdProvider.seconds - left) / mockAdProvider.seconds) * 100}%`}} /></div>
      </div>
      <div className="video-actions">
        {done ? (
          <button className="btn primary big" onClick={onReward}>{iconize(t("video.collect"))}</button>
        ) : (
          <button className="btn" onClick={onClose}>{iconize(t("video.closeNo"))}</button>
        )}
      </div>
    </div>
  );
}
