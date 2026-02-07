import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const ACT_FNS = {
  linear: { fn: (x) => x, label: "Linear", abbr: "Lin" },
  relu: { fn: (x) => Math.max(0, x), label: "ReLU", abbr: "ReLU" },
  lrelu: { fn: (x) => (x > 0 ? x : 0.01 * x), label: "Leaky ReLU", abbr: "LReLU" },
  sigmoid: { fn: (x) => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))), label: "Sigmoid", abbr: "σ" },
  tanh: { fn: (x) => Math.tanh(x), label: "Tanh", abbr: "tanh" },
};

const GRID = 100;
const DOMAIN = [-5, 5];
const SOLVED_STORAGE_KEY = "nn-builder-solved-challenges-v1";
const REVEAL_DURATION_MS = 1500;

const COLORS = {
  bg: "#080c14",
  panel: "#0f1523",
  panelBorder: "#1a2540",
  surface: "#151d30",
  accent: "#00e0a0",
  accentDim: "#00e0a040",
  negative: "#ff4070",
  negativeDim: "#ff407040",
  text: "#c8d4e8",
  textMuted: "#5a6f8f",
  textBright: "#e8f0ff",
  inputNeuron: "#3b82f6",
  outputNeuron: "#f59e0b",
  selected: "#00e0a0",
  success: "#2df577",
};

const SCORE_COLOR_STOPS = [
  { score: 0, rgb: [122, 24, 24] },
  { score: 50, rgb: [229, 121, 34] },
  { score: 80, rgb: [236, 206, 55] },
  { score: 95, rgb: [78, 232, 113] },
  { score: 100, rgb: [47, 248, 137] },
];

const DIFFICULTY_COLORS = {
  Beginner: "#4ade80",
  Intermediate: "#f59e0b",
  Advanced: "#fb7185",
  Expert: "#a78bfa",
};

function fmt(v) {
  if (v === undefined || v === null || isNaN(v)) return "0.00";
  if (Math.abs(v) < 0.005) return "0.00";
  if (Math.abs(v) >= 1000) return v.toExponential(1);
  return v.toFixed(2);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getScoreColor(score) {
  const clamped = clamp(score, 0, 100);
  let left = SCORE_COLOR_STOPS[0];
  let right = SCORE_COLOR_STOPS[SCORE_COLOR_STOPS.length - 1];

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

function getScoreLabel(score) {
  if (score >= 95) return "Matched!";
  if (score >= 80) return "Almost there";
  if (score >= 50) return "Getting closer";
  return "Keep going";
}

function forwardPassFull(layers, inputValues) {
  const acts = [inputValues.slice()];
  const pres = [inputValues.slice()];
  for (let l = 1; l < layers.length; l++) {
    const layer = layers[l];
    const prev = acts[l - 1];
    const actFn = ACT_FNS[layer.activation].fn;
    const lp = [];
    const la = [];
    for (const n of layer.neurons) {
      let s = n.bias;
      for (let i = 0; i < prev.length; i++) s += (n.weights[i] || 0) * prev[i];
      lp.push(s);
      la.push(actFn(s));
    }
    pres.push(lp);
    acts.push(la);
  }
  return { activations: acts, preActivations: pres };
}

function computeOutput(layers, x1, x2) {
  let prev = [x1, x2];
  for (let l = 1; l < layers.length; l++) {
    const layer = layers[l];
    const actFn = ACT_FNS[layer.activation].fn;
    const next = [];
    for (const n of layer.neurons) {
      let s = n.bias;
      for (let i = 0; i < prev.length; i++) s += (n.weights[i] || 0) * prev[i];
      next.push(actFn(s));
    }
    prev = next;
  }
  return prev[0] ?? 0;
}

function colorMap(t) {
  const x = clamp(t, 0, 1);
  const v = Math.round(x * 255);
  return [v, v, v];
}

function neuronColor(val, alpha = 1) {
  if (val === undefined || isNaN(val)) return `rgba(90,111,143,${alpha})`;
  const t = 1 / (1 + Math.exp(-val * 0.5));
  const c = colorMap(t);
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

function createInitialNetwork() {
  return [
    { type: "input", activation: "linear", neuronCount: 2 },
    { type: "output", activation: "linear", neurons: [{ bias: 0, weights: [0, 0] }] },
  ];
}

function cloneLayers(layers) {
  return layers.map((layer, idx) => {
    if (idx === 0) return { ...layer };
    return {
      ...layer,
      neurons: layer.neurons.map((n) => ({ bias: n.bias, weights: [...n.weights] })),
    };
  });
}

function zeroLayersLike(templateLayers) {
  return templateLayers.map((layer, idx) => {
    if (idx === 0) return { ...layer };
    return {
      ...layer,
      neurons: layer.neurons.map((n) => ({
        bias: 0,
        weights: n.weights.map(() => 0),
      })),
    };
  });
}

function networkArchitectureMatches(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const la = a[i];
    const lb = b[i];
    if (la.type !== lb.type) return false;
    if (i === 0) {
      if (la.neuronCount !== lb.neuronCount) return false;
      continue;
    }
    if (la.activation !== lb.activation) return false;
    if (la.neurons.length !== lb.neurons.length) return false;
    for (let j = 0; j < la.neurons.length; j++) {
      if (la.neurons[j].weights.length !== lb.neurons[j].weights.length) return false;
    }
  }
  return true;
}

function lerpLayers(startLayers, endLayers, t) {
  return endLayers.map((layer, layerIdx) => {
    if (layerIdx === 0) return { ...layer };
    const startLayer = startLayers[layerIdx];
    return {
      ...layer,
      neurons: layer.neurons.map((n, neuronIdx) => {
        const startNeuron = startLayer?.neurons?.[neuronIdx];
        const sb = startNeuron?.bias ?? 0;
        return {
          bias: lerp(sb, n.bias, t),
          weights: n.weights.map((w, wi) => {
            const sw = startNeuron?.weights?.[wi] ?? 0;
            return lerp(sw, w, t);
          }),
        };
      }),
    };
  });
}

function computeGrid(sampleFn) {
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

function computeVariance(values) {
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

function computeMSE(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s / n;
}

function drawHeatmap(canvas, values, minVal, maxVal, options = {}) {
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
    const cx = plotW * (0 - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0]);
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
    ctx.font = "11px 'DM Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("x₁", plotW - 16, cy - 6);
    ctx.fillText("x₂", cx + 14, 14);
    for (let v = -4; v <= 4; v += 2) {
      if (v === 0) continue;
      const px = plotW * (v - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0]);
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
    ctx.font = "9px 'DM Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(fmt(maxVal), barX - 3, barY + 8);
    ctx.fillText(fmt(minVal), barX - 3, barY + barH);
  }
}

function createLinearSolution(weights, bias = 0, outputActivation = "linear") {
  return [
    { type: "input", activation: "linear", neuronCount: 2 },
    {
      type: "output",
      activation: outputActivation,
      neurons: [{ bias, weights: [...weights] }],
    },
  ];
}

function createSingleHiddenSolution({
  hiddenActivation = "relu",
  hiddenNeurons,
  outputWeights,
  outputBias = 0,
  outputActivation = "linear",
}) {
  return [
    { type: "input", activation: "linear", neuronCount: 2 },
    {
      type: "hidden",
      activation: hiddenActivation,
      neurons: hiddenNeurons.map((n) => ({ bias: n.bias, weights: [...n.weights] })),
    },
    {
      type: "output",
      activation: outputActivation,
      neurons: [{ bias: outputBias, weights: [...outputWeights] }],
    },
  ];
}

function buildReluSplineTerm({ fn, min, max, segments, inputWeights, scale = 1 }) {
  const segs = Math.max(2, segments);
  const step = (max - min) / segs;
  const knots = Array.from({ length: segs + 1 }, (_, i) => min + i * step);
  const values = knots.map((x) => fn(x));

  const slopes = [];
  for (let i = 0; i < segs; i++) {
    slopes.push((values[i + 1] - values[i]) / step);
  }

  const coeffs = [slopes[0]];
  for (let i = 1; i < slopes.length; i++) {
    coeffs.push(slopes[i] - slopes[i - 1]);
  }

  const baseBias = values[0];
  const neurons = knots.slice(0, -1).map((threshold) => ({
    bias: -threshold,
    weights: [...inputWeights],
  }));

  return {
    neurons,
    outputWeights: coeffs.map((c) => c * scale),
    outputBias: baseBias * scale,
  };
}

function createReluSplineSolution(terms) {
  const hiddenNeurons = [];
  const outputWeights = [];
  let outputBias = 0;

  for (const term of terms) {
    hiddenNeurons.push(...term.neurons);
    outputWeights.push(...term.outputWeights);
    outputBias += term.outputBias;
  }

  return createSingleHiddenSolution({
    hiddenActivation: "relu",
    hiddenNeurons,
    outputWeights,
    outputBias,
    outputActivation: "linear",
  });
}

const CHALLENGE_DEFS = [
  {
    id: "identity",
    name: "Identity",
    formula: "x₁",
    difficulty: "Beginner",
    par: "0 hidden · linear",
    targetFn: (x1) => x1,
    solutionFactory: () => createLinearSolution([1, 0], 0, "linear"),
  },
  {
    id: "linear_combo",
    name: "Linear Combo",
    formula: "2x₁ - x₂ + 1",
    difficulty: "Beginner",
    par: "0 hidden · linear",
    targetFn: (x1, x2) => 2 * x1 - x2 + 1,
    solutionFactory: () => createLinearSolution([2, -1], 1, "linear"),
  },
  {
    id: "relu_ramp",
    name: "ReLU Ramp",
    formula: "max(0, x₁)",
    difficulty: "Intermediate",
    par: "0 hidden · relu output",
    targetFn: (x1) => Math.max(0, x1),
    solutionFactory: () => createLinearSolution([1, 0], 0, "relu"),
  },
  {
    id: "absolute_value",
    name: "Absolute Value",
    formula: "|x₁|",
    difficulty: "Intermediate",
    par: "1 hidden · 2 relu",
    targetFn: (x1) => Math.abs(x1),
    solutionFactory: () =>
      createSingleHiddenSolution({
        hiddenActivation: "relu",
        hiddenNeurons: [
          { bias: 0, weights: [1, 0] },
          { bias: 0, weights: [-1, 0] },
        ],
        outputWeights: [1, 1],
        outputBias: 0,
        outputActivation: "linear",
      }),
  },
  {
    id: "max_two_inputs",
    name: "Max Of Two",
    formula: "max(x₁, x₂)",
    difficulty: "Intermediate",
    par: "1 hidden · 3 relu",
    targetFn: (x1, x2) => Math.max(x1, x2),
    solutionFactory: () =>
      createSingleHiddenSolution({
        hiddenActivation: "relu",
        hiddenNeurons: [
          { bias: 0, weights: [1, -1] },
          { bias: 0, weights: [0, 1] },
          { bias: 0, weights: [0, -1] },
        ],
        outputWeights: [1, 1, -1],
        outputBias: 0,
        outputActivation: "linear",
      }),
  },
  {
    id: "quadratic",
    name: "Quadratic",
    formula: "x₁²",
    difficulty: "Advanced",
    par: "1 hidden · ~18 relu",
    targetFn: (x1) => x1 * x1,
    solutionFactory: () =>
      createReluSplineSolution([
        buildReluSplineTerm({
          fn: (z) => z * z,
          min: -5,
          max: 5,
          segments: 18,
          inputWeights: [1, 0],
        }),
      ]),
  },
  {
    id: "product",
    name: "Product",
    formula: "x₁ · x₂",
    difficulty: "Advanced",
    par: "1 hidden · ~36 relu",
    targetFn: (x1, x2) => x1 * x2,
    solutionFactory: () =>
      createReluSplineSolution([
        buildReluSplineTerm({
          fn: (z) => z * z,
          min: -10,
          max: 10,
          segments: 18,
          inputWeights: [1, 1],
          scale: 0.25,
        }),
        buildReluSplineTerm({
          fn: (z) => z * z,
          min: -10,
          max: 10,
          segments: 18,
          inputWeights: [1, -1],
          scale: -0.25,
        }),
      ]),
  },
  {
    id: "sine",
    name: "Sine Wave",
    formula: "sin(x₁)",
    difficulty: "Advanced",
    par: "1 hidden · ~26 relu",
    targetFn: (x1) => Math.sin(x1),
    solutionFactory: () =>
      createReluSplineSolution([
        buildReluSplineTerm({
          fn: (z) => Math.sin(z),
          min: -5,
          max: 5,
          segments: 26,
          inputWeights: [1, 0],
        }),
      ]),
  },
  {
    id: "diagonal_sine",
    name: "Diagonal Sine",
    formula: "sin(x₁ + x₂)",
    difficulty: "Expert",
    par: "1 hidden · ~34 relu",
    targetFn: (x1, x2) => Math.sin(x1 + x2),
    solutionFactory: () =>
      createReluSplineSolution([
        buildReluSplineTerm({
          fn: (z) => Math.sin(z),
          min: -10,
          max: 10,
          segments: 34,
          inputWeights: [1, 1],
        }),
      ]),
  },
  {
    id: "radial_bowl",
    name: "Radial Bowl",
    formula: "x₁² + x₂²",
    difficulty: "Expert",
    par: "1 hidden · ~32 relu",
    targetFn: (x1, x2) => x1 * x1 + x2 * x2,
    solutionFactory: () =>
      createReluSplineSolution([
        buildReluSplineTerm({
          fn: (z) => z * z,
          min: -5,
          max: 5,
          segments: 16,
          inputWeights: [1, 0],
        }),
        buildReluSplineTerm({
          fn: (z) => z * z,
          min: -5,
          max: 5,
          segments: 16,
          inputWeights: [0, 1],
        }),
      ]),
  },
  {
    id: "step_edge",
    name: "Step Edge",
    formula: "x₁ >= 0 ? 1 : -1",
    difficulty: "Expert",
    par: "0 hidden · tanh output",
    targetFn: (x1) => (x1 >= 0 ? 1 : -1),
    solutionFactory: () => createLinearSolution([2.8, 0], 0, "tanh"),
  },
];

function ChallengeThumbnail({ values, min, max }) {
  const thumbRef = useRef(null);

  useEffect(() => {
    drawHeatmap(thumbRef.current, values, min, max, { showAxes: false, showColorBar: false });
  }, [values, min, max]);

  return (
    <canvas
      ref={thumbRef}
      width={76}
      height={76}
      style={{
        width: 76,
        height: 76,
        borderRadius: 8,
        border: `1px solid ${COLORS.panelBorder}`,
        background: COLORS.bg,
      }}
    />
  );
}

export default function App() {
  const [layers, setLayers] = useState(createInitialNetwork);
  const [inputValues, setInputValues] = useState([0.5, 0.5]);
  const [sel, setSel] = useState(null);
  const [netHeight, setNetHeight] = useState(340);
  const [dragging, setDragging] = useState(false);

  const [isChallengeMode, setIsChallengeMode] = useState(false);
  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [selectedChallengeId, setSelectedChallengeId] = useState(null);
  const [savedAttempt, setSavedAttempt] = useState(null);
  const [revealSolvedLockId, setRevealSolvedLockId] = useState(null);
  const [isRevealingSolution, setIsRevealingSolution] = useState(false);
  const [isSolutionRevealed, setIsSolutionRevealed] = useState(false);
  const [isMatchCelebrating, setIsMatchCelebrating] = useState(false);
  const [solvedChallenges, setSolvedChallenges] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(SOLVED_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const dragStartY = useRef(0);
  const dragStartH = useRef(0);
  const userCanvasRef = useRef(null);
  const targetCanvasRef = useRef(null);
  const svgRef = useRef(null);
  const revealFrameRef = useRef(null);
  const celebrationTimeoutRef = useRef(null);
  const prevChallengeScoreRef = useRef(0);

  const challengeCatalog = useMemo(
    () =>
      CHALLENGE_DEFS.map((challenge) => {
        const targetGrid = computeGrid(challenge.targetFn);
        return {
          ...challenge,
          targetGrid: {
            ...targetGrid,
            variance: computeVariance(targetGrid.values),
          },
          solutionLayers: challenge.solutionFactory(),
        };
      }),
    []
  );

  const activeChallenge = useMemo(
    () => challengeCatalog.find((c) => c.id === selectedChallengeId) ?? null,
    [challengeCatalog, selectedChallengeId]
  );
  const challengeComparisonActive = Boolean(isChallengeMode && activeChallenge && !showChallengePicker);

  const layerSizes = useMemo(
    () => layers.map((l) => (l.type === "input" ? l.neuronCount : l.neurons.length)),
    [layers]
  );

  const { activations, preActivations } = useMemo(
    () => forwardPassFull(layers, inputValues),
    [layers, inputValues]
  );

  const networkGrid = useMemo(() => computeGrid((x1, x2) => computeOutput(layers, x1, x2)), [layers]);

  const heatmapScale = useMemo(() => {
    if (challengeComparisonActive && activeChallenge) {
      return {
        min: Math.min(networkGrid.min, activeChallenge.targetGrid.min),
        max: Math.max(networkGrid.max, activeChallenge.targetGrid.max),
      };
    }
    return { min: networkGrid.min, max: networkGrid.max };
  }, [challengeComparisonActive, activeChallenge, networkGrid.min, networkGrid.max]);

  const challengeScore = useMemo(() => {
    if (!isChallengeMode || !activeChallenge) return 0;
    const mse = computeMSE(networkGrid.values, activeChallenge.targetGrid.values);
    const variance = activeChallenge.targetGrid.variance;
    if (variance <= 1e-12) return mse <= 1e-12 ? 100 : 0;
    const r2 = Math.max(0, 1 - mse / variance);
    return clamp(r2 * 100, 0, 100);
  }, [isChallengeMode, activeChallenge, networkGrid.values]);

  const challengeScoreDisplay = Math.floor(challengeScore * 100) / 100;

  const scoreLabel = getScoreLabel(challengeScore);
  const scoreColor = getScoreColor(challengeScore);
  const scoreGlow = challengeScore >= 95 && (isMatchCelebrating || isRevealingSolution);
  const canRestoreAttempt = savedAttempt?.challengeId === activeChallenge?.id;

  const cancelRevealAnimation = useCallback(() => {
    if (revealFrameRef.current) {
      cancelAnimationFrame(revealFrameRef.current);
      revealFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dy = (e.clientY || e.touches?.[0]?.clientY || 0) - dragStartY.current;
      setNetHeight(Math.max(200, Math.min(800, dragStartH.current + dy)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging]);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    drawHeatmap(userCanvasRef.current, networkGrid.values, heatmapScale.min, heatmapScale.max, {
      showAxes: true,
      showColorBar: true,
    });
  }, [networkGrid, heatmapScale.min, heatmapScale.max, challengeComparisonActive]);

  useEffect(() => {
    if (!challengeComparisonActive || !activeChallenge) return;
    drawHeatmap(targetCanvasRef.current, activeChallenge.targetGrid.values, heatmapScale.min, heatmapScale.max, {
      showAxes: true,
      showColorBar: true,
    });
  }, [challengeComparisonActive, activeChallenge, heatmapScale.min, heatmapScale.max]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify(solvedChallenges));
    } catch {
      // ignore storage write failures
    }
  }, [solvedChallenges]);

  useEffect(() => {
    if (!challengeComparisonActive || !activeChallenge) return;
    if (isRevealingSolution || isSolutionRevealed) return;
    if (revealSolvedLockId === activeChallenge.id) return;
    if (challengeScore < 95) return;
    const markSolvedTimer = setTimeout(() => {
      setSolvedChallenges((prev) => {
        if (prev[activeChallenge.id]) return prev;
        return { ...prev, [activeChallenge.id]: true };
      });
    }, 0);
    return () => clearTimeout(markSolvedTimer);
  }, [
    challengeComparisonActive,
    activeChallenge,
    challengeScore,
    isRevealingSolution,
    isSolutionRevealed,
    revealSolvedLockId,
  ]);

  useEffect(() => {
    if (!activeChallenge || revealSolvedLockId !== activeChallenge.id) return;
    if (isRevealingSolution || isSolutionRevealed) return;
    if (challengeScore >= 95) return;
    const unlockTimer = setTimeout(() => {
      setRevealSolvedLockId(null);
    }, 0);
    return () => clearTimeout(unlockTimer);
  }, [activeChallenge, revealSolvedLockId, challengeScore, isRevealingSolution, isSolutionRevealed]);

  useEffect(() => {
    if (!challengeComparisonActive || !activeChallenge || isSolutionRevealed) {
      prevChallengeScoreRef.current = challengeScore;
      if (isMatchCelebrating) {
        const clearPulseTimer = setTimeout(() => {
          setIsMatchCelebrating(false);
        }, 0);
        return () => clearTimeout(clearPulseTimer);
      }
      return;
    }
    if (prevChallengeScoreRef.current < 95 && challengeScore >= 95) {
      const startPulseTimer = setTimeout(() => {
        setIsMatchCelebrating(true);
      }, 0);
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = setTimeout(() => {
        setIsMatchCelebrating(false);
      }, 1500);
      prevChallengeScoreRef.current = challengeScore;
      return () => clearTimeout(startPulseTimer);
    }
    prevChallengeScoreRef.current = challengeScore;
  }, [challengeComparisonActive, activeChallenge, challengeScore, isSolutionRevealed, isMatchCelebrating]);

  useEffect(
    () => () => {
      cancelRevealAnimation();
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    },
    [cancelRevealAnimation]
  );

  const handleToggleChallengeMode = () => {
    if (isChallengeMode) {
      cancelRevealAnimation();
      if (isSolutionRevealed && activeChallenge && savedAttempt && savedAttempt.challengeId === activeChallenge.id) {
        setLayers(cloneLayers(savedAttempt.layers));
        setInputValues([...savedAttempt.inputValues]);
        setSel(savedAttempt.sel ? { ...savedAttempt.sel } : null);
      }
      setIsChallengeMode(false);
      setShowChallengePicker(false);
      setIsRevealingSolution(false);
      setIsSolutionRevealed(false);
      setRevealSolvedLockId(null);
      setSavedAttempt(null);
      setIsMatchCelebrating(false);
      prevChallengeScoreRef.current = 0;
    } else {
      setIsChallengeMode(true);
      setShowChallengePicker(true);
      setIsMatchCelebrating(false);
      prevChallengeScoreRef.current = 0;
    }
  };

  const handleSelectChallenge = (challengeId) => {
    cancelRevealAnimation();
    const isSwitchingChallenge = challengeId !== activeChallenge?.id;
    if (isSolutionRevealed && isSwitchingChallenge) return;
    if (!isSwitchingChallenge && isSolutionRevealed && savedAttempt && savedAttempt.challengeId === challengeId) {
      setLayers(cloneLayers(savedAttempt.layers));
      setInputValues([...savedAttempt.inputValues]);
    }
    setSelectedChallengeId(challengeId);
    setShowChallengePicker(false);
    setIsRevealingSolution(false);
    setSavedAttempt(null);
    setIsSolutionRevealed(false);
    setRevealSolvedLockId(null);
    setIsMatchCelebrating(false);
    prevChallengeScoreRef.current = 0;
    setSel(null);
  };

  const handleShowSolution = () => {
    if (!activeChallenge || isRevealingSolution || isSolutionRevealed) return;
    const confirmed = window.confirm(
      "Reveal a solution? Your current weights will be saved so you can return to them."
    );
    if (!confirmed) return;

    cancelRevealAnimation();

    const targetLayers = cloneLayers(activeChallenge.solutionLayers);
    const architectureMatches = networkArchitectureMatches(layers, targetLayers);
    const startLayers = architectureMatches ? cloneLayers(layers) : zeroLayersLike(targetLayers);

    setSavedAttempt({
      challengeId: activeChallenge.id,
      layers: cloneLayers(layers),
      inputValues: [...inputValues],
      sel: sel ? { ...sel } : null,
    });

    setSel(null);
    setIsRevealingSolution(true);
    setIsSolutionRevealed(true);
    setRevealSolvedLockId(activeChallenge.id);
    setLayers(startLayers);

    const startedAt = performance.now();
    const animate = (now) => {
      const t = clamp((now - startedAt) / REVEAL_DURATION_MS, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setLayers(lerpLayers(startLayers, targetLayers, eased));
      if (t < 1) {
        revealFrameRef.current = requestAnimationFrame(animate);
      } else {
        revealFrameRef.current = null;
        setLayers(targetLayers);
        setIsRevealingSolution(false);
      }
    };

    revealFrameRef.current = requestAnimationFrame(animate);
  };

  const handleRestoreAttempt = () => {
    if (!activeChallenge || !savedAttempt || savedAttempt.challengeId !== activeChallenge.id) return;
    cancelRevealAnimation();
    setLayers(cloneLayers(savedAttempt.layers));
    setInputValues([...savedAttempt.inputValues]);
    setSel(savedAttempt.sel ? { ...savedAttempt.sel } : null);
    setIsRevealingSolution(false);
    setIsSolutionRevealed(false);
    setRevealSolvedLockId(null);
    setIsMatchCelebrating(false);
    prevChallengeScoreRef.current = 0;
  };

  const handleTryAnother = () => {
    cancelRevealAnimation();
    if (activeChallenge && savedAttempt && savedAttempt.challengeId === activeChallenge.id) {
      setLayers(cloneLayers(savedAttempt.layers));
      setInputValues([...savedAttempt.inputValues]);
    }
    setIsRevealingSolution(false);
    setIsSolutionRevealed(false);
    setRevealSolvedLockId(null);
    setIsMatchCelebrating(false);
    prevChallengeScoreRef.current = 0;
    setSavedAttempt(null);
    setSelectedChallengeId(null);
    setShowChallengePicker(true);
    setSel(null);
  };

  const addHiddenLayer = () => {
    setLayers((prev) => {
      const outIdx = prev.length - 1;
      const prevLayer = prev[outIdx - 1];
      const prevSize = outIdx - 1 === 0 ? prev[0].neuronCount : prevLayer.neurons.length;
      const newCount = 3;
      const newLayer = {
        type: "hidden",
        activation: "relu",
        neurons: Array.from({ length: newCount }, () => ({
          bias: 0,
          weights: Array(prevSize).fill(0),
        })),
      };
      const newOutput = {
        ...prev[outIdx],
        neurons: prev[outIdx].neurons.map((n) => ({
          ...n,
          weights: Array(newCount).fill(0),
        })),
      };
      return [...prev.slice(0, outIdx), newLayer, newOutput];
    });
    setSel(null);
  };

  const removeLayer = (idx) => {
    if (idx === 0 || idx === layers.length - 1) return;
    setLayers((prev) => {
      const prevSize = idx === 1 ? prev[0].neuronCount : prev[idx - 1].neurons.length;
      const next = [...prev];
      next.splice(idx, 1);
      if (idx < next.length) {
        next[idx] = {
          ...next[idx],
          neurons: next[idx].neurons.map((n) => ({
            ...n,
            weights: Array(prevSize).fill(0),
          })),
        };
      }
      return next;
    });
    setSel(null);
  };

  const addNeuron = (layerIdx) => {
    if (layerIdx === 0 || layerIdx === layers.length - 1) return;
    setLayers((prev) => {
      const next = prev.map((l, i) => {
        if (i === layerIdx) {
          const prevSize = i === 1 ? prev[0].neuronCount : prev[i - 1].neurons.length;
          return {
            ...l,
            neurons: [...l.neurons, { bias: 0, weights: Array(prevSize).fill(0) }],
          };
        }
        if (i === layerIdx + 1) {
          return {
            ...l,
            neurons: l.neurons.map((n) => ({ ...n, weights: [...n.weights, 0] })),
          };
        }
        return l;
      });
      return next;
    });
  };

  const removeNeuron = (layerIdx, neuronIdx) => {
    if (layerIdx === 0 || layerIdx === layers.length - 1) return;
    if (layers[layerIdx].neurons.length <= 1) return;
    setLayers((prev) => {
      const next = prev.map((l, i) => {
        if (i === layerIdx) {
          return { ...l, neurons: l.neurons.filter((_, j) => j !== neuronIdx) };
        }
        if (i === layerIdx + 1) {
          return {
            ...l,
            neurons: l.neurons.map((n) => ({
              ...n,
              weights: n.weights.filter((_, j) => j !== neuronIdx),
            })),
          };
        }
        return l;
      });
      return next;
    });
    if (sel && sel.layerIdx === layerIdx) setSel(null);
  };

  const updateWeight = (layerIdx, neuronIdx, weightIdx, val) => {
    setLayers((prev) =>
      prev.map((l, i) => {
        if (i !== layerIdx) return l;
        return {
          ...l,
          neurons: l.neurons.map((n, j) => {
            if (j !== neuronIdx) return n;
            const w = [...n.weights];
            w[weightIdx] = val;
            return { ...n, weights: w };
          }),
        };
      })
    );
  };

  const updateBias = (layerIdx, neuronIdx, val) => {
    setLayers((prev) =>
      prev.map((l, i) => {
        if (i !== layerIdx) return l;
        return {
          ...l,
          neurons: l.neurons.map((n, j) => (j === neuronIdx ? { ...n, bias: val } : n)),
        };
      })
    );
  };

  const setLayerActivation = (layerIdx, act) => {
    setLayers((prev) => prev.map((l, i) => (i === layerIdx ? { ...l, activation: act } : l)));
  };

  const randomizeAll = () => {
    cancelRevealAnimation();
    setIsRevealingSolution(false);
    setIsSolutionRevealed(false);
    setRevealSolvedLockId(null);
    setSavedAttempt(null);
    setIsMatchCelebrating(false);
    prevChallengeScoreRef.current = 0;
    setLayers((prev) =>
      prev.map((l, i) => {
        if (i === 0) return l;
        return {
          ...l,
          neurons: l.neurons.map((n) => ({
            bias: (Math.random() - 0.5) * 2,
            weights: n.weights.map(() => (Math.random() - 0.5) * 2),
          })),
        };
      })
    );
  };

  const resetAll = () => {
    cancelRevealAnimation();
    setLayers(createInitialNetwork());
    setInputValues([0.5, 0.5]);
    setIsRevealingSolution(false);
    setIsSolutionRevealed(false);
    setRevealSolvedLockId(null);
    setSavedAttempt(null);
    setIsMatchCelebrating(false);
    prevChallengeScoreRef.current = 0;
    setSel(null);
  };

  const SVG_W = 560;
  const SVG_H = netHeight;
  const PAD_X = 60;
  const PAD_Y = 30;
  const neuronR = 22;

  const neuronPositions = useMemo(() => {
    const positions = [];
    const numLayers = layers.length;
    const usableW = SVG_W - PAD_X * 2;
    const usableH = SVG_H - PAD_Y * 2;
    for (let l = 0; l < numLayers; l++) {
      const size = layerSizes[l];
      const x = numLayers === 1 ? SVG_W / 2 : PAD_X + (l / (numLayers - 1)) * usableW;
      const lp = [];
      for (let n = 0; n < size; n++) {
        const y = size === 1 ? SVG_H / 2 : PAD_Y + (n / (size - 1)) * usableH;
        lp.push({ x, y });
      }
      positions.push(lp);
    }
    return positions;
  }, [layers, layerSizes, SVG_H]);

  const renderInspectorSidebar = () => {
    if (!sel) {
      return (
        <div style={{ padding: 20, color: COLORS.textMuted, fontFamily: "'Sora', sans-serif", fontSize: 13 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>Neuron Inspector</div>
          <p style={{ lineHeight: 1.6 }}>Click on any neuron in the network to inspect and edit its properties.</p>
          {challengeComparisonActive && activeChallenge && (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                background: COLORS.bg,
                borderRadius: 8,
                border: `1px solid ${COLORS.panelBorder}`,
              }}
            >
              <div style={{ fontSize: 10, color: COLORS.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                Active Challenge
              </div>
              <div style={{ fontSize: 14, color: COLORS.textBright, fontWeight: 600 }}>{activeChallenge.name}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                {activeChallenge.formula}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: scoreColor, fontWeight: 600 }}>
                Match score: {challengeScoreDisplay.toFixed(2)}%
              </div>
            </div>
          )}
          <div
            style={{
              marginTop: 20,
              padding: 14,
              background: COLORS.bg,
              borderRadius: 8,
              border: `1px solid ${COLORS.panelBorder}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: COLORS.accent,
                marginBottom: 6,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Quick Tips
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, color: COLORS.textMuted, fontSize: 12, lineHeight: 1.8 }}>
              <li>Click neurons to select them</li>
              <li>Edit weights and biases below</li>
              <li>Heatmap updates in real time</li>
              <li>Add layers with the + button</li>
            </ul>
          </div>
        </div>
      );
    }

    const { layerIdx, neuronIdx } = sel;
    const isInput = layerIdx === 0;
    const layerLabel = layerIdx === 0 ? "Input" : layerIdx === layers.length - 1 ? "Output" : `Hidden ${layerIdx}`;
    const neuronLabel = isInput ? (neuronIdx === 0 ? "x₁" : "x₂") : `n${neuronIdx + 1}`;
    const act = activations[layerIdx]?.[neuronIdx];
    const pre = preActivations[layerIdx]?.[neuronIdx];

    const numberInput = (value, onChange, label, step = 0.1) => (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: COLORS.textMuted, minWidth: 60, fontFamily: "'DM Mono', monospace" }}>
          {label}
        </span>
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            flex: 1,
            background: COLORS.bg,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 6,
            padding: "6px 8px",
            color: COLORS.textBright,
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            outline: "none",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = COLORS.accent;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = COLORS.panelBorder;
          }}
        />
      </div>
    );

    return (
      <div style={{ padding: 16, fontFamily: "'Sora', sans-serif", overflowY: "auto", maxHeight: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div
              style={{
                fontSize: 10,
                color: COLORS.accent,
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              {layerLabel} Layer
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textBright }}>Neuron {neuronLabel}</div>
          </div>
          <button
            onClick={() => setSel(null)}
            style={{
              background: "none",
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 6,
              color: COLORS.textMuted,
              cursor: "pointer",
              padding: "4px 8px",
              fontSize: 11,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            background: COLORS.bg,
            borderRadius: 8,
            padding: 12,
            marginBottom: 14,
            border: `1px solid ${COLORS.panelBorder}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>{isInput ? "Value" : "Activation"}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textBright, fontFamily: "'DM Mono', monospace" }}>
              {fmt(act)}
            </span>
          </div>
          {!isInput && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>Pre-activation</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>
                {fmt(pre)}
              </span>
            </div>
          )}
          {!isInput && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>Activation fn</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>
                {ACT_FNS[layers[layerIdx].activation].label}
              </span>
            </div>
          )}
        </div>

        {isInput && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500, letterSpacing: 0.5 }}>
              INPUT VALUE
            </div>
            {numberInput(
              inputValues[neuronIdx],
              (v) => {
                const nv = [...inputValues];
                nv[neuronIdx] = v;
                setInputValues(nv);
              },
              neuronLabel,
              0.1
            )}
            <input
              type="range"
              min={-5}
              max={5}
              step={0.01}
              value={inputValues[neuronIdx]}
              onChange={(e) => {
                const nv = [...inputValues];
                nv[neuronIdx] = parseFloat(e.target.value);
                setInputValues(nv);
              }}
              style={{ width: "100%", accentColor: COLORS.accent, marginTop: 4 }}
            />
          </div>
        )}

        {!isInput && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500, letterSpacing: 0.5 }}>
              BIAS
            </div>
            {numberInput(layers[layerIdx].neurons[neuronIdx].bias, (v) => updateBias(layerIdx, neuronIdx, v), "b")}
            <input
              type="range"
              min={-5}
              max={5}
              step={0.01}
              value={layers[layerIdx].neurons[neuronIdx].bias}
              onChange={(e) => updateBias(layerIdx, neuronIdx, parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: COLORS.accent, marginTop: 2 }}
            />
          </div>
        )}

        {!isInput && (
          <div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500, letterSpacing: 0.5 }}>
              INCOMING WEIGHTS
            </div>
            {layers[layerIdx].neurons[neuronIdx].weights.map((w, wi) => {
              const prevLabel =
                layerIdx === 1 ? (wi === 0 ? "x₁" : wi === 1 ? "x₂" : `x${wi + 1}`) : `h${layerIdx - 1}n${wi + 1}`;
              return (
                <div key={wi}>
                  {numberInput(w, (v) => updateWeight(layerIdx, neuronIdx, wi, v), `w(${prevLabel})`, 0.1)}
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    step={0.01}
                    value={w}
                    onChange={(e) => updateWeight(layerIdx, neuronIdx, wi, parseFloat(e.target.value))}
                    style={{
                      width: "100%",
                      accentColor: w >= 0 ? COLORS.accent : COLORS.negative,
                      marginTop: -2,
                      marginBottom: 6,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderChallengeLibrary = () => (
    <div style={{ padding: 14, fontFamily: "'Sora', sans-serif", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textBright }}>Challenge Library</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Pick any target function and match it.</div>
        </div>
        {activeChallenge && (
          <button onClick={() => setShowChallengePicker(false)} style={subtleBtnStyle}>
            Back
          </button>
        )}
      </div>

      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 170px)", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2 }}>
        {challengeCatalog.map((challenge) => {
          const solved = Boolean(solvedChallenges[challenge.id]);
          const selected = challenge.id === activeChallenge?.id;
          const disabledByReveal = isSolutionRevealed && challenge.id !== activeChallenge?.id;
          return (
            <button
              key={challenge.id}
              onClick={() => handleSelectChallenge(challenge.id)}
              disabled={disabledByReveal}
              style={{
                background: selected ? COLORS.accentDim : COLORS.surface,
                border: `1px solid ${selected ? COLORS.accent : COLORS.panelBorder}`,
                borderRadius: 10,
                color: COLORS.text,
                padding: 10,
                cursor: disabledByReveal ? "default" : "pointer",
                opacity: disabledByReveal ? 0.5 : 1,
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textBright }}>{challenge.name}</div>
                <span
                  style={{
                    fontSize: 10,
                    color: DIFFICULTY_COLORS[challenge.difficulty],
                    border: `1px solid ${DIFFICULTY_COLORS[challenge.difficulty]}55`,
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 999,
                    padding: "2px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {challenge.difficulty}
                </span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{challenge.formula}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <ChallengeThumbnail
                  values={challenge.targetGrid.values}
                  min={challenge.targetGrid.min}
                  max={challenge.targetGrid.max}
                />
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 11, color: COLORS.textMuted }}>
                  <div>Par: {challenge.par}</div>
                  <div style={{ color: solved ? COLORS.success : COLORS.textMuted, fontWeight: 600 }}>
                    {solved ? "✓ Solved" : "Unsolved"}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const shouldShowChallengeLibrary = isChallengeMode && (showChallengePicker || !activeChallenge);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "'Sora', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          background: COLORS.panel,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textBright, letterSpacing: -0.5 }}>
            <span style={{ color: COLORS.accent }}>⬡</span> Neural Network Builder
          </div>
          <span
            style={{
              fontSize: 11,
              color: COLORS.textMuted,
              background: COLORS.bg,
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {layers.length - 2} hidden {layers.length - 2 === 1 ? "layer" : "layers"} ·{" "}
            {layers.reduce((s, l, i) => s + (i === 0 ? l.neuronCount : l.neurons.length), 0)} neurons
          </span>
          {isChallengeMode && (
            <span
              style={{
                fontSize: 11,
                color: COLORS.accent,
                background: COLORS.accentDim,
                border: `1px solid ${COLORS.accent}40`,
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              {activeChallenge ? `Challenge: ${activeChallenge.name}` : "Challenge mode"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            onClick={handleToggleChallengeMode}
            style={isChallengeMode ? { ...btnStyle, borderColor: `${COLORS.accent}60`, color: COLORS.accent, background: COLORS.accentDim } : btnStyle}
          >
            {isChallengeMode ? "Free Play" : "Challenge"}
          </button>
          {isChallengeMode && (
            <button
              onClick={() => setShowChallengePicker(true)}
              disabled={isSolutionRevealed}
              style={{ ...btnStyle, borderColor: `${COLORS.accent}40`, color: COLORS.accent }}
            >
              {activeChallenge ? "Challenge List" : "Pick Challenge"}
            </button>
          )}
          <button onClick={randomizeAll} style={btnStyle}>
            ⟳ Randomize
          </button>
          <button onClick={resetAll} style={{ ...btnStyle, borderColor: COLORS.negative + "60", color: COLORS.negative }}>
            Reset
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div
          style={{
            width: 300,
            flexShrink: 0,
            background: COLORS.panel,
            borderRight: `1px solid ${COLORS.panelBorder}`,
            overflowY: "auto",
          }}
        >
          {shouldShowChallengeLibrary ? renderChallengeLibrary() : renderInspectorSidebar()}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", padding: 16, gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              padding: "10px 14px",
              background: COLORS.panel,
              borderRadius: 10,
              border: `1px solid ${COLORS.panelBorder}`,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: COLORS.textMuted,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginRight: 4,
              }}
            >
              Layers
            </span>
            {layers.map((l, i) => {
              const isInput = i === 0;
              const isOutput = i === layers.length - 1;
              const label = isInput ? "Input (2)" : isOutput ? "Output (1)" : `Hidden ${i}`;
              const size = isInput ? l.neuronCount : l.neurons.length;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: COLORS.surface,
                    borderRadius: 8,
                    padding: "4px 8px",
                    border: `1px solid ${COLORS.panelBorder}`,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 500, color: COLORS.text, marginRight: 2 }}>{label}</span>
                  {!isInput && (
                    <select
                      value={l.activation}
                      onChange={(e) => setLayerActivation(i, e.target.value)}
                      style={{
                        background: COLORS.bg,
                        color: COLORS.accent,
                        border: `1px solid ${COLORS.panelBorder}`,
                        borderRadius: 4,
                        padding: "2px 4px",
                        fontSize: 10,
                        fontFamily: "'DM Mono', monospace",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      {Object.entries(ACT_FNS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {!isInput && !isOutput && (
                    <>
                      <button
                        onClick={() => removeNeuron(i, l.neurons.length - 1)}
                        style={smallBtnStyle}
                        title="Remove neuron"
                        disabled={l.neurons.length <= 1}
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontSize: 10,
                          color: COLORS.textMuted,
                          fontFamily: "'DM Mono', monospace",
                          minWidth: 14,
                          textAlign: "center",
                        }}
                      >
                        {size}
                      </span>
                      <button onClick={() => addNeuron(i)} style={smallBtnStyle} title="Add neuron">
                        +
                      </button>
                      <button
                        onClick={() => removeLayer(i)}
                        style={{ ...smallBtnStyle, color: COLORS.negative, borderColor: COLORS.negative + "40" }}
                        title="Remove layer"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <button
              onClick={addHiddenLayer}
              style={{
                ...btnStyle,
                fontSize: 11,
                padding: "4px 10px",
                background: COLORS.accentDim,
                color: COLORS.accent,
                borderColor: COLORS.accent + "40",
              }}
            >
              + Hidden Layer
            </button>
          </div>

          <div
            style={{
              background: COLORS.panel,
              borderRadius: 10,
              border: `1px solid ${COLORS.panelBorder}`,
              padding: 8,
              position: "relative",
              flexShrink: 0,
            }}
          >
            <svg
              ref={svgRef}
              width={SVG_W}
              height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={{ width: "100%", height: netHeight, display: "block", userSelect: dragging ? "none" : undefined }}
            >
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {layers.map((l, li) => {
                if (li === 0) return null;
                const prevPositions = neuronPositions[li - 1];
                const curPositions = neuronPositions[li];
                return l.neurons.map((n, ni) =>
                  n.weights.map((w, wi) => {
                    const from = prevPositions[wi];
                    const to = curPositions[ni];
                    if (!from || !to) return null;
                    const absW = Math.abs(w);
                    const opacity = Math.min(0.15 + absW * 0.3, 0.9);
                    const strokeW = Math.max(0.5, Math.min(absW * 2, 4));
                    const color = w >= 0 ? COLORS.accent : COLORS.negative;
                    const isSel = sel && sel.layerIdx === li && sel.neuronIdx === ni;
                    return (
                      <line
                        key={`${li}-${ni}-${wi}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={color}
                        strokeWidth={isSel ? strokeW + 1 : strokeW}
                        opacity={isSel ? Math.min(opacity + 0.3, 1) : opacity}
                        strokeLinecap="round"
                      />
                    );
                  })
                );
              })}
              {neuronPositions.map((lp, li) =>
                lp.map((pos, ni) => {
                  const isInput = li === 0;
                  const isOutput = li === layers.length - 1;
                  const actVal = activations[li]?.[ni] ?? 0;
                  const isSel = sel && sel.layerIdx === li && sel.neuronIdx === ni;
                  const fillColor = neuronColor(actVal, 0.7);
                  const strokeColor = isSel
                    ? COLORS.selected
                    : isInput
                      ? COLORS.inputNeuron
                      : isOutput
                        ? COLORS.outputNeuron
                        : "#3a4f70";
                  return (
                    <g key={`${li}-${ni}`} onClick={() => setSel({ layerIdx: li, neuronIdx: ni })} style={{ cursor: "pointer" }}>
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={neuronR + (isSel ? 3 : 0)}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isSel ? 2.5 : 1.5}
                        filter={isSel ? "url(#glow)" : undefined}
                      />
                      <text
                        x={pos.x}
                        y={pos.y + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={COLORS.textBright}
                        fontSize="10"
                        fontFamily="'DM Mono', monospace"
                        fontWeight="500"
                        style={{ pointerEvents: "none" }}
                      >
                        {fmt(actVal)}
                      </text>
                      <text
                        x={pos.x}
                        y={pos.y - neuronR - 6}
                        textAnchor="middle"
                        fill={COLORS.textMuted}
                        fontSize="9"
                        fontFamily="'Sora', sans-serif"
                        fontWeight="500"
                        style={{ pointerEvents: "none" }}
                      >
                        {isInput ? (ni === 0 ? "x₁" : "x₂") : isOutput ? "out" : `h${li}.${ni + 1}`}
                      </text>
                    </g>
                  );
                })
              )}
              {layers.map((l, li) => {
                const x = neuronPositions[li]?.[0]?.x ?? 0;
                const isInput = li === 0;
                const isOutput = li === layers.length - 1;
                const label = isInput ? "Input" : isOutput ? "Output" : `Hidden ${li}`;
                return (
                  <text
                    key={`lbl-${li}`}
                    x={x}
                    y={SVG_H - 6}
                    textAnchor="middle"
                    fill={COLORS.textMuted}
                    fontSize="9"
                    fontFamily="'Sora', sans-serif"
                    fontWeight="500"
                  >
                    {label}
                    {!isInput ? ` · ${ACT_FNS[l.activation].abbr}` : ""}
                  </text>
                );
              })}
            </svg>
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                dragStartY.current = e.clientY;
                dragStartH.current = netHeight;
                setDragging(true);
              }}
              onTouchStart={(e) => {
                dragStartY.current = e.touches[0].clientY;
                dragStartH.current = netHeight;
                setDragging(true);
              }}
              style={{
                height: 14,
                cursor: "ns-resize",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "0 0 10px 10px",
                userSelect: "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = COLORS.surface;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div style={{ width: 40, height: 3, borderRadius: 2, background: COLORS.panelBorder }} />
            </div>
          </div>

          <div
            style={{
              background: COLORS.panel,
              borderRadius: 10,
              border: `1px solid ${COLORS.panelBorder}`,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: COLORS.textMuted,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              {challengeComparisonActive ? "Challenge Matchup" : "Output Heatmap · f(x₁, x₂)"}
            </div>

            {challengeComparisonActive && activeChallenge && (
              <>
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 16, color: COLORS.textBright, fontWeight: 700 }}>{activeChallenge.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                      {activeChallenge.formula} · {activeChallenge.difficulty} · par {activeChallenge.par}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setShowChallengePicker(true)}
                      disabled={isSolutionRevealed}
                      style={{
                        ...subtleBtnStyle,
                        opacity: isSolutionRevealed ? 0.6 : 1,
                        cursor: isSolutionRevealed ? "default" : "pointer",
                      }}
                    >
                      Challenge List
                    </button>
                    <button
                      onClick={handleShowSolution}
                      disabled={isRevealingSolution || isSolutionRevealed}
                      style={{
                        ...subtleBtnStyle,
                        opacity: isRevealingSolution || isSolutionRevealed ? 0.6 : 1,
                        cursor: isRevealingSolution || isSolutionRevealed ? "default" : "pointer",
                      }}
                    >
                      {isRevealingSolution ? "Revealing..." : isSolutionRevealed ? "Solution Shown" : "Show Solution"}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    width: "100%",
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.panelBorder}`,
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: scoreColor, fontWeight: 600 }}>
                      {scoreLabel}
                      {challengeScore >= 95 ? " ✓" : ""}
                    </span>
                    <span style={{ fontSize: 13, color: COLORS.textBright, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                      {challengeScoreDisplay.toFixed(2)}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 12,
                      borderRadius: 999,
                      background: "#1f2a40",
                      border: `1px solid ${COLORS.panelBorder}`,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${challengeScoreDisplay.toFixed(2)}%`,
                        background: scoreColor,
                        transition: "width 120ms linear, background 140ms linear",
                        boxShadow: scoreGlow ? `0 0 16px ${scoreColor}` : "none",
                      }}
                    />
                  </div>
                </div>

                {isSolutionRevealed && (
                  <div
                    style={{
                      width: "100%",
                      border: `1px solid ${COLORS.accent}55`,
                      background: COLORS.accentDim,
                      borderRadius: 10,
                      padding: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>Solution revealed</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleRestoreAttempt}
                        disabled={!canRestoreAttempt}
                        style={{
                          ...subtleBtnStyle,
                          opacity: canRestoreAttempt ? 1 : 0.5,
                          cursor: canRestoreAttempt ? "pointer" : "default",
                        }}
                      >
                        Restore my attempt
                      </button>
                      <button onClick={handleTryAnother} style={subtleBtnStyle}>
                        Try another
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ width: "100%", display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      background: COLORS.bg,
                      border: `1px solid ${COLORS.panelBorder}`,
                      borderRadius: 10,
                      padding: 8,
                    }}
                  >
                    <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
                      Your Network
                    </div>
                    <canvas
                      ref={userCanvasRef}
                      width={360}
                      height={360}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${COLORS.panelBorder}`,
                        width: "min(360px, 42vw)",
                        height: "min(360px, 42vw)",
                        background: COLORS.bg,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      background: COLORS.bg,
                      border: `1px solid ${COLORS.panelBorder}`,
                      borderRadius: 10,
                      padding: 8,
                    }}
                  >
                    <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
                      Target
                    </div>
                    <canvas
                      ref={targetCanvasRef}
                      width={360}
                      height={360}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${COLORS.panelBorder}`,
                        width: "min(360px, 42vw)",
                        height: "min(360px, 42vw)",
                        background: COLORS.bg,
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {!challengeComparisonActive && (
              <>
                {isChallengeMode && (
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                    {activeChallenge
                      ? "Challenge list is open in the sidebar. Pick any challenge to continue."
                      : "Choose a challenge from the sidebar to start matching a target function."}
                  </div>
                )}
                <canvas
                  ref={userCanvasRef}
                  width={400}
                  height={400}
                  style={{
                    borderRadius: 6,
                    border: `1px solid ${COLORS.panelBorder}`,
                    width: 380,
                    height: 380,
                    background: COLORS.bg,
                  }}
                />
              </>
            )}

            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 4,
                fontSize: 11,
                color: COLORS.textMuted,
                fontFamily: "'DM Mono', monospace",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <span>
                Domain: [{DOMAIN[0]}, {DOMAIN[1]}] × [{DOMAIN[0]}, {DOMAIN[1]}]
              </span>
              <span>
                Resolution: {GRID}×{GRID}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  background: "none",
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 6,
  color: COLORS.text,
  cursor: "pointer",
  padding: "5px 12px",
  fontSize: 12,
  fontFamily: "'Sora', sans-serif",
  fontWeight: 500,
  transition: "all 0.15s",
};

const subtleBtnStyle = {
  background: "none",
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 6,
  color: COLORS.textMuted,
  cursor: "pointer",
  padding: "5px 10px",
  fontSize: 11,
  fontFamily: "'Sora', sans-serif",
  fontWeight: 500,
  transition: "all 0.15s",
};

const smallBtnStyle = {
  background: COLORS.bg,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 4,
  color: COLORS.textMuted,
  cursor: "pointer",
  padding: "1px 6px",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: "18px",
};
