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
export const NETWORK_JSON_SCHEMA = "nn-builder/network";
export const NETWORK_JSON_VERSION = 1;
export const NETWORK_IMPORT_LIMITS = Object.freeze({
  maxLayers: 20,
  maxNeuronsPerLayer: 128,
  maxTotalWeights: 20_000,
  maxFileBytes: 5_000_000,
});

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

const NEURON_STOPS = [
  [40, 40, 50],
  [50, 80, 140],
  [0, 152, 255],
];

export function neuronColor(val, alpha = 1) {
  if (val === undefined || isNaN(val)) return `rgba(100,100,110,${alpha})`;
  const t = clamp(1 / (1 + Math.exp(-val * 0.5)), 0, 1);
  const scaled = t * (NEURON_STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), NEURON_STOPS.length - 2);
  const f = scaled - i;
  const a = NEURON_STOPS[i];
  const b = NEURON_STOPS[i + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgba(${r},${g},${bl},${alpha})`;
}

function runLayerActivations(layer, previousActivations, preActivationsOut = null) {
  const activate = ACT_FNS[layer.activation].fn;
  const activations = [];

  for (const neuron of layer.neurons) {
    let weightedSum = neuron.bias;
    for (let i = 0; i < previousActivations.length; i++) {
      weightedSum += (neuron.weights[i] || 0) * previousActivations[i];
    }
    if (preActivationsOut) preActivationsOut.push(weightedSum);
    activations.push(activate(weightedSum));
  }

  return activations;
}

export function forwardPassFull(layers, inputValues) {
  const acts = [inputValues.slice()];
  const pres = [inputValues.slice()];
  for (let l = 1; l < layers.length; l++) {
    const preActivations = [];
    const activations = runLayerActivations(layers[l], acts[l - 1], preActivations);
    pres.push(preActivations);
    acts.push(activations);
  }
  return { activations: acts, preActivations: pres };
}

export function computeOutput(layers, x1, x2) {
  let prev = [x1, x2];
  for (let l = 1; l < layers.length; l++) {
    prev = runLayerActivations(layers[l], prev);
  }
  return prev[0] ?? 0;
}

export function createInitialNetwork() {
  return [
    { type: "input", activation: "linear", neuronCount: 2 },
    { type: "output", activation: "linear", neurons: [{ bias: 0, weights: [0, 0] }] },
  ];
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// enforce fixed two-input sandbox contract
function sanitizeInputValues(inputValues) {
  if (!Array.isArray(inputValues) || inputValues.length !== DEFAULT_INPUT_VALUES.length) {
    return { valid: false, error: `Input values must contain exactly ${DEFAULT_INPUT_VALUES.length} numbers.` };
  }
  if (!inputValues.every(isFiniteNumber)) {
    return { valid: false, error: "Input values must all be finite numbers." };
  }
  return { valid: true, values: [...inputValues] };
}

function sanitizeLayers(layers) {
  if (!Array.isArray(layers) || layers.length < 2) {
    return { valid: false, error: "Network must include at least an input and output layer." };
  }
  if (layers.length > NETWORK_IMPORT_LIMITS.maxLayers) {
    return { valid: false, error: `Network has too many layers (max ${NETWORK_IMPORT_LIMITS.maxLayers}).` };
  }

  const nextLayers = [];
  const inputLayer = layers[0];
  if (!inputLayer || typeof inputLayer !== "object") {
    return { valid: false, error: "Input layer is missing or malformed." };
  }
  if (inputLayer.neuronCount !== DEFAULT_INPUT_VALUES.length) {
    return { valid: false, error: `Input layer must have exactly ${DEFAULT_INPUT_VALUES.length} neurons.` };
  }
  nextLayers.push({ type: "input", activation: "linear", neuronCount: DEFAULT_INPUT_VALUES.length });

  let prevSize = DEFAULT_INPUT_VALUES.length;
  let totalWeights = 0;
  // validate each non-input layer and normalize neuron arrays
  for (let layerIdx = 1; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    if (!layer || typeof layer !== "object") {
      return { valid: false, error: `Layer ${layerIdx} is malformed.` };
    }
    const activationExists =
      typeof layer.activation === "string" && Object.prototype.hasOwnProperty.call(ACT_FNS, layer.activation);
    if (!activationExists || typeof ACT_FNS[layer.activation].fn !== "function") {
      return { valid: false, error: `Layer ${layerIdx} has an unsupported activation function.` };
    }
    if (!Array.isArray(layer.neurons) || layer.neurons.length === 0) {
      return { valid: false, error: `Layer ${layerIdx} must include at least one neuron.` };
    }
    if (layer.neurons.length > NETWORK_IMPORT_LIMITS.maxNeuronsPerLayer) {
      return {
        valid: false,
        error: `Layer ${layerIdx} has too many neurons (max ${NETWORK_IMPORT_LIMITS.maxNeuronsPerLayer}).`,
      };
    }
    if (layerIdx === layers.length - 1 && layer.neurons.length !== 1) {
      return { valid: false, error: "Output layer must contain exactly one neuron." };
    }

    const nextNeurons = [];
    for (let neuronIdx = 0; neuronIdx < layer.neurons.length; neuronIdx++) {
      const neuron = layer.neurons[neuronIdx];
      if (!neuron || typeof neuron !== "object") {
        return { valid: false, error: `Layer ${layerIdx}, neuron ${neuronIdx} is malformed.` };
      }
      if (!isFiniteNumber(neuron.bias)) {
        return { valid: false, error: `Layer ${layerIdx}, neuron ${neuronIdx} has an invalid bias.` };
      }
      if (!Array.isArray(neuron.weights) || neuron.weights.length !== prevSize) {
        return {
          valid: false,
          error: `Layer ${layerIdx}, neuron ${neuronIdx} must have exactly ${prevSize} weights.`,
        };
      }
      if (!neuron.weights.every(isFiniteNumber)) {
        return { valid: false, error: `Layer ${layerIdx}, neuron ${neuronIdx} has invalid weights.` };
      }
      totalWeights += neuron.weights.length;
      if (totalWeights > NETWORK_IMPORT_LIMITS.maxTotalWeights) {
        return {
          valid: false,
          error: `Network has too many weights (max ${NETWORK_IMPORT_LIMITS.maxTotalWeights}).`,
        };
      }
      nextNeurons.push({
        bias: neuron.bias,
        weights: [...neuron.weights],
      });
    }

    const isOutput = layerIdx === layers.length - 1;
    nextLayers.push({
      type: isOutput ? "output" : "hidden",
      activation: layer.activation,
      neurons: nextNeurons,
    });
    prevSize = nextNeurons.length;
  }

  return { valid: true, layers: nextLayers };
}

export function createNetworkExportPayload(layers, inputValues) {
  return {
    schema: NETWORK_JSON_SCHEMA,
    version: NETWORK_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    network: {
      layers: cloneLayers(layers),
      inputValues: [...inputValues],
    },
  };
}

export function parseNetworkImportPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "JSON root must be an object." };
  }

  const hasSchema = Object.prototype.hasOwnProperty.call(payload, "schema");
  const hasVersion = Object.prototype.hasOwnProperty.call(payload, "version");
  const hasNestedNetwork = payload.network && typeof payload.network === "object";
  const hasAnyMetadata = hasSchema || hasVersion;
  const hasMetadata = hasSchema && hasVersion;
  if (hasAnyMetadata && !hasMetadata) {
    return { valid: false, error: "JSON metadata is incomplete." };
  }
  if (hasMetadata) {
    if (payload.schema !== NETWORK_JSON_SCHEMA) {
      return { valid: false, error: "Unsupported JSON schema." };
    }
    if (payload.version !== NETWORK_JSON_VERSION) {
      return { valid: false, error: "Unsupported JSON version." };
    }
    if (!payload.network || typeof payload.network !== "object") {
      return { valid: false, error: "Missing network payload." };
    }
  }

  // accept both modern metadata payloads and legacy plain payloads
  const hasTopLevelLayers = Object.prototype.hasOwnProperty.call(payload, "layers");
  const candidate = hasMetadata ? payload.network : hasTopLevelLayers ? payload : hasNestedNetwork ? payload.network : payload;
  const layersResult = sanitizeLayers(candidate.layers);
  if (!layersResult.valid) return layersResult;

  const hasInputValues = Object.prototype.hasOwnProperty.call(candidate, "inputValues");
  const hasLegacyTopLevelInputs = !hasMetadata && candidate !== payload && Object.prototype.hasOwnProperty.call(payload, "inputValues");
  if (!hasInputValues && !hasLegacyTopLevelInputs) {
    return { valid: false, error: "Missing input values." };
  }
  const providedInputs = hasInputValues
    ? candidate.inputValues
    : hasLegacyTopLevelInputs
      ? payload.inputValues
      : null;
  const inputResult = sanitizeInputValues(providedInputs);
  if (!inputResult.valid) return inputResult;

  return {
    valid: true,
    layers: layersResult.layers,
    inputValues: inputResult.values,
  };
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
  // stop updates on the first invalid field so ui can highlight it
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
  // keep user text when it still represents the same number
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
    if (parsedPrev.valid && parsedPrev.value === canonicalValue) {
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

function cloneNeuron(neuron) {
  return { bias: neuron.bias, weights: [...neuron.weights] };
}

function zeroNeuronLike(neuron) {
  return {
    bias: 0,
    weights: neuron.weights.map(() => 0),
  };
}

export function cloneLayers(layers) {
  return layers.map((layer, idx) => {
    if (idx === 0) return { ...layer };
    return {
      ...layer,
      neurons: layer.neurons.map(cloneNeuron),
    };
  });
}

export function zeroLayersLike(templateLayers) {
  return templateLayers.map((layer, idx) => {
    if (idx === 0) return { ...layer };
    return {
      ...layer,
      neurons: layer.neurons.map(zeroNeuronLike),
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
