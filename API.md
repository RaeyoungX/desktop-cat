# Desktop Cat 后端接口文档

**版本**：v1.0  
**栈**：Node.js 22 LTS · Hono · Zod · Redis · Supabase · Pino  
**Base URL**：`https://api.desktopcat.app/v1`

---

## 通用约定

### 请求头

| Header | 说明 |
|--------|------|
| `Authorization: Bearer <jwt>` | Supabase 颁发的用户 JWT，除注册/登录外必传 |
| `Content-Type: application/json` | POST/PUT 请求必传 |
| `X-Client-Version: 1.0.0` | 客户端版本，用于灰度兼容 |

### 响应格式

```jsonc
// 成功
{ "ok": true, "data": { ... } }

// 失败
{ "ok": false, "error": { "code": "QUOTA_EXCEEDED", "message": "本月 AI 检测额度已用完" } }
```

### 错误码

| code | HTTP | 含义 |
|------|------|------|
| `UNAUTHORIZED` | 401 | JWT 缺失或过期 |
| `FORBIDDEN` | 403 | 权限不足（如免费用户访问付费功能） |
| `QUOTA_EXCEEDED` | 402 | AI 检测月度额度已用完 |
| `PLAN_REQUIRED` | 402 | 需要付费套餐 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `RATE_LIMITED` | 429 | 请求过频（Redis 限流） |
| `ORDER_NOT_FOUND` | 404 | 订单不存在 |
| `PAYMENT_FAILED` | 400 | 支付失败 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

### 限流策略（Redis）

| 接口类型 | 限制 |
|---------|------|
| 登录/注册 | 10次/分钟/IP |
| 一般接口 | 60次/分钟/用户 |
| AI 检测上报 | 4次/分钟/用户（30秒间隔保护）|
| 支付创建 | 5次/分钟/用户 |

---

## 一、用户认证

### 1.1 注册

```
POST /auth/signup
```

**Body**
```json
{
  "email": "rae@example.com",
  "password": "••••••••"
}
```

**Response**
```json
{
  "ok": true,
  "data": {
    "user_id": "uuid",
    "email": "rae@example.com",
    "access_token": "eyJ...",
    "expires_at": 1776906176
  }
}
```

---

### 1.2 登录

```
POST /auth/signin
```

**Body**
```json
{
  "email": "rae@example.com",
  "password": "••••••••"
}
```

**Response**
```json
{
  "ok": true,
  "data": {
    "user_id": "uuid",
    "email": "rae@example.com",
    "access_token": "eyJ...",
    "expires_at": 1776906176,
    "plan": "pro",
    "quota_remaining_hours": 47.5
  }
}
```

---

### 1.3 登出

```
POST /auth/signout
Authorization: Bearer <jwt>
```

**Response**
```json
{ "ok": true }
```

---

### 1.4 刷新 Token

```
POST /auth/refresh
```

**Body**
```json
{ "refresh_token": "..." }
```

**Response**
```json
{
  "ok": true,
  "data": {
    "access_token": "eyJ...",
    "expires_at": 1776906176
  }
}
```

---

## 二、用户信息

### 2.1 获取用户完整信息

```
GET /user/me
Authorization: Bearer <jwt>
```

**Response**
```json
{
  "ok": true,
  "data": {
    "user_id": "uuid",
    "email": "rae@example.com",
    "plan": "pro",
    "plan_expires_at": "2026-12-31",
    "quota": {
      "plan_hours": 60,
      "used_hours": 12.5,
      "remaining_hours": 47.5,
      "reset_at": "2026-05-01"
    },
    "stats": {
      "points": 380,
      "total_sessions": 5,
      "total_mins": 250,
      "level": 3,
      "level_name": "资深监工"
    }
  }
}
```

---

## 三、AI 检测 & 额度

### 3.1 上报一次 AI 检测用量

每次截图分析完成后客户端调用，后端记录用量并更新 Redis 缓存。

```
POST /quota/report
Authorization: Bearer <jwt>
```

**Body**
```json
{
  "session_id": "sess_abc123",
  "duration_seconds": 30,
  "status": "focused",
  "activity": "写 React 组件"
}
```

**Response（正常）**
```json
{
  "ok": true,
  "data": {
    "used_hours": 12.51,
    "remaining_hours": 47.49,
    "quota_pct": 20.9
  }
}
```

**Response（额度耗尽）**
```json
{
  "ok": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "本月 AI 检测额度已用完",
    "data": { "plan": "pro", "plan_hours": 60, "used_hours": 60 }
  }
}
```

> **说明**：客户端收到 `QUOTA_EXCEEDED` 后停止本地检测，并在 UI 显示升级提示。

---

### 3.2 查询当月额度状态

```
GET /quota/status
Authorization: Bearer <jwt>
```

**Response**
```json
{
  "ok": true,
  "data": {
    "plan": "pro",
    "plan_hours": 60,
    "used_hours": 12.5,
    "remaining_hours": 47.5,
    "quota_pct": 20.8,
    "reset_at": "2026-05-01T00:00:00Z"
  }
}
```

> **缓存**：余额从 Redis 读取（TTL 5分钟），避免频繁查 DB。

---

## 四、专注会话同步

### 4.1 同步会话数据（批量）

```
POST /sessions/sync
Authorization: Bearer <jwt>
```

**Body**
```json
{
  "sessions": [
    {
      "local_id": "1714000000000",
      "name": "写代码",
      "duration": 45,
      "start_time": "2026-04-29T09:00:00Z",
      "end_time": "2026-04-29T09:45:00Z",
      "distract_count": 2
    }
  ]
}
```

**Response**
```json
{
  "ok": true,
  "data": {
    "synced": 1,
    "points_awarded": 45,
    "total_points": 425
  }
}
```

---

### 4.2 同步积分与统计

```
POST /stats/sync
Authorization: Bearer <jwt>
```

**Body**
```json
{
  "points": 380,
  "total_sessions": 5,
  "total_mins": 250
}
```

**Response**
```json
{
  "ok": true,
  "data": {
    "points": 380,
    "total_sessions": 5,
    "total_mins": 250,
    "updated_at": "2026-04-29T13:00:00Z"
  }
}
```

---

### 4.3 获取排行榜

```
GET /stats/leaderboard?limit=10
Authorization: Bearer <jwt>
```

**Response**
```json
{
  "ok": true,
  "data": {
    "rank": 42,
    "leaderboard": [
      { "rank": 1, "user_id": "uuid", "points": 9800, "total_mins": 3200 }
    ]
  }
}
```

---

## 五、订阅套餐

### 5.1 获取套餐列表

```
GET /plans
```

**Response**
```json
{
  "ok": true,
  "data": {
    "plans": [
      { "id": "free",  "name": "免费版",  "quota_hours": 5,   "price_monthly": 0,   "price_yearly": 0    },
      { "id": "light", "name": "Light",   "quota_hours": 20,  "price_monthly": 3,   "price_yearly": 28   },
      { "id": "pro",   "name": "Pro",     "quota_hours": 60,  "price_monthly": 15,  "price_yearly": 148  },
      { "id": "power", "name": "Power",   "quota_hours": 120, "price_monthly": 26,  "price_yearly": 258  }
    ]
  }
}
```

---

### 5.2 获取当前订阅

```
GET /subscription
Authorization: Bearer <jwt>
```

**Response**
```json
{
  "ok": true,
  "data": {
    "plan": "pro",
    "billing": "yearly",
    "status": "active",
    "current_period_start": "2026-01-01",
    "current_period_end": "2026-12-31",
    "auto_renew": true
  }
}
```

---

## 六、支付（支付宝 & 微信支付）

### 6.1 创建支付订单

```
POST /payment/create
Authorization: Bearer <jwt>
```

**Body**
```json
{
  "plan_id": "pro",
  "billing": "yearly",
  "payment_method": "alipay"
}
```

**Response**
```json
{
  "ok": true,
  "data": {
    "order_id": "CAT20260429001",
    "amount": 148,
    "currency": "CNY",
    "payment_method": "alipay",
    "qr_code_url": "https://qr.alipay.com/...",
    "expires_at": "2026-04-29T13:30:00Z"
  }
}
```

> `payment_method` 可选值：`alipay` | `wechat`

---

### 6.2 查询订单状态

```
GET /payment/order/:order_id
Authorization: Bearer <jwt>
```

**Response**
```json
{
  "ok": true,
  "data": {
    "order_id": "CAT20260429001",
    "status": "paid",
    "plan": "pro",
    "amount": 148,
    "paid_at": "2026-04-29T13:12:00Z"
  }
}
```

| status | 含义 |
|--------|------|
| `pending` | 待支付 |
| `paid` | 已支付，订阅已激活 |
| `expired` | 二维码已过期 |
| `failed` | 支付失败 |
| `refunded` | 已退款 |

> 客户端每 3 秒轮询一次，最长轮询 10 分钟；收到 `paid` 后刷新本地 plan 状态。

---

### 6.3 支付宝异步回调（Webhook）

```
POST /payment/webhook/alipay
```

> 由支付宝服务端主动调用，无需鉴权 JWT，用签名验证合法性。

**Body（支付宝标准参数）**
```
out_trade_no=CAT20260429001&trade_status=TRADE_SUCCESS&sign=...
```

**处理逻辑**：
1. 验证支付宝签名
2. 校验 `out_trade_no` 对应订单存在且 `amount` 匹配
3. Redis 防重放：`SET webhook:alipay:{trade_no} 1 EX 86400`，已处理则直接返回 `success`
4. 更新 Supabase `subscriptions` 表，激活套餐
5. 重置当月 AI 额度缓存
6. 返回字符串 `success`

---

### 6.4 微信支付回调（Webhook）

```
POST /payment/webhook/wechat
```

**Body（微信 JSON 通知）**
```json
{
  "out_trade_no": "CAT20260429001",
  "trade_state": "SUCCESS",
  "sign": "..."
}
```

处理逻辑同支付宝，返回：
```json
{ "code": "SUCCESS", "message": "成功" }
```

---

## 七、商店 & 装扮

### 7.1 获取商品列表

```
GET /shop/items
```

> 无需登录，商品列表全局统一。新增装扮只需更新服务端，客户端无需升级。

**Response**
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "bow",
        "name": "蝴蝶结",
        "icon": "gift",
        "icon_color": "#db2777",
        "icon_bg": "#fce7f3",
        "cost": 25,
        "desc": "优雅满分",
        "available": true
      },
      {
        "id": "hat",
        "name": "礼帽",
        "icon": "wand-2",
        "icon_color": "#374151",
        "icon_bg": "#f3f4f6",
        "cost": 50,
        "desc": "绅士猫咪",
        "available": true
      }
    ]
  }
}
```

---

### 7.2 获取用户已拥有 & 已装备的道具

```
GET /shop/inventory
Authorization: Bearer <jwt>
```

**Response**
```json
{
  "ok": true,
  "data": {
    "owned":    ["bow", "hat"],
    "equipped": ["bow"]
  }
}
```

> **缓存**：Redis `inventory:{user_id}` TTL 10分钟，购买/装备操作后主动失效。

---

### 7.3 购买道具

```
POST /shop/buy
Authorization: Bearer <jwt>
```

**Body**
```json
{ "item_id": "hat" }
```

**Response（成功）**
```json
{
  "ok": true,
  "data": {
    "item_id": "hat",
    "points_spent": 50,
    "points_remaining": 330,
    "owned": ["bow", "hat"]
  }
}
```

**Response（积分不足）**
```json
{
  "ok": false,
  "error": {
    "code": "INSUFFICIENT_POINTS",
    "message": "积分不足，需要 50 分，当前 20 分"
  }
}
```

> **服务端校验**：积分以 `user_stats.points` 为准，客户端本地积分仅做 UI 展示，不可信。

---

### 7.4 装备 / 卸下道具

```
POST /shop/equip
Authorization: Bearer <jwt>
```

**Body**
```json
{
  "item_id": "hat",
  "action": "equip"
}
```

> `action` 可选值：`equip` | `unequip`

**Response**
```json
{
  "ok": true,
  "data": {
    "equipped": ["bow", "hat"]
  }
}
```

---

### 7.5 数据表补充

```sql
-- 用户道具库存
CREATE TABLE inventory (
  user_id   UUID REFERENCES auth.users,
  item_id   TEXT,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- 用户装备状态
CREATE TABLE equipped_items (
  user_id   UUID PRIMARY KEY REFERENCES auth.users,
  item_ids  TEXT[] DEFAULT '{}',   -- ["bow","hat"]
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 九、数据库表结构（Supabase）

```sql
-- 用户统计
CREATE TABLE user_stats (
  user_id       UUID PRIMARY KEY REFERENCES auth.users,
  points        INT DEFAULT 0,
  total_sessions INT DEFAULT 0,
  total_mins    INT DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 专注会话
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users,
  name          TEXT,
  duration      INT,  -- 分钟
  start_time    TIMESTAMPTZ,
  end_time      TIMESTAMPTZ,
  distract_count INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 订阅
CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users,
  plan          TEXT CHECK (plan IN ('free','light','pro','power')),
  billing       TEXT CHECK (billing IN ('monthly','yearly')),
  status        TEXT CHECK (status IN ('active','expired','cancelled')),
  period_start  DATE,
  period_end    DATE,
  auto_renew    BOOL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 支付订单
CREATE TABLE orders (
  id            TEXT PRIMARY KEY,  -- CAT20260429001
  user_id       UUID REFERENCES auth.users,
  plan_id       TEXT,
  billing       TEXT,
  amount        NUMERIC(8,2),
  currency      TEXT DEFAULT 'CNY',
  payment_method TEXT,
  status        TEXT DEFAULT 'pending',
  paid_at       TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- AI 检测月度用量
CREATE TABLE quota_usage (
  user_id       UUID REFERENCES auth.users,
  month         TEXT,  -- '2026-04'
  used_seconds  INT DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
```

---

## 十、Redis Key 规范

| Key | TTL | 用途 |
|-----|-----|------|
| `quota:{user_id}:{month}` | 月末 | AI 检测剩余秒数缓存 |
| `session:{user_id}` | 24h | 当前登录态缓存 |
| `webhook:alipay:{trade_no}` | 24h | 防重放 |
| `webhook:wechat:{trade_no}` | 24h | 防重放 |
| `rate:{ip}:login` | 60s | 登录限流计数 |
| `rate:{user_id}:api` | 60s | 通用接口限流 |
| `rate:{user_id}:quota` | 60s | 上报限流 |
