export const ACT_FNS = {
  linear: { fn: (x) => x, label: "Linear", abbr: "Lin" },
  relu: { fn: (x) => Math.max(0, x), label: "ReLU", abbr: "ReLU" },
  lrelu: { fn: (x) => (x > 0 ? x : 0.01 * x), label: "Leaky ReLU", abbr: "LReLU" },
  sigmoid: { fn: (x) => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))), label: "Sigmoid", abbr: "σ" },
  tanh: { fn: (x) => Math.tanh(x), label: "Tanh", abbr: "tanh" },
};

export const SOLVED_STORAGE_KEY = "nn-builder-solved-challenges-v1";
export const REVEAL_DURATION_MS = 1500;
export const DEFAULT_INPUT_VALUES = [0.5, 0.5];

const REAL_NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

export function fmt(v) {
  if (v === undefined || v === null || isNaN(v)) return "0.00";
  if (Math.abs(v) < 0.005) return "0.00";
  if (Math.abs(v) >= 1000) return v.toExponential(1);
  return v.toFixed(2);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

function colorMap(t) {
  const x = clamp(t, 0, 1);
  const v = Math.round(x * 255);
  return [v, v, v];
}

export function neuronColor(val, alpha = 1) {
  if (val === undefined || isNaN(val)) return `rgba(90,111,143,${alpha})`;
  const t = 1 / (1 + Math.exp(-val * 0.5));
  const c = colorMap(t);
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

export function forwardPassFull(layers, inputValues) {
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

export function computeOutput(layers, x1, x2) {
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

export function createInitialNetwork() {
  return [
    { type: "input", activation: "linear", neuronCount: 2 },
    { type: "output", activation: "linear", neurons: [{ bias: 0, weights: [0, 0] }] },
  ];
}

export function parseRealNumber(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text || !REAL_NUMBER_PATTERN.test(text)) return { valid: false, value: 0 };
  const value = Number(text);
  if (!Number.isFinite(value)) return { valid: false, value: 0 };
  return { valid: true, value };
}

export function inputFieldKey(inputIdx) {
  return `i:${inputIdx}`;
}

export function biasFieldKey(layerIdx, neuronIdx) {
  return `b:${layerIdx}:${neuronIdx}`;
}

export function weightFieldKey(layerIdx, neuronIdx, weightIdx) {
  return `w:${layerIdx}:${neuronIdx}:${weightIdx}`;
}

export function numberToDraftText(value) {
  return Number.isFinite(value) ? String(value) : "0";
}

export function buildParameterDrafts(layers, inputValues) {
  const drafts = {};
  for (let i = 0; i < inputValues.length; i++) {
    drafts[inputFieldKey(i)] = numberToDraftText(inputValues[i]);
  }
  for (let layerIdx = 1; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    for (let neuronIdx = 0; neuronIdx < layer.neurons.length; neuronIdx++) {
      const neuron = layer.neurons[neuronIdx];
      drafts[biasFieldKey(layerIdx, neuronIdx)] = numberToDraftText(neuron.bias);
      for (let weightIdx = 0; weightIdx < neuron.weights.length; weightIdx++) {
        drafts[weightFieldKey(layerIdx, neuronIdx, weightIdx)] = numberToDraftText(neuron.weights[weightIdx]);
      }
    }
  }
  return drafts;
}

function readDraftText(drafts, key, fallbackValue) {
  const text = drafts[key];
  return typeof text === "string" ? text : numberToDraftText(fallbackValue);
}

export function parseDraftsToNetwork(drafts, layers, inputValues) {
  const nextInputValues = [];
  for (let i = 0; i < inputValues.length; i++) {
    const parsed = parseRealNumber(readDraftText(drafts, inputFieldKey(i), inputValues[i]));
    if (!parsed.valid) return null;
    nextInputValues.push(parsed.value);
  }

  const nextLayers = [{ ...layers[0] }];
  for (let layerIdx = 1; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    const nextNeurons = [];
    for (let neuronIdx = 0; neuronIdx < layer.neurons.length; neuronIdx++) {
      const neuron = layer.neurons[neuronIdx];
      const parsedBias = parseRealNumber(readDraftText(drafts, biasFieldKey(layerIdx, neuronIdx), neuron.bias));
      if (!parsedBias.valid) return null;
      const nextWeights = [];
      for (let weightIdx = 0; weightIdx < neuron.weights.length; weightIdx++) {
        const parsedWeight = parseRealNumber(
          readDraftText(drafts, weightFieldKey(layerIdx, neuronIdx, weightIdx), neuron.weights[weightIdx])
        );
        if (!parsedWeight.valid) return null;
        nextWeights.push(parsedWeight.value);
      }
      nextNeurons.push({
        bias: parsedBias.value,
        weights: nextWeights,
      });
    }
    nextLayers.push({
      ...layer,
      neurons: nextNeurons,
    });
  }

  return { layers: nextLayers, inputValues: nextInputValues };
}

export function reconcileParameterDrafts(prevDrafts, layers, inputValues) {
  const canonicalDrafts = buildParameterDrafts(layers, inputValues);
  const nextDrafts = {};
  let changed = false;

  for (const [key, canonicalText] of Object.entries(canonicalDrafts)) {
    const prevText = prevDrafts[key];
    if (typeof prevText !== "string") {
      nextDrafts[key] = canonicalText;
      changed = true;
      continue;
    }
    const parsedPrev = parseRealNumber(prevText);
    const canonicalValue = Number(canonicalText);
    if (parsedPrev.valid && Object.is(parsedPrev.value, canonicalValue)) {
      nextDrafts[key] = prevText;
      continue;
    }
    nextDrafts[key] = canonicalText;
    if (prevText !== canonicalText) changed = true;
  }

  if (!changed && Object.keys(prevDrafts).length === Object.keys(nextDrafts).length) return prevDrafts;
  return nextDrafts;
}

export function numericArraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

export function networkParametersEqual(aLayers, bLayers) {
  if (aLayers.length !== bLayers.length) return false;
  for (let layerIdx = 0; layerIdx < aLayers.length; layerIdx++) {
    const aLayer = aLayers[layerIdx];
    const bLayer = bLayers[layerIdx];
    if (!bLayer || aLayer.type !== bLayer.type || aLayer.activation !== bLayer.activation) return false;
    if (layerIdx === 0) {
      if (aLayer.neuronCount !== bLayer.neuronCount) return false;
      continue;
    }
    if (aLayer.neurons.length !== bLayer.neurons.length) return false;
    for (let neuronIdx = 0; neuronIdx < aLayer.neurons.length; neuronIdx++) {
      const aNeuron = aLayer.neurons[neuronIdx];
      const bNeuron = bLayer.neurons[neuronIdx];
      if (!bNeuron || !Object.is(aNeuron.bias, bNeuron.bias)) return false;
      if (!numericArraysEqual(aNeuron.weights, bNeuron.weights)) return false;
    }
  }
  return true;
}

export function cloneLayers(layers) {
  return layers.map((layer, idx) => {
    if (idx === 0) return { ...layer };
    return {
      ...layer,
      neurons: layer.neurons.map((n) => ({ bias: n.bias, weights: [...n.weights] })),
    };
  });
}

export function zeroLayersLike(templateLayers) {
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

export function networkArchitectureMatches(a, b) {
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

export function lerpLayers(startLayers, endLayers, t) {
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
