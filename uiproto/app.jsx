const { useState: useSt, useEffect: useEf, useRef: useRf, useMemo: useMm, useCallback: useCb } = React;

function App() {
  const stageRef = useRf(null);
  const [view, setView] = useSt({ x: 0, y: 0, z: 0.7 });
  const [hovered, setHovered] = useSt(null);
  const [tooltip, setTooltip] = useSt(null);
  const [selected, setSelected] = useSt(null);
  const [statusFilter, setStatusFilter] = useSt({
    free: true, partial: true, full: true, reserved: true, inventory: true, blocked: true,
  });
  const [tweaksOpen, setTweaksOpen] = useSt(false);
  const [tweaks, setTweaks] = useSt(() => {
    const defaults = /*EDITMODE-BEGIN*/{
      "theme": "light",
      "lang": "ru",
      "pattern": "pattern",
      "ruler": true,
      "labels": true,
      "minimap": true,
      "legend": true
    }/*EDITMODE-END*/;
    return defaults;
  });

  // Edit-mode bridge (Tweaks toggle in toolbar)
  useEf(() => {
    const handler = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    try {
      window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    } catch (e) {}
    return () => window.removeEventListener('message', handler);
  }, []);

  // Persist tweaks (and live-apply)
  useEf(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
    try {
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: tweaks }, '*');
    } catch (e) {}
  }, [tweaks]);

  // Fit to view on mount
  useEf(() => {
    const el = stageRef.current;
    if (!el) return;
    fitAll();
    const onResize = () => setView(v => ({ ...v })); // triggers re-render for vb calc
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fitAll = () => {
    const el = stageRef.current;
    if (!el) return;
    const pad = 40;
    const zx = (el.clientWidth - pad * 2) / WMS.WORLD.w;
    const zy = (el.clientHeight - pad * 2) / WMS.WORLD.h;
    const z = Math.min(zx, zy);
    const cx = WMS.WORLD.w / 2;
    const cy = WMS.WORLD.h / 2;
    const x = cx - el.clientWidth / 2 / z;
    const y = cy - el.clientHeight / 2 / z;
    setView({ x, y, z });
  };

  // Keyboard shortcuts
  useEf(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'f' || e.key === 'F') fitAll();
      if (e.key === '+' || e.key === '=') setView(v => ({ ...v, z: Math.min(3, v.z * 1.2) }));
      if (e.key === '-' || e.key === '_') setView(v => ({ ...v, z: Math.max(0.3, v.z / 1.2) }));
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onHoverSection = useCb((item, e) => {
    if (!item) {
      setHovered(null);
      setTooltip(null);
      return;
    }
    setHovered(item);
    if (e) setTooltip({ item, x: e.clientX, y: e.clientY });
  }, []);

  // Follow mouse movement for tooltip
  useEf(() => {
    if (!hovered) return;
    const onMove = (e) => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null);
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [hovered]);

  const onClickSection = useCb((item) => {
    setSelected(item);
  }, []);

  const onSelectRack = useCb((rack) => {
    // select first section of the rack & pan to it
    const first = rack.sections[Math.floor(rack.sections.length / 2)];
    setSelected(first);
    // center view on it
    const el = stageRef.current;
    if (el) {
      const z = view.z;
      const x = first.x - el.clientWidth / 2 / z + first.w / 2;
      const y = first.y - el.clientHeight / 2 / z + first.h / 2;
      setView(v => ({ ...v, x, y }));
    }
  }, [view.z]);

  // Counts per status
  const counts = useMm(() => {
    const c = {};
    WMS.RACKS.forEach(r => r.sections.forEach(s => {
      c[s.status] = (c[s.status] || 0) + 1;
    }));
    WMS.FLOOR_CELLS.forEach(p => {
      c[p.status] = (c[p.status] || 0) + 1;
    });
    return c;
  }, []);

  const L = (ru, en) => tweaks.lang === 'en' ? en : ru;

  const [searchQ, setSearchQ] = useSt('');
  useEf(() => {
    if (!searchQ) return;
    const q = searchQ.trim().toUpperCase();
    let hit = null;
    for (const r of WMS.RACKS) {
      for (const s of r.sections) {
        if (s.id.toUpperCase().includes(q)) { hit = s; break; }
      }
      if (hit) break;
    }
    if (!hit) {
      for (const p of WMS.FLOOR_CELLS) {
        if (p.id.toUpperCase().includes(q)) { hit = p; break; }
      }
    }
    if (hit) {
      setSelected(hit);
      const el = stageRef.current;
      if (el) {
        const z = view.z;
        const x = hit.x - el.clientWidth / 2 / z + hit.w / 2;
        const y = hit.y - el.clientHeight / 2 / z + hit.h / 2;
        setView(v => ({ ...v, x, y }));
      }
    }
  }, [searchQ]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <span>Warehouse Map</span>
        </div>
        <div className="crumbs">
          <span>{L('Склад', 'Warehouse')}</span>
          <span className="sep">/</span>
          <span>SKL-MSK-01</span>
          <span className="sep">/</span>
          <span className="cur">{L('Этаж 1', 'Floor 1')}</span>
        </div>
        <div className="spacer" />
        <div className="search">
          <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            placeholder={L('Поиск: A-05, PAL-B3…', 'Find: A-05, PAL-B3…')}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          <span className="kbd">⌘K</span>
        </div>
        <button className="btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M7 12h10M11 18h2" />
          </svg>
          {L('Фильтры', 'Filters')}
        </button>
        <button
          className={'btn ' + (tweaksOpen ? 'active' : '')}
          onClick={() => setTweaksOpen(o => !o)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Tweaks
        </button>
      </header>

      <div className="body">
        <Sidebar
          lang={tweaks.lang}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          counts={counts}
          racks={WMS.RACKS}
          selected={selected}
          onSelectRack={onSelectRack}
          onSelectSection={(s) => setSelected(s)}
        />

        <div className="stage-wrap" ref={stageRef}>
          <WarehouseMap
            view={view} setView={setView}
            lang={tweaks.lang} theme={tweaks.theme}
            hovered={hovered} selected={selected}
            onHoverSection={onHoverSection}
            onClickSection={onClickSection}
            statusFilter={statusFilter}
            showRuler={tweaks.ruler}
            showLabels={tweaks.labels}
            pattern={tweaks.pattern}
            stageRef={stageRef}
          />

          <div className="overlay-tl">
            {tweaks.legend && <Legend lang={tweaks.lang} />}
          </div>

          <div className="overlay-br">
            <ZoomControls view={view} setView={setView} fitAll={fitAll} />
          </div>

          <div className="overlay-bl">
            {tweaks.minimap && <Minimap view={view} setView={setView} stageRef={stageRef} lang={tweaks.lang} />}
          </div>

          {tweaksOpen && (
            <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} onClose={() => setTweaksOpen(false)} lang={tweaks.lang} />
          )}

          <Tooltip data={tooltip} lang={tweaks.lang} />
        </div>

        <RightPanel lang={tweaks.lang} selected={selected} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
