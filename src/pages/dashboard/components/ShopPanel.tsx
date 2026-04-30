import { Star } from "lucide-react";
import { SHOP_ITEMS } from "../constants";

type ShopPanelProps = {
  equipped: string[];
  points: number;
  onToggleEquip: (id: string) => void;
};

export function ShopPanel({ equipped, points, onToggleEquip }: ShopPanelProps) {
  return (
    <main className="panel-stack">
      <section className="shop-header"><Star size={19} /><strong>{points}</strong><span>积分</span></section>
      <section className="shop-list">
        {SHOP_ITEMS.map((item) => (
          <div className="shop-item" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.cost} 积分</span>
            </div>
            <button onClick={() => onToggleEquip(item.id)}>{equipped.includes(item.id) ? "取下" : "装备"}</button>
          </div>
        ))}
      </section>
    </main>
  );
}
