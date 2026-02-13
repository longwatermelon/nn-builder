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

const SCALAR_MUL_PRODUCT_SOLUTION_LAYERS = [
  {
    type: "input",
    activation: "linear",
    neuronCount: 2,
  },
  {
    type: "hidden",
    activation: "relu",
    neurons: [
      {
        bias: 0,
        weights: [1, 1],
        name: "relu(s)",
      },
      {
        bias: 0,
        weights: [1, 0],
        name: "relu(x)",
      },
      {
        bias: 0,
        weights: [0, 1],
        name: "relu(y)",
      },
      {
        bias: 0,
        weights: [-1, -1],
        name: "relu(-s)",
      },
      {
        bias: 0,
        weights: [-1, 0],
        name: "relu(-x)",
      },
      {
        bias: 0,
        weights: [0, -1],
        name: "relu(-y)",
      },
    ],
  },
  {
    type: "hidden",
    activation: "linear",
    neurons: [
      {
        bias: 0,
        weights: [1, 0, 0, 1, 0, 0],
        name: "|s|",
      },
      {
        bias: 0,
        weights: [0, 1, 0, 0, 1, 0],
        name: "|x|",
      },
      {
        bias: 0,
        weights: [0, 0, 1, 0, 0, 1],
        name: "|y|",
      },
    ],
  },
  {
    type: "hidden",
    activation: "relu",
    neurons: [
      {
        bias: 0,
        weights: [1, 0, 0],
        name: "f(|s|)",
      },
      {
        bias: -1,
        weights: [1, 0, 0],
        name: "f(|s|-1)",
      },
      {
        bias: -5,
        weights: [5, 0, 0],
        name: "g(|s|-1)",
      },
      {
        bias: -25,
        weights: [5, 0, 0],
        name: "g(|s|-5)",
      },
      {
        bias: -70,
        weights: [14, 0, 0],
        name: "h(|s|-5)",
      },
      {
        bias: 0,
        weights: [0, 1, 0],
        name: "f(|x|)",
      },
      {
        bias: -1,
        weights: [0, 1, 0],
        name: "f(|x|-1)",
      },
      {
        bias: -5,
        weights: [0, 5, 0],
        name: "g(|x|-1)",
      },
      {
        bias: -25,
        weights: [0, 5, 0],
        name: "g(|x|-5)",
      },
      {
        bias: -70,
        weights: [0, 14, 0],
        name: "h(|x|-5)",
      },
      {
        bias: 0,
        weights: [0, 0, 1],
        name: "f(|y|)",
      },
      {
        bias: -1,
        weights: [0, 0, 1],
        name: "f(|y|-1)",
      },
      {
        bias: -5,
        weights: [0, 0, 5],
        name: "g(|y|-1)",
      },
      {
        bias: -25,
        weights: [0, 0, 5],
        name: "g(|y|-5)",
      },
      {
        bias: -70,
        weights: [0, 0, 14],
        name: "h(|y|-5)",
      },
    ],
  },
  {
    type: "hidden",
    activation: "linear",
    neurons: [
      {
        bias: 0,
        weights: [1, -1, 1, -1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        name: "p(|s|)",
      },
      {
        bias: 0,
        weights: [0, 0, 0, 0, 0, 1, -1, 1, -1, 1, 0, 0, 0, 0, 0],
        name: "p(|x|)",
      },
      {
        bias: 0,
        weights: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, -1, 1, -1, 1],
        name: "p(|y|)",
      },
    ],
  },
  {
    type: "output",
    activation: "linear",
    neurons: [
      {
        bias: 0,
        weights: [0.5, -0.5, -0.5],
      },
    ],
  },
];

function createScalarMulProductSolution() {
  return SCALAR_MUL_PRODUCT_SOLUTION_LAYERS.map((layer) => {
    if (layer.type === "input") {
      return {
        type: layer.type,
        activation: layer.activation,
        neuronCount: layer.neuronCount,
      };
    }

    return {
      type: layer.type,
      activation: layer.activation,
      neurons: layer.neurons.map((neuron) => {
        const clonedNeuron = {
          bias: neuron.bias,
          weights: [...neuron.weights],
        };

        if (typeof neuron.name === "string") {
          clonedNeuron.name = neuron.name;
        }

        return clonedNeuron;
      }),
    };
  });
}

function createNestedTrigStackSolution() {
  const relayEps = 0.02;
  const argRelayScale = 0.07;
  const sinRelayScale = 0.1;
  const cosRelayScale = 0.3;

  return [
    { type: "input", activation: "linear", neuronCount: 2 },
    {
      type: "hidden",
      activation: "linear",
      neurons: [
        { bias: 0, weights: [1, 0], name: "x" },
        { bias: 0, weights: [2, 0], name: "2x" },
        { bias: 0, weights: [3, 0], name: "3x" },
      ],
    },
    {
      type: "hidden",
      activation: "sin",
      neurons: [
        { bias: 0, weights: [1, 0, 0], name: "sin(x)" },
        { bias: 0, weights: [0, 1, 0], name: "sin(2x)" },
        { bias: 0, weights: [0, 0, 1], name: "sin(3x)" },
        { bias: Math.PI / 2, weights: [1, 0, 0], name: "cos(x) via phase" },
        { bias: 0, weights: [relayEps, 0, 0], name: "relay(x)" },
      ],
    },
    {
      type: "hidden",
      activation: "linear",
      neurons: [
        { bias: 0, weights: [0, 1, 0, 1, 0], name: "sin(2x) + cos(x)" },
        { bias: 0, weights: [0, 0, 1, 1, 0], name: "sin(3x) + cos(x)" },
        { bias: 0, weights: [1, 0, 0, 0, 0], name: "sin(x)" },
        { bias: 0, weights: [0, 0, 0, 0, 1 / relayEps], name: "x~" },
      ],
    },
    {
      type: "hidden",
      activation: "sin",
      neurons: [
        { bias: 0, weights: [1, 0, 0, 0], name: "sin(sin(2x) + cos(x))" },
        { bias: 0, weights: [0, argRelayScale, 0, 0], name: "relay(sin(3x) + cos(x))" },
        { bias: 0, weights: [0, 0, sinRelayScale, 0], name: "relay(sin(x))" },
        { bias: 0, weights: [0, 0, 0, relayEps], name: "relay(x)" },
      ],
    },
    {
      type: "hidden",
      activation: "cos",
      neurons: [
        { bias: 0, weights: [1, 0, 0, 0], name: "cos(sin(...))" },
        { bias: 0, weights: [0, 1 / argRelayScale, 0, 0], name: "cos(sin(3x) + cos(x))" },
        { bias: -Math.PI / 2, weights: [0, 0, cosRelayScale, 0], name: "relay(sin(x))" },
        { bias: -Math.PI / 2, weights: [0, 0, 0, 1], name: "relay(x)" },
      ],
    },
    {
      type: "output",
      activation: "linear",
      neurons: [
        {
          bias: -1,
          weights: [1, 3, -1 / (sinRelayScale * cosRelayScale), -0.5 / relayEps],
        },
      ],
    },
  ];
}

export const CHALLENGE_DEFS = [
  // tutorial and easy challenges teach core primitives first
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
    id: "three_axis_fold",
    name: "Three Axis Fold",
    formula:
      "f(x_1, x_2) = 0.2x_1 + \\max(0, x_1 + x_2 - 1) - 0.9\\max(0, x_1 - 1.5x_2 - 0.5) + 0.7\\max(0, -x_1 + 0.4x_2 + 1.5)",
    difficulty: "medium",
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
    id: "max_two_inputs",
    name: "Max Of Two",
    formula: "f(x_1, x_2) = \\max(x_1, x_2)",
    difficulty: "hard",
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
    id: "offcenter_diamond_cap",
    name: "Offcenter Diamond Cap",
    formula: "f(x_1, x_2) = \\max(0, 2.2 - \\left|x_1 - 1.2\\right| - 0.6\\left|x_2 + 0.8\\right|)",
    difficulty: "hard",
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
    id: "input_product",
    name: "Input Product",
    formula: "f(x_1, x_2) = x_1 \\cdot x_2",
    difficulty: "insane",
    hint: "Build |x+y|, |x|, |y|, then approximate squares with ReLU hinges.",
    targetFn: (x1, x2) => x1 * x2,
    solutionFactory: () => createScalarMulProductSolution(),
  },
  {
    id: "nested_trig_stack",
    name: "Nested Trig Stack",
    formula:
      "f(x_1, x_2) = \\cos\\left(\\sin\\left(\\sin\\left(2x_1\\right) + \\cos\\left(x_1\\right)\\right)\\right) + 3\\cos\\left(\\sin\\left(3x_1\\right) + \\cos\\left(x_1\\right)\\right) - \\sin\\left(x_1\\right) - 0.5x_1 - 1",
    difficulty: "insane",
    hint: "Carry x and sin(x) with tiny-angle relays while composing trig features.",
    targetFn: (x1) =>
      Math.cos(Math.sin(Math.sin(2 * x1) + Math.cos(x1)))
      + 3 * Math.cos(Math.sin(3 * x1) + Math.cos(x1))
      - Math.sin(x1)
      - 0.5 * x1
      - 1,
    solutionFactory: () => createNestedTrigStackSolution(),
  },
];
