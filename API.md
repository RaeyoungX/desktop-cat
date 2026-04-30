# Desktop Cat 后端接口文档

**版本**：v1.0  
**栈**：Supabase Edge Functions（Deno · TypeScript）· Zod · Supabase Postgres & Auth  
**Base URL**：以部署为准。**示例**：`https://api.desktopcat.app/v1`（自定义域反代至 Functions）；或直接 `https://<PROJECT_REF>.supabase.co/functions/v1/<edge-function>`。**下文路径按功能域描述；当前实现按 Edge Function 拆分部署**。

---

## 通用约定

### Edge Functions 与路由

- **服务端**：全部为 **Supabase Edge Functions**，**不再使用 Hono / 自建 Node HTTP 进程**。
- **路由**：按功能域拆分 Supabase Edge Functions，不使用单个 `desktop-api` 大网关。当前域包括 `auth`、`user`、`quota`、`sessions`、`stats`、`plans`、`subscription`、`payment`、`vision`、`shop`；若使用自定义域，可由反向代理拼装统一前缀。
- **数据库**：读写 **Supabase Postgres**；需在 Functions 中使用 **Service Role** 的路径（如付费 Webhook 写订阅）必须服务端校验签名后执行，密钥仅存 **Edge Secrets**。
- **校验**：推荐使用 **Zod** 解析 Body / Query。
- **敏感配置**：`GCP_PROJECT_ID`、`GCP_PRIVATE_KEY`、`GCP_CLIENT_EMAIL`、`VERTEX_LOCATION`、`VISION_MODEL`、`EPAY_PID`、`EPAY_KEY`、`EPAY_GATEWAY` 等通过 **Supabase Dashboard → Edge Functions → Secrets**（或 `supabase secrets set`）注入，在 Function 内 `Deno.env.get(...)` 读取。
- **Vision 默认值**：`VERTEX_LOCATION=us-central1`、`VISION_MODEL=gemini-3.1-flash-lite-preview`。Vertex URL 与现有 `analyze-speech` 一致：`https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/{model}:generateContent`。
- **日志**：使用 `console` / Deno 标准输出或 Supabase 仪表盘日志；**禁止**在日志中输出截图、任务全文、支付验签原文。

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
| `RATE_LIMITED` | 429 | 请求过频（PostgreSQL `rate_limit_buckets` 计数） |
| `ORDER_NOT_FOUND` | 404 | 订单不存在 |
| `PAYMENT_FAILED` | 400 | 支付失败 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

### 限流策略（Supabase / Postgres）

| 接口类型 | 限制 |
|---------|------|
| 登录/注册 | 10次/分钟/IP |
| 一般接口 | 60次/分钟/用户 |
| AI 检测上报 | 4次/分钟/用户（30秒间隔可由业务逻辑与 `sessions`/`quota_usage` 共同约束） |
| 支付创建 | 5次/分钟/用户 |

实现：**不引入 Redis**。在 `rate_limit_buckets` 表中按 **`bucket_key` + `window_start`** 累加计数（或由 Edge Function 调用 **RPC/SQL** 单行 upsert）；窗口通常为 **对齐到日历分钟**，详见 §十。超限返回 `429 RATE_LIMITED`。限流计数读写均在 **Functions** 内通过 **Supabase 服务端密钥**访问 Postgres。

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

每次截图分析完成后客户端调用；**Edge Function** 内 **UPSERT `quota_usage`**（累加当月 `used_seconds`），再结合套餐计算剩余额度。**单一事实来源**：Postgres（`quota_usage` + `subscriptions` / `plans`），不写旁路缓存。

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

> **数据**：直接从 `quota_usage` 与用户当前套餐推导；可选用 **同一 Edge Function isolate 内的短 TTL 内存**，仍不引入 Redis。

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

## 六、支付（易支付聚合：对外统一网关）

**收银约定**：不向公网暴露「支付宝开放平台 / 微信支付开放平台」的官方异步回调地址。**支付宝扫码与微信支付均由易支付（或等价四方聚合）代收**；**Edge Function** 只与聚合 **API（下单）** 与 **`POST /payment/webhook/epay`（异步通知）** 交互。客户端请求的 `payment_method: "alipay" | "wechat"` **仅映射到聚合侧支付方式**（`type`/通道枚举以实现商字段为准）。

---

### 6.1 创建支付订单（Edge Function 请求易支付下单）

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

| 字段 | 说明 |
|------|------|
| `payment_method` | `alipay` \| `wechat`。对应用户在聚合收银台打开的 **支付宝 / 微信**，非直连蚂蚁/腾讯开放平台。 |

**处理流程（Edge Function）**

1. 创建 `orders` 记录：`pending`，金额为套餐现价快照。
2. 以 `orders.id`（如 `CAT20260429001`）作为 **`out_trade_no`**。
3. **Edge Function** 通过 **`fetch`** 请求易支付 **提交订单**接口（`EPAY_GATEWAY`）：`pid`、`key` 参与签名、`money`、`type`/`payment_method` 映射、`notify_url`（公网 HTTPS → `POST /payment/webhook/epay`）、可选 `return_url`、`out_trade_no`。**商户密钥不落客户端**。
4. 将上游返回的 `payurl` / PC-H5 链接归入 **`pay_url`**；将易支付原始 `qrcode` 归入 **`qr_code`**。注意：易支付 `qrcode` 是扫码内容 payload，**不是图片 URL**。

**Response**

```json
{
  "ok": true,
  "data": {
    "order_id": "CAT20260429001",
    "amount": 148,
    "currency": "CNY",
    "payment_method": "alipay",
    "pay_url": "https://pay.example-gateway.com/submit?id=...",
    "qr_code": "alipays://platformapi/startapp?...",
    "qr_code_url": null,
    "expires_at": "2026-04-29T13:30:00Z"
  }
}
```

| 字段 | 说明 |
|------|------|
| `pay_url` | 易支付返回的支付链接，可作为兜底打开入口，也可在没有 `qr_code` 时生成二维码。 |
| `qr_code` | 易支付原始 `qrcode` 扫码 payload。客户端用本地 `qrcode` 库生成 data URL 图片展示。 |
| `qr_code_url` | 兼容旧客户端字段。新实现不把 `qrcode` 写入此字段；没有图片 URL 时返回 `null`。 |

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
| `paid` | 已支付，订阅已通过 Edge Function / Postgres 落库激活 |
| `expired` | 订单超时未付 |
| `failed` | 支付失败 / 聚合关单 |
| `refunded` | 已退款 |

> 客户端可每 3 秒轮询，最长约 10 分钟；收到 `paid` 后刷新 `GET /user/me` 或 `GET /quota/status`。

---

### 6.3 易支付异步通知（Webhook）

```
POST /payment/webhook/epay
```

无需 JWT。由 **易支付**在用户支付完成后通知；**不再提供** `POST /payment/webhook/alipay`、`POST /payment/webhook/wechat`（支付宝/微信官方回调由聚合商对接，非本 API 表面路径）。

**请求体**

- `Content-Type`、字段名（如 `out_trade_no`、`money`、`trade_status`、`sign`）以实现商文档为准，常见为 **`application/x-www-form-urlencoded`**。
- 验签前不得采信金额与成功状态。

**处理逻辑**

1. 按实现商规则 **验签**。
2. `out_trade_no` → `orders.id`：存在、`status === pending`、金额与订单 **一致**（注意分/元与精度）。
3. **幂等**：`INSERT INTO epay_webhook_dedupe (out_trade_no) VALUES (...)`；若主键冲突则 **直接返回** `success`（易支付重试不再改库）。
4. 支付成功：更新 `orders`（`paid`、`paid_at`），写/更新 `subscriptions`（`active`、周期）；**按 `quota_usage` 与套餐规则重算**当月可用 AI 秒数（仍仅写回 Postgres，无外部 KV）。
5. 响应体为 **纯文本** `success`（或实现商要求的固定串），避免非约定格式触发对方重试风暴。

**环境变量（示例）**

`EPAY_PID`、`EPAY_KEY`、`EPAY_GATEWAY`、`EPAY_NOTIFY_URL`（与商户后台「异步通知地址」完全一致）。

---

### 6.4 Gemini Vision 代理（与本节支付并列，密钥不落客户端）

桌面端 **不得** 携带 Vertex/Gemini 密钥。`vision` Edge Function 在已通过 JWT 鉴权、且用户仍有 AI 额度时响应：

```
POST /vision/analyze
Authorization: Bearer <jwt>
```

**Body**

```json
{
  "screenshotBase64": "/9j/4AAQSkZJRgABAQ...",
  "mimeType": "image/jpeg",
  "taskName": "写 React 组件",
  "sessionId": "sess_abc123",
  "checkId": "check_1777545000000_ab12cd",
  "clientMeta": { "platform": "darwin" }
}
```

**Response**

```json
{
  "status": "focused",
  "confidence": 0.86,
  "activity": "写代码",
  "reason": "The screen shows a code editor related to the task.",
  "checkId": "check_1777545000000_ab12cd"
}
```

**隐私与存储**

- 截图只用于当次 Vision 判断；客户端 buffer/base64 分析后立即释放。
- 服务端不写 Supabase Storage，不入库，不记录 base64，不记录完整任务全文。
- 日志只记录 `requestId`、用户 hash、耗时、模型、状态和错误码。

**Prompt 策略**

- 正例：与任务可见相关的代码、文档、终端、设计稿、任务相关网页、会议、笔记、参考资料。
- 反例：短视频、游戏、购物、社交信息流、明显无关聊天、娱乐内容，以及看似工作但和当前任务无关的邮件/聊天/网页/文档。
- 黑屏、锁屏、空白、切窗口、信息不足、无法判断返回 `uncertain`。
- `uncertain` 在客户端按 focused 处理；误报成本高于漏报。

**客户端检测契约**

- 会话开始 30 秒后第一次检测，之后每 30 秒一次。
- 截主屏，优先 `screen: 0`；若 display id 不可用，回退到默认截图。
- 本地灵敏度 `distractThreshold` 支持 `1 | 2 | 3`，默认 2；连续达到阈值的 `distracted` 才触发猫咪提醒。
- 任意一次 `focused` 或 `uncertain` 重置连续分心计数，并让猫咪恢复游走。
- Edge Function 失败、无权限、额度耗尽时不触发提醒，只在 UI 显示检测暂停/不可用。
- macOS 屏幕录制权限被拒时，客户端切换为低精度 `behaviorOnly` 行为检测，仅记录 `uncertain` 活动状态，不做语义分心提醒。

客户端在单次分析成功后 **再调用 `POST /quota/report`**（见第三节）记入 30 秒用量；若先做额度判断再调 Vision，可减少无效模型调用。

**限流**：与 §「限流策略」一致，使用 `rate_limit_buckets`，`bucket_key` 建议 `vision:user:{user_id}`；与 `POST /quota/report` 的 `quota:user:{user_id}` 分开计数。

---

## 七、商店 & 装扮

### 7.1 获取商品列表

```
GET /shop/items
```

> 无需登录，商品列表全局统一。新增装扮只需更新 **数据库或静态配置**，客户端无需升级。

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

> **数据源**：直接从 `inventory` / `equipped_items`/`user_stats` 读取；不写 Redis。**可选**：同一 **Edge Function 实例（isolate）存活期内**的进程内 LRU 短缓存，仅在写库成功后失效。

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

> **服务端校验**（Functions 侧）：积分以 `user_stats.points` 为准，客户端本地积分仅做 UI 展示，不可信。

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

-- HTTP 限流（替代 Redis KV）：对齐到日历分钟的一组 key
CREATE TABLE rate_limit_buckets (
  bucket_key     TEXT NOT NULL,
  window_start   TIMESTAMPTZ NOT NULL,
  hit_count      INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX rate_limit_buckets_key_recent ON rate_limit_buckets (bucket_key, window_start DESC);

-- 易支付 webhook 幂等：同一 merchant out_trade_no 仅允许一条成功入账路径（先插入再事务内改订单）
CREATE TABLE epay_webhook_dedupe (
  out_trade_no    TEXT PRIMARY KEY,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 十、限流与幂等约定（PostgreSQL / Supabase）

**原则**：不向架构中额外引入 Redis、Memcached 或独立队列；限流计数与 Webhook 去重全部由 **上文 `rate_limit_buckets`、`epay_webhook_dedupe`** 承载。Supabase Auth 自带的 Session/JWT **不由本表冗余**。

### `rate_limit_buckets.bucket_key` 命名建议

| `bucket_key` 模式 | 配合窗口（建议） | 用途 |
|------------------|------------------|------|
| `login:ip:{ip}` | 当前 UTC 分钟的 `window_start = date_trunc('minute', now())` | 注册 / 登录 |
| `api:user:{user_id}` | 同上 | 通用已认证接口 |
| `quota:user:{user_id}` | 同上 | `POST /quota/report` |
| `vision:user:{user_id}` | 同上 | `POST /vision/analyze` |
| `payment:user:{user_id}` | 同上 | `POST /payment/create` |

对每个请求：**`UPSERT`** 该行 `hit_count`，若超过 §「限流策略」阈值则 **`429`**。可配合 **周期性 SQL**（如 `delete from rate_limit_buckets where window_start < now() - interval '2 hours'`）或 Supabase Cron 精简历史行。

### `epay_webhook_dedupe`

在验签通过后、更新 `orders` 之前：**先插入 `out_trade_no`**；冲突则视作易支付重复通知，**HTTP 仍返回约定成功**，避免无限重试。与 **`orders` 更新的同一 Postgres 事务**内编排时注意 **顺序**（先 dedupe insert 成功者才执行扣款入账逻辑；若你希望「仅已成功支付才写 dedupe」，可改为在完成 `orders.status = paid` 的同一事务内 `INSERT ... ON CONFLICT DO NOTHING`）。

### Session / 配额

登录态依赖 **Supabase Auth** JWT；配额余量 **`quota_usage` + 套餐表** 计算，不靠外部缓存层。
