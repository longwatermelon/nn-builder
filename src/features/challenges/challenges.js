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

export const CHALLENGE_DEFS = [
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
