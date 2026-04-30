import { Trophy } from "lucide-react";
import type { CloudUser, LeaderboardEntry } from "../../../shared/cloud";

type LeaderboardPanelProps = {
  cloudUser: CloudUser | null;
  leaderboard: LeaderboardEntry[];
  myRank: number | null;
};

export function LeaderboardPanel({ cloudUser, leaderboard, myRank }: LeaderboardPanelProps) {
  return (
    <main className="panel-stack">
      <section className="leaderboard-hero">
        <img src="/assets/cat-play.png" alt="" />
        <div>
          <strong>{myRank ? `当前第 ${myRank} 名` : "专注排行榜"}</strong>
          <span>{cloudUser ? `${cloudUser.stats.points} 积分 · ${cloudUser.stats.totalMins} 分钟` : "登录后查看你的排名"}</span>
        </div>
      </section>

      <section className="leaderboard-list">
        {leaderboard.length > 0 ? leaderboard.map((entry) => (
          <div className="leaderboard-row" key={`${entry.rank}-${entry.userId}`}>
            <div className="rank-mark"><Trophy size={14} />{entry.rank}</div>
            <div>
              <strong>{entry.userId.slice(0, 8)}</strong>
              <span>{entry.totalMins} 分钟 · {entry.totalSessions ?? 0} 次</span>
            </div>
            <b>{entry.points}</b>
          </div>
        )) : (
          <div className="empty">暂无云端排行数据</div>
        )}
      </section>
    </main>
  );
}
