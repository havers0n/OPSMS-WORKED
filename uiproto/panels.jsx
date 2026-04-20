// Sidebar, right panel, overlays
const { useState: useStateUi, useEffect: useEffectUi, useMemo: useMemoUi } = React;

function Sidebar({ lang, statusFilter, setStatusFilter, counts, racks, selected, onSelectRack, onSelectSection }) {
  const L = (ru, en) => lang === 'en' ? en : ru;
  const [expanded, setExpanded] = useStateUi({});

  return (
    <aside className="sidebar">
      <h4>{L('Статусы', 'Status')}</h4>
      <div className="filter-list">
        {Object.values(WMS.STATUSES).map(st => {
          const on = statusFilter[st.id] !== false;
          return (
            <div key={st.id}
              className={'filter-row ' + (on ? '' : 'off')}
              onClick={() => setStatusFilter(sf => ({ ...sf, [st.id]: !on }))}
            >
              <span className="swatch" style={{
                background: st.fill,
                borderStyle: st.dashed ? 'dashed' : 'solid',
              }} />
              <span className="label">{lang === 'en' ? st.labelEn : st.label}</span>
              <span className="count">{counts[st.id] || 0}</span>
            </div>
          );
        })}
      </div>
      <h4>{L('Стеллажи', 'Racks')}</h4>
      <div className="tree">
        {racks.map(rack => {
          const isExp = expanded[rack.id];
          const fullCount = rack.sections.filter(s => s.status === 'full').length;
          return (
            <React.Fragment key={rack.id}>
              <div
                className={'tree-row ' + (selected?.rackId === rack.id ? 'selected' : '')}
                onClick={() => {
                  setExpanded(e => ({ ...e, [rack.id]: !isExp }));
                  onSelectRack(rack);
                }}
              >
                <span className="chev">{isExp ? '▾' : '▸'}</span>
                <span className="name">{rack.id}</span>
                <span className="meta">{fullCount}/{rack.sections.length}</span>
              </div>
              {isExp && (
                <div className="tree-child">
                  {rack.sections.map(s => (
                    <div key={s.id}
                      className={'tree-row ' + (selected?.id === s.id ? 'selected' : '')}
                      onClick={() => onSelectSection(s)}
                    >
                      <span className="swatch" style={{
                        width: 8, height: 8,
                        background: WMS.STATUSES[s.status].fill,
                        borderRadius: 2,
                        border: '1px solid ' + WMS.STATUSES[s.status].stroke,
                      }} />
                      <span className="name">{s.id}</span>
                      <span className="meta">{s.fill}%</span>
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </aside>
  );
}

function RightPanel({ lang, selected }) {
  const L = (ru, en) => lang === 'en' ? en : ru;

  if (!selected) {
    return (
      <aside className="rightpanel">
        <div className="section">
          <h3>{L('Детали', 'Details')}</h3>
          <div className="sub">{L('Выберите ячейку или секцию на карте', 'Select a cell or section on the map')}</div>
        </div>
        <div className="section" style={{ color: 'var(--ink-3)', fontSize: 12 }}>
          <div style={{ marginBottom: 10, fontWeight: 600, color: 'var(--ink-2)' }}>
            {L('Быстрые действия', 'Quick actions')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>→ {L('Поиск по коду', 'Search by code')} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>⌘K</span></div>
            <div>→ {L('Перейти к стеллажу', 'Jump to rack')} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>G R</span></div>
            <div>→ {L('Вписать в экран', 'Fit to view')} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>F</span></div>
          </div>
        </div>
      </aside>
    );
  }

  const isSection = selected.rackId !== undefined;
  const st = WMS.STATUSES[selected.status];

  return (
    <aside className="rightpanel">
      <div className="section">
        <h3>
          {selected.id}
          <span className="tag">{isSection ? L('Секция', 'Section') : L('Палетоместо', 'Pallet')}</span>
        </h3>
        <div style={{ marginTop: 6 }}>
          <span className="chip">
            <span className="dot" style={{ background: st.stroke }}></span>
            {lang === 'en' ? st.labelEn : st.label}
          </span>
        </div>
        <div className="kv">
          <span className="k">{L('Заполненность', 'Fill')}</span>
          <span className="v">{selected.fill != null ? selected.fill + '%' : '—'}</span>
          <span className="k">{L('Стеллаж', 'Rack')}</span>
          <span className="v">{selected.rackId || '—'}</span>
          <span className="k">{L('Ярусы', 'Tiers')}</span>
          <span className="v">{selected.tiers || 1}</span>
          <span className="k">{L('Координаты', 'Coords')}</span>
          <span className="v">{Math.round(selected.x)}, {Math.round(selected.y)}</span>
        </div>
        {selected.fill != null && (
          <div className="fill-bar">
            <span style={{ width: selected.fill + '%', background: st.stroke }} />
          </div>
        )}
      </div>

      {isSection && (
        <div className="section">
          <h3 style={{ fontSize: 12 }}>{L('Ярусы', 'Vertical tiers')}</h3>
          <div className="sub">{L('Вид сверху не показывает высоту — раскрыто ниже', 'Top-down view collapses tiers — shown below')}</div>
          <div className="tier-stack">
            {Array.from({ length: selected.tiers || 4 }).map((_, ti) => {
              // fabricate tier statuses from seed
              const seed = (selected.id.charCodeAt(2) || 0) + ti * 3;
              const r = Math.abs(Math.sin(seed) * 1000) % 100;
              const tierStatus = r < 20 ? 'free' : r < 50 ? 'partial' : r < 85 ? 'full' : 'reserved';
              const stt = WMS.STATUSES[tierStatus];
              const cells = 6;
              return (
                <div key={ti} className="tier">
                  <span className="tier-id">T{ti + 1}</span>
                  <div className="tier-cells">
                    {Array.from({ length: cells }).map((_, ci) => {
                      const rc = Math.abs(Math.sin(seed * 7 + ci * 13) * 1000) % 100;
                      const cs = rc < 30 ? 'free' : rc < 75 ? 'full' : 'partial';
                      const cst = WMS.STATUSES[cs];
                      return (
                        <span key={ci} className="cc" style={{
                          background: cst.fill,
                          borderColor: cst.stroke,
                          borderStyle: cst.dashed ? 'dashed' : 'solid',
                        }} />
                      );
                    })}
                  </div>
                  <span className="tier-meta">{lang === 'en' ? stt.labelEn : stt.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="section">
        <h3 style={{ fontSize: 12 }}>{L('Содержимое', 'Contents')}</h3>
        {selected.status === 'free' ? (
          <div className="sub">{L('Пусто', 'Empty')}</div>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['SKU-4018 · Кофе молотый 250г', 'SKU-2217 · Чай зелёный 100г', 'SKU-9912 · Сахар 1кг'].slice(0, selected.status === 'partial' ? 2 : 3).map((s, i) => (
              <div key={i} style={{
                fontSize: 11,
                padding: '6px 8px',
                background: 'var(--bg-sunk)',
                borderRadius: 3,
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-2)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{lang === 'en' ? s.replace('Кофе молотый 250г', 'Coffee ground 250g').replace('Чай зелёный 100г', 'Green tea 100g').replace('Сахар 1кг', 'Sugar 1kg') : s}</span>
                <span style={{ color: 'var(--ink-4)' }}>×{12 + i * 7}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section" style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
        <button className="btn primary" style={{ flex: 1 }}>{L('Открыть', 'Open')}</button>
        <button className="btn" style={{ flex: 1 }}>{L('История', 'History')}</button>
      </div>
    </aside>
  );
}

function ZoomControls({ view, setView, fitAll }) {
  const setZ = (z) => setView(v => ({ ...v, z: Math.max(0.3, Math.min(3, z)) }));
  return (
    <div className="zoom-stack">
      <button onClick={() => setZ(view.z * 1.25)} title="Zoom in">＋</button>
      <div className="zoom-level">{Math.round(view.z * 100)}%</div>
      <button onClick={() => setZ(view.z / 1.25)} title="Zoom out">−</button>
      <button onClick={fitAll} title="Fit to view" style={{ fontSize: 11 }}>⛶</button>
    </div>
  );
}

function Legend({ lang, compact }) {
  const L = (ru, en) => lang === 'en' ? en : ru;
  return (
    <div className="legend">
      <h5>{L('Легенда', 'Legend')}</h5>
      {Object.values(WMS.STATUSES).map(st => (
        <div key={st.id} className="legend-row">
          <span className="sw" style={{
            background: st.fill,
            borderColor: st.stroke,
            borderStyle: st.dashed ? 'dashed' : 'solid',
          }} />
          <span>{lang === 'en' ? st.labelEn : st.label}</span>
        </div>
      ))}
      <div style={{ height: 1, background: 'var(--line)', margin: '8px -12px' }} />
      <div className="legend-row">
        <span className="sw" style={{ background: 'url(#) center/cover', backgroundColor: 'var(--wall)' }} />
        <span>{L('Стена / колонна', 'Wall / column')}</span>
      </div>
      <div className="legend-row">
        <span className="sw" style={{ background: 'transparent', borderColor: 'var(--accent)', borderStyle: 'dashed' }} />
        <span>{L('Ворота', 'Dock door')}</span>
      </div>
    </div>
  );
}

function Minimap({ view, setView, stageRef, lang }) {
  const W = 184, H = 120;
  const sx = W / WMS.WORLD.w;
  const sy = H / WMS.WORLD.h;
  const [, force] = useStateUi(0);

  useEffectUi(() => {
    const i = setInterval(() => force(x => x + 1), 120);
    return () => clearInterval(i);
  }, []);

  const el = stageRef.current;
  const vw = el ? el.clientWidth / view.z : 400;
  const vh = el ? el.clientHeight / view.z : 300;

  const onMouseDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const move = (ev) => {
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const worldX = mx / sx - vw / 2;
      const worldY = my / sy - vh / 2;
      setView(v => ({ ...v, x: worldX, y: worldY }));
    };
    move(e);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="minimap">
      <div className="minimap-head">
        <span>{lang === 'en' ? 'Overview' : 'Обзор'}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>1400×900</span>
      </div>
      <div className="minimap-canvas" style={{ width: W, height: H }} onMouseDown={onMouseDown}>
        <svg width={W} height={H} viewBox={`0 0 ${WMS.WORLD.w} ${WMS.WORLD.h}`}>
          {WMS.ZONES.map(z => (
            <rect key={z.id} x={z.x} y={z.y} width={z.w} height={z.h}
              fill={z.color} opacity="0.2" />
          ))}
          {WMS.RACKS.map(r => (
            <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h}
              fill="var(--ink-3)" />
          ))}
          {WMS.WALLS.map((w, i) => (
            <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h}
              fill="var(--wall)" />
          ))}
          {/* viewport */}
          <rect x={view.x} y={view.y} width={vw} height={vh}
            fill="var(--accent)" fillOpacity="0.15"
            stroke="var(--accent)" strokeWidth="12" vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}

function Tooltip({ data, lang }) {
  if (!data) return null;
  const { item, x, y } = data;
  const st = WMS.STATUSES[item.status];
  const L = (ru, en) => lang === 'en' ? en : ru;

  // clamp to viewport
  const tx = Math.min(x + 14, window.innerWidth - 260);
  const ty = Math.min(y + 14, window.innerHeight - 120);

  return (
    <div className="tooltip" style={{ left: tx, top: ty }}>
      <div className="tt-head">
        <span className="tt-id">{item.id}</span>
        <span className="tt-status" style={{ background: st.fill, color: st.stroke, borderLeft: `3px solid ${st.stroke}` }}>
          {lang === 'en' ? st.labelEn : st.label}
        </span>
      </div>
      <div className="tt-bar"><span style={{ width: (item.fill || 0) + '%', background: st.stroke }} /></div>
      <div className="tt-meta">
        {L('Заполнено', 'Fill')}: {item.fill ?? 0}% · {L('Ярусы', 'Tiers')}: {item.tiers || 1}
      </div>
      <div className="tt-meta" style={{ marginTop: 4, color: 'var(--ink-4)' }}>
        {L('Клик — детали', 'Click for details')}
      </div>
    </div>
  );
}

function TweaksPanel({ tweaks, setTweaks, onClose, lang }) {
  const L = (ru, en) => lang === 'en' ? en : ru;
  const set = (k, v) => setTweaks(t => ({ ...t, [k]: v }));
  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <span>Tweaks</span>
        <button className="btn ghost icon-only" onClick={onClose}>✕</button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <label>{L('Тема', 'Theme')}</label>
          <div className="ctl">
            <select value={tweaks.theme} onChange={e => set('theme', e.target.value)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
        <div className="tweak-row">
          <label>{L('Язык', 'Language')}</label>
          <div className="ctl">
            <select value={tweaks.lang} onChange={e => set('lang', e.target.value)}>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <div className="tweak-row">
          <label>{L('Заливка статусов', 'Status fill')}</label>
          <div className="ctl">
            <select value={tweaks.pattern} onChange={e => set('pattern', e.target.value)}>
              <option value="pattern">{L('Паттерн', 'Pattern')}</option>
              <option value="solid">{L('Сплошной', 'Solid')}</option>
            </select>
          </div>
        </div>
        <div className="tweak-row">
          <label>{L('Координатная сетка', 'Coordinate ruler')}</label>
          <div className={'switch ' + (tweaks.ruler ? 'on' : '')} onClick={() => set('ruler', !tweaks.ruler)} />
        </div>
        <div className="tweak-row">
          <label>{L('Подписи секций', 'Section labels')}</label>
          <div className={'switch ' + (tweaks.labels ? 'on' : '')} onClick={() => set('labels', !tweaks.labels)} />
        </div>
        <div className="tweak-row">
          <label>{L('Мини-карта', 'Minimap')}</label>
          <div className={'switch ' + (tweaks.minimap ? 'on' : '')} onClick={() => set('minimap', !tweaks.minimap)} />
        </div>
        <div className="tweak-row">
          <label>{L('Легенда', 'Legend')}</label>
          <div className={'switch ' + (tweaks.legend ? 'on' : '')} onClick={() => set('legend', !tweaks.legend)} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, RightPanel, ZoomControls, Legend, Minimap, Tooltip, TweaksPanel });
