import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { generateLogo } from './generator';
import { PALETTES, PALETTE_KEYS } from './palettes';

// ─── Constants ───────────────────────────────────────────────────────────────

const STYLES = ['minimal', 'geometric', 'abstract', 'retro', 'organic', 'brutalist'];
const SYMMETRIES = [
  { key: 'none', label: 'Off' },
  { key: 'mirror-h', label: 'H-Mirror' },
  { key: 'mirror-v', label: 'V-Mirror' },
  { key: 'radial-3', label: '3×' },
  { key: 'radial-4', label: '4×' },
  { key: 'radial-5', label: '5×' },
  { key: 'radial-6', label: '6×' },
];
const PNG_SIZES = [512, 1024, 2048];

const randSeed = () => Math.floor(Math.random() * 2 ** 32);

function AngleDial({ angle, onChange }) {
  const svgRef = useRef(null);
  const handlePointerDown = (e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const update = (x, y) => {
      let a = Math.atan2(x - cx, -(y - cy)) * 180 / Math.PI;
      if (a < 0) a += 360;
      onChange(Math.round(a));
    };
    update(e.clientX, e.clientY);
    const onMove = (e) => update(e.clientX, e.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const rad = (angle - 90) * Math.PI / 180;
  const dotX = (12 + 7 * Math.cos(rad)).toFixed(2);
  const dotY = (12 + 7 * Math.sin(rad)).toFixed(2);
  return (
    <svg ref={svgRef} width="24" height="24" viewBox="0 0 24 24"
      style={{ cursor: 'grab', flexShrink: 0, userSelect: 'none' }}
      onPointerDown={handlePointerDown}>
      <circle cx="12" cy="12" r="10.5" fill="var(--panel-2)" stroke="var(--border)" strokeWidth="1"/>
      <line x1="12" y1="12" x2={dotX} y2={dotY} stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx={dotX} cy={dotY} r="2.5" fill="var(--accent)"/>
    </svg>
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

// ─── Bulk export helpers (pure string — no DOM needed) ────────────────────────

function shapeToStr(shape) {
  const { groupTransform, fill, stroke, strokeWidth, opacity, blendMode, ...props } = shape;
  const f = fill || 'none';
  const s = stroke || 'none';
  const sw = strokeWidth || 0;
  const styleStr = [
    blendMode && blendMode !== 'normal' ? `mix-blend-mode:${blendMode}` : '',
    opacity != null && opacity !== 1 ? `opacity:${opacity}` : '',
  ].filter(Boolean).join(';');
  const st = styleStr ? ` style="${styleStr}"` : '';
  const base = `fill="${f}" stroke="${s}" stroke-width="${sw}"${st}`;
  let el;
  switch (props.type) {
    case 'circle':
      el = `<circle cx="${props.cx}" cy="${props.cy}" r="${Math.max(1, props.r)}" ${base}/>`;
      break;
    case 'ellipse': {
      const t = props.rotation ? ` transform="rotate(${props.rotation} ${props.cx} ${props.cy})"` : '';
      el = `<ellipse cx="${props.cx}" cy="${props.cy}" rx="${Math.max(1, props.rx)}" ry="${Math.max(1, props.ry)}"${t} ${base}/>`;
      break;
    }
    case 'rect': {
      const t = props.rotation ? ` transform="rotate(${props.rotation} ${props.cx} ${props.cy})"` : '';
      el = `<rect x="${props.cx - props.width / 2}" y="${props.cy - props.height / 2}" width="${Math.max(1, props.width)}" height="${Math.max(1, props.height)}"${t} ${base}/>`;
      break;
    }
    case 'polygon':
      el = `<polygon points="${props.points}" ${base}/>`;
      break;
    case 'path': {
      const t = props.rotation ? ` transform="rotate(${props.rotation} ${props.cx} ${props.cy})"` : '';
      el = `<path d="${props.d}"${t} ${base}/>`;
      break;
    }
    case 'ring': {
      const rc = f !== 'none' ? f : s;
      el = `<circle cx="${props.cx}" cy="${props.cy}" r="${Math.max(1, props.r * 0.68)}" stroke="${rc}" stroke-width="${props.r * 0.6}" fill="none"${st}/>`;
      break;
    }
    default:
      el = `<circle cx="${props.cx}" cy="${props.cy}" r="50" ${base}/>`;
  }
  return groupTransform ? `<g transform="${groupTransform}">${el}</g>` : el;
}

function buildItemSVGString(item) {
  const { logoData, layerMode, singleColor } = item;
  const { shapes, background, textLayer } = logoData;
  const isOneLayer = layerMode === 'one';

  let defs = '';
  if (background.type === 'gradient') {
    if (background.gradientType === 'radial') {
      defs = `<defs><radialGradient id="bg-grad" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="${background.color1}"/><stop offset="100%" stop-color="${background.color2}"/></radialGradient></defs>`;
    } else {
      const { x1, y1, x2, y2 } = angleToGradientAttrs(background.angle ?? 180);
      defs = `<defs><linearGradient id="bg-grad" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0%" stop-color="${background.color1}"/><stop offset="100%" stop-color="${background.color2}"/></linearGradient></defs>`;
    }
  }

  const bg = background.type === 'solid'
    ? `<rect width="500" height="500" fill="${background.color}"/>`
    : background.type === 'gradient'
    ? `<rect width="500" height="500" fill="url(#bg-grad)"/>`
    : '';

  const shapesStr = shapes.map(shape =>
    isOneLayer
      ? shapeToStr({ ...shape, fill: singleColor, stroke: 'none', opacity: 1, blendMode: 'normal' })
      : shapeToStr(shape)
  ).join('');

  const text = textLayer
    ? `<text x="${textLayer.x}" y="${textLayer.y}" text-anchor="middle" dominant-baseline="auto" font-size="${textLayer.fontSize}" fill="${textLayer.fill}" font-family="${textLayer.fontFamily}" font-weight="${textLayer.fontWeight}" letter-spacing="${textLayer.letterSpacing}">${textLayer.text}</text>`
    : '';

  return `<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" width="500" height="500">${defs}${bg}<g>${shapesStr}</g>${text}</svg>`;
}

// ─── Advanced export helpers ──────────────────────────────────────────────────

function svgToCanvas(svgStr, size = 500) {
  return new Promise((resolve) => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.src = url;
  });
}

function canvasToJPEGBytes(canvas, quality = 0.9) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf))), 'image/jpeg', quality);
  });
}

async function buildPDFBytes(items, size = 500) {
  const pages = [];
  for (const item of items) {
    const canvas = await svgToCanvas(buildItemSVGString(item), size);
    pages.push(await canvasToJPEGBytes(canvas));
  }

  const enc = new TextEncoder();
  const parts = [];
  let offset = 0;

  const write = (str) => { const b = enc.encode(str); parts.push(b); offset += b.length; };
  const writeBin = (bytes) => { parts.push(bytes); offset += bytes.length; };

  write('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const objOffsets = {};
  let objNum = 1;

  // Catalog
  objOffsets[objNum] = offset;
  write(`${objNum} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objNum++;

  // Pages node (placeholder — we know obj 2 is Pages, kids start at 3)
  const pagesPos = offset;
  objOffsets[objNum] = offset;
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  write(`${objNum} 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);
  objNum++;

  for (let i = 0; i < pages.length; i++) {
    const jpeg = pages[i];
    const pageN = objNum;
    const imgN = objNum + 1;
    const contN = objNum + 2;

    objOffsets[pageN] = offset;
    write(`${pageN} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size} ${size}] /Resources << /XObject << /Im${i} ${imgN} 0 R >> >> /Contents ${contN} 0 R >>\nendobj\n`);

    objOffsets[imgN] = offset;
    write(`${imgN} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${size} /Height ${size} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    writeBin(jpeg);
    write(`\nendstream\nendobj\n`);

    const cs = `q ${size} 0 0 ${size} 0 0 cm /Im${i} Do Q`;
    objOffsets[contN] = offset;
    write(`${contN} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);

    objNum += 3;
  }

  const xrefOffset = offset;
  write(`xref\n0 ${objNum}\n`);
  write(`0000000000 65535 f \n`);
  for (let i = 1; i < objNum; i++) write(`${String(objOffsets[i]).padStart(10, '0')} 00000 n \n`);
  write(`trailer\n<< /Size ${objNum} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { result.set(p, pos); pos += p.length; }
  return result;
}

// Build an Illustrator-compatible SVG file (vector, multi-artboard for multiple items).
// AI's native format is SVG with Adobe namespace declarations — this is what Illustrator
// opens as fully editable vectors, not a rasterized image.
function buildIllustratorSVG(items) {
  const size = 500;
  let defs = '';
  let layers = '';

  items.forEach((item, idx) => {
    const { logoData, layerMode, singleColor } = item;
    const { shapes, background, textLayer } = logoData;
    const isOneLayer = layerMode === 'one';

    let bgStr = '';
    if (background.type === 'solid') {
      bgStr = `<rect width="${size}" height="${size}" fill="${background.color}"/>`;
    } else if (background.type === 'gradient') {
      const gid = `ai-grad-${idx}`;
      if (background.gradientType === 'radial') {
        defs += `<radialGradient id="${gid}" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="${background.color1}"/><stop offset="100%" stop-color="${background.color2}"/></radialGradient>`;
      } else {
        const { x1, y1, x2, y2 } = angleToGradientAttrs(background.angle ?? 180);
        defs += `<linearGradient id="${gid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0%" stop-color="${background.color1}"/><stop offset="100%" stop-color="${background.color2}"/></linearGradient>`;
      }
      bgStr = `<rect width="${size}" height="${size}" fill="url(#${gid})"/>`;
    }

    const shapesStr = shapes.map(s => isOneLayer
      ? shapeToStr({ ...s, fill: singleColor, stroke: 'none', opacity: 1, blendMode: 'normal' })
      : shapeToStr(s)
    ).join('');

    const textStr = textLayer
      ? `<text x="${textLayer.x}" y="${textLayer.y}" text-anchor="middle" dominant-baseline="auto" font-size="${textLayer.fontSize}" fill="${textLayer.fill}" font-family="${textLayer.fontFamily}" font-weight="${textLayer.fontWeight}" letter-spacing="${textLayer.letterSpacing}">${textLayer.text}</text>`
      : '';

    // Each logo becomes a named layer (Illustrator layer group)
    layers += `\n<g xmlns:i="http://ns.adobe.com/AdobeIllustrator/10.0/" i:layer="yes" i:dimmedPercent="50" id="logo-${idx + 1}">\n<title>Logo ${idx + 1}</title>\n${bgStr}<g>${shapesStr}</g>${textStr}\n</g>`;
  });

  // For multi-logo, stack artboards side by side horizontally
  const cols = items.length;
  const w = size * cols;
  const h = size;

  // Illustrator opens SVGs as fully editable vectors when they have:
  // 1. XML declaration, 2. Adobe namespace on <svg>, 3. x:Version attribute
  return `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generator: LogoForge -->\n<svg version="1.1"\n  xmlns="http://www.w3.org/2000/svg"\n  xmlns:xlink="http://www.w3.org/1999/xlink"\n  xmlns:x="http://ns.adobe.com/Extensibility/1.0/"\n  xmlns:i="http://ns.adobe.com/AdobeIllustrator/10.0/"\n  x:Version="6.00"\n  viewBox="0 0 ${w} ${h}"\n  width="${w}"\n  height="${h}"\n  xml:space="preserve">\n<defs>${defs}</defs>${layers}\n</svg>`;
}

function wrapSVGAsEPS(svgStr) {
  return `%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 500 500\n%%HiResBoundingBox: 0 0 500 500\n%%BeginDocument: logo.svg\n${svgStr}\n%%EndDocument\n%%EOF`;
}

// ─── Logo SVG ─────────────────────────────────────────────────────────────────

function LogoSVG({ logo, svgRef, layerMode, singleColor }) {
  if (!logo) return null;
  const { shapes, background, textLayer } = logo;
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
      </defs>

      {/* Layer 1: Background */}
      {background.type === 'solid' && (
        <rect width="500" height="500" fill={background.color} />
      )}
      {background.type === 'gradient' && (
        <rect width="500" height="500" fill="url(#logo-bg-grad)" />
      )}

      {/* Layer 2: Shapes */}
      <g>
        {isOneLayer ? (
          shapes.map((shape, i) => (
            <ShapeEl key={i} shape={{ ...shape, fill: singleColor, stroke: 'none', opacity: 1, blendMode: 'normal' }} />
          ))
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
function MiniLogo({ logo }) {
  if (!logo) return null;
  const { shapes, background } = logo;
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
      </defs>
      {background.type === 'solid' && <rect width="500" height="500" fill={background.color} />}
      {background.type === 'gradient' && <rect width="500" height="500" fill="url(#mini-bg-grad)" />}
      <g>
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
  const [symmetry, setSymmetry] = useState('none');
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(52);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [shapeSeed, setShapeSeed] = useState(randSeed);
  const [colorSeed, setColorSeed] = useState(randSeed);
  const [logoSize, setLogoSize] = useState(50);
  const [exportName, setExportName] = useState('logoforge');
  const [lockShapes, setLockShapes] = useState(false);
  const [lockColors, setLockColors] = useState(false);
  const [history, setHistory] = useState([]);
  const [gradientSelectedStop, setGradientSelectedStop] = useState(0);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState(new Set());
  const [showPngMenu, setShowPngMenu] = useState(false);
  const [showExportAllMenu, setShowExportAllMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastKey, setToastKey] = useState(0);

  const svgRef = useRef(null);
  const pngMenuRef = useRef(null);
  const exportAllMenuRef = useRef(null);

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

  // Close export-all menu on outside click
  useEffect(() => {
    if (!showExportAllMenu) return;
    const handler = (e) => {
      if (exportAllMenuRef.current && !exportAllMenuRef.current.contains(e.target)) {
        setShowExportAllMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportAllMenu]);

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
      singleColor, layerMode, centerGap, logoSize,
    }),
    [style, shapeCount, palette, bgType, bgColor, bgGrad1, bgGrad2, bgGradAngle, bgGradType,
     text, fontSize, textColor, symmetry, shapeSeed, colorSeed,
     colorMode, singleColor, layerMode, centerGap, logoSize]
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
    setColorMode(Math.random() > 0.5 ? 'multi' : 'single');
    setSingleColor('#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0'));
    setShapeSeed(randSeed());
    setColorSeed(randSeed());
  };

  const showToast = (msg) => {
    setToast(msg);
    setToastKey(k => k + 1);
  };

  const saveToHistory = useCallback(() => {
    setHistory(h => [
      { id: Date.now(), logoData, shapeSeed, colorSeed,
        style, paletteKey, bgType, bgColor, bgGrad1, bgGrad2, bgGradAngle, bgGradType,
        symmetry, colorMode, singleColor, layerMode, centerGap, exportName },
      ...h,
    ].slice(0, 20));
    showToast('Saved to history');
  }, [logoData, shapeSeed, colorSeed, style, paletteKey, bgType, bgColor, symmetry, colorMode, singleColor, layerMode]);

  const loadFromHistory = (item) => {
    setShapeSeed(item.shapeSeed);
    setColorSeed(item.colorSeed);
    setStyle(item.style);
    setPaletteKey(item.paletteKey);
    setBgType(item.bgType);
    setBgColor(item.bgColor);
    setSymmetry(item.symmetry);
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

  const removeFromHistory = (id) => {
    setHistory(h => h.filter(i => i.id !== id));
    setSelectedHistoryIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const toggleHistorySelect = (id) => {
    setSelectedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllHistory = () => setSelectedHistoryIds(new Set(history.map(i => i.id)));
  const deselectAllHistory = () => setSelectedHistoryIds(new Set());

  const exportItemsSVG = (items) => {
    items.forEach((item, idx) => {
      setTimeout(() => {
        const str = buildItemSVGString(item);
        const blob = new Blob([str], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${item.exportName || 'logoforge'}-${idx + 1}.svg`; a.click();
        URL.revokeObjectURL(url);
      }, idx * 250);
    });
    showToast(`Exporting ${items.length} SVG${items.length > 1 ? 's' : ''}`);
  };

  const exportItemsPNG = (items, size) => {
    setShowPngMenu(false);
    items.forEach((item, idx) => {
      setTimeout(() => {
        const str = buildItemSVGString(item);
        const blob = new Blob([str], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (item.bgType !== 'transparent') {
            ctx.fillStyle = item.bgType === 'solid' ? item.bgColor : '#000000';
            ctx.fillRect(0, 0, size, size);
          }
          ctx.drawImage(img, 0, 0, size, size);
          const a = document.createElement('a');
          a.download = `${item.exportName || 'logoforge'}-${idx + 1}-${size}px.png`; a.href = canvas.toDataURL('image/png'); a.click();
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }, idx * 300);
    });
    showToast(`Exporting ${items.length} PNG${items.length > 1 ? 's' : ''}`);
  };

  const getSVGString = () => {
    if (!svgRef.current) return '';

    if (bgType === 'transparent') {
      const svg = svgRef.current;
      let b = null;

      const g = svg.querySelector('g');
      if (g) {
        const bb = g.getBBox();
        if (bb.width > 0 && bb.height > 0) b = bb;
      }

      if (b) {
        const clone = svg.cloneNode(true);
        clone.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
        clone.setAttribute('width', b.width);
        clone.setAttribute('height', b.height);
        return new XMLSerializer().serializeToString(clone);
      }
    }

    return new XMLSerializer().serializeToString(svgRef.current);
  };

  const exportSVG = () => {
    const str = getSVGString();
    if (!str) return;
    const blob = new Blob([str], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportName || 'logoforge'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('SVG exported');
  };

  const copySVGCode = () => {
    const str = getSVGString();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => showToast('SVG code copied'));
  };

  const copySelectedSVGs = () => {
    const items = history.filter(i => selectedHistoryIds.has(i.id));
    const combined = items.map(item => buildItemSVGString(item)).join('\n\n');
    navigator.clipboard.writeText(combined).then(() => showToast(`Copied ${items.length} SVG${items.length > 1 ? 's' : ''}`));
  };

  const exportPNG = (size) => {
    setShowPngMenu(false);
    const str = getSVGString();
    if (!str) return;
    const blob = new Blob([str], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const svgW = img.naturalWidth || 500;
      const svgH = img.naturalHeight || 500;
      const scale = size / Math.max(svgW, svgH);
      const cw = Math.round(svgW * scale);
      const ch = Math.round(svgH * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (bgType !== 'transparent') {
        ctx.fillStyle = bgType === 'solid' ? bgColor : '#000000';
        ctx.fillRect(0, 0, cw, ch);
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      const a = document.createElement('a');
      a.download = `${exportName || 'logoforge'}-${size}px.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      URL.revokeObjectURL(url);
      showToast(`PNG ${size}px exported`);
    };
    img.src = url;
  };

  const exportCurrentEPS = () => {
    const str = getSVGString();
    if (!str) return;
    const blob = new Blob([wrapSVGAsEPS(str)], { type: 'application/postscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${exportName || 'logoforge'}.eps`; a.click();
    URL.revokeObjectURL(url);
    showToast('EPS file exported');
  };

  const exportCurrentPDF = async () => {
    showToast('Generating PDF…');
    const bytes = await buildPDFBytes([{ logoData, layerMode, singleColor, bgType }]);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${exportName || 'logoforge'}.pdf`; a.click();
    URL.revokeObjectURL(url);
    showToast('PDF exported');
  };

  const exportSelectedEPS = () => {
    const items = history.filter(i => selectedHistoryIds.has(i.id));
    items.forEach((item, idx) => {
      setTimeout(() => {
        const str = buildItemSVGString(item);
        const blob = new Blob([wrapSVGAsEPS(str)], { type: 'application/postscript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${item.exportName || 'logoforge'}-${idx + 1}.eps`; a.click();
        URL.revokeObjectURL(url);
      }, idx * 250);
    });
    showToast(`Exporting ${items.length} EPS file${items.length > 1 ? 's' : ''}`);
  };

  const exportSelectedPDF = async () => {
    const items = history.filter(i => selectedHistoryIds.has(i.id));
    showToast('Generating PDF…');
    const bytes = await buildPDFBytes(items);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `logoforge-${items.length}-logos.pdf`; a.click();
    URL.revokeObjectURL(url);
    showToast(`PDF exported (${items.length} pages)`);
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
          {selectedHistoryIds.size > 0 ? (
            <>
              <button className="btn btn-export" onClick={copySelectedSVGs}>Copy SVG</button>
              <button className="btn btn-export" onClick={() => exportItemsSVG(history.filter(i => selectedHistoryIds.has(i.id)))}>
                Export SVGs ({selectedHistoryIds.size})
              </button>
              <div className="export-group" ref={pngMenuRef}>
                <button className="btn btn-export" onClick={() => setShowPngMenu(v => !v)}>
                  Export ▾
                </button>
                {showPngMenu && (
                  <div className="dropdown-menu">
                    {PNG_SIZES.map(s => (
                      <button key={s} onClick={() => { exportItemsPNG(history.filter(i => selectedHistoryIds.has(i.id)), s); setShowPngMenu(false); }}>
                        PNG {s}px <span className="dropdown-badge">{selectedHistoryIds.size} files</span>
                      </button>
                    ))}
                    <div className="dropdown-divider" />
                    <button onClick={() => { exportSelectedEPS(); setShowPngMenu(false); }}>.EPS <span className="dropdown-badge">{selectedHistoryIds.size} files</span></button>
                    <button onClick={() => { exportSelectedPDF(); setShowPngMenu(false); }}>.PDF <span className="dropdown-badge">1 file</span></button>
                  </div>
                )}
              </div>
              <button className="btn btn-export-dim" onClick={deselectAllHistory}>✕ Reset</button>
            </>
          ) : (
            <>
              <button className="btn btn-export" onClick={copySVGCode}>Copy SVG</button>
              <button className="btn btn-export" onClick={exportSVG}>Export SVG</button>
              <div className="export-group" ref={pngMenuRef}>
                <button className="btn btn-export" onClick={() => setShowPngMenu(v => !v)}>Export ▾</button>
                {showPngMenu && (
                  <div className="dropdown-menu">
                    {PNG_SIZES.map(s => (
                      <button key={s} onClick={() => exportPNG(s)}>PNG {s}px</button>
                    ))}
                    <div className="dropdown-divider" />
                    <button onClick={() => { exportCurrentEPS(); setShowPngMenu(false); }}>.EPS</button>
                    <button onClick={() => { exportCurrentPDF(); setShowPngMenu(false); }}>.PDF</button>
                  </div>
                )}
              </div>
            </>
          )}
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

          {/* Logo Size */}
          <div className="control-group">
            <div className="control-label">
              Logo Size <span className="control-value">{logoSize}%</span>
            </div>
            <input
              type="range" className="slider"
              min={20} max={150} value={logoSize}
              onChange={e => setLogoSize(+e.target.value)}
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
                {/* Type + angle row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <button className={`chip ${bgGradType === 'linear' ? 'active' : ''}`} onClick={() => setBgGradType('linear')}>Linear</button>
                  <button className={`chip ${bgGradType === 'radial' ? 'active' : ''}`} onClick={() => setBgGradType('radial')}>Radial</button>
                  {bgGradType === 'linear' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
                      <AngleDial angle={bgGradAngle} onChange={setBgGradAngle} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '3px 6px' }}>
                        <input
                          type="number"
                          value={bgGradAngle}
                          min={0} max={359}
                          onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setBgGradAngle(((v % 360) + 360) % 360); }}
                          style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 11, width: 28, textAlign: 'right', padding: 0 }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>°</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Gradient bar with stop handles */}
                <div style={{ position: 'relative', height: 28 }}>
                  <div style={{
                    position: 'absolute', left: 10, right: 10, top: '50%', transform: 'translateY(-50%)',
                    height: 12, borderRadius: 6,
                    background: bgGradType === 'radial'
                      ? `radial-gradient(circle, ${bgGrad1}, ${bgGrad2})`
                      : `linear-gradient(90deg, ${bgGrad1}, ${bgGrad2})`
                  }} />
                  <button onClick={() => setGradientSelectedStop(0)} style={{
                    position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)',
                    width: 16, height: 16, borderRadius: '50%', padding: 0, cursor: 'pointer',
                    background: bgGrad1,
                    border: gradientSelectedStop === 0 ? '2px solid #fff' : '2px solid rgba(255,255,255,0.3)',
                    boxShadow: gradientSelectedStop === 0 ? '0 0 0 1px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.4)',
                    transition: 'border-color 0.1s, box-shadow 0.1s'
                  }} />
                  <button onClick={() => setGradientSelectedStop(1)} style={{
                    position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
                    width: 16, height: 16, borderRadius: '50%', padding: 0, cursor: 'pointer',
                    background: bgGrad2,
                    border: gradientSelectedStop === 1 ? '2px solid #fff' : '2px solid rgba(255,255,255,0.3)',
                    boxShadow: gradientSelectedStop === 1 ? '0 0 0 1px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.4)',
                    transition: 'border-color 0.1s, box-shadow 0.1s'
                  }} />
                </div>

                {/* Selected stop color picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={gradientSelectedStop === 0 ? bgGrad1 : bgGrad2}
                    onChange={e => gradientSelectedStop === 0 ? setBgGrad1(e.target.value) : setBgGrad2(e.target.value)}
                    style={{ width: 28, height: 28, border: '1px solid var(--border)', background: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', padding: 2 }}
                  />
                  <span style={{ color: 'var(--text)', fontSize: 11, letterSpacing: '0.04em', fontFamily: 'var(--font-ui)' }}>
                    {(gradientSelectedStop === 0 ? bgGrad1 : bgGrad2).toUpperCase()}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 9, letterSpacing: '0.1em', marginLeft: 'auto' }}>
                    STOP {gradientSelectedStop + 1}
                  </span>
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

            {['radial-3','radial-4','radial-5','radial-6'].includes(symmetry) && (
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
          <div className="export-name-wrapper">
            <input
              className="export-name-input"
              value={exportName}
              onChange={e => setExportName(e.target.value)}
              placeholder="Logo Name"
              spellCheck={false}
            />
            <svg className="export-name-edit-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.5 2.5L13.5 4.5L5.5 12.5H3.5V10.5L11.5 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={`logo-canvas-wrapper ${bgType === 'transparent' ? 'transparent-bg' : ''}`}>
            <LogoSVG logo={logoData} svgRef={svgRef} layerMode={layerMode} singleColor={singleColor} />
          </div>
          <div className="canvas-actions">
            <button className="btn btn-random-all" onClick={randomizeAll}>⚡ Randomize All</button>
            <button className="btn btn-regen" onClick={regenerate}>⟳ Regenerate</button>
            <button className="btn-heart" onClick={saveToHistory} title="Save to history">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 14 21 12 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </section>

        {/* ── History ── */}
        <aside className="history-panel">
          <div className="history-header">
            <div className="control-label">Saved</div>
            {history.length > 0 && (
              <button
                onClick={selectedHistoryIds.size === history.length ? deselectAllHistory : selectAllHistory}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                {selectedHistoryIds.size === history.length ? 'Deselect' : 'Select All'}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="history-empty">
              No saved logos yet.<br />
              Press S or click Save.
            </div>
          ) : (
            <>
              <div className="history-grid">
                {history.map(item => {
                  const isSelected = selectedHistoryIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`history-item ${item.bgType === 'transparent' ? 'transparent-bg' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => { loadFromHistory(item); setExportName(item.exportName || ''); toggleHistorySelect(item.id); }}
                      title="Click to load / select"
                    >
                      <MiniLogo logo={item.logoData} />
                      {isSelected && <div className="history-item-check">✓</div>}
                      <button
                        className="history-item-delete"
                        onClick={e => { e.stopPropagation(); removeFromHistory(item.id); }}
                        title="Remove"
                      >✕</button>
                    </div>
                  );
                })}
              </div>
              <div className="history-footer">
                {selectedHistoryIds.size > 0 && (
                  <button className="history-footer-btn history-footer-btn--delete"
                    onClick={() => { history.filter(i => selectedHistoryIds.has(i.id)).forEach(i => removeFromHistory(i.id)); }}>
                    Delete ({selectedHistoryIds.size})
                  </button>
                )}
                <button className="history-footer-btn" onClick={clearHistory}>
                  Clear All
                </button>
              </div>
            </>
          )}
        </aside>
      </main>

      {toast && <div key={toastKey} className="toast">{toast}</div>}
    </div>
  );
}
