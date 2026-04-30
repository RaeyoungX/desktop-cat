import { PawPrint } from "lucide-react";

export function DashboardHero() {
  return (
    <section className="hero">
      <div>
        <div className="small-label"><PawPrint size={13} /> 专注模式</div>
        <h1>今天让猫咪盯着哪件事？</h1>
        <p>写下目标，开始计时。截图只用于当次 AI 判断，不落盘。</p>
      </div>
      <img src="/assets/cat-sitsit.png" alt="Desktop Cat" />
    </section>
  );
}
