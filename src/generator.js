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
    types: ['circle', 'rect', 'triangle', 'hexagon', 'diamond'],
    minN: 2, maxN: 3,
    opRange: [1, 1],
    useBlend: false,
    strokeP: 0.4,
    strokeOnlyP: 0.25,
    sizeMult: 1.3,
    spreadFactor: 0.7,
  },
  geometric: {
    types: ['circle', 'rect', 'triangle', 'hexagon', 'pentagon', 'diamond', 'star', 'cross'],
    minN: 3, maxN: 7,
    opRange: [0.85, 1],
    useBlend: false,
    strokeP: 0.4,
    strokeOnlyP: 0.15,
    sizeMult: 1.0,
    spreadFactor: 1.0,
  },
  abstract: {
    types: ['circle', 'ellipse', 'triangle', 'hexagon', 'blob', 'blob'],
    minN: 5, maxN: 9,
    opRange: [0.4, 0.85],
    useBlend: true,
    blendModes: ['multiply', 'screen', 'overlay', 'soft-light', 'color-dodge'],
    strokeP: 0.1,
    strokeOnlyP: 0,
    sizeMult: 1.15,
    spreadFactor: 1.1,
  },
  retro: {
    types: ['circle', 'rect', 'triangle', 'diamond', 'star', 'ring', 'hexagon'],
    minN: 2, maxN: 5,
    opRange: [1, 1],
    useBlend: false,
    strokeP: 0.75,
    strokeOnlyP: 0.35,
    sizeMult: 1.05,
    spreadFactor: 0.9,
  },
  organic: {
    types: ['blob', 'blob', 'ellipse', 'circle', 'blob'],
    minN: 3, maxN: 6,
    opRange: [0.65, 0.95],
    useBlend: false,
    strokeP: 0.2,
    strokeOnlyP: 0,
    sizeMult: 1.2,
    spreadFactor: 0.95,
  },
  brutalist: {
    types: ['rect', 'rect', 'triangle', 'diamond', 'cross', 'rect'],
    minN: 3, maxN: 6,
    opRange: [1, 1],
    useBlend: false,
    strokeP: 0.6,
    strokeOnlyP: 0.2,
    sizeMult: 1.1,
    spreadFactor: 1.05,
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
  text,
  fontSize,
  textColor,
  fontFamily,
  symmetry,
  shapeSeed,
  colorSeed,
  colorMode,   // 'multi' | 'single'
  singleColor, // hex string used when colorMode === 'single'
}) {
  const cfg = STYLE_CONFIGS[style] || STYLE_CONFIGS.geometric;
  const sRNG = createRNG(shapeSeed);
  const cRNG = createRNG(colorSeed);

  const n = shapeCount || irand(cfg.minN, cfg.maxN, sRNG);

  // Composition: all shapes cluster tightly around center (250,250) so they
  // form a single unified mass rather than scattered elements.
  // Primary = almost centered, secondary = small orbit, accent = edge of cluster.
  const SPREAD = {
    primary:   { pos: 22,  sizeMin: 160, sizeMax: 240 },
    secondary: { pos: 60,  sizeMin: 70,  sizeMax: 145 },
    accent:    { pos: 90,  sizeMin: 28,  sizeMax: 70  },
  };

  const baseShapes = [];
  for (let i = 0; i < n; i++) {
    const tier =
      i === 0 ? 'primary' :
      i < Math.ceil(n * 0.5) ? 'secondary' : 'accent';

    const sp = SPREAD[tier];
    const angle = rand(0, Math.PI * 2, sRNG);
    const dist  = rand(0, sp.pos, sRNG);
    const cx = 250 + dist * Math.cos(angle);
    const cy = 250 + dist * Math.sin(angle);

    const size = rand(sp.sizeMin, sp.sizeMax, sRNG) * cfg.sizeMult;
    const rot  = rand(0, 360, sRNG);
    const type = pick(cfg.types, sRNG);
    baseShapes.push(buildShape(type, cx, cy, size, rot, sRNG));
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

  const shapes = allShapes.map((shape) => {
    const strokeOnly = cRNG() < cfg.strokeOnlyP;
    const hasStroke = strokeOnly || cRNG() < cfg.strokeP;

    let fill, stroke;
    if (isSingle) {
      // Single color mode: use the chosen hex for everything,
      // vary opacity so overlapping layers create depth.
      fill = strokeOnly ? 'none' : singleColor;
      stroke = hasStroke ? singleColor : 'none';
    } else {
      fill = strokeOnly ? 'none' : pick(colors, cRNG);
      stroke = hasStroke ? pick(colors, cRNG) : 'none';
    }

    const strokeWidth = hasStroke ? rand(2, 7, cRNG) : 0;
    // Single color: widen opacity range so layers read individually
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
      color1: colors[0],
      color2: colors[colors.length - 1],
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
