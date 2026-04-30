import { BarChart2, CreditCard, ListTodo, PawPrint, ShoppingBag, Trophy } from "lucide-react";
import type { DashboardTab } from "../constants";

type DashboardTabsProps = {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

const TABS = [
  { key: "tasks", label: "任务", Icon: ListTodo },
  { key: "summary", label: "总结", Icon: BarChart2 },
  { key: "shop", label: "商店", Icon: ShoppingBag },
  { key: "subscription", label: "订阅", Icon: CreditCard },
  { key: "leaderboard", label: "排行", Icon: Trophy },
  { key: "profile", label: "我的", Icon: PawPrint },
] satisfies Array<{ key: DashboardTab; label: string; Icon: typeof ListTodo }>;

export function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <nav className="tabs">
      {TABS.map(({ key, label, Icon }) => (
        <button key={key} className={activeTab === key ? "active" : ""} onClick={() => onChange(key)}>
          <Icon size={14} /> {label}
        </button>
      ))}
    </nav>
  );
}
