const NEW_HIDDEN_LAYER_SIZE = 3;

function getPreviousLayerSize(layers, layerIdx) {
  return layerIdx === 1 ? layers[0].neuronCount : layers[layerIdx - 1].neurons.length;
}

function createZeroNeuron(inputCount) {
  return { bias: 0, weights: Array(inputCount).fill(0) };
}

// count mutable parameters so edits stay inside import limits
export function countNetworkWeights(layers) {
  return layers.reduce((sum, layer, layerIdx) => {
    if (layerIdx === 0) return sum;
    return sum + layer.neurons.reduce((layerSum, neuron) => layerSum + neuron.weights.length, 0);
  }, 0);
}

// insert a relu hidden layer before the output layer
export function buildLayersWithAddedHiddenLayer(layers) {
  const outputLayerIndex = layers.length - 1;
  const hiddenInputSize = getPreviousLayerSize(layers, outputLayerIndex);
  const newHiddenLayer = {
    type: "hidden",
    activation: "relu",
    neurons: Array.from({ length: NEW_HIDDEN_LAYER_SIZE }, () => createZeroNeuron(hiddenInputSize)),
  };
  const nextOutputLayer = {
    ...layers[outputLayerIndex],
    neurons: layers[outputLayerIndex].neurons.map((neuron) => ({
      ...neuron,
      weights: Array(NEW_HIDDEN_LAYER_SIZE).fill(0),
    })),
  };
  return [...layers.slice(0, outputLayerIndex), newHiddenLayer, nextOutputLayer];
}

// add one neuron to a hidden layer and one matching weight in the next layer
export function buildLayersWithAddedNeuron(layers, layerIdx) {
  return layers.map((layer, index) => {
    if (index === layerIdx) {
      const prevSize = getPreviousLayerSize(layers, index);
      return {
        ...layer,
        neurons: [...layer.neurons, createZeroNeuron(prevSize)],
      };
    }
    if (index === layerIdx + 1) {
      return {
        ...layer,
        neurons: layer.neurons.map((neuron) => ({ ...neuron, weights: [...neuron.weights, 0] })),
      };
    }
    return layer;
  });
}

// remove a hidden layer and reset incoming weights for the next layer
export function buildLayersWithRemovedLayer(layers, layerIdx) {
  const nextLayers = [...layers];
  nextLayers.splice(layerIdx, 1);

  if (layerIdx < nextLayers.length) {
    const prevSize = getPreviousLayerSize(layers, layerIdx);
    nextLayers[layerIdx] = {
      ...nextLayers[layerIdx],
      neurons: nextLayers[layerIdx].neurons.map((neuron) => ({
        ...neuron,
        weights: Array(prevSize).fill(0),
      })),
    };
  }

  return nextLayers;
}

// remove a neuron and trim the matching weight from the next layer
export function buildLayersWithRemovedNeuron(layers, layerIdx, neuronIdx) {
  return layers.map((layer, index) => {
    if (index === layerIdx) {
      return {
        ...layer,
        neurons: layer.neurons.filter((_, idx) => idx !== neuronIdx),
      };
    }
    if (index === layerIdx + 1) {
      return {
        ...layer,
        neurons: layer.neurons.map((neuron) => ({
          ...neuron,
          weights: neuron.weights.filter((_, idx) => idx !== neuronIdx),
        })),
      };
    }
    return layer;
  });
}
