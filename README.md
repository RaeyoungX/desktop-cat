# Desktop Cat

Desktop Cat 是一个 Electron 桌面专注工具：用户在 Dashboard 写下今日任务，开始专注会话后，猫咪会在桌面底部巡逻。会话中定时截图并通过 Supabase Edge Function 代理 Vertex AI Gemini Vision 判断是否分心；连续分心才提醒，截图不落盘、不入库。

## 当前架构

项目已经从旧的 `renderer/*.html + *.js` 迁移到 Electron + Vite + React + TypeScript：

- `electron/main`：Electron 主进程，负责 Dashboard/猫咪透明窗口、托盘、会话状态、截图检测调度、本地持久化。
- `electron/preload`：安全 IPC 白名单，向渲染层暴露 `window.desktopCat` 和猫咪窗口兼容 API。
- `src`：Vite + React 渲染层，按 `pages -> components -> hooks` 分层组织，并包含共享类型、统计/任务/检测纯逻辑。
  - `src/pages/dashboard`：Dashboard 页面、页面内组件、页面内 hooks。
  - `src/pages/cat`：透明猫咪窗口页面、画布组件、猫咪窗口 hooks。
  - `src/components`：跨页面复用组件。
  - `src/hooks`：跨页面复用 hooks。
- `public/assets`：运行时静态素材，当前复用原猫咪图片资源。
- `supabase/functions/analyze-screen`：Supabase Edge Function，通过 Vertex AI Gemini Vision 做屏幕相关性分析。

旧 `renderer/` 目录已经删除，后续 UI 只维护 `src/pages/*`、`src/components/*` 和 `src/hooks/*` 下的 React 代码。

## 功能范围

- 今日 Todo：添加、删除、勾选完成、点击选为当前专注目标；按本地日期分桶，次日自动清空。
- 专注会话：支持 25 / 45 / 60 / 90 分钟和自定义时长，倒计时、进度条、手动结束、自动结束。
- AI 分心检测：会话中每 30 秒截主屏，调用 `analyze-screen`；连续 2 次 distracted 才提醒，focused/uncertain 会重置提醒状态。
- 猫咪行为：会话中显示透明置顶猫咪窗口，默认巡逻；分心后走到鼠标旁边坐下；恢复专注后继续巡逻；会话结束隐藏。
- 总结：展示今日专注时长、专注次数、完成任务、提醒次数、猫咪评语、本周柱状图和检测时间线。
- 托盘：常驻托盘，显示当前任务和已专注时长，支持打开 Dashboard、结束当前专注、退出。

## 开发命令

```bash
npm install
npm run dev
```

常用检查：

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

`build:mac` 输出 `dmg` 和 `zip`，`build:win` 输出 Windows NSIS 安装包。当前本地开发配置默认跳过 macOS 签名，避免没有生产证书或 timestamp 服务不可用时阻塞开发打包。生产发布时应在 CI 中配置签名、公证和应用图标。

## AI Vision 配置

桌面端不保存 Gemini API Key。截图会发送到 Supabase Edge Function，由服务端使用 Google service account 调 Vertex AI。

Edge Function 需要配置这些 secrets：

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GCP_PROJECT_ID=...
GCP_PRIVATE_KEY=...
GCP_CLIENT_EMAIL=...
VERTEX_LOCATION=global
VISION_MODEL=gemini-3.1-flash-preview
```

如果当前 Vertex 项目不支持 `gemini-3.1-flash-preview`，可以只改 secret：

```bash
VISION_MODEL=gemini-3-flash-preview
```

客户端需要知道 Edge Function URL。开发时可设置：

```bash
DESKTOP_CAT_VISION_URL=https://<project-ref>.supabase.co/functions/v1/analyze-screen
```

用户登录后的 Supabase JWT 会作为 `Authorization: Bearer <jwt>` 发送给 Edge Function。未配置 URL 或未登录时，基础计时仍可用，AI 检测会降级为不可用状态。

## Supabase 后端

新增函数位于：

```text
supabase/functions/analyze-screen/index.ts
```

核心约束：

- 请求体：`{ screenshotBase64, mimeType, taskName, sessionId, checkId, clientMeta }`
- 响应体：`{ status, confidence, activity, reason, checkId }`
- 不持久化截图、不上传 Storage、不输出 base64 日志。
- `uncertain`、黑屏、锁屏、看参考资料、模糊无法判断都按专注处理。
- 使用 Postgres `rate_limit_buckets` 做分钟级限流，使用 `quota_usage` 和 `subscriptions` 做月度 AI 检测额度判断。

## 数据表

首版用到这些表：

- `sessions`
- `user_stats`
- `quota_usage`
- `rate_limit_buckets`
- `subscriptions`（用于读取 plan；没有订阅时按 free 处理）

`sessions` 建议包含 `local_id` 做客户端幂等同步字段。

## 备注

- `dist/`、`dist-electron/`、`release/` 是生成产物，已加入 `.gitignore`。
- 当前 UI 使用 code-native React 控件，不再维护旧 HTML/JS renderer。
- `electron-builder` 可能会因下载源缺少 `dmg-builder` 依赖而失败；这属于外部镜像问题，可切换 Electron Builder binaries mirror 或在 CI 缓存依赖解决。
