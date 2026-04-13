// Seeded pseudo-random number generator (mulberry32)
function createRNG(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const rand = (min, max, rng) => min + rng() * (max - min);
const irand = (min, max, rng) => Math.floor(rand(min, max + 0.9999, rng));

function polyPts(cx, cy, r, n, rotDeg = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (rotDeg * Math.PI) / 180 - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function starPts(cx, cy, R, r, n, rotDeg = 0) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? R : r;
    const a = (i / (n * 2)) * Math.PI * 2 + (rotDeg * Math.PI) / 180 - Math.PI / 2;
    return `${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function blobD(cx, cy, avgR, irregularity, n, rng) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = avgR * (1 + rand(-irregularity, irregularity, rng));
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const cp1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const cp2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${cp1[0].toFixed(2)} ${cp1[1].toFixed(2)} ${cp2[0].toFixed(2)} ${cp2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + ' Z';
}

// Petal / pointed oval — horizontal by default (tips at left and right).
// When placed at (250+offset, 250) and radial symmetry is applied, each copy
// ends up pointing radially outward — exactly like the inspiration images.
function petalD(cx, cy, hw, hh) {
  const cp = hh * 0.92;
  return [
    `M ${(cx - hw).toFixed(2)} ${cy}`,
    `C ${(cx - hw * 0.5).toFixed(2)} ${(cy - cp).toFixed(2)} ${(cx + hw * 0.5).toFixed(2)} ${(cy - cp).toFixed(2)} ${(cx + hw).toFixed(2)} ${cy}`,
    `C ${(cx + hw * 0.5).toFixed(2)} ${(cy + cp).toFixed(2)} ${(cx - hw * 0.5).toFixed(2)} ${(cy + cp).toFixed(2)} ${(cx - hw).toFixed(2)} ${cy}`,
    'Z',
  ].join(' ');
}

// Lens / vesica piscis — two circular arcs forming a leaf/eye shape.
// Also horizontal by default.
function lensD(cx, cy, hw, hh) {
  // Arc radius derived from chord-sagitta relationship
  const r = (hw * hw + hh * hh) / (2 * hh);
  const lx = (cx - hw).toFixed(2);
  const rx = (cx + hw).toFixed(2);
  const rs = r.toFixed(2);
  return `M ${lx} ${cy} A ${rs} ${rs} 0 0 1 ${rx} ${cy} A ${rs} ${rs} 0 0 1 ${lx} ${cy} Z`;
}

// Cross / plus shape
function crossD(cx, cy, size, thickness) {
  const h = size / 2;
  const t = thickness / 2;
  return `M ${cx - t} ${cy - h} L ${cx + t} ${cy - h} L ${cx + t} ${cy - t} L ${cx + h} ${cy - t} L ${cx + h} ${cy + t} L ${cx + t} ${cy + t} L ${cx + t} ${cy + h} L ${cx - t} ${cy + h} L ${cx - t} ${cy + t} L ${cx - h} ${cy + t} L ${cx - h} ${cy - t} L ${cx - t} ${cy - t} Z`;
}

// Arrow / chevron
function arrowD(cx, cy, size) {
  const h = size * 0.6;
  const w = size * 0.5;
  return `M ${cx} ${cy - h} L ${cx + w} ${cy + h * 0.4} L ${cx + w * 0.35} ${cy + h * 0.4} L ${cx + w * 0.35} ${cy + h} L ${cx - w * 0.35} ${cy + h} L ${cx - w * 0.35} ${cy + h * 0.4} L ${cx - w} ${cy + h * 0.4} Z`;
}

const STYLE_CONFIGS = {
  minimal: {
    types: ['circle', 'petal', 'lens', 'diamond', 'hexagon', 'ellipse'],
    minN: 1, maxN: 2,
    opRange: [1, 1],
    useBlend: false,
    strokeP: 0.3,
    strokeOnlyP: 0.2,
    sizeMult: 1.3,
  },
  geometric: {
    types: ['circle', 'rect', 'triangle', 'hexagon', 'diamond', 'star', 'cross', 'petal', 'lens'],
    minN: 1, maxN: 3,
    opRange: [0.9, 1],
    useBlend: false,
    strokeP: 0.35,
    strokeOnlyP: 0.15,
    sizeMult: 1.0,
  },
  abstract: {
    types: ['circle', 'ellipse', 'petal', 'lens', 'blob', 'hexagon'],
    minN: 2, maxN: 4,
    opRange: [0.5, 0.9],
    useBlend: true,
    blendModes: ['multiply', 'screen', 'overlay', 'soft-light'],
    strokeP: 0.1,
    strokeOnlyP: 0,
    sizeMult: 1.15,
  },
  retro: {
    types: ['circle', 'petal', 'diamond', 'star', 'ring', 'lens', 'hexagon'],
    minN: 1, maxN: 3,
    opRange: [1, 1],
    useBlend: false,
    strokeP: 0.7,
    strokeOnlyP: 0.3,
    sizeMult: 1.05,
  },
  organic: {
    types: ['blob', 'petal', 'lens', 'ellipse', 'circle'],
    minN: 1, maxN: 3,
    opRange: [0.7, 0.95],
    useBlend: false,
    strokeP: 0.15,
    strokeOnlyP: 0,
    sizeMult: 1.2,
  },
  brutalist: {
    types: ['rect', 'triangle', 'diamond', 'cross', 'hexagon'],
    minN: 1, maxN: 3,
    opRange: [1, 1],
    useBlend: false,
    strokeP: 0.55,
    strokeOnlyP: 0.2,
    sizeMult: 1.1,
  },
};

function buildShape(type, cx, cy, size, rot, rng) {
  switch (type) {
    case 'circle':
      return { type: 'circle', cx, cy, r: size / 2 };
    case 'ellipse': {
      const aspect = rand(0.35, 0.75, rng);
      return { type: 'ellipse', cx, cy, rx: size / 2, ry: (size * aspect) / 2 * 2, rotation: rot };
    }
    case 'rect': {
      const wScale = rand(0.6, 1.5, rng);
      const hScale = rand(0.6, 1.5, rng);
      return { type: 'rect', cx, cy, width: size * wScale, height: size * hScale, rotation: rot };
    }
    case 'triangle':
      return { type: 'polygon', cx, cy, points: polyPts(cx, cy, size / 2, 3, rot) };
    case 'diamond':
      return { type: 'polygon', cx, cy, points: polyPts(cx, cy, size / 2, 4, rot + 45) };
    case 'pentagon':
      return { type: 'polygon', cx, cy, points: polyPts(cx, cy, size / 2, 5, rot) };
    case 'hexagon':
      return { type: 'polygon', cx, cy, points: polyPts(cx, cy, size / 2, 6, rot) };
    case 'star':
      return { type: 'polygon', cx, cy, points: starPts(cx, cy, size / 2, size * 0.22, 5, rot) };
    case 'petal': {
      const hw = size / 2;
      const hh = size * rand(0.25, 0.55, rng);
      return { type: 'path', cx, cy, d: petalD(cx, cy, hw, hh), rotation: rot };
    }
    case 'lens': {
      const hw = size / 2;
      const hh = size * rand(0.2, 0.45, rng);
      return { type: 'path', cx, cy, d: lensD(cx, cy, hw, hh), rotation: rot };
    }
    case 'blob': {
      const n = irand(5, 9, rng);
      const irr = rand(0.18, 0.48, rng);
      return { type: 'path', cx, cy, d: blobD(cx, cy, size / 2, irr, n, rng) };
    }
    case 'ring':
      return { type: 'ring', cx, cy, r: size / 2, innerR: size * 0.28 };
    case 'cross': {
      const thickness = size * rand(0.2, 0.45, rng);
      return { type: 'path', cx, cy, d: crossD(cx, cy, size, thickness), rotation: rot };
    }
    case 'arrow':
      return { type: 'path', cx, cy, d: arrowD(cx, cy, size), rotation: rot };
    default:
      return { type: 'circle', cx, cy, r: size / 2 };
  }
}


export function generateLogo({
  style,
  shapeCount,
  palette,
  bgType,
  bgColor,
  bgGradient,
  text,
  fontSize,
  textColor,
  fontFamily,
  symmetry,
  shapeSeed,
  colorSeed,
  colorMode,   // 'multi' | 'single'
  singleColor, // hex string used when colorMode === 'single'
  layerMode,   // 'one' | 'individual'
  centerGap,   // 0 (heavy overlap) … 100 (open gap) — radial mode only
  logoSize,    // 'S' | 'M' | 'L'
}) {
  const cfg = STYLE_CONFIGS[style] || STYLE_CONFIGS.geometric;
  const sRNG = createRNG(shapeSeed);
  const cRNG = createRNG(colorSeed);
  const sizeMult = (logoSize ?? 50) / 50;

  const n = shapeCount || irand(cfg.minN, cfg.maxN, sRNG);
  const baseShapes = [];
  const isRadial = symmetry === 'radial-4' || symmetry === 'radial-6';

  if (isRadial) {
    // ── Radial placement ────────────────────────────────────────────────────
    // Place each base shape along the positive x-axis at a radial offset.
    // The symmetry control rotates them into the full flower/clover pattern.
    //
    // Key: shapes with tips at center (offset < size/2) create clover/overlap
    // patterns; shapes with gap at center (offset ≈ size/2) create spaced
    // petal patterns. We keep the type consistent per "ring" for clean logos.
    //
    // For radial-4: shapeCount=1 → 4 petals, shapeCount=2 → 8 (two rings), etc.
    const radialMult = symmetry === 'radial-4' ? 4 : 6;
    const ringCount = Math.max(1, Math.ceil(n / radialMult));

    for (let ring = 0; ring < ringCount; ring++) {
      const type = pick(cfg.types, sRNG);

      // Outer rings are smaller so the overall composition stays balanced
      const sizeFraction = ring === 0 ? 1.0 : rand(0.45, 0.75, sRNG);
      const size = rand(110, 200, sRNG) * cfg.sizeMult * sizeFraction * sizeMult;

      // centerGap (0–100) maps to overlapFactor (0.15–0.85):
      //   0   → 0.15  heavy overlap — shapes fill the center
      //   50  → 0.50  shapes just touch at center
      //   100 → 0.85  clear whitespace gap between shapes
      const gapNorm = (centerGap ?? 50) / 100;
      const overlapFactor = 0.15 + gapNorm * 0.70;
      const offset = size * overlapFactor + ring * rand(55, 90, sRNG);

      const cx = 250 + offset;
      const cy = 250;

      // Petal / lens / ellipse: keep horizontal (rotation=0) so tips point
      // radially outward. Other shapes: small variation for interest.
      const isElongated = ['petal', 'lens', 'ellipse'].includes(type);
      const rot = isElongated ? rand(-10, 10, sRNG) : irand(0, 3, sRNG) * 45;

      baseShapes.push(buildShape(type, cx, cy, size, rot, sRNG));
    }
  } else {
    // ── Cluster placement: shapes overlap tightly around center ─────────────
    const SPREAD = {
      primary:   { pos: 22,  sizeMin: 160, sizeMax: 240 },
      secondary: { pos: 60,  sizeMin: 70,  sizeMax: 145 },
      accent:    { pos: 90,  sizeMin: 28,  sizeMax: 70  },
    };

    for (let i = 0; i < n; i++) {
      const tier =
        i === 0 ? 'primary' :
        i < Math.ceil(n * 0.5) ? 'secondary' : 'accent';

      const sp = SPREAD[tier];
      const angle = rand(0, Math.PI * 2, sRNG);
      const dist  = rand(0, sp.pos, sRNG);
      const cx = 250 + dist * Math.cos(angle);
      const cy = 250 + dist * Math.sin(angle);

      const size = rand(sp.sizeMin, sp.sizeMax, sRNG) * cfg.sizeMult * sizeMult;
      const rot  = rand(0, 360, sRNG);
      const type = pick(cfg.types, sRNG);
      baseShapes.push(buildShape(type, cx, cy, size, rot, sRNG));
    }
  }

  // Symmetry expansion
  const SYM_MAP = {
    none: [null],
    'mirror-h': [null, 'mirror-h'],
    'mirror-v': [null, 'mirror-v'],
    'radial-4': [null, 90, 180, 270],
    'radial-6': [null, 60, 120, 180, 240, 300],
  };
  const variants = SYM_MAP[symmetry] || [null];

  const allShapes = [];
  for (const shape of baseShapes) {
    for (const v of variants) {
      if (v === null) {
        allShapes.push({ ...shape });
      } else if (v === 'mirror-h') {
        allShapes.push({ ...shape, groupTransform: 'scale(-1,1) translate(-500,0)' });
      } else if (v === 'mirror-v') {
        allShapes.push({ ...shape, groupTransform: 'scale(1,-1) translate(0,-500)' });
      } else {
        allShapes.push({ ...shape, groupTransform: `rotate(${v} 250 250)` });
      }
    }
  }

  // Color assignment
  const colors = palette.colors;
  const isSingle = colorMode === 'single' && singleColor;
  const isOneLayer = layerMode === 'one';

  // For "one layer" mode: always use singleColor — the UI only shows
  // the single color picker when this mode is active.
  const oneLayerColor = isOneLayer ? singleColor : null;

  const shapes = allShapes.map((shape) => {
    if (isOneLayer) {
      return {
        ...shape,
        fill: oneLayerColor,
        stroke: 'none',
        strokeWidth: 0,
        opacity: 1,
        blendMode: 'normal',
      };
    }

    const strokeOnly = cRNG() < cfg.strokeOnlyP;
    const hasStroke = strokeOnly || cRNG() < cfg.strokeP;

    let fill, stroke;
    if (isSingle) {
      fill = strokeOnly ? 'none' : singleColor;
      stroke = hasStroke ? singleColor : 'none';
    } else {
      fill = strokeOnly ? 'none' : pick(colors, cRNG);
      stroke = hasStroke ? pick(colors, cRNG) : 'none';
    }

    const strokeWidth = hasStroke ? rand(2, 7, cRNG) : 0;
    const opMin = isSingle ? 0.3 : cfg.opRange[0];
    const opMax = isSingle ? 0.95 : cfg.opRange[1];
    const opacity = rand(opMin, opMax, cRNG);
    const blendMode = cfg.useBlend ? pick(cfg.blendModes, cRNG) : 'normal';
    return { ...shape, fill, stroke, strokeWidth, opacity, blendMode };
  });

  // Background
  let background;
  if (bgType === 'transparent') {
    background = { type: 'transparent' };
  } else if (bgType === 'gradient') {
    background = {
      type: 'gradient',
      color1: bgGradient?.color1 || colors[0],
      color2: bgGradient?.color2 || colors[colors.length - 1],
      angle: bgGradient?.angle ?? 180,
      gradientType: bgGradient?.gradientType || 'linear',
    };
  } else {
    background = { type: 'solid', color: bgColor };
  }

  // Text layer
  const textLayer =
    text && text.trim()
      ? {
          text: text.trim(),
          x: 250,
          y: text.length > 8 ? 478 : 472,
          fontSize: fontSize || 52,
          fill: textColor || '#FFFFFF',
          fontFamily: fontFamily || 'sans-serif',
          fontWeight: '700',
          letterSpacing: '0.05em',
        }
      : null;

  return { shapes, background, textLayer };
}
