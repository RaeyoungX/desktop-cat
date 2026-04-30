// Variant C — 大胆海报风 / Bold Poster (FocusPet-inspired):
// huge typography with violet accent words, lemon-yellow stage,
// scattered paw prints + sticker decorations, cat interacts w/ real objects.

const { useState: useStateC } = React;

const boldTheme = {
  bg: '#ffe14a',           // brighter lemon
  card: '#fff8e8',         // warm cream (not pure white)
  cardSoft: '#ffe9c7',
  ink: '#241a3d',
  inkMid: '#6a5b94',
  inkSoft: '#bdb0d8',
  violet: '#6d28d9',       // deeper plum-violet
  violetSoft: '#e9dcff',
  pink: '#ff5d8f',         // hotter coral pink
  green: '#3ecf8e',        // emerald
  cyan: '#2dd4bf',         // teal (not baby blue)
  orange: '#ff6b35',       // tomato red-orange
  red: '#e11d48',          // deep rose
  border: '#241a3d',
};

// scattered paw + sticker bg
function PawBg({ density = 14, color = '#1a1530', opacity = 0.08 }) {
  const positions = React.useMemo(() => {
    const arr = [];
    const seed = 73;
    for (let i = 0; i < density; i++) {
      const a = (i * seed) % 100, b = (i * 37 + 11) % 100;
      arr.push({ x: a, y: b, r: ((i*13)%40) - 20, s: 0.6 + ((i*7)%50)/100 });
    }
    return arr;
  }, [density]);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {positions.map((p, i) => (
        <svg key={i} viewBox="0 0 24 24" width={20*p.s} height={20*p.s}
          style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: `rotate(${p.r}deg)`, opacity }}>
          <g fill={color}>
            <ellipse cx="12" cy="16" rx="5" ry="4"/>
            <ellipse cx="6" cy="9" rx="2" ry="2.5"/>
            <ellipse cx="18" cy="9" rx="2" ry="2.5"/>
            <ellipse cx="9" cy="5" rx="1.6" ry="2"/>
            <ellipse cx="15" cy="5" rx="1.6" ry="2"/>
          </g>
        </svg>
      ))}
    </div>
  );
}

function ArcadeApp() {
  const app = window.useCatApp();
  const t = boldTheme;
  return (
    <div style={{
      width: '100%', height: '100%', background: t.bg, color: t.ink,
      fontFamily: '"Nunito", "PingFang SC", -apple-system, sans-serif',
      display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
    }}>
      <PawBg density={18} color={t.ink} opacity={0.06}/>
      <BoldHeader app={app}/>
      <BoldTabs app={app}/>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 32px 32px', position: 'relative' }}>
        {app.tab === 'focus'   && <BoldFocus app={app}/>}
        {app.tab === 'plans'   && <BoldPlans app={app}/>}
        {app.tab === 'shop'    && <BoldShop app={app}/>}
        {app.tab === 'stats'   && <BoldStats app={app}/>}
        {app.tab === 'profile' && <BoldProfile app={app}/>}
      </div>
    </div>
  );
}

// stickered card with hand-drawn outline + offset shadow
function Sticker({ children, color, bg, rotate = 0, style, ...rest }) {
  const t = boldTheme;
  return (
    <div {...rest} style={{
      background: bg || t.card,
      border: `2.5px solid ${color || t.border}`,
      borderRadius: 16,
      boxShadow: `4px 4px 0 0 ${t.border}`,
      transform: rotate ? `rotate(${rotate}deg)` : undefined,
      position: 'relative',
      ...style,
    }}>{children}</div>
  );
}

function BoldHeader({ app }) {
  const t = boldTheme;
  return (
    <div style={{ padding: '16px 32px 8px', position: 'relative', zIndex: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: t.orange,
            border: `2.5px solid ${t.border}`, boxShadow: `2px 2px 0 0 ${t.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>🐱</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: t.ink, letterSpacing: '-0.02em' }}>FocusCat</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sticker color={t.violet} style={{ padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="star" size={14} stroke={t.violet}/>
            <span style={{ fontWeight: 900, color: t.ink }}>{app.points}</span>
          </Sticker>
          <button style={{
            width: 36, height: 36, border: `2.5px solid ${t.border}`, borderRadius: 18,
            background: t.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `2px 2px 0 0 ${t.border}`,
          }}><Icon name="close" size={14}/></button>
        </div>
      </div>
    </div>
  );
}

function BoldTabs({ app }) {
  const t = boldTheme;
  const items = [
    { id: 'focus', label: '专注', color: t.violet },
    { id: 'plans', label: '计划', color: t.orange },
    { id: 'shop',  label: '商店', color: t.pink },
    { id: 'stats', label: '战绩', color: t.cyan },
    { id: 'profile', label: '我的', color: t.green },
  ];
  return (
    <div style={{ padding: '0 32px', display: 'flex', gap: 8, position: 'relative', zIndex: 2 }}>
      {items.map(it => {
        const active = app.tab === it.id;
        return (
          <button key={it.id} onClick={() => app.setTab(it.id)} style={{
            padding: '8px 20px', border: `2.5px solid ${t.border}`, borderRadius: 999,
            background: active ? it.color : t.card,
            color: active ? '#fff' : t.ink,
            fontWeight: 900, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: active ? `2px 2px 0 0 ${t.border}` : 'none',
            transform: active ? 'translateY(-1px)' : 'none',
            transition: 'all .12s',
          }}>{it.label}</button>
        );
      })}
    </div>
  );
}

// ── focus ─────────────────────────────────────────────────
function BoldFocus({ app }) {
  const t = boldTheme;
  const [newTask, setNewTask] = useStateC('');
  if (app.running) return <BoldTimer app={app}/>;

  return (
    <div>
      {/* hero poster section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 24, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: t.red,
            color: '#fff', border: `2px solid ${t.border}`, borderRadius: 999,
            padding: '4px 12px', fontSize: 12, fontWeight: 900, marginBottom: 14,
            boxShadow: `2px 2px 0 0 ${t.border}`, transform: 'rotate(-2deg)' }}>
            🐾 反摸鱼小队 · 招募中
          </div>
          <h1 style={{
            margin: 0, fontSize: 48, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', color: t.ink,
          }}>
            走神了？<br/>
            一只猫会<br/>
            <span style={{ color: t.orange }}>瞪</span> 着 <span style={{ color: t.violet }}>你。</span>
          </h1>
          <p style={{ marginTop: 14, fontSize: 14, color: t.inkMid, fontWeight: 600 }}>
            它不会唠叨。它就 · 静 · 静 · 地看着你。直到你乖乖回去干活。
          </p>
        </div>
        <div style={{ position: 'relative', height: 220, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {/* cat with laptop */}
          <svg viewBox="0 0 280 220" width="100%" height="100%" style={{ overflow: 'visible' }}>
            {/* coffee cup */}
            <g transform="translate(40 130)">
              <rect x="0" y="0" width="36" height="40" rx="3" fill="#fff" stroke={t.ink} strokeWidth="3"/>
              <path d="M 36 8 Q 50 8 50 22 Q 50 32 36 32" fill="none" stroke={t.ink} strokeWidth="3"/>
              <path d="M 8 -8 Q 12 -16 16 -8 M 18 -10 Q 22 -18 26 -10 M 28 -8 Q 32 -16 36 -8"
                fill="none" stroke={t.inkMid} strokeWidth="2" strokeLinecap="round" opacity=".5"/>
            </g>
            {/* laptop */}
            <g transform="translate(110 100)">
              <rect x="0" y="60" width="160" height="14" rx="2" fill="#c8c8d0" stroke={t.ink} strokeWidth="3"/>
              <rect x="10" y="0" width="140" height="64" rx="3" fill="#3a3550" stroke={t.ink} strokeWidth="3"/>
              <rect x="18" y="8" width="124" height="48" rx="2" fill="#5a5380"/>
            </g>
            {/* cat peering over laptop */}
            <g transform="translate(150 60)">
              {/* paws on laptop */}
              <ellipse cx="-30" cy="50" rx="12" ry="6" fill={t.ink}/>
              <ellipse cx="30" cy="50" rx="12" ry="6" fill={t.ink}/>
              {/* head */}
              <path d="M -30 30 L -22 5 L -10 22 Z" fill={t.ink}/>
              <path d="M 30 30 L 22 5 L 10 22 Z" fill={t.ink}/>
              <ellipse cx="0" cy="32" rx="36" ry="30" fill={t.ink}/>
              {/* big yellow eyes */}
              <ellipse cx="-12" cy="32" rx="7" ry="9" fill={t.bg}/>
              <ellipse cx="12" cy="32" rx="7" ry="9" fill={t.bg}/>
              <ellipse cx="-12" cy="34" rx="2.5" ry="5" fill={t.ink}/>
              <ellipse cx="12" cy="34" rx="2.5" ry="5" fill={t.ink}/>
              <circle cx="-13" cy="30" r="1.5" fill="#fff"/>
              <circle cx="11" cy="30" r="1.5" fill="#fff"/>
              {/* nose */}
              <path d="M -3 46 L 0 49 L 3 46 Z" fill={t.pink}/>
            </g>
            {/* speech */}
            <g transform="translate(180 30)">
              <Sticker/>
            </g>
          </svg>
          <div style={{
            position: 'absolute', top: 8, right: 0, background: t.orange,
            color: '#fff',
            border: `2.5px solid ${t.border}`, borderRadius: 14, padding: '10px 14px',
            boxShadow: `3px 3px 0 0 ${t.border}`, transform: 'rotate(4deg)',
            fontSize: 13, fontWeight: 900, maxWidth: 180, lineHeight: 1.35,
          }}>
            少刷点手机，<br/>多摸点猫。 🐾
          </div>
        </div>
      </div>

      {/* input */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div>
          <SectionTitle color={t.violet}>今天打算做什么？</SectionTitle>
          <Sticker style={{ padding: 6, marginBottom: 14 }}>
            <input
              placeholder="比如：写代码、看书、画画……"
              value={app.customTitle}
              onChange={e => app.setCustomTitle(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', border: 'none', background: 'transparent',
                fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}/>
          </Sticker>

          <div style={{ fontSize: 12, fontWeight: 800, color: t.inkMid, marginBottom: 8, letterSpacing: '0.05em' }}>
            或者从你常做的事里挑：
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {app.tasks.map((task, i) => {
              const sel = app.selectedTaskId === task.id;
              const colors = [t.pink, t.cyan, t.green, t.orange];
              const c = colors[i % colors.length];
              return (
                <div key={task.id} onClick={() => { app.setSelectedTaskId(task.id); app.setCustomTitle(''); app.setDuration(task.minutes); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 999,
                    border: `2px solid ${t.border}`,
                    background: sel ? c : t.card,
                    color: sel ? '#fff' : t.ink,
                    fontWeight: 800, fontSize: 14, cursor: 'pointer',
                    boxShadow: sel ? `2px 2px 0 0 ${t.border}` : 'none',
                  }}>
                  <span>{task.title}</span>
                  <span style={{ fontSize: 11, opacity: .7 }}>· {task.minutes}'</span>
                  <span onClick={(e) => { e.stopPropagation(); app.removeTask(task.id); }}
                    style={{ display: 'inline-flex', cursor: 'pointer', opacity: .6 }}>
                    <Icon name="close" size={11}/>
                  </span>
                </div>
              );
            })}
            <input value={newTask} onChange={e=>setNewTask(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'){app.addTask(newTask); setNewTask('');} }}
              placeholder="+ 加一个"
              style={{
                padding: '8px 14px', borderRadius: 999, border: `2px dashed ${t.inkSoft}`,
                background: 'transparent', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                outline: 'none', color: t.ink, width: 110,
              }}/>
          </div>
        </div>

        <div>
          <SectionTitle color={t.pink}>陪你多久？</SectionTitle>
          <Sticker style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 72, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em', color: t.violet }}>
                {app.duration}
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: t.inkMid }}>分钟</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 14 }}>
              {window.PRESETS.map(p => {
                const sel = app.duration === p;
                return (
                  <button key={p} onClick={() => app.setDuration(p)} style={{
                    padding: '6px 14px', borderRadius: 999, border: `2px solid ${t.border}`,
                    background: sel ? t.ink : t.card, color: sel ? t.bg : t.ink,
                    fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{p}'</button>
                );
              })}
            </div>
            <div style={{ marginTop: 12, padding: 8, background: t.violetSoft, borderRadius: 10,
              fontSize: 12, fontWeight: 800, color: t.violet, textAlign: 'center' }}>
              专注完成 +{app.duration} ⭐
            </div>
          </Sticker>
        </div>
      </div>

      {/* big start button */}
      <button onClick={app.startSession} disabled={!app.activeTitle} style={{
        marginTop: 24, width: '100%', padding: '20px',
        background: app.activeTitle ? t.violet : '#d4cfe5',
        color: '#fff', border: `3px solid ${t.border}`, borderRadius: 18,
        fontSize: 22, fontWeight: 900, cursor: app.activeTitle ? 'pointer' : 'not-allowed',
        fontFamily: 'inherit', letterSpacing: '0.02em',
        boxShadow: app.activeTitle ? `5px 5px 0 0 ${t.border}` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      }}>
        <Icon name="play" size={20} stroke="#fff"/>
        {app.activeTitle ? `开始专注 → ${app.activeTitle}` : '先告诉小猫做什么'}
      </button>
    </div>
  );
}

function SectionTitle({ children, color }) {
  return (
    <div style={{
      display: 'inline-block', fontSize: 16, fontWeight: 900, color: '#fff',
      background: color, padding: '4px 12px', borderRadius: 8,
      border: `2px solid ${boldTheme.border}`, marginBottom: 12,
      boxShadow: `2px 2px 0 0 ${boldTheme.border}`, transform: 'rotate(-1deg)',
    }}>{children}</div>
  );
}

// ── timer ─────────────────────────────────────────────────
function BoldTimer({ app }) {
  const t = boldTheme;
  const pct = 1 - app.secondsLeft / app.totalSeconds;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '20px 0' }}>
      <SectionTitle color={t.violet}>专注中 · {app.activeTitle}</SectionTitle>
      <div style={{ position: 'relative' }}>
        <Sticker style={{ padding: 28, background: t.card }}>
          <div style={{ fontSize: 96, fontWeight: 900, color: t.violet, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {fmtTime(app.secondsLeft)}
          </div>
          <div style={{ marginTop: 14, height: 14, background: t.violetSoft, borderRadius: 8, border: `2px solid ${t.border}`, overflow: 'hidden' }}>
            <div style={{ width: `${pct*100}%`, height: '100%', background: t.violet, transition: 'width 1s linear' }}/>
          </div>
        </Sticker>
        {/* cat pops out beside the timer card */}
        <div style={{ position: 'absolute', right: -40, top: -30 }}>
          <Cat size={120} expression={app.paused ? 'sleep' : 'focus'} accessory={app.equippedItem?.icon} accent={t.violet}/>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={app.togglePause} style={boldBtn(t, t.cyan)}>{app.paused ? '▶ 继续' : '|| 暂停'}</button>
        <button onClick={app.finishSession} style={boldBtn(t, t.green)}>✓ 完成</button>
        <button onClick={app.stopSession} style={boldBtn(t, t.pink)}>× 放弃</button>
      </div>
    </div>
  );
}
function boldBtn(t, color) {
  return {
    padding: '10px 22px', border: `2.5px solid ${t.border}`, borderRadius: 999,
    background: color, color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer',
    fontFamily: 'inherit', boxShadow: `3px 3px 0 0 ${t.border}`,
  };
}

// ── shop ─────────────────────────────────────────────────
function BoldShop({ app }) {
  const t = boldTheme;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em' }}>
          给猫咪 <span style={{ color: t.violet }}>整点行头</span>
        </h2>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          background: t.violet, color: '#fff', padding: '8px 16px', borderRadius: 999,
          border: `2.5px solid ${t.border}`, boxShadow: `3px 3px 0 0 ${t.border}`,
          fontWeight: 900, fontSize: 18 }}>
          <Icon name="star" size={16} stroke="#fff"/> {app.points}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {app.shop.map((item, i) => {
          const canAfford = app.points >= item.price;
          const tilts = [-1.5, 1, -0.5, 1.8, -1, 0.8];
          const colors = [t.pink, t.cyan, t.green, t.orange, t.violet, t.pink];
          return (
            <Sticker key={item.id} rotate={tilts[i % tilts.length]} style={{ padding: 14, position: 'relative' }}>
              {item.equipped && (
                <div style={{
                  position: 'absolute', top: -12, right: 12, background: t.green, color: t.ink,
                  fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 999,
                  border: `2px solid ${t.border}`, transform: 'rotate(8deg)',
                }}>装备中 ✓</div>
              )}
              <div style={{
                height: 80, borderRadius: 10, background: colors[i % colors.length] + '33',
                border: `2px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={item.icon} size={42} stroke={t.violet}/>
              </div>
              <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900, color: t.ink }}>{item.name}</div>
              <div style={{ fontSize: 12, color: t.inkMid, fontWeight: 600 }}>{item.desc}</div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {item.owned ? (
                  <span style={{ fontSize: 12, fontWeight: 800, color: t.green }}>已拥有</span>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 900, color: canAfford ? t.violet : t.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="star" size={12} stroke={t.violet}/> {item.price}
                  </span>
                )}
                {item.owned ? (
                  <button onClick={() => app.equipItem(item.id)} style={{
                    padding: '5px 12px', borderRadius: 999,
                    border: `2px solid ${t.border}`,
                    background: item.equipped ? t.ink : t.card,
                    color: item.equipped ? '#fff' : t.ink,
                    fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{item.equipped ? '取下' : '装备'}</button>
                ) : (
                  <button disabled={!canAfford} onClick={() => app.buyItem(item.id)} style={{
                    padding: '5px 12px', borderRadius: 999,
                    border: `2px solid ${t.border}`,
                    background: canAfford ? t.violet : '#e5e0f0',
                    color: canAfford ? '#fff' : t.inkSoft,
                    fontWeight: 800, fontSize: 12, cursor: canAfford ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', boxShadow: canAfford ? `2px 2px 0 0 ${t.border}` : 'none',
                  }}>{canAfford ? '买它！' : '不够'}</button>
                )}
              </div>
            </Sticker>
          );
        })}
      </div>
    </div>
  );
}

// ── stats ────────────────────────────────────────────────
function BoldStats({ app }) {
  const t = boldTheme;
  const days = ['一','二','三','四','五','六','日'];
  const weekData = [42, 65, 30, 88, 0, 50, 24];
  const max = Math.max(...weekData, 90);
  return (
    <div>
      <h2 style={{ margin: '0 0 18px', fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em' }}>
        这周 <span style={{ color: t.violet }}>蹲了你</span> 多久？
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <BoldStat label="今日" v={app.focusedMin} u="分钟" c={t.violet} rot={-1}/>
        <BoldStat label="本周" v={app.sessions + 12} u="次"   c={t.pink}   rot={1}/>
        <BoldStat label="积分" v={app.points}      u="⭐"    c={t.orange} rot={-1}/>
        <BoldStat label="连续" v="5"               u="天"    c={t.green}  rot={1}/>
      </div>
      <Sticker style={{ padding: 18, marginBottom: 14 }}>
        <SectionTitle color={t.cyan}>本周专注</SectionTitle>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 160, marginTop: 4 }}>
          {weekData.map((v,i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: t.inkMid }}>{v || '—'}</div>
              <div style={{ width: '100%', height: `${(v/max)*120}px`, minHeight: 4,
                background: i === 3 ? t.violet : t.violetSoft,
                border: `2px solid ${t.border}`, borderRadius: '8px 8px 0 0', borderBottom: 'none' }}/>
              <div style={{ fontSize: 12, fontWeight: 800, color: t.inkMid }}>{days[i]}</div>
            </div>
          ))}
        </div>
      </Sticker>
      <Sticker style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
        <Cat size={90} expression="happy" accessory={app.equippedItem?.icon} accent={t.violet}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>"今天蹲了你 {app.sessions} 次！"</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.inkMid, marginTop: 4 }}>
            {app.sessions > 0 ? '猫咪现在咕噜咕噜的，超开心 🐾' : '还没开始呢，一起加油吧～'}
          </div>
        </div>
      </Sticker>
    </div>
  );
}
function BoldStat({ label, v, u, c, rot }) {
  return (
    <Sticker rotate={rot} bg={c} style={{ padding: 14, color: '#fff' }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', opacity: .9 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', marginTop: 2 }}>
        {v}<span style={{ fontSize: 14, opacity: .8, marginLeft: 4 }}>{u}</span>
      </div>
    </Sticker>
  );
}

// ── profile ──────────────────────────────────────────────
function BoldProfile({ app }) {
  const t = boldTheme;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Sticker style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, border: `2.5px solid ${t.border}`, background: t.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🐱</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>rae@example.com</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.inkMid }}>资深猫工 · LV.3 · 加入 124 天</div>
        </div>
        <button style={{ padding: '8px 16px', borderRadius: 999, border: `2.5px solid ${t.border}`,
          background: t.card, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: `2px 2px 0 0 ${t.border}` }}>登出</button>
      </Sticker>

      <Sticker bg={t.violet} style={{ padding: 18, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em' }}>Lv. 3</div>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: .85 }}>资深猫工</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>380 / 600</div>
        </div>
        <div style={{ marginTop: 14, height: 14, background: 'rgba(255,255,255,.3)', borderRadius: 8,
          border: `2px solid ${t.border}`, overflow: 'hidden' }}>
          <div style={{ width: '63%', height: '100%', background: '#fff' }}/>
        </div>
      </Sticker>

      <Sticker style={{ padding: 18 }}>
        <SectionTitle color={t.pink}>最近 5 次专注</SectionTitle>
        {app.history.map((h,i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
            borderTop: i ? `2px dashed ${t.violetSoft}` : 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.bg,
              border: `2px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="flame" size={16} stroke={t.violet}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{h.title}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMid }}>{h.when} · {h.minutes} 分钟</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: t.violet }}>+{h.minutes}</div>
          </div>
        ))}
      </Sticker>
    </div>
  );
}

// ── plans ────────────────────────────────────────────────
function BoldPlans({ app }) {
  const t = boldTheme;
  const [newTitle, setNewTitle] = useStateC('');
  const [newMin, setNewMin] = useStateC(25);
  const [calMonth, setCalMonth] = useStateC(() => {
    const d = window.parseYmd(app.selectedDate);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const dayPlans = app.plans.filter(p => p.date === app.selectedDate);
  const doneCount = dayPlans.filter(p => p.done).length;
  const sel = window.parseYmd(app.selectedDate);
  const isToday = app.selectedDate === app.today;
  const isTomorrow = app.selectedDate === app.tomorrow;
  const dateLabel = isToday ? '今天' : isTomorrow ? '明天' :
    `${sel.getMonth()+1} 月 ${sel.getDate()} 日`;
  const weekday = ['日','一','二','三','四','五','六'][sel.getDay()];

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    app.addPlan(app.selectedDate, newTitle, newMin);
    setNewTitle(''); setNewMin(25);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 22 }}>
      {/* LEFT: calendar */}
      <div>
        <SectionTitle color={t.orange}>挑一天</SectionTitle>
        <Sticker style={{ padding: 16 }}>
          <CalendarGrid month={calMonth} setMonth={setCalMonth}
            selectedDate={app.selectedDate} onPick={app.setSelectedDate}
            plans={app.plans} t={t} today={app.today}/>
        </Sticker>

        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button onClick={() => app.setSelectedDate(app.today)} style={quickDayBtn(t, isToday, t.violet)}>今天</button>
          <button onClick={() => app.setSelectedDate(app.tomorrow)} style={quickDayBtn(t, isTomorrow, t.pink)}>明天</button>
        </div>

        <Sticker bg={t.violetSoft} style={{ marginTop: 14, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.violet, letterSpacing: '0.06em' }}>本周完成度</div>
          <WeekProgress plans={app.plans} t={t}/>
        </Sticker>
      </div>

      {/* RIGHT: day list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', color: t.ink }}>
            {dateLabel}<span style={{ color: t.orange }}>，</span>
          </h2>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.inkMid }}>
            打算<span style={{ color: t.violet }}>{dayPlans.length === 0 ? '摆烂' : `做 ${dayPlans.length} 件事`}</span> · 周{weekday}
          </div>
          {dayPlans.length > 0 && (
            <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 900, color: '#fff',
              background: t.green, padding: '4px 12px', borderRadius: 999,
              border: `2px solid ${t.border}`, boxShadow: `2px 2px 0 0 ${t.border}` }}>
              {doneCount}/{dayPlans.length} ✓
            </div>
          )}
        </div>

        {/* add row */}
        <Sticker style={{ padding: 6, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            placeholder={`给 ${dateLabel} 加点事…`}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            style={{
              flex: 1, padding: '12px 14px', border: 'none', background: 'transparent',
              fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: 'inherit', outline: 'none',
            }}/>
          <select value={newMin} onChange={e => setNewMin(+e.target.value)}
            style={{
              padding: '8px 10px', border: `2px solid ${t.border}`, borderRadius: 8,
              background: t.bg, fontWeight: 800, fontFamily: 'inherit', color: t.ink, cursor: 'pointer',
            }}>
            {[15, 25, 45, 60, 90].map(m => <option key={m} value={m}>{m} 分</option>)}
          </select>
          <button onClick={handleAdd} style={{
            padding: '10px 16px', border: `2.5px solid ${t.border}`, borderRadius: 10,
            background: t.orange, color: '#fff', fontWeight: 900, cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: `2px 2px 0 0 ${t.border}`,
          }}>+ 加</button>
        </Sticker>

        {/* list */}
        {dayPlans.length === 0 ? (
          <BoldEmpty t={t} dateLabel={dateLabel}/>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dayPlans.map((p, i) => {
              const tilts = [-0.4, 0.5, -0.6, 0.3];
              return (
                <Sticker key={p.id} rotate={tilts[i % tilts.length]}
                  bg={p.done ? t.cardSoft : t.card}
                  style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* checkbox */}
                  <button onClick={() => app.togglePlan(p.id)} style={{
                    width: 30, height: 30, borderRadius: 8,
                    border: `2.5px solid ${t.border}`, cursor: 'pointer',
                    background: p.done ? t.green : '#fff',
                    boxShadow: `2px 2px 0 0 ${t.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {p.done && <Icon name="check" size={16} stroke="#fff" sw={3}/>}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 17, fontWeight: 900, color: t.ink,
                      textDecoration: p.done ? 'line-through' : 'none',
                      opacity: p.done ? 0.55 : 1,
                    }}>{p.title}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.inkMid, marginTop: 2 }}>
                      预计 {p.minutes} 分钟
                    </div>
                  </div>
                  {!p.done && (
                    <button onClick={() => app.startPlanFocus(p.id)} style={{
                      padding: '8px 14px', border: `2.5px solid ${t.border}`, borderRadius: 999,
                      background: t.violet, color: '#fff', fontWeight: 900, fontSize: 13,
                      cursor: 'pointer', fontFamily: 'inherit', boxShadow: `2px 2px 0 0 ${t.border}`,
                      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    }}>
                      <Icon name="play" size={11} stroke="#fff"/> 让猫盯着
                    </button>
                  )}
                  <button onClick={() => app.removePlan(p.id)} style={{
                    width: 28, height: 28, borderRadius: 8, border: `2px solid ${t.inkSoft}`,
                    background: 'transparent', cursor: 'pointer', color: t.inkSoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}><Icon name="close" size={12}/></button>
                </Sticker>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function quickDayBtn(t, active, color) {
  return {
    flex: 1, padding: '8px 0', borderRadius: 999, border: `2.5px solid ${t.border}`,
    background: active ? color : t.card, color: active ? '#fff' : t.ink,
    fontWeight: 900, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: active ? `2px 2px 0 0 ${t.border}` : 'none',
  };
}

function CalendarGrid({ month, setMonth, selectedDate, onPick, plans, t, today }) {
  const first = new Date(month.y, month.m, 1);
  const startCol = first.getDay(); // 0=Sun
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startCol; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const monthName = `${month.y} 年 ${month.m + 1} 月`;
  const counts = {};
  plans.forEach(p => { counts[p.date] = (counts[p.date] || 0) + 1; });
  const dayLabels = ['日','一','二','三','四','五','六'];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => setMonth(m => ({ y: m.m === 0 ? m.y - 1 : m.y, m: (m.m + 11) % 12 }))}
          style={navBtn(t)}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 900, color: t.ink }}>{monthName}</div>
        <button onClick={() => setMonth(m => ({ y: m.m === 11 ? m.y + 1 : m.y, m: (m.m + 1) % 12 }))}
          style={navBtn(t)}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {dayLabels.map(d => (
          <div key={d} style={{ fontSize: 11, fontWeight: 800, color: t.inkSoft, textAlign: 'center', padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i}/>;
          const ds = `${month.y}-${String(month.m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const isSel = ds === selectedDate;
          const isToday = ds === today;
          const c = counts[ds] || 0;
          return (
            <button key={i} onClick={() => onPick(ds)} style={{
              aspectRatio: '1 / 1', borderRadius: 8,
              border: isSel ? `2.5px solid ${t.border}` : `1.5px solid ${isToday ? t.orange : 'transparent'}`,
              background: isSel ? t.violet : (isToday ? '#fff' : 'transparent'),
              color: isSel ? '#fff' : t.ink,
              fontWeight: 900, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: isSel ? `2px 2px 0 0 ${t.border}` : 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              position: 'relative', padding: 0,
            }}>
              <span>{d}</span>
              {c > 0 && (
                <div style={{ display: 'flex', gap: 2, position: 'absolute', bottom: 4 }}>
                  {Array.from({ length: Math.min(c, 3) }).map((_, j) => (
                    <span key={j} style={{
                      width: 4, height: 4, borderRadius: 2,
                      background: isSel ? '#fff' : t.orange,
                    }}/>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function navBtn(t) {
  return {
    width: 28, height: 28, borderRadius: 8, border: `2px solid ${t.border}`,
    background: t.card, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 16, lineHeight: 1, boxShadow: `1px 1px 0 0 ${t.border}`,
  };
}

function WeekProgress({ plans, t }) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = ['一','二','三','四','五','六','日'];
  const week = days.map((label, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const ds = window.ymd(d);
    const dayPlans = plans.filter(p => p.date === ds);
    const done = dayPlans.filter(p => p.done).length;
    return { label, done, total: dayPlans.length, isToday: ds === window.ymd(today) };
  });
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
      {week.map((w, i) => {
        const pct = w.total ? w.done / w.total : 0;
        return (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: 36, borderRadius: 6, background: '#fff',
              border: `1.5px solid ${w.isToday ? t.violet : t.border}`,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${pct * 100}%`, background: w.total === 0 ? t.cardSoft : t.violet,
              }}/>
              {w.total > 0 && (
                <div style={{ position: 'relative', fontSize: 10, fontWeight: 900,
                  color: pct > 0.5 ? '#fff' : t.ink, lineHeight: '36px' }}>
                  {w.done}/{w.total}
                </div>
              )}
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: t.inkMid, marginTop: 4 }}>{w.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// 摆烂猫 — only when day has zero plans
function BoldEmpty({ t, dateLabel }) {
  return (
    <div style={{ position: 'relative', padding: '20px 0' }}>
      <Sticker bg={t.bg} style={{ padding: 30, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* lazy cat */}
        <svg viewBox="0 0 240 140" width="280" height="160" style={{ display: 'block', margin: '0 auto' }}>
          {/* floor line */}
          <line x1="10" y1="125" x2="230" y2="125" stroke={t.ink} strokeWidth="2.5" strokeDasharray="4 6"/>
          {/* puddle cat lying flat */}
          <ellipse cx="120" cy="120" rx="95" ry="18" fill={t.ink}/>
          {/* head resting */}
          <ellipse cx="68" cy="108" rx="32" ry="22" fill={t.ink}/>
          {/* ears flopped */}
          <path d="M 48 90 L 50 76 L 62 92 Z" fill={t.ink}/>
          <path d="M 88 90 L 86 76 L 74 92 Z" fill={t.ink}/>
          {/* sleepy eyes (closed) */}
          <path d="M 56 108 Q 60 112 64 108" fill="none" stroke={t.violet} strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M 74 108 Q 78 112 82 108" fill="none" stroke={t.violet} strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M 65 116 L 69 119 L 73 116" fill={t.pink}/>
          {/* whiskers */}
          <g stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".7">
            <line x1="40" y1="115" x2="56" y2="116"/>
            <line x1="40" y1="120" x2="56" y2="119"/>
            <line x1="96" y1="115" x2="80" y2="116"/>
            <line x1="96" y1="120" x2="80" y2="119"/>
          </g>
          {/* tail flopped */}
          <path d="M 210 122 Q 226 116 218 104" fill="none" stroke={t.ink} strokeWidth="14" strokeLinecap="round"/>
          {/* zzz */}
          <text x="100" y="78" fontSize="20" fontWeight="900" fill={t.violet}>z</text>
          <text x="112" y="62" fontSize="14" fontWeight="900" fill={t.violet} opacity=".7">z</text>
          <text x="122" y="50" fontSize="10" fontWeight="900" fill={t.violet} opacity=".5">z</text>
        </svg>
        <div style={{ fontSize: 22, fontWeight: 900, color: t.ink, marginTop: 6 }}>
          {dateLabel}什么都<span style={{ color: t.orange }}>不想干</span>。
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.inkMid, marginTop: 6 }}>
          猫咪表示完全理解。要躺平就躺，要列事就列。
        </div>
      </Sticker>
    </div>
  );
}

window.ArcadeApp = ArcadeApp;
