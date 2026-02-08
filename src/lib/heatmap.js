import { COLORS } from "../styles/theme";
import { clamp, fmt } from "./networkMath";

export const GRID = 100;
export const DOMAIN = [-5, 5];

function colorMap(t) {
  const x = clamp(t, 0, 1);
  const v = Math.round(x * 255);
  return [v, v, v];
}

export function computeGrid(sampleFn) {
  const values = new Float64Array(GRID * GRID);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const x1 = DOMAIN[0] + (i / (GRID - 1)) * (DOMAIN[1] - DOMAIN[0]);
      const x2 = DOMAIN[1] - (j / (GRID - 1)) * (DOMAIN[1] - DOMAIN[0]);
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

  const showAxes = options.showAxes ?? true;
  const showColorBar = options.showColorBar ?? true;

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
    ctx.strokeStyle = "rgba(200,212,232,0.3)";
    ctx.lineWidth = 1;
    const cx = (plotW * (0 - DOMAIN[0])) / (DOMAIN[1] - DOMAIN[0]);
    const cy = h * (1 - (0 - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0]));
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
      const px = (plotW * (v - DOMAIN[0])) / (DOMAIN[1] - DOMAIN[0]);
      const py2 = h * (1 - (v - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0]));
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
}
