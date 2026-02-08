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

function createInterpretableReluProductSolution() {
  const thresholds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const hingeCoefficients = thresholds.map((threshold) => (threshold === 0 ? 1 : 2));
  const projectionSigns = [1, -1, -1];

  const layer1Neurons = [
    { bias: 0, weights: [1, 1] },
    { bias: 0, weights: [-1, -1] },
    { bias: 0, weights: [1, 0] },
    { bias: 0, weights: [-1, 0] },
    { bias: 0, weights: [0, 1] },
    { bias: 0, weights: [0, -1] },
  ];

  const layer2Neurons = [
    { bias: 0, weights: [1, 1, 0, 0, 0, 0] },
    { bias: 0, weights: [0, 0, 1, 1, 0, 0] },
    { bias: 0, weights: [0, 0, 0, 0, 1, 1] },
  ];

  const layer3Neurons = [];
  const outputWeights = [];

  for (let sourceIdx = 0; sourceIdx < projectionSigns.length; sourceIdx++) {
    for (let i = 0; i < thresholds.length; i++) {
      const threshold = thresholds[i];
      const weights = [0, 0, 0];
      weights[sourceIdx] = 1;
      layer3Neurons.push({ bias: -threshold, weights });
      outputWeights.push(0.5 * projectionSigns[sourceIdx] * hingeCoefficients[i]);
    }
  }

  return [
    { type: "input", activation: "linear", neuronCount: 2 },
    { type: "hidden", activation: "relu", neurons: layer1Neurons },
    { type: "hidden", activation: "linear", neurons: layer2Neurons },
    { type: "hidden", activation: "relu", neurons: layer3Neurons },
    { type: "output", activation: "linear", neurons: [{ bias: 0, weights: outputWeights }] },
  ];
}

export const CHALLENGE_DEFS = [
  {
    id: "identity",
    name: "Identity",
    formula: "f(x_1, x_2) = x_1",
    difficulty: "tutorial",
    targetFn: (x1) => x1,
    solutionFactory: () => createLinearSolution([1, 0], 0, "linear"),
  },
  {
    id: "input_sum",
    name: "Input Sum",
    formula: "f(x_1, x_2) = x_1 + x_2",
    difficulty: "tutorial",
    targetFn: (x1, x2) => x1 + x2,
    solutionFactory: () => createLinearSolution([1, 1], 0, "linear"),
  },
  {
    id: "relu_ramp",
    name: "ReLU Ramp",
    formula: "f(x_1, x_2) = \\max(0, x_1)",
    difficulty: "tutorial",
    targetFn: (x1) => Math.max(0, x1),
    solutionFactory: () => createLinearSolution([1, 0], 0, "relu"),
  },
  {
    id: "tanh_curve",
    name: "Tanh Curve",
    formula: "f(x_1, x_2) = \\tanh(x_1)",
    difficulty: "tutorial",
    targetFn: (x1) => Math.tanh(x1),
    solutionFactory: () => createLinearSolution([1, 0], 0, "tanh"),
  },
  {
    id: "linear_combo",
    name: "Linear Combo",
    formula: "f(x_1, x_2) = 2x_1 - x_2 + 1",
    difficulty: "easy",
    targetFn: (x1, x2) => 2 * x1 - x2 + 1,
    solutionFactory: () => createLinearSolution([2, -1], 1, "linear"),
  },
  {
    id: "step_edge",
    name: "Step Edge",
    formula: "f(x_1, x_2) = \\begin{cases}1,&x_1 \\ge 0\\\\-1,&x_1 < 0\\end{cases}",
    difficulty: "easy",
    targetFn: (x1) => (x1 >= 0 ? 1 : -1),
    solutionFactory: () => createLinearSolution([2.8, 0], 0, "tanh"),
  },
  {
    id: "absolute_value",
    name: "Absolute Value",
    formula: "f(x_1, x_2) = \\left|x_1\\right|",
    difficulty: "medium",
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
    formula: "f(x_1, x_2) = \\max(x_1, x_2)",
    difficulty: "medium",
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
    id: "absolute_difference",
    name: "Absolute Difference",
    formula: "f(x_1, x_2) = \\left|x_1 - x_2\\right|",
    difficulty: "medium",
    targetFn: (x1, x2) => Math.abs(x1 - x2),
    solutionFactory: () =>
      createSingleHiddenSolution({
        hiddenActivation: "relu",
        hiddenNeurons: [
          { bias: 0, weights: [1, -1] },
          { bias: 0, weights: [-1, 1] },
        ],
        outputWeights: [1, 1],
        outputBias: 0,
        outputActivation: "linear",
      }),
  },
  {
    id: "roofline_lite",
    name: "Roofline Lite",
    formula: "f(x_1, x_2) = 0.25x_2 + \\max(0, x_1 + 1) - 1.2\\max(0, x_1 - 0.5)",
    difficulty: "hard",
    targetFn: (x1, x2) => 0.25 * x2 + Math.max(0, x1 + 1) - 1.2 * Math.max(0, x1 - 0.5),
    solutionFactory: () =>
      createSingleHiddenSolution({
        hiddenActivation: "relu",
        hiddenNeurons: [
          { bias: 0, weights: [0, 1] },
          { bias: 0, weights: [0, -1] },
          { bias: 1, weights: [1, 0] },
          { bias: -0.5, weights: [1, 0] },
        ],
        outputWeights: [0.25, -0.25, 1, -1.2],
        outputBias: 0,
        outputActivation: "linear",
      }),
  },
  {
    id: "tilted_notch_lite",
    name: "Tilted Notch Lite",
    formula: "f(x_1, x_2) = \\max(0, x_1 + 0.5x_2 + 1) - \\max(0, x_1 + 0.5x_2 - 1) - 0.35\\max(0, x_1 - x_2 - 1.2)",
    difficulty: "hard",
    targetFn: (x1, x2) =>
      Math.max(0, x1 + 0.5 * x2 + 1) - Math.max(0, x1 + 0.5 * x2 - 1) - 0.35 * Math.max(0, x1 - x2 - 1.2),
    solutionFactory: () =>
      createSingleHiddenSolution({
        hiddenActivation: "relu",
        hiddenNeurons: [
          { bias: 1, weights: [1, 0.5] },
          { bias: -1, weights: [1, 0.5] },
          { bias: -1.2, weights: [1, -1] },
        ],
        outputWeights: [1, -1, -0.35],
        outputBias: 0,
        outputActivation: "linear",
      }),
  },
  {
    id: "diamond_cap_lite",
    name: "Diamond Cap Lite",
    formula: "f(x_1, x_2) = \\max(0, 2 - \\left|x_1 - 1\\right| - 0.6\\left|x_2 + 0.8\\right|)",
    difficulty: "hard",
    targetFn: (x1, x2) => Math.max(0, 2 - Math.abs(x1 - 1) - 0.6 * Math.abs(x2 + 0.8)),
    solutionFactory: () =>
      createSingleHiddenSolution({
        hiddenActivation: "relu",
        hiddenNeurons: [
          { bias: -1, weights: [1, 0] },
          { bias: 1, weights: [-1, 0] },
          { bias: 0.8, weights: [0, 1] },
          { bias: -0.8, weights: [0, -1] },
        ],
        outputWeights: [-1, -1, -0.6, -0.6],
        outputBias: 2,
        outputActivation: "relu",
      }),
  },
  {
    id: "kinked_valley",
    name: "Kinked Valley",
    formula: "f(x_1, x_2) = \\left|x_1 - 1\\right| + 0.7\\left|x_2 + 1.5\\right| - 0.8\\max(0, x_1 + x_2 - 1)",
    difficulty: "insane",
    targetFn: (x1, x2) => Math.abs(x1 - 1) + 0.7 * Math.abs(x2 + 1.5) - 0.8 * Math.max(0, x1 + x2 - 1),
    solutionFactory: () =>
      createSingleHiddenSolution({
        hiddenActivation: "relu",
        hiddenNeurons: [
          { bias: -1, weights: [1, 0] },
          { bias: 1, weights: [-1, 0] },
          { bias: 1.5, weights: [0, 1] },
          { bias: -1.5, weights: [0, -1] },
          { bias: -1, weights: [1, 1] },
        ],
        outputWeights: [1, 1, 0.7, 0.7, -0.8],
        outputBias: 0,
        outputActivation: "linear",
      }),
  },
  {
    id: "offcenter_diamond_cap",
    name: "Offcenter Diamond Cap",
    formula: "f(x_1, x_2) = \\max(0, 2.2 - \\left|x_1 - 1.2\\right| - 0.6\\left|x_2 + 0.8\\right|)",
    difficulty: "insane",
    targetFn: (x1, x2) => Math.max(0, 2.2 - Math.abs(x1 - 1.2) - 0.6 * Math.abs(x2 + 0.8)),
    solutionFactory: () =>
      createSingleHiddenSolution({
        hiddenActivation: "relu",
        hiddenNeurons: [
          { bias: -1.2, weights: [1, 0] },
          { bias: 1.2, weights: [-1, 0] },
          { bias: 0.8, weights: [0, 1] },
          { bias: -0.8, weights: [0, -1] },
        ],
        outputWeights: [-1, -1, -0.6, -0.6],
        outputBias: 2.2,
        outputActivation: "relu",
      }),
  },
  {
    id: "three_axis_fold",
    name: "Three Axis Fold",
    formula:
      "f(x_1, x_2) = 0.2x_1 + \\max(0, x_1 + x_2 - 1) - 0.9\\max(0, x_1 - 1.5x_2 - 0.5) + 0.7\\max(0, -x_1 + 0.4x_2 + 1.5)",
    difficulty: "insane",
    hint: "3 hinges: one x₁ + x₂ diagonal and two opposing diagonals.",
    targetFn: (x1, x2) =>
      0.2 * x1 + Math.max(0, x1 + x2 - 1) - 0.9 * Math.max(0, x1 - 1.5 * x2 - 0.5) + 0.7 * Math.max(0, -x1 + 0.4 * x2 + 1.5),
    solutionFactory: () =>
      createSingleHiddenSolution({
        hiddenActivation: "relu",
        hiddenNeurons: [
          { bias: 6, weights: [1, 0] },
          { bias: -1, weights: [1, 1] },
          { bias: -0.5, weights: [1, -1.5] },
          { bias: 1.5, weights: [-1, 0.4] },
        ],
        outputWeights: [0.2, 1, -0.9, 0.7],
        outputBias: -1.2,
        outputActivation: "linear",
      }),
  },
  {
    id: "input_product",
    name: "Input Product",
    formula: "f(x_1, x_2) = x_1 \\cdot x_2",
    difficulty: "exploratory",
    hint: "Build |x+y|, |x|, |y|, then approximate squares with ReLU hinges.",
    targetFn: (x1, x2) => x1 * x2,
    solutionFactory: () => createInterpretableReluProductSolution(),
  },
  {
    id: "sine_wave",
    name: "Sine Wave",
    formula: "f(x_1, x_2) = \\sin(x_1)",
    difficulty: "exploratory",
    targetFn: (x1) => Math.sin(x1),
    solutionFactory: () =>
      createSingleHiddenSolution({
        hiddenActivation: "tanh",
        hiddenNeurons: [
          { bias: 0.237772, weights: [0.55563, -0.000168] },
          { bias: 0.402373, weights: [0.482088, -0.001171] },
          { bias: 0.094491, weights: [0.502461, -0.006282] },
          { bias: 0.496975, weights: [0.477786, -0.001813] },
          { bias: -0.13228, weights: [-0.186954, -0.00069] },
          { bias: 1.976553, weights: [-0.899293, -0.000095] },
          { bias: 2.881629, weights: [0.857624, 0.000543] },
          { bias: -0.513163, weights: [-0.473029, -0.00557] },
          { bias: -1.47704, weights: [-0.695062, 0.00003] },
          { bias: 0.601725, weights: [0.48149, -0.002664] },
          { bias: 3.227008, weights: [-0.944779, 0.00035] },
          { bias: -0.18877, weights: [-0.50841, -0.001528] },
        ],
        outputWeights: [
          3.095853,
          -0.719523,
          -0.111042,
          -0.534438,
          -3.259329,
          0.868952,
          -1.212044,
          0.291017,
          0.863039,
          -0.44723,
          1.142495,
          0.44544,
        ],
        outputBias: -0.149593,
        outputActivation: "linear",
      }),
  },
];
