import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { generateLogo } from './generator';
import { PALETTES, PALETTE_KEYS } from './palettes';

// ─── Constants ───────────────────────────────────────────────────────────────

const STYLES = ['minimal', 'geometric', 'abstract', 'retro', 'organic', 'brutalist'];
const SYMMETRIES = [
  { key: 'none', label: 'Off' },
  { key: 'mirror-h', label: 'H-Mirror' },
  { key: 'mirror-v', label: 'V-Mirror' },
  { key: 'radial-4', label: '4× Radial' },
  { key: 'radial-6', label: '6× Radial' },
];
const PNG_SIZES = [512, 1024, 2048];

const randSeed = () => Math.floor(Math.random() * 2 ** 32);

// ─── SVG Renderer ────────────────────────────────────────────────────────────

function ShapeEl({ shape }) {
  const { groupTransform, fill, stroke, strokeWidth, opacity, blendMode, ...props } = shape;
  const style = {
    mixBlendMode: blendMode && blendMode !== 'normal' ? blendMode : undefined,
    opacity,
  };
  const attrs = {
    fill: fill || 'none',
    stroke: stroke || 'none',
    strokeWidth: strokeWidth || 0,
  };

  let el;
  switch (props.type) {
    case 'circle':
      el = <circle cx={props.cx} cy={props.cy} r={Math.max(1, props.r)} style={style} {...attrs} />;
      break;
    case 'ellipse': {
      const t = props.rotation ? `rotate(${props.rotation} ${props.cx} ${props.cy})` : undefined;
      el = <ellipse cx={props.cx} cy={props.cy} rx={Math.max(1, props.rx)} ry={Math.max(1, props.ry)} style={style} transform={t} {...attrs} />;
      break;
    }
    case 'rect': {
      const t = props.rotation ? `rotate(${props.rotation} ${props.cx} ${props.cy})` : undefined;
      el = <rect x={props.cx - props.width / 2} y={props.cy - props.height / 2} width={Math.max(1, props.width)} height={Math.max(1, props.height)} style={style} transform={t} {...attrs} />;
      break;
    }
    case 'polygon':
      el = <polygon points={props.points} style={style} {...attrs} />;
      break;
    case 'path': {
      const t = props.rotation ? `rotate(${props.rotation} ${props.cx} ${props.cy})` : undefined;
      el = <path d={props.d} style={style} transform={t} {...attrs} />;
      break;
    }
    case 'ring': {
      // Ring: thick-stroke circle with no fill
      const ringColor = fill !== 'none' ? fill : stroke;
      const ringR = Math.max(1, props.r * 0.68);
      const ringW = props.r * 0.6;
      el = <circle cx={props.cx} cy={props.cy} r={ringR} stroke={ringColor} strokeWidth={ringW} fill="none" style={style} />;
      break;
    }
    default:
      el = <circle cx={props.cx} cy={props.cy} r={50} style={style} {...attrs} />;
  }

  if (groupTransform) {
    return <g transform={groupTransform}>{el}</g>;
  }
  return el;
}

function LogoSVG({ logo, svgRef }) {
  if (!logo) return null;
  const { shapes, background, textLayer } = logo;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 500 500"
      xmlns="http://www.w3.org/2000/svg"
      width="500"
      height="500"
    >
      <defs>
        {background.type === 'gradient' && (
          <linearGradient id="logo-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={background.color1} />
            <stop offset="100%" stopColor={background.color2} />
          </linearGradient>
        )}
      </defs>

      {background.type === 'solid' && (
        <rect width="500" height="500" fill={background.color} />
      )}
      {background.type === 'gradient' && (
        <rect width="500" height="500" fill="url(#logo-bg-grad)" />
      )}

      {shapes.map((shape, i) => (
        <ShapeEl key={i} shape={shape} />
      ))}

      {textLayer && (
        <text
          x={textLayer.x}
          y={textLayer.y}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={textLayer.fontSize}
          fill={textLayer.fill}
          fontFamily={textLayer.fontFamily}
          fontWeight={textLayer.fontWeight}
          letterSpacing={textLayer.letterSpacing}
        >
          {textLayer.text}
        </text>
      )}
    </svg>
  );
}

// Mini logo for history items
function MiniLogo({ logo }) {
  if (!logo) return null;
  const { shapes, background } = logo;
  return (
    <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      {background.type === 'solid' && <rect width="500" height="500" fill={background.color} />}
      {background.type === 'gradient' && (
        <>
          <defs>
            <linearGradient id="mini-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={background.color1} />
              <stop offset="100%" stopColor={background.color2} />
            </linearGradient>
          </defs>
          <rect width="500" height="500" fill="url(#mini-bg-grad)" />
        </>
      )}
      {shapes.map((shape, i) => (
        <ShapeEl key={i} shape={shape} />
      ))}
    </svg>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [style, setStyle] = useState('geometric');
  const [shapeCount, setShapeCount] = useState(5);
  const [paletteKey, setPaletteKey] = useState('electric');
  const [bgType, setBgType] = useState('solid');
  const [bgColor, setBgColor] = useState('#0D0D0D');
  const [symmetry, setSymmetry] = useState('none');
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(52);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [shapeSeed, setShapeSeed] = useState(randSeed);
  const [colorSeed, setColorSeed] = useState(randSeed);
  const [lockShapes, setLockShapes] = useState(false);
  const [lockColors, setLockColors] = useState(false);
  const [history, setHistory] = useState([]);
  const [showPngMenu, setShowPngMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastKey, setToastKey] = useState(0);

  const svgRef = useRef(null);
  const pngMenuRef = useRef(null);

  // Close PNG menu on outside click
  useEffect(() => {
    if (!showPngMenu) return;
    const handler = (e) => {
      if (pngMenuRef.current && !pngMenuRef.current.contains(e.target)) {
        setShowPngMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPngMenu]);

  // Keyboard shortcut: Space = regenerate, S = save
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); regenerate(); }
      if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey) saveToHistory();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const palette = PALETTES[paletteKey];

  const logoData = useMemo(() =>
    generateLogo({
      style, shapeCount, palette, bgType, bgColor,
      text, fontSize, textColor, fontFamily: 'sans-serif',
      symmetry, shapeSeed, colorSeed,
    }),
    [style, shapeCount, palette, bgType, bgColor, text, fontSize, textColor, symmetry, shapeSeed, colorSeed]
  );

  const regenerate = useCallback(() => {
    if (!lockShapes) setShapeSeed(randSeed());
    if (!lockColors) setColorSeed(randSeed());
  }, [lockShapes, lockColors]);

  const randomizeAll = () => {
    const styleIdx = Math.floor(Math.random() * STYLES.length);
    const palIdx = Math.floor(Math.random() * PALETTE_KEYS.length);
    setStyle(STYLES[styleIdx]);
    setPaletteKey(PALETTE_KEYS[palIdx]);
    setShapeCount(Math.floor(Math.random() * 8) + 2);
    setSymmetry(SYMMETRIES[Math.floor(Math.random() * SYMMETRIES.length)].key);
    setShapeSeed(randSeed());
    setColorSeed(randSeed());
  };

  const showToast = (msg) => {
    setToast(msg);
    setToastKey(k => k + 1);
  };

  const saveToHistory = useCallback(() => {
    setHistory(h => [
      { id: Date.now(), logoData, shapeSeed, colorSeed, style, paletteKey, bgType, bgColor, symmetry },
      ...h,
    ].slice(0, 20));
    showToast('Saved to history');
  }, [logoData, shapeSeed, colorSeed, style, paletteKey, bgType, bgColor, symmetry]);

  const loadFromHistory = (item) => {
    setShapeSeed(item.shapeSeed);
    setColorSeed(item.colorSeed);
    setStyle(item.style);
    setPaletteKey(item.paletteKey);
    setBgType(item.bgType);
    setBgColor(item.bgColor);
    setSymmetry(item.symmetry);
  };

  const clearHistory = () => setHistory([]);

  const getSVGString = () => {
    if (!svgRef.current) return '';
    return new XMLSerializer().serializeToString(svgRef.current);
  };

  const exportSVG = () => {
    const str = getSVGString();
    if (!str) return;
    const blob = new Blob([str], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logoforge-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('SVG exported');
  };

  const copySVGCode = () => {
    const str = getSVGString();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => showToast('SVG code copied'));
  };

  const exportPNG = (size) => {
    setShowPngMenu(false);
    const str = getSVGString();
    if (!str) return;
    const blob = new Blob([str], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (bgType !== 'transparent') {
        ctx.fillStyle = bgType === 'solid' ? bgColor : '#000000';
        ctx.fillRect(0, 0, size, size);
      }
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement('a');
      a.download = `logoforge-${size}px-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      URL.revokeObjectURL(url);
      showToast(`PNG ${size}px exported`);
    };
    img.src = url;
  };

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <span className="brand-name">LOGOFORGE</span>
          <span className="brand-sub">Vector Logo Generator</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-random-all" onClick={randomizeAll}>
            ⚡ Randomize All
          </button>
          <button className="btn btn-ghost" onClick={copySVGCode}>
            Copy SVG
          </button>
          <button className="btn btn-ghost" onClick={exportSVG}>
            Export SVG
          </button>
          <div className="export-group" ref={pngMenuRef}>
            <button className="btn btn-ghost" onClick={() => setShowPngMenu(v => !v)}>
              Export PNG ▾
            </button>
            {showPngMenu && (
              <div className="dropdown-menu">
                {PNG_SIZES.map(s => (
                  <button key={s} onClick={() => exportPNG(s)}>
                    {s} × {s} px
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main-layout">
        {/* ── Controls ── */}
        <aside className="controls-panel">

          {/* Style */}
          <div className="control-group">
            <div className="control-label">Style</div>
            <div className="chip-grid">
              {STYLES.map(s => (
                <button key={s} className={`chip ${style === s ? 'active' : ''}`} onClick={() => setStyle(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Shape Count */}
          <div className="control-group">
            <div className="control-label">
              Shapes <span className="control-value">{shapeCount}</span>
            </div>
            <input
              type="range" className="slider"
              min={2} max={12} value={shapeCount}
              onChange={e => setShapeCount(+e.target.value)}
            />
          </div>

          <div className="divider" />

          {/* Palette */}
          <div className="control-group">
            <div className="control-label">Palette</div>
            <div className="palette-grid">
              {PALETTE_KEYS.map(key => (
                <button
                  key={key}
                  className={`palette-chip ${paletteKey === key ? 'active' : ''}`}
                  onClick={() => setPaletteKey(key)}
                >
                  <div className="palette-swatches">
                    {PALETTES[key].colors.slice(0, 5).map((c, i) => (
                      <div key={i} className="swatch" style={{ background: c }} />
                    ))}
                  </div>
                  <span>{PALETTES[key].name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="divider" />

          {/* Background */}
          <div className="control-group">
            <div className="control-label">Background</div>
            <div className="bg-row">
              {['solid', 'gradient', 'transparent'].map(t => (
                <button key={t} className={`chip ${bgType === t ? 'active' : ''}`} onClick={() => setBgType(t)}>
                  {t === 'transparent' ? 'None' : t}
                </button>
              ))}
            </div>
            {bgType === 'solid' && (
              <div className="color-row">
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} />
                <span>{bgColor.toUpperCase()}</span>
              </div>
            )}
            {bgType === 'gradient' && (
              <div className="color-row">
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Auto from palette</span>
              </div>
            )}
          </div>

          <div className="divider" />

          {/* Symmetry */}
          <div className="control-group">
            <div className="control-label">Symmetry</div>
            <div className="chip-grid">
              {SYMMETRIES.map(s => (
                <button key={s.key} className={`chip ${symmetry === s.key ? 'active' : ''}`} onClick={() => setSymmetry(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divider" />

          {/* Text */}
          <div className="control-group">
            <div className="control-label">Text Overlay</div>
            <input
              type="text" className="text-input"
              placeholder="Company name..."
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={20}
            />
            {text && (
              <>
                <div className="control-label" style={{ marginTop: 4 }}>
                  Size <span className="control-value">{fontSize}px</span>
                </div>
                <input
                  type="range" className="slider"
                  min={20} max={80} value={fontSize}
                  onChange={e => setFontSize(+e.target.value)}
                />
                <div className="text-controls">
                  <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} />
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Text color</span>
                </div>
              </>
            )}
          </div>

          <div className="divider" />

          {/* Lock */}
          <div className="control-group">
            <div className="control-label">Lock on Regenerate</div>
            <div className="lock-row">
              <button className={`lock-btn ${lockShapes ? 'active' : ''}`} onClick={() => setLockShapes(v => !v)}>
                <span className="lock-icon">{lockShapes ? '🔒' : '🔓'}</span> Shapes
              </button>
              <button className={`lock-btn ${lockColors ? 'active' : ''}`} onClick={() => setLockColors(v => !v)}>
                <span className="lock-icon">{lockColors ? '🔒' : '🔓'}</span> Colors
              </button>
            </div>
          </div>

          {/* Keyboard hints */}
          <div style={{ color: 'var(--text-dim)', fontSize: 9, letterSpacing: '0.1em', lineHeight: 1.8, marginTop: 4 }}>
            SPACE — regenerate<br />
            S — save to history
          </div>
        </aside>

        {/* ── Canvas ── */}
        <section className="canvas-area">
          <div className={`logo-canvas-wrapper ${bgType === 'transparent' ? 'transparent-bg' : ''}`}>
            <LogoSVG logo={logoData} svgRef={svgRef} />
          </div>
          <div className="canvas-actions">
            <button className="btn btn-save" onClick={saveToHistory}>♡ Save</button>
            <button className="btn btn-regen" onClick={regenerate}>⟳ Regenerate</button>
          </div>
        </section>

        {/* ── History ── */}
        <aside className="history-panel">
          <div className="history-header">
            <div className="control-label">Saved</div>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="history-empty">
              No saved logos yet.<br />
              Press S or click Save.
            </div>
          ) : (
            <div className="history-grid">
              {history.map(item => (
                <div
                  key={item.id}
                  className={`history-item ${bgType === 'transparent' ? 'transparent-bg' : ''}`}
                  onClick={() => loadFromHistory(item)}
                  title="Click to restore"
                >
                  <MiniLogo logo={item.logoData} />
                </div>
              ))}
            </div>
          )}
        </aside>
      </main>

      {/* Toast */}
      {toast && <div key={toastKey} className="toast">{toast}</div>}
    </div>
  );
}
