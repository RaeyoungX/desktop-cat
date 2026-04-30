# Desktop Cat

Desktop Cat 是一个 Electron 桌面专注工具：用户在 Dashboard 写下今日任务，开始专注会话后，猫咪会在桌面巡逻。会话中定时截图，通过 Supabase Edge Functions 代理 Vertex AI Gemini Vision 判断是否分心；连续分心才提醒，截图不落盘、不入库。

## 架构

- `electron/main`：Dashboard/透明猫咪窗口、托盘、截图检测调度、本地持久化、云端 API 客户端。
- `electron/preload`：安全 IPC 白名单，向 React 暴露 `window.desktopCat`。
- `src`：Vite + React + TypeScript 渲染层，按 `pages -> components -> hooks` 分层。
- `public/assets`：猫咪图片素材。
- `supabase/functions`：按功能拆分的 Edge Functions，不使用单体网关。

旧 `renderer/*.html + *.js` 已删除，后续只维护 React 代码。

## 功能

- 今日 Todo：添加、删除、勾选完成、点击选为当前专注目标；按本地日期分桶，次日自动清空。
- 专注会话：25 / 45 / 60 / 90 分钟和自定义时长，倒计时、进度条、手动结束、自动结束。
- AI 分心检测：每 30 秒截主屏，连续 2 次 distracted 才提醒；focused/uncertain 重置状态。
- 猫咪行为：会话中巡逻，分心后走到鼠标旁坐下，恢复专注后继续巡逻，会话结束隐藏。
- 云端能力：邮箱登录、额度、会话同步、排行榜、套餐订阅、易支付订单、云商店购买/装备。
- 托盘：显示当前任务和已专注时长，支持打开 Dashboard、结束当前专注、退出。

## 开发命令

```bash
npm install
npm run dev
```

检查与构建：

```bash
npm run typecheck
npm test
npm run build
```

打包：

```bash
npm run build:mac
npm run build:win
npm run pack
```

## Supabase Functions

函数按功能拆分：

- `auth`：`/signup`、`/signin`、`/signout`、`/refresh`
- `user`：当前用户信息
- `quota`：`/status`、`/report`
- `sessions`：`/sync`
- `stats`：`/sync`、`/leaderboard`
- `plans`：套餐列表
- `subscription`：当前订阅
- `payment`：`/create`、`/order/:id`、`/webhook/epay`
- `shop`：`/items`、`/inventory`、`/buy`、`/equip`
- `vision`：`/analyze`
- `analyze-screen`：旧客户端兼容入口

默认线上 base：

```text
https://jtotlqxlsjeiqmklbhmj.supabase.co/functions/v1
```

开发时可覆盖：

```bash
DESKTOP_CAT_API_URL=https://<project-ref>.supabase.co/functions/v1
DESKTOP_CAT_VISION_URL=https://<project-ref>.supabase.co/functions/v1/analyze-screen
DESKTOP_CAT_OPEN_DEVTOOLS=false
```

开发模式默认会为 Dashboard 打开独立 DevTools 窗口，方便看请求和控制台日志；需要临时关闭时设置 `DESKTOP_CAT_OPEN_DEVTOOLS=false`。

## Secrets

Supabase 基础必填：

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Gemini Vision 必填：

```bash
GCP_PROJECT_ID=...
GCP_PRIVATE_KEY=...
GCP_CLIENT_EMAIL=...
VERTEX_LOCATION=us-central1
VISION_MODEL=gemini-3.1-flash-lite-preview
```

易支付可选；缺失时 `/payment/create` 返回 `PAYMENT_NOT_CONFIGURED`，其他功能照常可用：

```bash
EPAY_PID=...
EPAY_KEY=...
EPAY_GATEWAY=...
EPAY_NOTIFY_URL=...
EPAY_RETURN_URL=...
```

也兼容 `EASY_PAY_PID`、`EASY_PAY_PKEY`、`EASY_PAY_API_BASE`、`EASY_PAY_NOTIFY_URL`、`EASY_PAY_RETURN_URL`。

## 部署

```bash
supabase link --project-ref jtotlqxlsjeiqmklbhmj
supabase db push
supabase functions deploy auth user quota sessions stats plans subscription billing payment shop vision analyze-screen --no-verify-jwt
```

`--no-verify-jwt` 是为了支持注册、登录、套餐、商品列表和支付 webhook；每个需要登录的路由在函数内部单独校验 JWT。

## 隐私约束

- 截图只在内存中用于当次 Vision 调用，不写磁盘、不上传 Storage、不入库。
- Vision 日志只记录 requestId、用户短 hash、模型、状态、耗时和平台，不记录 base64 或完整任务文本。
- `uncertain`、锁屏、黑屏、无法判断都按 focused 处理；参考资料必须和任务可见相关，否则不再自动放行。
