import { MATCH_SCORE_THRESHOLD } from "../challenges/score";

function createLinearTutorialNetwork({ weights, bias = 0, activation = "linear" }) {
  return [
    { type: "input", activation: "linear", neuronCount: 2 },
    {
      type: "output",
      activation,
      neurons: [{ bias, weights: [...weights] }],
    },
  ];
}

function createAbsoluteValueStarterNetwork() {
  return [
    { type: "input", activation: "linear", neuronCount: 2 },
    {
      type: "hidden",
      activation: "relu",
      neurons: [
        { bias: 0, weights: [1, 0] },
        { bias: 0, weights: [-1, 0] },
      ],
    },
    {
      type: "output",
      activation: "linear",
      neurons: [{ bias: 0, weights: [0, 0] }],
    },
  ];
}

export const TUTORIAL_STORAGE_KEY = "nn-builder-onboarding-v1";

export const TUTORIAL_STEPS = [
  {
    id: "weights-only",
    name: "Step 1 - Weights",
    lesson: "A neuron starts with weighted input sums.",
    formula: "f(x_1, x_2) = x_1 + x_2",
    objective: "Set w(x_1) and w(x_2) so your heatmap matches the target.",
    hint: "Try w(x_1) = 1 and w(x_2) = 1.",
    targetFn: (x1, x2) => x1 + x2,
    scoreThreshold: MATCH_SCORE_THRESHOLD,
    initialNetworkFactory: () => createLinearTutorialNetwork({ weights: [0, 0], bias: 0 }),
    initialSelection: { layerIdx: 1, neuronIdx: 0 },
    lockedSelectionLayerIdx: 1,
    networkViewPolicy: {
      showLayerCards: false,
      showActivationControls: false,
      showArchitectureControls: false,
    },
    inspectorPolicy: {
      showNameField: false,
      showInputValueSection: false,
      showBiasSection: false,
      showClearSelectionButton: false,
    },
  },
  {
    id: "bias-shift",
    name: "Step 2 - Bias",
    lesson: "Bias shifts the whole output surface up or down.",
    formula: "f(x_1, x_2) = x_1 + x_2 + 1",
    objective: "Use bias to lift the whole plane after the weights are right.",
    hint: "After w(x_1) = 1 and w(x_2) = 1, set b = 1.",
    targetFn: (x1, x2) => x1 + x2 + 1,
    scoreThreshold: MATCH_SCORE_THRESHOLD,
    initialNetworkFactory: () => createLinearTutorialNetwork({ weights: [0.9, 0.9], bias: 0 }),
    initialSelection: { layerIdx: 1, neuronIdx: 0 },
    lockedSelectionLayerIdx: 1,
    networkViewPolicy: {
      showLayerCards: false,
      showActivationControls: false,
      showArchitectureControls: false,
    },
    inspectorPolicy: {
      showNameField: false,
      showInputValueSection: false,
      showBiasSection: true,
      showClearSelectionButton: false,
    },
  },
  {
    id: "negative-weights",
    name: "Step 3 - Signs",
    lesson: "Negative weights subtract instead of add.",
    formula: "f(x_1, x_2) = x_1 - x_2",
    objective: "Use one positive and one negative weight.",
    hint: "Try w(x_1) = 1, w(x_2) = -1, and b = 0.",
    targetFn: (x1, x2) => x1 - x2,
    scoreThreshold: MATCH_SCORE_THRESHOLD,
    initialNetworkFactory: () => createLinearTutorialNetwork({ weights: [0.8, 0.8], bias: 0.2 }),
    initialSelection: { layerIdx: 1, neuronIdx: 0 },
    lockedSelectionLayerIdx: 1,
    networkViewPolicy: {
      showLayerCards: false,
      showActivationControls: false,
      showArchitectureControls: false,
    },
    inspectorPolicy: {
      showNameField: false,
      showInputValueSection: false,
      showBiasSection: true,
      showClearSelectionButton: false,
    },
  },
  {
    id: "activation",
    name: "Step 4 - Activation",
    lesson: "Activation changes the shape from linear to nonlinear.",
    formula: "f(x_1, x_2) = \\max(0, x_1)",
    objective: "Switch the output activation to ReLU.",
    hint: "Keep w(x_1) near 1, w(x_2) near 0, b near 0, and choose ReLU.",
    completionCheck: ({ layers }) => layers?.[layers.length - 1]?.activation === "relu",
    completionHint: "Choose ReLU activation to complete this step.",
    targetFn: (x1) => Math.max(0, x1),
    scoreThreshold: MATCH_SCORE_THRESHOLD,
    initialNetworkFactory: () => createLinearTutorialNetwork({ weights: [1, 0], bias: 0, activation: "linear" }),
    initialSelection: { layerIdx: 1, neuronIdx: 0 },
    lockedSelectionLayerIdx: 1,
    networkViewPolicy: {
      showLayerCards: true,
      showActivationControls: true,
      showArchitectureControls: false,
    },
    inspectorPolicy: {
      showNameField: false,
      showInputValueSection: false,
      showBiasSection: true,
      showClearSelectionButton: false,
    },
  },
  {
    id: "hidden-layer",
    name: "Step 5 - Hidden Layer",
    lesson: "Hidden neurons can build reusable features.",
    formula: "f(x_1, x_2) = \\left|x_1\\right|",
    objective: "Set the output weights so both hidden ReLU features contribute.",
    hint: "Select the output neuron and try weights [1, 1] with bias 0.",
    targetFn: (x1) => Math.abs(x1),
    scoreThreshold: MATCH_SCORE_THRESHOLD,
    initialNetworkFactory: () => createAbsoluteValueStarterNetwork(),
    initialSelection: { layerIdx: 2, neuronIdx: 0 },
    lockedSelectionLayerIdx: 2,
    networkViewPolicy: {
      showLayerCards: true,
      showActivationControls: false,
      showArchitectureControls: false,
    },
    inspectorPolicy: {
      showNameField: false,
      showInputValueSection: false,
      showBiasSection: true,
      showClearSelectionButton: false,
    },
  },
];
