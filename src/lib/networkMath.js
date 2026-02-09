export const ACT_FNS = {
  linear: { fn: (x) => x, label: "Linear", abbr: "Lin" },
  relu: { fn: (x) => Math.max(0, x), label: "ReLU", abbr: "ReLU" },
  lrelu: { fn: (x) => (x > 0 ? x : 0.01 * x), label: "Leaky ReLU", abbr: "LReLU" },
  sigmoid: { fn: (x) => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))), label: "Sigmoid", abbr: "σ" },
  tanh: { fn: (x) => Math.tanh(x), label: "Tanh", abbr: "tanh" },
  sin: { fn: (x) => Math.sin(x), label: "Sine", abbr: "sin" },
  cos: { fn: (x) => Math.cos(x), label: "Cosine", abbr: "cos" },
};

export const SOLVED_STORAGE_KEY = "nn-builder-solved-challenges-v1";
export const PARAM_SLIDERS_STORAGE_KEY = "nn-builder-param-sliders-v1";
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
const LATEX_TEXT_ESCAPE_PATTERN = /[\\{}$&#_%^~]/g;
const SIMPLE_NEURON_TEX_COMMAND_TOKEN_PATTERN = /^[A-Za-z]$/;
const SIMPLE_NEURON_TEX_SCRIPT_TOKEN_PATTERN = /^[A-Za-z0-9]$/;
const SIMPLE_NEURON_TEX_SEGMENT_BREAK_CHARS = new Set(["+", "-", "*", "/", "=", ",", "(", ")"]);
const SIMPLE_NEURON_TEX_INVALID_BASE_CHARS = new Set(["_", "^", "{", "+", "-", "*", "/", "=", ",", "("]);
const SIMPLE_NEURON_TEX_SAFE_COMMANDS = new Set([
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "varepsilon",
  "zeta",
  "eta",
  "theta",
  "vartheta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "pi",
  "varpi",
  "rho",
  "varrho",
  "sigma",
  "varsigma",
  "tau",
  "upsilon",
  "phi",
  "varphi",
  "chi",
  "psi",
  "omega",
  "Gamma",
  "Delta",
  "Theta",
  "Lambda",
  "Xi",
  "Pi",
  "Sigma",
  "Upsilon",
  "Phi",
  "Psi",
  "Omega",
]);
const LATEX_TEXT_ESCAPE_MAP = Object.freeze({
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "$": "\\$",
  "&": "\\&",
  "#": "\\#",
  "_": "\\_",
  "%": "\\%",
  "^": "\\^{}",
  "~": "\\~{}",
});

function escapeLatexText(text) {
  return text.replace(LATEX_TEXT_ESCAPE_PATTERN, (char) => LATEX_TEXT_ESCAPE_MAP[char] ?? char);
}

function hasBalancedBraces(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char !== "}") continue;
    depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function hasOnlySimpleNeuronTexChars(text) {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const codePoint = char.codePointAt(0);
    const isAsciiLetter = (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
    const isDigit = char >= "0" && char <= "9";
    if (typeof codePoint === "number" && codePoint > 0x7f) continue;
    if (isAsciiLetter || isDigit) continue;
    if (char === "_") continue;
    if (char === "^") continue;
    if (char === "{") continue;
    if (char === "}") continue;
    if (char === ",") continue;
    if (char === "(") continue;
    if (char === ")") continue;
    if (char === "+") continue;
    if (char === "-") continue;
    if (char === "*") continue;
    if (char === "/") continue;
    if (char === ".") continue;
    if (char === "=") continue;
    if (char === "'") continue;
    if (char === "\\") continue;
    if (char === " ") continue;
    return false;
  }
  return true;
}

function isSimpleNeuronScriptToken(char) {
  const codePoint = char.codePointAt(0);
  if (typeof codePoint === "number" && codePoint > 0x7f) return true;
  return SIMPLE_NEURON_TEX_SCRIPT_TOKEN_PATTERN.test(char);
}

function readSimpleNeuronTexCommand(text, startIdx) {
  let commandIdx = startIdx + 1;
  while (commandIdx < text.length && SIMPLE_NEURON_TEX_COMMAND_TOKEN_PATTERN.test(text[commandIdx])) {
    commandIdx += 1;
  }
  if (commandIdx === startIdx + 1) return null;
  return {
    name: text.slice(startIdx + 1, commandIdx),
    nextIdx: commandIdx,
  };
}

function isSimpleNeuronTex(text) {
  if (!text || !hasOnlySimpleNeuronTexChars(text)) return false;
  if (!hasBalancedBraces(text)) return false;

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "\\") continue;
    const command = readSimpleNeuronTexCommand(text, i);
    if (!command) return false;
    if (!SIMPLE_NEURON_TEX_SAFE_COMMANDS.has(command.name)) return false;
    i = command.nextIdx - 1;
  }

  let groupDepth = 0;
  let seenSubInSegment = false;
  let seenSupInSegment = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "{") {
      groupDepth += 1;
      continue;
    }
    if (char === "}") {
      groupDepth -= 1;
      continue;
    }
    if (groupDepth > 0) continue;
    if (char === " " || SIMPLE_NEURON_TEX_SEGMENT_BREAK_CHARS.has(char)) {
      seenSubInSegment = false;
      seenSupInSegment = false;
      continue;
    }
    if (char === "_") {
      if (seenSubInSegment) return false;
      seenSubInSegment = true;
      continue;
    }
    if (char === "^") {
      if (seenSupInSegment) return false;
      seenSupInSegment = true;
      continue;
    }
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char !== "_" && char !== "^") continue;

    let prevIdx = i - 1;
    while (prevIdx >= 0 && text[prevIdx] === " ") prevIdx -= 1;
    if (prevIdx < 0) return false;
    if (SIMPLE_NEURON_TEX_INVALID_BASE_CHARS.has(text[prevIdx])) return false;

    let nextIdx = i + 1;
    while (nextIdx < text.length && text[nextIdx] === " ") nextIdx += 1;
    if (nextIdx >= text.length) return false;

    const nextChar = text[nextIdx];
    if (nextChar === "{") {
      let depth = 1;
      let contentLength = 0;
      nextIdx += 1;
      while (nextIdx < text.length && depth > 0) {
        const groupChar = text[nextIdx];
        if (groupChar === "{") {
          depth += 1;
        } else if (groupChar === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
        if (depth > 0) contentLength += 1;
        nextIdx += 1;
      }
      if (depth !== 0 || contentLength === 0) return false;
      i = nextIdx;
      continue;
    }

    if (nextChar === "\\") {
      const command = readSimpleNeuronTexCommand(text, nextIdx);
      if (!command) return false;
      if (!SIMPLE_NEURON_TEX_SAFE_COMMANDS.has(command.name)) return false;
      i = command.nextIdx - 1;
      continue;
    }

    if (!isSimpleNeuronScriptToken(nextChar)) return false;
    i = nextIdx;
  }

  return true;
}

function normalizeNeuronTex(text) {
  const hasSubOrSup = text.includes("_") || text.includes("^");
  if (hasSubOrSup && isSimpleNeuronTex(text)) return text;
  return `\\text{${escapeLatexText(text)}}`;
}

export function normalizeNeuronName(rawName) {
  if (typeof rawName !== "string") return "";
  return rawName.trim();
}

function normalizeOptionalNeuronName(rawName, error) {
  if (rawName === undefined) return { valid: true, name: "" };
  if (typeof rawName !== "string") return { valid: false, error };
  return { valid: true, name: normalizeNeuronName(rawName) };
}

function sanitizeInputNeuronNames(rawNames) {
  if (rawNames === undefined) {
    return {
      valid: true,
      names: Array(DEFAULT_INPUT_VALUES.length).fill(""),
    };
  }

  if (!Array.isArray(rawNames) || rawNames.length !== DEFAULT_INPUT_VALUES.length) {
    return {
      valid: false,
      error: `Input layer names must contain exactly ${DEFAULT_INPUT_VALUES.length} values.`,
    };
  }

  const normalizedNames = [];
  for (let inputIdx = 0; inputIdx < rawNames.length; inputIdx++) {
    const nameResult = normalizeOptionalNeuronName(rawNames[inputIdx], `Input neuron ${inputIdx} has an invalid name.`);
    if (!nameResult.valid) return nameResult;
    normalizedNames.push(nameResult.name);
  }

  return { valid: true, names: normalizedNames };
}

export function getDefaultNeuronName(layerIdx, neuronIdx, layerCount) {
  if (layerIdx === 0) return `x_${neuronIdx + 1}`;
  if (layerIdx === layerCount - 1) return "f(x_1, x_2)";
  return `h_{${layerIdx},${neuronIdx + 1}}`;
}

export function getNeuronCustomName(layers, layerIdx, neuronIdx) {
  const layer = layers?.[layerIdx];
  if (!layer) return "";
  if (layerIdx === 0) return normalizeNeuronName(layer.neuronNames?.[neuronIdx]);
  return normalizeNeuronName(layer.neurons?.[neuronIdx]?.name);
}

export function getNeuronName(layers, layerIdx, neuronIdx) {
  const customName = getNeuronCustomName(layers, layerIdx, neuronIdx);
  if (customName) return customName;
  const layerCount = Array.isArray(layers) && layers.length > 0 ? layers.length : layerIdx + 1;
  return getDefaultNeuronName(layerIdx, neuronIdx, layerCount);
}

export function getNeuronTex(layers, layerIdx, neuronIdx) {
  const customName = getNeuronCustomName(layers, layerIdx, neuronIdx);
  if (customName) return normalizeNeuronTex(customName);
  const layerCount = Array.isArray(layers) && layers.length > 0 ? layers.length : layerIdx + 1;
  return getDefaultNeuronName(layerIdx, neuronIdx, layerCount);
}

const EQUATION_ZERO_EPSILON = 1e-12;
const EQUATION_UNIT_COEFFICIENT_EPSILON = 1e-9;
const EQUATION_SOURCE_GROUPING_PATTERN = /[+\-*/=]/;
const EQUATION_NUMERIC_LEADING_PATTERN = /^[0-9.]/;
const NETWORK_EQUATION_MAX_CHARS = 200_000;
const NETWORK_EQUATION_TOO_LARGE_ERROR = "Network equation is too large to export.";

function enforceEquationLengthLimit(text, maxChars) {
  if (typeof maxChars !== "number") return text;
  if (text.length > maxChars) throw new Error(NETWORK_EQUATION_TOO_LARGE_ERROR);
  return text;
}

function joinEquationParts(parts, separator, maxChars) {
  if (parts.length === 0) return "";
  if (typeof maxChars !== "number") return parts.join(separator);

  let totalLength = 0;
  for (let idx = 0; idx < parts.length; idx++) {
    totalLength += parts[idx].length;
    if (idx > 0) totalLength += separator.length;
    if (totalLength > maxChars) throw new Error(NETWORK_EQUATION_TOO_LARGE_ERROR);
  }

  return parts.join(separator);
}

function formatEquationLatexNumber(value) {
  if (!Number.isFinite(value)) return "0";
  const normalized = Math.abs(value) < EQUATION_ZERO_EPSILON ? 0 : value;
  const magnitude = Math.abs(normalized);
  if (magnitude !== 0 && (magnitude >= 1000 || magnitude < 0.001)) {
    const [mantissa, exponent] = normalized.toExponential(2).split("e");
    return `${Number(mantissa)}\\,10^{${Number(exponent)}}`;
  }
  return String(Number(normalized.toFixed(3)));
}

function wrapEquationActivationTex(activationKey, affineTex) {
  switch (activationKey) {
    case "relu":
      return `\\operatorname{ReLU}\\left(${affineTex}\\right)`;
    case "lrelu":
      return `\\operatorname{LeakyReLU}\\left(${affineTex}\\right)`;
    case "sigmoid":
      return `\\sigma\\left(${affineTex}\\right)`;
    case "tanh":
      return `\\tanh\\left(${affineTex}\\right)`;
    case "sin":
      return `\\sin\\left(${affineTex}\\right)`;
    case "cos":
      return `\\cos\\left(${affineTex}\\right)`;
    case "linear":
    default:
      return affineTex;
  }
}

export function buildNeuronActivationTex(activationKey, bias, weights, sourceTerms, maxChars = null) {
  const safeWeights = Array.isArray(weights) ? weights : [];
  const safeSourceTerms = Array.isArray(sourceTerms) ? sourceTerms : [];
  const weightedTerms = [];

  for (let weightIdx = 0; weightIdx < safeWeights.length; weightIdx++) {
    const rawWeight = safeWeights[weightIdx];
    const weightValue = Number.isFinite(rawWeight) ? rawWeight : 0;
    if (Math.abs(weightValue) <= EQUATION_ZERO_EPSILON) continue;

    const rawSourceTex = safeSourceTerms[weightIdx];
    const sourceTex = typeof rawSourceTex === "string" && rawSourceTex.length > 0 ? rawSourceTex : "0";
    const absWeight = Math.abs(weightValue);
    const coefficientTex =
      Math.abs(absWeight - 1) < EQUATION_UNIT_COEFFICIENT_EPSILON ? "" : formatEquationLatexNumber(absWeight);
    const sourceNeedsGrouping =
      EQUATION_SOURCE_GROUPING_PATTERN.test(sourceTex)
      || (coefficientTex.length > 0 && EQUATION_NUMERIC_LEADING_PATTERN.test(sourceTex));
    const sourceFactorTex = sourceNeedsGrouping ? `\\left(${sourceTex}\\right)` : sourceTex;
    const termTex = enforceEquationLengthLimit(`${coefficientTex}${sourceFactorTex}`, maxChars);
    weightedTerms.push({
      isNegative: weightValue < 0,
      tex: termTex,
    });
  }

  const affineTerms = weightedTerms.map((term, idx) => {
    if (idx === 0) return term.isNegative ? `-${term.tex}` : term.tex;
    return `${term.isNegative ? "-" : "+"} ${term.tex}`;
  });

  const biasValue = Number.isFinite(bias) ? bias : 0;
  if (Math.abs(biasValue) > EQUATION_ZERO_EPSILON) {
    const biasTerm = formatEquationLatexNumber(Math.abs(biasValue));
    if (affineTerms.length === 0) {
      affineTerms.push(biasValue < 0 ? `-${biasTerm}` : biasTerm);
    } else {
      affineTerms.push(`${biasValue < 0 ? "-" : "+"} ${biasTerm}`);
    }
  }

  const affineTex = affineTerms.length > 0 ? joinEquationParts(affineTerms, " ", maxChars) : "0";
  return enforceEquationLengthLimit(wrapEquationActivationTex(activationKey, affineTex), maxChars);
}

export function buildNeuronEquationTex(targetTex, activationKey, bias, weights, sourceTerms, maxChars = null) {
  return enforceEquationLengthLimit(
    `${targetTex} = ${buildNeuronActivationTex(activationKey, bias, weights, sourceTerms, maxChars)}`,
    maxChars
  );
}

export function buildNetworkEquationTex(layers, maxChars = NETWORK_EQUATION_MAX_CHARS) {
  if (!Array.isArray(layers) || layers.length < 2) return "";
  const outputLayerIdx = layers.length - 1;
  const outputLayer = layers[outputLayerIdx];
  if (!outputLayer?.neurons?.[0]) return "";

  const expressionCache = layers.map((layer, layerIdx) => {
    if (layerIdx === 0) {
      const inputCount = layer?.neuronCount ?? DEFAULT_INPUT_VALUES.length;
      return Array.from({ length: inputCount }, (_, neuronIdx) => getNeuronTex(layers, 0, neuronIdx));
    }
    const neuronCount = Array.isArray(layer?.neurons) ? layer.neurons.length : 0;
    return Array.from({ length: neuronCount }, () => null);
  });

  const buildNeuronExpressionTex = (layerIdx, neuronIdx) => {
    if (layerIdx <= 0) return enforceEquationLengthLimit(getNeuronTex(layers, 0, neuronIdx), maxChars);

    const cachedTex = expressionCache[layerIdx]?.[neuronIdx];
    if (cachedTex !== null && cachedTex !== undefined) return cachedTex;

    const layer = layers[layerIdx];
    const neuron = layer?.neurons?.[neuronIdx];
    if (!layer || !neuron) return "0";

    const sourceTerms = neuron.weights.map((_, weightIdx) => buildNeuronExpressionTex(layerIdx - 1, weightIdx));
    const expressionTex = buildNeuronActivationTex(layer.activation, neuron.bias, neuron.weights, sourceTerms, maxChars);
    if (expressionCache[layerIdx]) expressionCache[layerIdx][neuronIdx] = expressionTex;
    return expressionTex;
  };

  const outputTex = enforceEquationLengthLimit(getNeuronTex(layers, outputLayerIdx, 0), maxChars);
  const outputExpressionTex = buildNeuronExpressionTex(outputLayerIdx, 0);
  return enforceEquationLengthLimit(`${outputTex} = ${outputExpressionTex}`, maxChars);
}

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
  const inputNameResult = sanitizeInputNeuronNames(inputLayer.neuronNames);
  if (!inputNameResult.valid) return inputNameResult;
  const normalizedInputLayer = {
    type: "input",
    activation: "linear",
    neuronCount: DEFAULT_INPUT_VALUES.length,
  };
  if (inputNameResult.names.some(Boolean)) {
    normalizedInputLayer.neuronNames = inputNameResult.names;
  }
  nextLayers.push(normalizedInputLayer);

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
      const nameResult = normalizeOptionalNeuronName(
        neuron.name,
        `Layer ${layerIdx}, neuron ${neuronIdx} has an invalid name.`
      );
      if (!nameResult.valid) return nameResult;
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
      const nextNeuron = {
        bias: neuron.bias,
        weights: [...neuron.weights],
      };
      if (nameResult.name) nextNeuron.name = nameResult.name;
      nextNeurons.push(nextNeuron);
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

  const nextInputLayer = { ...layers[0] };
  if (Array.isArray(layers[0].neuronNames)) {
    nextInputLayer.neuronNames = [...layers[0].neuronNames];
  }
  const nextLayers = [nextInputLayer];
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
      const nextNeuron = {
        bias: parsedBias.value,
        weights: nextWeights,
      };
      const name = normalizeNeuronName(neuron.name);
      if (name) nextNeuron.name = name;
      nextNeurons.push(nextNeuron);
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
  const nextNeuron = { bias: neuron.bias, weights: [...neuron.weights] };
  const name = normalizeNeuronName(neuron.name);
  if (name) nextNeuron.name = name;
  return nextNeuron;
}

function zeroNeuronLike(neuron) {
  const nextNeuron = {
    bias: 0,
    weights: neuron.weights.map(() => 0),
  };
  const name = normalizeNeuronName(neuron.name);
  if (name) nextNeuron.name = name;
  return nextNeuron;
}

function cloneInputLayer(layer) {
  const nextLayer = { ...layer };
  if (Array.isArray(layer.neuronNames)) {
    nextLayer.neuronNames = [...layer.neuronNames];
  }
  return nextLayer;
}

export function cloneLayers(layers) {
  return layers.map((layer, idx) => {
    if (idx === 0) return cloneInputLayer(layer);
    return {
      ...layer,
      neurons: layer.neurons.map(cloneNeuron),
    };
  });
}

export function zeroLayersLike(templateLayers) {
  return templateLayers.map((layer, idx) => {
    if (idx === 0) return cloneInputLayer(layer);
    return {
      ...layer,
      neurons: layer.neurons.map(zeroNeuronLike),
    };
  });
}

export function mergeNeuronNames(primaryLayers, fallbackLayers) {
  const mergedLayers = cloneLayers(primaryLayers);
  if (mergedLayers.length === 0) return mergedLayers;

  const fallbackInputLayer = Array.isArray(fallbackLayers) ? fallbackLayers[0] : null;
  const fallbackOutputLayer = Array.isArray(fallbackLayers) ? fallbackLayers[fallbackLayers.length - 1] : null;

  const mergedInputLayer = mergedLayers[0];
  const mergedInputNames = Array.from({ length: mergedInputLayer.neuronCount }, (_, neuronIdx) => {
    const primaryName = normalizeNeuronName(mergedInputLayer.neuronNames?.[neuronIdx]);
    if (primaryName) return primaryName;
    return normalizeNeuronName(fallbackInputLayer?.neuronNames?.[neuronIdx]);
  });
  if (mergedInputNames.some(Boolean)) {
    mergedInputLayer.neuronNames = mergedInputNames;
  } else {
    delete mergedInputLayer.neuronNames;
  }

  const mergedOutputLayer = mergedLayers[mergedLayers.length - 1];
  for (let neuronIdx = 0; neuronIdx < mergedOutputLayer.neurons.length; neuronIdx++) {
    const mergedNeuron = mergedOutputLayer.neurons[neuronIdx];
    const fallbackNeuron = fallbackOutputLayer?.neurons?.[neuronIdx];
    const name = normalizeNeuronName(mergedNeuron.name) || normalizeNeuronName(fallbackNeuron?.name);
    if (name) {
      mergedNeuron.name = name;
    } else {
      delete mergedNeuron.name;
    }
  }

  const mergedHiddenLayers = mergedLayers.slice(1, -1);
  const fallbackHiddenLayers = Array.isArray(fallbackLayers) ? fallbackLayers.slice(1, -1) : [];

  for (let hiddenIdx = 0; hiddenIdx < mergedHiddenLayers.length; hiddenIdx++) {
    const mergedHiddenLayer = mergedHiddenLayers[hiddenIdx];
    const fallbackHiddenLayer = fallbackHiddenLayers[hiddenIdx] ?? null;
    const canMapLayerNames = mergedHiddenLayer.neurons.length === (fallbackHiddenLayer?.neurons?.length ?? -1);
    for (let neuronIdx = 0; neuronIdx < mergedHiddenLayer.neurons.length; neuronIdx++) {
      const mergedNeuron = mergedHiddenLayer.neurons[neuronIdx];
      const fallbackNeuron = canMapLayerNames ? fallbackHiddenLayer?.neurons?.[neuronIdx] : null;
      const name = normalizeNeuronName(mergedNeuron.name) || normalizeNeuronName(fallbackNeuron?.name);
      if (name) {
        mergedNeuron.name = name;
      } else {
        delete mergedNeuron.name;
      }
    }
  }

  return mergedLayers;
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
    if (layerIdx === 0) return cloneInputLayer(layer);
    const startLayer = startLayers[layerIdx];
    return {
      ...layer,
      neurons: layer.neurons.map((n, neuronIdx) => {
        const startNeuron = startLayer?.neurons?.[neuronIdx];
        const sb = startNeuron?.bias ?? 0;
        const nextNeuron = {
          bias: lerp(sb, n.bias, t),
          weights: n.weights.map((w, wi) => {
            const sw = startNeuron?.weights?.[wi] ?? 0;
            return lerp(sw, w, t);
          }),
        };
        const name = normalizeNeuronName(n.name);
        if (name) nextNeuron.name = name;
        return nextNeuron;
      }),
    };
  });
}
