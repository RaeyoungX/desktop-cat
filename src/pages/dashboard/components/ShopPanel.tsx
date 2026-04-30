import { Crown, Gift, Glasses, ShoppingBag, Sparkles, Wand2 } from "lucide-react";
import type { CloudUser, ShopItem } from "../../../shared/cloud";

const ICONS = {
  crown: Crown,
  gift: Gift,
  glasses: Glasses,
  sparkles: Sparkles,
  "wand-2": Wand2,
};

type ShopPanelProps = {
  cloudUser: CloudUser | null;
  equipped: string[];
  ownedItems: string[];
  points: number;
  shopItems: ShopItem[];
  onBuyItem: (id: string) => void;
  onToggleEquip: (id: string) => void;
};

export function ShopPanel({ cloudUser, equipped, ownedItems, points, shopItems, onBuyItem, onToggleEquip }: ShopPanelProps) {
  return (
    <main className="panel-stack">
      <section className="shop-hero">
        <img src={cloudUser ? "/assets/cat-box.png" : "/assets/cat-sleep.png"} alt="" />
        <div>
          <strong>{cloudUser ? `${points} 积分` : "本地基础装扮"}</strong>
          <span>{cloudUser ? "购买后库存会云端同步" : "登录后可购买并同步云端库存"}</span>
        </div>
      </section>

      <section className="shop-list">
        {shopItems.map((item) => {
          const Icon = ICONS[item.icon as keyof typeof ICONS] ?? Gift;
          const owned = cloudUser ? ownedItems.includes(item.id) : false;
          const isEquipped = equipped.includes(item.id);
          const canBuy = cloudUser && !owned && points >= item.cost;
          return (
            <div className="shop-item" key={item.id}>
              <div className="shop-icon" style={{ background: item.iconBg, color: item.iconColor }}>
                <Icon size={17} />
              </div>
              <div className="shop-copy">
                <strong>{item.name}</strong>
                <span>{item.desc} · {item.cost} 积分</span>
              </div>
              {!cloudUser ? (
                <button onClick={() => onToggleEquip(item.id)}>登录后装备</button>
              ) : owned ? (
                <button onClick={() => onToggleEquip(item.id)}>{isEquipped ? "取下" : "装备"}</button>
              ) : (
                <button disabled={!canBuy} onClick={() => onBuyItem(item.id)}>
                  {points >= item.cost ? "购买" : "积分不足"}
                </button>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
