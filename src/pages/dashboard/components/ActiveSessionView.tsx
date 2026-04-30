import { Clock3, SquareCheck } from "lucide-react";
import type { ActiveSession } from "../../../shared/types";
import { formatTimer } from "../hooks/useDashboardState";

type ActiveSessionViewProps = {
  activeSession: ActiveSession;
  detectorStatus: string;
  progress: number;
  remainingSeconds: number;
  onFinish: () => void;
};

export function ActiveSessionView({
  activeSession,
  detectorStatus,
  progress,
  remainingSeconds,
  onFinish,
}: ActiveSessionViewProps) {
  return (
    <section className="active-panel">
      <div className="active-badge"><span /> 专注中</div>
      <img className="active-cat" src="/assets/cat-sitsit.png" alt="" />
      <h1>{activeSession.name}</h1>
      <p><Clock3 size={14} /> 计划 {activeSession.duration} 分钟</p>
      <div className="timer">{formatTimer(remainingSeconds)}</div>
      <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>
      <div className={`focus-health ${activeSession.distractCount > 2 ? "danger" : activeSession.distractCount > 0 ? "warn" : ""}`}>
        {activeSession.distractCount > 0 ? `已提醒 ${activeSession.distractCount} 次` : "猫咪正在安静巡逻"}
      </div>
      {detectorStatus ? <div className="detector-status">{detectorStatus}</div> : null}
      <button className="primary-button" onClick={onFinish}>
        <SquareCheck size={17} /> 结束专注
      </button>
    </section>
  );
}
