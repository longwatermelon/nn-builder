import { clamp, lerp } from "../../lib/networkMath";

export const MATCH_SCORE_THRESHOLD = 95;

const SCORE_COLOR_STOPS = [
  { score: 0, rgb: [122, 24, 24] },
  { score: 50, rgb: [229, 121, 34] },
  { score: 80, rgb: [236, 206, 55] },
  { score: 95, rgb: [78, 232, 113] },
  { score: 100, rgb: [47, 248, 137] },
];

export function getScoreColor(score) {
  const clamped = clamp(score, 0, 100);
  let left = SCORE_COLOR_STOPS[0];
  let right = SCORE_COLOR_STOPS[SCORE_COLOR_STOPS.length - 1];

  // find surrounding stops then interpolate within that segment
  for (let i = 0; i < SCORE_COLOR_STOPS.length - 1; i++) {
    const a = SCORE_COLOR_STOPS[i];
    const b = SCORE_COLOR_STOPS[i + 1];
    if (clamped >= a.score && clamped <= b.score) {
      left = a;
      right = b;
      break;
    }
  }

  const range = right.score - left.score;
  const t = range === 0 ? 0 : (clamped - left.score) / range;
  const rgb = left.rgb.map((c, idx) => Math.round(lerp(c, right.rgb[idx], t)));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export function getScoreLabel(score) {
  if (score >= MATCH_SCORE_THRESHOLD) return "Matched!";
  if (score >= 80) return "Almost there";
  if (score >= 50) return "Getting closer";
  return "Keep going";
}
