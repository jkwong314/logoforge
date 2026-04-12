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
const CLIP_FRAMES = [
  { key: 'circle',     label: 'Circle' },
  { key: 'square',     label: 'Square' },
  { key: 'roundsq',   label: 'Rounded' },
  { key: 'hexagon',   label: 'Hexagon' },
  { key: 'none',      label: 'None' },
];
const PNG_SIZES = [512, 1024, 2048];

const randSeed = () => Math.floor(Math.random() * 2 ** 32);

function GradientDef({ id, background }) {
  if (background.gradientType === 'radial') {
    return (
      <radialGradient id={id} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor={background.color1} />
        <stop offset="100%" stopColor={background.color2} />
      </radialGradient>
    );
  }
  const { x1, y1, x2, y2 } = angleToGradientAttrs(background.angle ?? 180);
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      <stop offset="0%" stopColor={background.color1} />
      <stop offset="100%" stopColor={background.color2} />
    </linearGradient>
  );
}

// Convert CSS-style angle (deg) to SVG linearGradient x1/y1/x2/y2
function angleToGradientAttrs(angleDeg) {
  const r = angleDeg * Math.PI / 180;
  return {
    x1: `${(50 - 50 * Math.sin(r)).toFixed(2)}%`,
    y1: `${(50 + 50 * Math.cos(r)).toFixed(2)}%`,
    x2: `${(50 + 50 * Math.sin(r)).toFixed(2)}%`,
    y2: `${(50 - 50 * Math.cos(r)).toFixed(2)}%`,
  };
}

const GRADIENT_DIRS = [
  { label: '↓', angle: 180 },
  { label: '→', angle: 90  },
  { label: '↘', angle: 135 },
  { label: '↗', angle: 45  },
  { label: '↑', angle: 0   },
  { label: '⊙', angle: null }, // radial
];

// Returns an SVG path/shape string for the given clip frame key
function clipFramePath(key) {
  switch (key) {
    case 'circle':
      return <circle cx="250" cy="250" r="225" />;
    case 'square':
      return <rect x="25" y="25" width="450" height="450" />;
    case 'roundsq':
      return <rect x="25" y="25" width="450" height="450" rx="60" />;
    case 'hexagon': {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        return `${(250 + 225 * Math.cos(a)).toFixed(2)},${(250 + 225 * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
      return <polygon points={pts} />;
    }
    default:
      return null;
  }
}

// ─── SVG Shape Renderer ───────────────────────────────────────────────────────

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
      const ringColor = fill !== 'none' ? fill : stroke;
      el = <circle cx={props.cx} cy={props.cy} r={Math.max(1, props.r * 0.68)} stroke={ringColor} strokeWidth={props.r * 0.6} fill="none" style={style} />;
      break;
    }
    default:
      el = <circle cx={props.cx} cy={props.cy} r={50} style={style} {...attrs} />;
  }

  return groupTransform ? <g transform={groupTransform}>{el}</g> : el;
}

// ─── Logo SVG ─────────────────────────────────────────────────────────────────

function LogoSVG({ logo, svgRef, clipFrame, layerMode, singleColor }) {
  if (!logo) return null;
  const { shapes, background, textLayer } = logo;
  const hasClip = clipFrame && clipFrame !== 'none';
  const clipId = 'logo-frame-clip';
  const isOneLayer = layerMode === 'one';

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 500 500"
      xmlns="http://www.w3.org/2000/svg"
      width="500"
      height="500"
    >
      <defs>
        {background.type === 'gradient' && background.gradientType !== 'radial' && (
          <linearGradient id="logo-bg-grad" {...angleToGradientAttrs(background.angle ?? 180)}>
            <stop offset="0%" stopColor={background.color1} />
            <stop offset="100%" stopColor={background.color2} />
          </linearGradient>
        )}
        {background.type === 'gradient' && background.gradientType === 'radial' && (
          <radialGradient id="logo-bg-grad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={background.color1} />
            <stop offset="100%" stopColor={background.color2} />
          </radialGradient>
        )}
        {isOneLayer && (
          <mask id="logo-shapes-mask">
            <rect width="500" height="500" fill="black" />
            {shapes.map((shape, i) => (
              <ShapeEl key={i} shape={{ ...shape, fill: 'white', stroke: shape.stroke !== 'none' ? 'white' : 'none' }} />
            ))}
          </mask>
        )}
        {hasClip && (
          <clipPath id={clipId}>
            {clipFramePath(clipFrame)}
          </clipPath>
        )}
      </defs>

      {/* Background (always full canvas, outside clip) */}
      {background.type === 'solid' && (
        <rect width="500" height="500" fill={background.color} />
      )}
      {background.type === 'gradient' && (
        <rect width="500" height="500" fill="url(#logo-bg-grad)" />
      )}

      {/* Shapes — one layer uses a mask to export as single merged shape */}
      <g clipPath={hasClip ? `url(#${clipId})` : undefined}>
        {isOneLayer ? (
          <rect width="500" height="500" fill={singleColor} mask="url(#logo-shapes-mask)" />
        ) : (
          shapes.map((shape, i) => (
            <ShapeEl key={i} shape={shape} />
          ))
        )}
      </g>

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

// Mini logo for history thumbnails
function MiniLogo({ logo, clipFrame }) {
  if (!logo) return null;
  const { shapes, background } = logo;
  const hasClip = clipFrame && clipFrame !== 'none';
  return (
    <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        {background.type === 'gradient' && background.gradientType !== 'radial' && (
          <linearGradient id="mini-bg-grad" {...angleToGradientAttrs(background.angle ?? 180)}>
            <stop offset="0%" stopColor={background.color1} />
            <stop offset="100%" stopColor={background.color2} />
          </linearGradient>
        )}
        {background.type === 'gradient' && background.gradientType === 'radial' && (
          <radialGradient id="mini-bg-grad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={background.color1} />
            <stop offset="100%" stopColor={background.color2} />
          </radialGradient>
        )}
        {hasClip && <clipPath id="mini-clip">{clipFramePath(clipFrame)}</clipPath>}
      </defs>
      {background.type === 'solid' && <rect width="500" height="500" fill={background.color} />}
      {background.type === 'gradient' && <rect width="500" height="500" fill="url(#mini-bg-grad)" />}
      <g clipPath={hasClip ? 'url(#mini-clip)' : undefined}>
        {shapes.map((shape, i) => <ShapeEl key={i} shape={shape} />)}
      </g>
    </svg>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [style, setStyle] = useState('geometric');
  const [shapeCount, setShapeCount] = useState(5);
  const [paletteKey, setPaletteKey] = useState('electric');
  const [colorMode, setColorMode] = useState('multi');   // 'multi' | 'single'
  const [singleColor, setSingleColor] = useState('#EAFF00');
  const [layerMode, setLayerMode] = useState('one');     // 'one' | 'individual'
  const [centerGap, setCenterGap] = useState(50);        // 0=overlap … 100=far apart
  const [bgType, setBgType] = useState('solid');
  const [bgColor, setBgColor] = useState('#0D0D0D');
  const [bgGrad1, setBgGrad1] = useState('#0D0D2B');
  const [bgGrad2, setBgGrad2] = useState('#7B2D8B');
  const [bgGradAngle, setBgGradAngle] = useState(180);
  const [bgGradType, setBgGradType] = useState('linear'); // 'linear' | 'radial'
  const [clipFrame, setClipFrame] = useState('circle');
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

  // Keyboard shortcuts: Space = regenerate, S = save
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
      bgGradient: { color1: bgGrad1, color2: bgGrad2, angle: bgGradAngle, gradientType: bgGradType },
      text, fontSize, textColor, fontFamily: 'sans-serif',
      symmetry, shapeSeed, colorSeed,
      colorMode: layerMode === 'one' ? 'single' : colorMode,
      singleColor, layerMode, centerGap,
    }),
    [style, shapeCount, palette, bgType, bgColor, bgGrad1, bgGrad2, bgGradAngle, bgGradType,
     text, fontSize, textColor, symmetry, shapeSeed, colorSeed,
     colorMode, singleColor, layerMode, centerGap]
  );

  const regenerate = useCallback(() => {
    if (!lockShapes) setShapeSeed(randSeed());
    if (!lockColors) setColorSeed(randSeed());
  }, [lockShapes, lockColors]);

  const randomizeAll = () => {
    setStyle(STYLES[Math.floor(Math.random() * STYLES.length)]);
    setPaletteKey(PALETTE_KEYS[Math.floor(Math.random() * PALETTE_KEYS.length)]);
    setShapeCount(Math.floor(Math.random() * 8) + 2);
    setSymmetry(SYMMETRIES[Math.floor(Math.random() * SYMMETRIES.length)].key);
    setClipFrame(CLIP_FRAMES[Math.floor(Math.random() * CLIP_FRAMES.length)].key);
    setColorMode(Math.random() > 0.5 ? 'multi' : 'single');
    setShapeSeed(randSeed());
    setColorSeed(randSeed());
  };

  const showToast = (msg) => {
    setToast(msg);
    setToastKey(k => k + 1);
  };

  const saveToHistory = useCallback(() => {
    setHistory(h => [
      { id: Date.now(), logoData, clipFrame, shapeSeed, colorSeed,
        style, paletteKey, bgType, bgColor, bgGrad1, bgGrad2, bgGradAngle, bgGradType,
        symmetry, colorMode, singleColor, layerMode, centerGap },
      ...h,
    ].slice(0, 20));
    showToast('Saved to history');
  }, [logoData, clipFrame, shapeSeed, colorSeed, style, paletteKey, bgType, bgColor, symmetry, colorMode, singleColor, layerMode]);

  const loadFromHistory = (item) => {
    setShapeSeed(item.shapeSeed);
    setColorSeed(item.colorSeed);
    setStyle(item.style);
    setPaletteKey(item.paletteKey);
    setBgType(item.bgType);
    setBgColor(item.bgColor);
    setSymmetry(item.symmetry);
    setClipFrame(item.clipFrame || 'circle');
    setColorMode(item.colorMode || 'multi');
    if (item.singleColor) setSingleColor(item.singleColor);
    setLayerMode(item.layerMode || 'one');
    if (item.centerGap !== undefined) setCenterGap(item.centerGap);
    if (item.bgGrad1) setBgGrad1(item.bgGrad1);
    if (item.bgGrad2) setBgGrad2(item.bgGrad2);
    if (item.bgGradAngle !== undefined) setBgGradAngle(item.bgGradAngle);
    if (item.bgGradType) setBgGradType(item.bgGradType);
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
          <button className="btn btn-random-all" onClick={randomizeAll}>⚡ Randomize All</button>
          <button className="btn btn-ghost" onClick={copySVGCode}>Copy SVG</button>
          <button className="btn btn-ghost" onClick={exportSVG}>Export SVG</button>
          <div className="export-group" ref={pngMenuRef}>
            <button className="btn btn-ghost" onClick={() => setShowPngMenu(v => !v)}>
              Export PNG ▾
            </button>
            {showPngMenu && (
              <div className="dropdown-menu">
                {PNG_SIZES.map(s => (
                  <button key={s} onClick={() => exportPNG(s)}>{s} × {s} px</button>
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

          {/* Layer Mode */}
          <div className="control-group">
            <div className="control-label">Layers</div>
            <div className="chip-grid">
              <button
                className={`chip ${layerMode === 'one' ? 'active' : ''}`}
                onClick={() => setLayerMode('one')}
              >
                One Layer
              </button>
              <button
                className={`chip ${layerMode === 'individual' ? 'active' : ''}`}
                onClick={() => setLayerMode('individual')}
              >
                Individual
              </button>
            </div>
          </div>

          <div className="divider" />

          {/* Colors */}
          <div className="control-group">
            <div className="control-label">Colors</div>

            {layerMode === 'one' ? (
              /* One Layer: single color only */
              <div className="color-row">
                <input type="color" value={singleColor} onChange={e => setSingleColor(e.target.value)} />
                <span style={{ color: 'var(--text)', fontSize: 11, letterSpacing: '0.04em', fontFamily: 'var(--font-ui)' }}>
                  {singleColor.toUpperCase()}
                </span>
              </div>
            ) : (
              /* Individual: multi-color palette or single picker */
              <>
                <div className="chip-grid" style={{ marginBottom: 8 }}>
                  <button className={`chip ${colorMode === 'multi' ? 'active' : ''}`} onClick={() => setColorMode('multi')}>
                    Multicolor
                  </button>
                  <button className={`chip ${colorMode === 'single' ? 'active' : ''}`} onClick={() => setColorMode('single')}>
                    Single
                  </button>
                </div>
                {colorMode === 'single' ? (
                  <div className="color-row">
                    <input type="color" value={singleColor} onChange={e => setSingleColor(e.target.value)} />
                    <span style={{ color: 'var(--text)', fontSize: 11, letterSpacing: '0.04em', fontFamily: 'var(--font-ui)' }}>
                      {singleColor.toUpperCase()}
                    </span>
                  </div>
                ) : (
                  <div className="palette-grid">
                    {PALETTE_KEYS.map(key => (
                      <button key={key} className={`palette-chip ${paletteKey === key ? 'active' : ''}`} onClick={() => setPaletteKey(key)}>
                        <div className="palette-swatches">
                          {PALETTES[key].colors.slice(0, 5).map((c, i) => (
                            <div key={i} className="swatch" style={{ background: c }} />
                          ))}
                        </div>
                        <span>{PALETTES[key].name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="divider" />

          {/* Clip Frame */}
          <div className="control-group">
            <div className="control-label">Clip Frame</div>
            <div className="chip-grid">
              {CLIP_FRAMES.map(f => (
                <button
                  key={f.key}
                  className={`chip ${clipFrame === f.key ? 'active' : ''}`}
                  onClick={() => setClipFrame(f.key)}
                >
                  {f.label}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                {/* Two color pickers */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" value={bgGrad1} onChange={e => setBgGrad1(e.target.value)}
                    style={{ width: 28, height: 28, border: '1px solid var(--border)', background: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', padding: 2 }} />
                  <div style={{ flex: 1, height: 16, borderRadius: 3, background: `linear-gradient(90deg, ${bgGrad1}, ${bgGrad2})` }} />
                  <input type="color" value={bgGrad2} onChange={e => setBgGrad2(e.target.value)}
                    style={{ width: 28, height: 28, border: '1px solid var(--border)', background: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', padding: 2 }} />
                </div>
                {/* Direction chips */}
                <div className="chip-grid">
                  {GRADIENT_DIRS.map(({ label, angle }) => {
                    const isRadial = angle === null;
                    const isActive = isRadial
                      ? bgGradType === 'radial'
                      : bgGradType === 'linear' && bgGradAngle === angle;
                    return (
                      <button
                        key={label}
                        className={`chip ${isActive ? 'active' : ''}`}
                        style={{ minWidth: 32, textAlign: 'center' }}
                        onClick={() => {
                          if (isRadial) { setBgGradType('radial'); }
                          else { setBgGradType('linear'); setBgGradAngle(angle); }
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
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

            {(symmetry === 'radial-4' || symmetry === 'radial-6') && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="control-label">
                  Center Gap
                  <span className="control-value">{centerGap}%</span>
                </div>
                <input
                  type="range" className="slider"
                  min={0} max={100} value={centerGap}
                  onChange={e => setCenterGap(+e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: 9, letterSpacing: '0.08em' }}>
                  <span>Overlap</span>
                  <span>Open</span>
                </div>
              </div>
            )}
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

          <div style={{ color: 'var(--text-dim)', fontSize: 9, letterSpacing: '0.1em', lineHeight: 1.8, marginTop: 4 }}>
            SPACE — regenerate<br />
            S — save to history
          </div>
        </aside>

        {/* ── Canvas ── */}
        <section className="canvas-area">
          <div className={`logo-canvas-wrapper ${bgType === 'transparent' ? 'transparent-bg' : ''}`}>
            <LogoSVG logo={logoData} svgRef={svgRef} clipFrame={clipFrame} layerMode={layerMode} singleColor={singleColor} />
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
                  className={`history-item ${item.bgType === 'transparent' ? 'transparent-bg' : ''}`}
                  onClick={() => loadFromHistory(item)}
                  title="Click to restore"
                >
                  <MiniLogo logo={item.logoData} clipFrame={item.clipFrame} />
                </div>
              ))}
            </div>
          )}
        </aside>
      </main>

      {toast && <div key={toastKey} className="toast">{toast}</div>}
    </div>
  );
}
