# Handoff: FocusCat · Variant C（贴纸海报风 / Bold Sticker Poster）

## Overview
FocusCat 是一款"反摸鱼"专注 App。设定：一只黑色像素小猫蹲在你旁边，安静地盯着你，直到你乖乖把今天该做的事做完。完成专注会获得积分，可以在商店里给猫买装备（蝴蝶结、礼帽、墨镜、王冠）。

本设计稿包含 **5 个 Tab**：

1. **专注（Focus）** — 输入今日要做的事 + 选时长 + 开始计时
2. **计划（Plans）** — 日历 + 当日清单 + 一键进入专注
3. **商店（Shop）** — 用积分买猫咪装备
4. **战绩（Stats）** — 本周专注柱状图 + 数据卡片
5. **我的（Profile）** — 用户信息 + 等级进度 + 专注历史

## About the Design Files
本目录里的 HTML/JSX 文件是**设计参考稿**，是用来展示视觉、布局、交互意图的 React 原型，**不是用来直接拷进生产代码库的**。请在你们现有的环境（React/Vue/SwiftUI/原生……）里、用现有的组件和模式**重建**这些设计稿。如果项目还没决定技术栈，自行选择最合适的框架来实现。

## Fidelity
**High-fidelity (hifi)** — 颜色、字体、间距、阴影、交互态全部已经定稿。请按像素级还原；不要用现成 UI 库（MUI / AntD / Tailwind 默认样式等）的默认观感，那会破坏整套"贴纸海报"质感。

## 设计 DNA / Design Language

整套视觉的核心是 **"贴纸 + 海报 + 像素小猫"**：

- **贴纸卡片**：每个卡片都有 `2.5px` 深紫黑描边 + `4px 4px 0 0` 实心硬阴影（不带模糊），轻微旋转 (`-1.5deg ~ 1.8deg`) 制造手贴感。
- **柠檬黄底色 + 高饱和强调色**：避免任何柔和、磨砂、玻璃拟物。色块要硬、要实、要浓。
- **超大粗字标题**：`font-weight: 900`，`letter-spacing: -0.03em`，关键词用对比色高亮。
- **分散爪印背景**：18 个随机分布、随机旋转的爪印 SVG 作为 6% 透明度的背景纹理。
- **黑色像素猫**：唯一的角色 IP，所有插画里都是这只黑猫。眼睛颜色随场景换（专注时紫色、空状态紫色、清醒时柠檬黄）。
- **倾斜彩色徽章式 Section 标题**：每个分区标题是个旋转 `-1deg` 的实心色块 + 白字 + 硬阴影。

## Design Tokens

### Colors

```js
// 全局调色板（变量名 = 在代码里使用的名字）
const boldTheme = {
  bg:         '#ffe14a',   // 柠檬黄底色（整页背景）
  card:       '#fff8e8',   // 暖奶油白（卡片背景，不要纯白）
  cardSoft:   '#ffe9c7',   // 已完成项的卡片底
  ink:        '#241a3d',   // 深紫黑（所有边框、主文字）
  inkMid:     '#6a5b94',   // 中紫（次要文字）
  inkSoft:    '#bdb0d8',   // 浅紫（占位、禁用）
  violet:     '#6d28d9',   // 主色：紫罗兰（专注 tab、CTA、主积分色）
  violetSoft: '#e9dcff',   // 浅紫（进度条底、徽章底）
  pink:       '#ff5d8f',   // 玫红（商店 tab、辅助高亮）
  green:      '#3ecf8e',   // 翡翠绿（已完成、我的 tab、成功）
  cyan:       '#2dd4bf',   // 青绿（战绩 tab）
  orange:     '#ff6b35',   // 番茄橙（计划 tab、关键标题字、speech bubble）
  red:        '#e11d48',   // 玫红（"反摸鱼小队"徽章）
  border:     '#241a3d',   // 等于 ink，用作所有描边
};
```

**用色原则：**
- **底色**永远是柠檬黄 `#ffe14a`
- **描边**永远是 `2-2.5px solid #241a3d`
- **硬阴影**永远是 `2-5px 2-5px 0 0 #241a3d`（不带模糊半径）
- **CTA 按钮**用紫色 `#6d28d9`
- **每个 Tab 有自己的颜色**：专注=紫，计划=橙，商店=粉，战绩=青，我的=绿

### Typography

- **字体族**：`'Nunito', 'PingFang SC', -apple-system, sans-serif`
- **Google Fonts 引入权重**：400, 600, 700, 800, 900

| 用途 | size | weight | letter-spacing | 备注 |
|---|---|---|---|---|
| 大标题 H1 | 48 | 900 | -0.03em | 多行，line-height 1.05 |
| Tab 大标题 H2 | 36 | 900 | -0.02em | "给猫咪整点行头" |
| 计时器数字 | 96 | 900 | -0.04em | tabular-nums |
| 数据卡数字 | 32 | 900 | -0.02em | |
| Section title 徽章 | 16 | 900 | — | 白字，背景为强调色 |
| 列表项标题 | 17 | 900 | — | |
| Tab 按钮 / Pills | 14 | 900 | — | |
| 正文 / 副标题 | 13-14 | 600-700 | — | |
| 标签 / 图例 | 11-12 | 700-900 | 0.05-0.08em | 大写 |

### Borders / Shadows / Radius

| Token | 值 | 用途 |
|---|---|---|
| 主描边 | `2.5px solid #241a3d` | 所有贴纸卡片、按钮 |
| 细描边 | `2px solid #241a3d` | 小标签、chip |
| 虚线描边 | `2px dashed #bdb0d8` | "+ 加一个"输入框 |
| 主硬阴影 | `4px 4px 0 0 #241a3d` | 大贴纸卡片 |
| 次硬阴影 | `2px 2px 0 0 #241a3d` | 小标签、Section title、按钮 |
| CTA 阴影 | `5px 5px 0 0 #241a3d` | 主"开始专注"按钮 |
| 圆角 - 卡片 | `16px` | |
| 圆角 - 小卡 / 输入 | `10-14px` | |
| 圆角 - Pill | `999px` | 所有 chip / 按钮（除大 CTA）|
| 圆角 - 大 CTA | `18px` | |

### Spacing

- 主内容区水平内边距：`32px`
- 卡片间隙：`12-22px`（根据层级）
- 卡片内 padding：`14-18px`（小卡 6-10）
- Tab 切换栏与内容区间隙：`20px`

## Screens / Views

### 共用 — Header（顶栏）

- 高 `~60px`，水平内边距 32px
- **左侧**：橙色方块 (36×36, radius 10, ink 描边 + 硬阴影) 内放 🐱 emoji，紧跟黑色 22px / 900 / "FocusCat" logo
- **右侧**：积分胶囊（白卡 + 紫色描边 + ⭐icon + 数字）+ 关闭按钮（36×36 圆按钮）

### 共用 — Tabs

- 5 个胶囊按钮，水平排列，gap 8
- **未选中**：白底 + ink 描边 + ink 字
- **选中**：当前 tab 对应色填充 + 白字 + 2px 硬阴影 + `translateY(-1px)` 上抬
- 顺序：专注（紫）→ 计划（橙）→ 商店（粉）→ 战绩（青）→ 我的（绿）

### Tab 1 — 专注 (Focus)

**布局**：左 1.2fr / 右 1fr 网格

**英雄区**：
- 左侧大标题三行：`走神了？` / `一只猫会` / `**瞪** 着 **你**。`（"瞪"用橙色，"你。"用紫色）
- 副标题："它不会唠叨。它就 · 静 · 静 · 地看着你。直到你乖乖回去干活。"
- 标题上方倾斜玫红徽章："🐾 反摸鱼小队 · 招募中"（rotate -2deg）
- 右侧：SVG 插画——黑猫趴在笔记本电脑后探出头，旁边有咖啡杯（带蒸汽线）。猫眼是柠檬黄椭圆 + 黑瞳孔 + 白高光。
- 浮动 speech bubble（rotate 4deg, 橙底白字）："少刷点手机，多摸点猫。🐾"

**输入区**（第二行 1.4fr / 1fr）：
- 左：Section title `今天打算做什么？`（紫徽章）→ 大输入框（贴纸卡里嵌透明 input）→ "或者从你常做的事里挑："+ 一排彩色 chip（粉/青/绿/橙循环），未选白底，选中实色填充
- 右：Section title `陪你多久？`（粉徽章）→ 巨大紫色数字 (72px) + "分钟" + 时长 chip 行 [25', 45', 60', 90'] + 紫色提示框 "专注完成 +N ⭐"

**主 CTA**：全宽紫色按钮（高 60px+），白字 22px / 900："开始专注 → {任务名}"，5px 硬阴影。禁用态变浅灰 `#d4cfe5` 无阴影。

### Tab 1.5 — 计时器（专注进行中）

- 顶部紫徽章："专注中 · {任务名}"
- 中央贴纸卡：96px / 900 / 紫色等宽数字 (`mm:ss`)
- 数字下方进度条：高 14px，紫色描边，浅紫底，紫色填充，1s 线性补间
- **猫咪从卡片右上探出**（绝对定位 `top: -30, right: -40`），表情切换 `focus`/`sleep`（暂停时）
- 下方三按钮（青/绿/粉）：暂停、完成、放弃

### Tab 2 — 计划 (Plans)

**布局**：左 320px 月历 / 右 1fr 当日列表

**左侧**：
1. 橙色 Section title "挑一天"
2. 月历贴纸卡：
   - 顶部："‹ 2025 年 N 月 ›" + 翻页按钮
   - 7 列网格，星期表头（日一二三四五六）灰色 11px
   - 单元格 `aspect-ratio: 1`，圆角 8
   - **今天**：橙色 1.5px 描边 + 白底
   - **选中日**：紫色填充 + 白字 + ink 描边 + 硬阴影
   - **有计划日**：底部 1-3 个 4×4 橙色小圆点
3. "今天" / "明天" 快捷按钮（紫/粉填充态）
4. 浅紫卡："本周完成度" + 7 列垂直柱状图（每柱 36px 高，柱内显示 `done/total`）

**右侧**：
1. 大标题：`{今天/明天/M月D日}<橙色，>` + "打算 <紫>做 N 件事</紫> · 周X"
2. 完成度徽章（绿底白字）右上：`done/total ✓`
3. 添加行：贴纸卡 6px padding 内嵌 [输入框 + 时长 select + 橙色"+ 加"按钮]
4. 计划列表：每条贴纸卡（轻微交替 tilt -0.4/0.5/-0.6/0.3）：
   - **复选框**（30×30，圆角 8，ink 描边 + 2px 硬阴影；未完成白底，完成绿底白勾）
   - 标题（17/900）+ 副标题（"预计 N 分钟"）
   - **紫色"让猫盯着"按钮**（▶ icon + 文字）— 点击带着标题和时长跳到专注 Tab 并立即开始计时
   - 灰色 × 删除按钮
5. **空状态（当日 0 计划）**：
   - 一只摊成饼的黑猫 SVG（"摆烂猫"）：身体被压成扁椭圆 + 头侧躺 + 闭眼弯线 + 粉鼻 + 飘 z…
   - 大字："{日期}什么都<橙>不想干</橙>。"
   - 副："猫咪表示完全理解。要躺平就躺，要列事就列。"

### Tab 3 — 商店 (Shop)

- 大标题："给猫咪 <紫>整点行头</紫>"
- 右上紫色积分胶囊（大号）：⭐ + 数字
- 3 列网格，6 件商品。每件**轻微随机倾斜** (`-1.5, 1, -0.5, 1.8, -1, 0.8`)：
  - 顶部 80px 色块（每色循环 pink/cyan/green/orange/violet/pink，加 `33` alpha）+ ink 描边
  - 中央放装备图标（SVG，紫色填充，42px）
  - 已装备的左上贴小绿徽章："装备中 ✓"（rotate 8deg）
  - 名字 (16/900) + 描述 (12/600 inkMid)
  - 底部行：左侧价格（紫⭐ + 数字 / "已拥有"），右侧按钮（"买它！" / "不够" / "装备" / "取下"）

### Tab 4 — 战绩 (Stats)

- 大标题："这周 <紫>蹲了你</紫> 多久？"
- 4 列彩色数据卡（每张 tilt ±1deg，整卡用强调色作为背景，白字）：今日分钟 / 本周次数 / 积分 / 连续天数。色序：紫 / 粉 / 橙 / 绿。
- 本周柱状图卡：青徽章 "本周专注"，7 列柱状图（高 160px，柱顶显示数字，星期标在下）。今天的柱填实紫色，其他填浅紫。
- 底部小卡：左侧 90px 黑猫（happy 表情），右侧 quote："今天蹲了你 N 次！"

### Tab 5 — 我的 (Profile)

- 顶部贴纸：左 64px 黄底方块带 🐱 → 邮箱 (20/900) + "资深猫工 · LV.3 · 加入 124 天" → 右侧"登出"白底按钮
- 紫色大块：等级卡（全紫底白字）：左 "Lv. 3" / "资深猫工"，右 "380 / 600"，下方进度条
- 历史卡：粉徽章 "最近 5 次专注"，列表项虚线分隔（黄底图标方块 + 标题 + 时间分钟 + 紫色 "+N"）

## State Management

参见 `shared.jsx` 里的 `useCatApp` 自定义 Hook（演示稿用 `useState`）。生产环境建议用 Zustand / Redux Toolkit / Pinia / 全局 store；状态形状：

```ts
type State = {
  tab: 'focus' | 'plans' | 'shop' | 'stats' | 'profile';

  // Focus
  tasks: { id, title, minutes, done }[];
  selectedTaskId: string | null;
  customTitle: string;
  duration: number;          // minutes
  activeTitle: string;       // computed: customTitle || tasks[selectedTaskId].title

  // Timer
  running: boolean;
  paused: boolean;
  secondsLeft: number;
  totalSeconds: number;      // = duration * 60

  // Plans
  plans: { id, date: 'YYYY-MM-DD', title, minutes, done }[];
  selectedDate: string;

  // Shop
  shop: { id, name, desc, price, icon, owned, equipped }[];
  equippedItem: ShopItem;    // computed

  // Score / history
  points: number;
  sessions: number;
  focusedMin: number;
  history: { title, minutes, when }[];
};

type Actions = {
  // tab
  setTab(tab);

  // tasks
  addTask(title, minutes?), removeTask(id), setSelectedTaskId(id);
  setCustomTitle(s), setDuration(min);

  // timer
  startSession(), togglePause(), stopSession(), finishSession();

  // plans
  addPlan(date, title, minutes?), removePlan(id), togglePlan(id), updatePlan(id, patch);
  setSelectedDate(date);
  startPlanFocus(planId);   // 复用 plan 数据填充 customTitle/duration 并开始 timer + 切到 focus tab

  // shop
  buyItem(id), equipItem(id);
};
```

**关键交互逻辑：**

- `startPlanFocus(id)`：从 `plans` 找到该项 → `setCustomTitle(title)` + `setSelectedTaskId(null)` + `setDuration(minutes)` + `setSecondsLeft(minutes * 60)` + `setRunning(true)` + `setPaused(false)` + `setTab('focus')`。这样点"让猫盯着"会立即进入计时态。
- `finishSession()`：积分 += duration（1 分钟 = 1 ⭐），sessions += 1，focusedMin += duration，history 头部插入新条目（限 12）。
- `equipItem(id)`：单插槽——给一个装备打开会让所有其他装备 `equipped: false`。再次点已装备的同一个 = 取下。

## Interactions & Behavior

- **Tab 切换**：纯客户端 state，无 URL 路由（生产建议加 `?tab=` 或路由）
- **计时器**：`setInterval` 每秒减 1，剩 0 自动 `finishSession`
- **暂停**：清除 interval，恢复重启
- **加任务/计划**：Enter 键提交
- **过渡动画**：进度条 `transition: width 1s linear`；选中态按钮 `transition: all .12s`
- **猫咪表情切换**：根据 timer 状态 `running && !paused → 'focus'`，`paused → 'sleep'`，完成 → `'celebrate'`，默认 `'idle'`/'happy'
- **猫咪尾巴动画**：`<animate>` 持续 3.6s 摇摆（睡觉时停）
- **Hover/Active**：当前演示稿没单独定义 hover；建议生产环境给所有按钮加 `:hover { transform: translate(-1px, -1px); box-shadow: +1 +1 } :active { translate(2px, 2px); box-shadow: 0 }` 强化"按下贴纸"质感

## Assets

- **没有外部图片**，所有插画都是内联 SVG（黑猫、爪印、咖啡杯、笔记本、摆烂猫）
- **图标**：自绘 SVG，见 `shared.jsx` 里的 `Icon` 组件，名字：play, pause, stop, plus, close, check, star, flame, task, shop, chart, user, bow, hat, glass, crown, stars, scarf, arrow-right, logout, sync, leaf
- **字体**：Google Fonts — Nunito (400, 600, 700, 800, 900)
- **emoji**：🐱 🐾 ⭐ ✓（仅这几个，故意克制）

## Files in this bundle

| 文件 | 用途 |
|---|---|
| `猫咪专注_C.html` | 入口 HTML，加载 React/Babel + 两个 jsx 并挂载 `<ArcadeApp/>` |
| `shared.jsx` | `useCatApp` 状态 hook、`Cat` 黑猫 SVG 组件、`Icon` 图标库、`fmtTime` 工具、日期工具（ymd/addDays/parseYmd）、SEED 数据 |
| `variant-arcade.jsx` | Variant C 全部 UI：`ArcadeApp`, `BoldHeader`, `BoldTabs`, `BoldFocus`, `BoldTimer`, `BoldPlans`, `CalendarGrid`, `WeekProgress`, `BoldEmpty`, `BoldShop`, `BoldStats`, `BoldProfile` + 主题对象 `boldTheme` |

## How to run the prototype locally

```bash
cd design_handoff_focuscat
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000/猫咪专注_C.html
```

或者直接双击 `猫咪专注_C.html`（部分浏览器需要 http server 才能加载 type="text/babel" 的外部 jsx 文件）。

## Notes for the developer

1. **不要**用 `framer-motion` / `react-spring` 等动画库——目前只有 SVG 内联 `<animate>` 和 CSS transition，足够。
2. **不要**用磨砂玻璃 / 渐变 / 大圆角 / 柔和阴影——会立刻破坏整套贴纸质感。所有阴影必须是 `Xpx Ypx 0 0 #241a3d`（offset 没模糊）。
3. **猫的眼睛颜色 = 主题强调色**，不要写死。`<Cat accent={theme.violet} />`。
4. **倾斜角度**很关键——别全 0 度，也别太夸张（>3deg 会显业余）。建议 ±0.5° ~ ±2°。
5. **黑猫 SVG** 是 IP 资产，请整体复用 `Cat` 组件（已支持 expression / accessory / accent / size 4 个 prop）；其他场景的猫（摆烂猫、英雄区猫）是单独 SVG 内联。
