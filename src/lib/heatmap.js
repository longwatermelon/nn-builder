import { COLORS } from "../styles/theme";
import { clamp, fmt } from "./networkMath";

export const GRID = 100;
export const DOMAIN = [-5, 5];
const DOMAIN_SPAN = DOMAIN[1] - DOMAIN[0];

const VIRIDIS_STOPS = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

function colorMap(t) {
  const x = clamp(t, 0, 1);
  const scaled = x * (VIRIDIS_STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), VIRIDIS_STOPS.length - 2);
  const f = scaled - i;
  const a = VIRIDIS_STOPS[i];
  const b = VIRIDIS_STOPS[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

function gridColumnToX1(columnIndex) {
  return DOMAIN[0] + (columnIndex / (GRID - 1)) * DOMAIN_SPAN;
}

function gridRowToX2(rowIndex) {
  return DOMAIN[1] - (rowIndex / (GRID - 1)) * DOMAIN_SPAN;
}

function domainToPlotX(x1, plotW) {
  const maxX = Math.max(0, plotW - 1);
  const t = (x1 - DOMAIN[0]) / DOMAIN_SPAN;
  return t * maxX;
}

function domainToPlotY(x2, plotH) {
  const maxY = Math.max(0, plotH - 1);
  const t = (x2 - DOMAIN[0]) / DOMAIN_SPAN;
  return (1 - t) * maxY;
}

function drawInputMarker(ctx, markerPoint, plotW, plotH) {
  if (!markerPoint) return;
  const { x1, x2 } = markerPoint;
  if (!Number.isFinite(x1) || !Number.isFinite(x2)) return;

  const maxX = Math.max(0, plotW - 1);
  const maxY = Math.max(0, plotH - 1);
  const rawX = domainToPlotX(x1, plotW);
  const rawY = domainToPlotY(x2, plotH);
  const px = clamp(rawX, 0, maxX);
  const py = clamp(rawY, 0, maxY);
  const isOutOfBounds = !Object.is(px, rawX) || !Object.is(py, rawY);

  ctx.save();

  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = isOutOfBounds ? "rgba(255, 80, 128, 0.5)" : "rgba(232, 240, 255, 0.55)";
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, maxY);
  ctx.moveTo(0, py);
  ctx.lineTo(maxX, py);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20, 20, 20, 0.75)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = isOutOfBounds ? COLORS.negative : "rgba(238, 243, 255, 0.95)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fillStyle = isOutOfBounds ? COLORS.negative : COLORS.accent;
  ctx.fill();

  if (isOutOfBounds) {
    const dx = rawX - px;
    const dy = rawY - py;
    const norm = Math.hypot(dx, dy) || 1;
    const ux = dx / norm;
    const uy = dy / norm;
    const baseX = clamp(px - ux * 7, 0, maxX);
    const baseY = clamp(py - uy * 7, 0, maxY);
    const nx = -uy;
    const ny = ux;

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(baseX + nx * 3.5, baseY + ny * 3.5);
    ctx.lineTo(baseX - nx * 3.5, baseY - ny * 3.5);
    ctx.closePath();
    ctx.fillStyle = COLORS.negative;
    ctx.fill();
  }

  ctx.restore();
}

export function computeGrid(sampleFn) {
  const values = new Float64Array(GRID * GRID);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < GRID; j++) {
    const x2 = gridRowToX2(j);
    for (let i = 0; i < GRID; i++) {
      const x1 = gridColumnToX1(i);
      const raw = sampleFn(x1, x2);
      const v = Number.isFinite(raw) ? raw : 0;
      values[j * GRID + i] = v;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  return { values, min, max };
}

export function computeVariance(values) {
  const n = values.length;
  if (!n) return 0;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += values[i];
  mean /= n;
  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean;
    varSum += d * d;
  }
  return varSum / n;
}

export function computeMSE(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s / n;
}

export function drawHeatmap(canvas, values, minVal, maxVal, options = {}) {
  if (!canvas || !values) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // keep defaults explicit so callers can override only one option
  const showAxes = options.showAxes ?? true;
  const showColorBar = options.showColorBar ?? true;
  const markerPoint = options.markerPoint ?? null;

  const w = canvas.width;
  const h = canvas.height;
  const plotW = showColorBar ? Math.max(20, w - 28) : w;

  const img = ctx.createImageData(w, h);
  const denom = maxVal - minVal || 1;
  const scaleX = plotW / GRID;
  const scaleY = h / GRID;

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const v = values[j * GRID + i];
      const t = (v - minVal) / denom;
      const c = colorMap(t);
      const x0 = Math.floor(i * scaleX);
      const y0 = Math.floor(j * scaleY);
      const x1 = Math.floor((i + 1) * scaleX);
      const y1 = Math.floor((j + 1) * scaleY);
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const idx = (py * w + px) * 4;
          img.data[idx] = c[0];
          img.data[idx + 1] = c[1];
          img.data[idx + 2] = c[2];
          img.data[idx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);

  if (showAxes) {
    ctx.strokeStyle = "rgba(220,230,245,0.4)";
    ctx.lineWidth = 1;
    const cx = domainToPlotX(0, plotW);
    const cy = domainToPlotY(0, h);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(plotW, cy);
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = "11px 'KaTeX_Main', 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.fillText("x₁", plotW - 16, cy - 6);
    ctx.fillText("x₂", cx + 14, 14);
    for (let v = -4; v <= 4; v += 2) {
      if (v === 0) continue;
      const px = domainToPlotX(v, plotW);
      const py2 = domainToPlotY(v, h);
      ctx.fillText(String(v), px, cy + 14);
      ctx.fillText(String(v), cx - 14, py2 + 4);
    }
  }

  if (showColorBar) {
    const barW = 12;
    const barH = h - 20;
    const barX = plotW + 10;
    const barY = 10;
    for (let y = 0; y < barH; y++) {
      const t2 = 1 - y / barH;
      const c2 = colorMap(t2);
      ctx.fillStyle = `rgb(${c2[0]},${c2[1]},${c2[2]})`;
      ctx.fillRect(barX, barY + y, barW, 1);
    }
    ctx.fillStyle = COLORS.text;
    ctx.font = "9px 'KaTeX_Main', 'Times New Roman', serif";
    ctx.textAlign = "right";
    ctx.fillText(fmt(maxVal), barX - 3, barY + 8);
    ctx.fillText(fmt(minVal), barX - 3, barY + barH);
  }

  drawInputMarker(ctx, markerPoint, plotW, h);
}
