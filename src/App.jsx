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

const COLORS = {
  bg: "#080c14", panel: "#0f1523", panelBorder: "#1a2540",
  surface: "#151d30", accent: "#00e0a0", accentDim: "#00e0a040",
  negative: "#ff4070", negativeDim: "#ff407040",
  text: "#c8d4e8", textMuted: "#5a6f8f", textBright: "#e8f0ff",
  inputNeuron: "#3b82f6", outputNeuron: "#f59e0b",
  selected: "#00e0a0",
};

function fmt(v) {
  if (v === undefined || v === null || isNaN(v)) return "0.00";
  if (Math.abs(v) < 0.005) return "0.00";
  if (Math.abs(v) >= 1000) return v.toExponential(1);
  return v.toFixed(2);
}

function forwardPassFull(layers, inputValues) {
  const acts = [inputValues.slice()];
  const pres = [inputValues.slice()];
  for (let l = 1; l < layers.length; l++) {
    const layer = layers[l];
    const prev = acts[l - 1];
    const actFn = ACT_FNS[layer.activation].fn;
    const lp = [], la = [];
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
  t = Math.max(0, Math.min(1, t));
  const v = Math.round(t * 255);
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

export default function App() {
  const [layers, setLayers] = useState(createInitialNetwork);
  const [inputValues, setInputValues] = useState([0.5, 0.5]);
  const [sel, setSel] = useState(null);
  const [netHeight, setNetHeight] = useState(340);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);
  const canvasRef = useRef(null);
  const svgRef = useRef(null);

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

  const layerSizes = useMemo(() => layers.map((l) => (l.type === "input" ? l.neuronCount : l.neurons.length)), [layers]);

  const { activations, preActivations } = useMemo(
    () => forwardPassFull(layers, inputValues),
    [layers, inputValues]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const vals = new Float64Array(GRID * GRID);
    let mn = Infinity, mx = -Infinity;
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const x1 = DOMAIN[0] + (i / (GRID - 1)) * (DOMAIN[1] - DOMAIN[0]);
        const x2 = DOMAIN[1] - (j / (GRID - 1)) * (DOMAIN[1] - DOMAIN[0]);
        const v = computeOutput(layers, x1, x2);
        vals[j * GRID + i] = v;
        if (isFinite(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
      }
    }
    if (!isFinite(mn)) { mn = 0; mx = 1; }
    if (mn === mx) { mn -= 0.5; mx += 0.5; }
    const scaleX = w / GRID, scaleY = h / GRID;
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const v = vals[j * GRID + i];
        const t = (v - mn) / (mx - mn);
        const c = colorMap(t);
        const x0 = Math.floor(i * scaleX), y0 = Math.floor(j * scaleY);
        const x1 = Math.floor((i + 1) * scaleX), y1 = Math.floor((j + 1) * scaleY);
        for (let py = y0; py < y1; py++) {
          for (let px = x0; px < x1; px++) {
            const idx = (py * w + px) * 4;
            img.data[idx] = c[0]; img.data[idx + 1] = c[1];
            img.data[idx + 2] = c[2]; img.data[idx + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    // Axes
    ctx.strokeStyle = "rgba(200,212,232,0.3)";
    ctx.lineWidth = 1;
    const cx = w * (0 - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0]);
    const cy = h * (1 - (0 - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0]));
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    // Labels
    ctx.fillStyle = COLORS.text;
    ctx.font = "11px 'DM Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("x₁", w - 16, cy - 6);
    ctx.fillText("x₂", cx + 14, 14);
    for (let v = -4; v <= 4; v += 2) {
      if (v === 0) continue;
      const px = w * (v - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0]);
      const py2 = h * (1 - (v - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0]));
      ctx.fillText(String(v), px, cy + 14);
      ctx.fillText(String(v), cx - 14, py2 + 4);
    }
    // Color bar
    const barW = 12, barH = h - 20, barX = w - 24, barY = 10;
    for (let y = 0; y < barH; y++) {
      const t2 = 1 - y / barH;
      const c2 = colorMap(t2);
      ctx.fillStyle = `rgb(${c2[0]},${c2[1]},${c2[2]})`;
      ctx.fillRect(barX, barY + y, barW, 1);
    }
    ctx.fillStyle = COLORS.text;
    ctx.font = "9px 'DM Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(fmt(mx), barX - 3, barY + 8);
    ctx.fillText(fmt(mn), barX - 3, barY + barH);
  }, [layers]);

  const addHiddenLayer = () => {
    setLayers((prev) => {
      const outIdx = prev.length - 1;
      const prevSize = layerSizes[outIdx - 1] ?? prev[0].neuronCount;
      const newCount = 3;
      const newLayer = {
        type: "hidden", activation: "relu",
        neurons: Array.from({ length: newCount }, () => ({
          bias: 0, weights: Array(prevSize).fill(0),
        })),
      };
      const newOutput = {
        ...prev[outIdx],
        neurons: prev[outIdx].neurons.map((n) => ({
          ...n, weights: Array(newCount).fill(0),
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
            ...n, weights: Array(prevSize).fill(0),
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
            ...l, neurons: [...l.neurons, { bias: 0, weights: Array(prevSize).fill(0) }],
          };
        }
        if (i === layerIdx + 1) {
          return {
            ...l, neurons: l.neurons.map((n) => ({ ...n, weights: [...n.weights, 0] })),
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
              ...n, weights: n.weights.filter((_, j) => j !== neuronIdx),
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
    setLayers((prev) => prev.map((l, i) => {
      if (i !== layerIdx) return l;
      return {
        ...l, neurons: l.neurons.map((n, j) => {
          if (j !== neuronIdx) return n;
          const w = [...n.weights]; w[weightIdx] = val;
          return { ...n, weights: w };
        }),
      };
    }));
  };

  const updateBias = (layerIdx, neuronIdx, val) => {
    setLayers((prev) => prev.map((l, i) => {
      if (i !== layerIdx) return l;
      return {
        ...l, neurons: l.neurons.map((n, j) =>
          j === neuronIdx ? { ...n, bias: val } : n
        ),
      };
    }));
  };

  const setLayerActivation = (layerIdx, act) => {
    setLayers((prev) => prev.map((l, i) => i === layerIdx ? { ...l, activation: act } : l));
  };

  const randomizeAll = () => {
    setLayers((prev) => prev.map((l, i) => {
      if (i === 0) return l;
      return {
        ...l, neurons: l.neurons.map((n) => ({
          bias: (Math.random() - 0.5) * 2,
          weights: n.weights.map(() => (Math.random() - 0.5) * 2),
        })),
      };
    }));
  };

  const resetAll = () => {
    setLayers(createInitialNetwork());
    setInputValues([0.5, 0.5]);
    setSel(null);
  };

  // SVG layout
  const SVG_W = 560;
  const SVG_H = netHeight;
  const PAD_X = 60, PAD_Y = 30;
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
  }, [layers, layerSizes, netHeight]);

  const selNeuron = sel
    ? { layerIdx: sel.layerIdx, neuronIdx: sel.neuronIdx }
    : null;

  const renderSidebar = () => {
    if (!sel) {
      return (
        <div style={{ padding: 20, color: COLORS.textMuted, fontFamily: "'Sora', sans-serif", fontSize: 13 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>Neuron Inspector</div>
          <p style={{ lineHeight: 1.6 }}>Click on any neuron in the network to inspect and edit its properties.</p>
          <div style={{ marginTop: 20, padding: 14, background: COLORS.bg, borderRadius: 8, border: `1px solid ${COLORS.panelBorder}` }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: COLORS.accent, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Quick Tips</div>
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
        <span style={{ fontSize: 12, color: COLORS.textMuted, minWidth: 60, fontFamily: "'DM Mono', monospace" }}>{label}</span>
        <input
          type="number" step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            flex: 1, background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 6, padding: "6px 8px", color: COLORS.textBright,
            fontFamily: "'DM Mono', monospace", fontSize: 13, outline: "none",
          }}
          onFocus={(e) => e.target.style.borderColor = COLORS.accent}
          onBlur={(e) => e.target.style.borderColor = COLORS.panelBorder}
        />
      </div>
    );

    return (
      <div style={{ padding: 16, fontFamily: "'Sora', sans-serif", overflowY: "auto", maxHeight: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.accent, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>
              {layerLabel} Layer
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textBright }}>
              Neuron {neuronLabel}
            </div>
          </div>
          <button
            onClick={() => setSel(null)}
            style={{
              background: "none", border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6,
              color: COLORS.textMuted, cursor: "pointer", padding: "4px 8px", fontSize: 11,
            }}
          >✕</button>
        </div>

        {/* Activation display */}
        <div style={{
          background: COLORS.bg, borderRadius: 8, padding: 12, marginBottom: 14,
          border: `1px solid ${COLORS.panelBorder}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>
              {isInput ? "Value" : "Activation"}
            </span>
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

        {/* Input value editor */}
        {isInput && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500, letterSpacing: 0.5 }}>
              INPUT VALUE
            </div>
            {numberInput(inputValues[neuronIdx], (v) => {
              const nv = [...inputValues]; nv[neuronIdx] = v; setInputValues(nv);
            }, neuronLabel, 0.1)}
            <input
              type="range" min={-5} max={5} step={0.01} value={inputValues[neuronIdx]}
              onChange={(e) => {
                const nv = [...inputValues]; nv[neuronIdx] = parseFloat(e.target.value); setInputValues(nv);
              }}
              style={{ width: "100%", accentColor: COLORS.accent, marginTop: 4 }}
            />
          </div>
        )}

        {/* Bias editor */}
        {!isInput && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500, letterSpacing: 0.5 }}>
              BIAS
            </div>
            {numberInput(layers[layerIdx].neurons[neuronIdx].bias, (v) => updateBias(layerIdx, neuronIdx, v), "b")}
            <input
              type="range" min={-5} max={5} step={0.01}
              value={layers[layerIdx].neurons[neuronIdx].bias}
              onChange={(e) => updateBias(layerIdx, neuronIdx, parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: COLORS.accent, marginTop: 2 }}
            />
          </div>
        )}

        {/* Weight editors */}
        {!isInput && (
          <div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500, letterSpacing: 0.5 }}>
              INCOMING WEIGHTS
            </div>
            {layers[layerIdx].neurons[neuronIdx].weights.map((w, wi) => {
              const prevLabel = layerIdx === 1
                ? (wi === 0 ? "x₁" : wi === 1 ? "x₂" : `x${wi + 1}`)
                : `h${layerIdx - 1}n${wi + 1}`;
              return (
                <div key={wi}>
                  {numberInput(w, (v) => updateWeight(layerIdx, neuronIdx, wi, v), `w(${prevLabel})`, 0.1)}
                  <input
                    type="range" min={-5} max={5} step={0.01} value={w}
                    onChange={(e) => updateWeight(layerIdx, neuronIdx, wi, parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: w >= 0 ? COLORS.accent : COLORS.negative, marginTop: -2, marginBottom: 6 }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      width: "100vw", height: "100vh", background: COLORS.bg, color: COLORS.text,
      fontFamily: "'Sora', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${COLORS.panelBorder}`, background: COLORS.panel, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textBright, letterSpacing: -0.5 }}>
            <span style={{ color: COLORS.accent }}>⬡</span> Neural Network Builder
          </div>
          <span style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.bg, padding: "2px 8px", borderRadius: 4 }}>
            {layers.length - 2} hidden {layers.length - 2 === 1 ? "layer" : "layers"} · {
              layers.reduce((s, l, i) => s + (i === 0 ? l.neuronCount : l.neurons.length), 0)
            } neurons
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={randomizeAll} style={btnStyle}>⟳ Randomize</button>
          <button onClick={resetAll} style={{ ...btnStyle, borderColor: COLORS.negative + "60", color: COLORS.negative }}>Reset</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{
          width: 280, flexShrink: 0, background: COLORS.panel,
          borderRight: `1px solid ${COLORS.panelBorder}`, overflowY: "auto",
        }}>
          {renderSidebar()}
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", padding: 16, gap: 12 }}>
          {/* Layer Controls */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            padding: "10px 14px", background: COLORS.panel, borderRadius: 10,
            border: `1px solid ${COLORS.panelBorder}`,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
              Layers
            </span>
            {layers.map((l, i) => {
              const isInput = i === 0;
              const isOutput = i === layers.length - 1;
              const label = isInput ? "Input (2)" : isOutput ? "Output (1)" : `Hidden ${i}`;
              const size = isInput ? l.neuronCount : l.neurons.length;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 4, background: COLORS.surface,
                  borderRadius: 8, padding: "4px 8px", border: `1px solid ${COLORS.panelBorder}`,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: COLORS.text, marginRight: 2 }}>
                    {label}
                  </span>
                  {!isInput && (
                    <select
                      value={l.activation}
                      onChange={(e) => setLayerActivation(i, e.target.value)}
                      style={{
                        background: COLORS.bg, color: COLORS.accent, border: `1px solid ${COLORS.panelBorder}`,
                        borderRadius: 4, padding: "2px 4px", fontSize: 10, fontFamily: "'DM Mono', monospace",
                        outline: "none", cursor: "pointer",
                      }}
                    >
                      {Object.entries(ACT_FNS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  )}
                  {!isInput && !isOutput && (
                    <>
                      <button
                        onClick={() => removeNeuron(i, l.neurons.length - 1)}
                        style={smallBtnStyle} title="Remove neuron"
                        disabled={l.neurons.length <= 1}
                      >−</button>
                      <span style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", minWidth: 14, textAlign: "center" }}>{size}</span>
                      <button onClick={() => addNeuron(i)} style={smallBtnStyle} title="Add neuron">+</button>
                      <button
                        onClick={() => removeLayer(i)}
                        style={{ ...smallBtnStyle, color: COLORS.negative, borderColor: COLORS.negative + "40" }}
                        title="Remove layer"
                      >✕</button>
                    </>
                  )}
                </div>
              );
            })}
            <button onClick={addHiddenLayer} style={{
              ...btnStyle, fontSize: 11, padding: "4px 10px", background: COLORS.accentDim,
              color: COLORS.accent, borderColor: COLORS.accent + "40",
            }}>+ Hidden Layer</button>
          </div>

          {/* Network Visualization */}
          <div style={{
            background: COLORS.panel, borderRadius: 10, border: `1px solid ${COLORS.panelBorder}`,
            padding: 8, position: "relative", flexShrink: 0,
          }}>
            <svg ref={svgRef} width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={{ width: "100%", height: netHeight, display: "block", userSelect: dragging ? "none" : undefined }}>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {/* Connections */}
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
                      <line key={`${li}-${ni}-${wi}`}
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke={color} strokeWidth={isSel ? strokeW + 1 : strokeW}
                        opacity={isSel ? Math.min(opacity + 0.3, 1) : opacity}
                        strokeLinecap="round"
                      />
                    );
                  })
                );
              })}
              {/* Neurons */}
              {neuronPositions.map((lp, li) =>
                lp.map((pos, ni) => {
                  const isInput = li === 0;
                  const isOutput = li === layers.length - 1;
                  const actVal = activations[li]?.[ni] ?? 0;
                  const isSel = sel && sel.layerIdx === li && sel.neuronIdx === ni;
                  const fillColor = neuronColor(actVal, 0.7);
                  const strokeColor = isSel ? COLORS.selected : isInput ? COLORS.inputNeuron : isOutput ? COLORS.outputNeuron : "#3a4f70";
                  return (
                    <g key={`${li}-${ni}`}
                      onClick={() => setSel({ layerIdx: li, neuronIdx: ni })}
                      style={{ cursor: "pointer" }}
                    >
                      <circle cx={pos.x} cy={pos.y} r={neuronR + (isSel ? 3 : 0)}
                        fill={fillColor} stroke={strokeColor}
                        strokeWidth={isSel ? 2.5 : 1.5}
                        filter={isSel ? "url(#glow)" : undefined}
                      />
                      <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                        fill={COLORS.textBright} fontSize="10" fontFamily="'DM Mono', monospace" fontWeight="500"
                        style={{ pointerEvents: "none" }}
                      >
                        {fmt(actVal)}
                      </text>
                      <text x={pos.x} y={pos.y - neuronR - 6} textAnchor="middle"
                        fill={COLORS.textMuted} fontSize="9" fontFamily="'Sora', sans-serif" fontWeight="500"
                        style={{ pointerEvents: "none" }}
                      >
                        {isInput ? (ni === 0 ? "x₁" : "x₂") : isOutput ? "out" : `h${li}.${ni + 1}`}
                      </text>
                    </g>
                  );
                })
              )}
              {/* Layer labels */}
              {layers.map((l, li) => {
                const x = neuronPositions[li]?.[0]?.x ?? 0;
                const isInput = li === 0;
                const isOutput = li === layers.length - 1;
                const label = isInput ? "Input" : isOutput ? "Output" : `Hidden ${li}`;
                return (
                  <text key={`lbl-${li}`} x={x} y={SVG_H - 6} textAnchor="middle"
                    fill={COLORS.textMuted} fontSize="9" fontFamily="'Sora', sans-serif" fontWeight="500"
                  >
                    {label}{!isInput ? ` · ${ACT_FNS[l.activation].abbr}` : ""}
                  </text>
                );
              })}
            </svg>
            {/* Resize handle */}
            <div
              onMouseDown={(e) => { e.preventDefault(); dragStartY.current = e.clientY; dragStartH.current = netHeight; setDragging(true); }}
              onTouchStart={(e) => { dragStartY.current = e.touches[0].clientY; dragStartH.current = netHeight; setDragging(true); }}
              style={{
                height: 14, cursor: "ns-resize", display: "flex", alignItems: "center",
                justifyContent: "center", borderRadius: "0 0 10px 10px", userSelect: "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = COLORS.surface}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div style={{
                width: 40, height: 3, borderRadius: 2, background: COLORS.panelBorder,
              }} />
            </div>
          </div>

          {/* Heatmap */}
          <div style={{
            background: COLORS.panel, borderRadius: 10, border: `1px solid ${COLORS.panelBorder}`,
            padding: 12, display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: COLORS.textMuted, letterSpacing: 1,
              textTransform: "uppercase", marginBottom: 8,
            }}>
              Output Heatmap · f(x₁, x₂)
            </div>
            <canvas ref={canvasRef} width={400} height={400}
              style={{ borderRadius: 6, border: `1px solid ${COLORS.panelBorder}`, width: 380, height: 380 }}
            />
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>
              <span>Domain: [{DOMAIN[0]}, {DOMAIN[1]}] × [{DOMAIN[0]}, {DOMAIN[1]}]</span>
              <span>Resolution: {GRID}×{GRID}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  background: "none", border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6,
  color: COLORS.text, cursor: "pointer", padding: "5px 12px", fontSize: 12,
  fontFamily: "'Sora', sans-serif", fontWeight: 500, transition: "all 0.15s",
};

const smallBtnStyle = {
  background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 4,
  color: COLORS.textMuted, cursor: "pointer", padding: "1px 6px", fontSize: 12,
  fontWeight: 600, lineHeight: "18px",
};
