import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import ChallengeLibrary from "./components/ChallengeLibrary";
import HeatmapPanel from "./components/HeatmapPanel";
import NetworkGraph from "./components/NetworkGraph";
import { CHALLENGE_DEFS } from "./features/challenges/challenges";
import { getScoreColor, getScoreLabel } from "./features/challenges/score";
import { computeGrid, computeMSE, computeVariance } from "./lib/heatmap";
import {
  ACT_FNS,
  DEFAULT_INPUT_VALUES,
  NETWORK_IMPORT_LIMITS,
  REVEAL_DURATION_MS,
  SOLVED_STORAGE_KEY,
  buildParameterDrafts,
  clamp,
  cloneLayers,
  computeOutput,
  createNetworkExportPayload,
  createInitialNetwork,
  forwardPassFull,
  lerpLayers,
  networkArchitectureMatches,
  networkParametersEqual,
  numericArraysEqual,
  parseNetworkImportPayload,
  parseDraftsToNetwork,
  parseRealNumber,
  reconcileParameterDrafts,
  zeroLayersLike,
} from "./lib/networkMath";
import { btnStyle, COLORS, smallBtnStyle } from "./styles/theme";

async function copyTextToClipboard(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  if (typeof document === "undefined") throw new Error("Clipboard is unavailable.");
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  if (!copied) throw new Error("Clipboard copy failed.");
}

function countNetworkWeights(layers) {
  return layers.reduce((sum, layer, layerIdx) => {
    if (layerIdx === 0) return sum;
    return sum + layer.neurons.reduce((layerSum, neuron) => layerSum + neuron.weights.length, 0);
  }, 0);
}

function buildLayersWithAddedHiddenLayer(layers) {
  const outIdx = layers.length - 1;
  const prevLayer = layers[outIdx - 1];
  const prevSize = outIdx - 1 === 0 ? layers[0].neuronCount : prevLayer.neurons.length;
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
    ...layers[outIdx],
    neurons: layers[outIdx].neurons.map((n) => ({
      ...n,
      weights: Array(newCount).fill(0),
    })),
  };
  return [...layers.slice(0, outIdx), newLayer, newOutput];
}

function buildLayersWithAddedNeuron(layers, layerIdx) {
  return layers.map((layer, i) => {
    if (i === layerIdx) {
      const prevSize = i === 1 ? layers[0].neuronCount : layers[i - 1].neurons.length;
      return {
        ...layer,
        neurons: [...layer.neurons, { bias: 0, weights: Array(prevSize).fill(0) }],
      };
    }
    if (i === layerIdx + 1) {
      return {
        ...layer,
        neurons: layer.neurons.map((n) => ({ ...n, weights: [...n.weights, 0] })),
      };
    }
    return layer;
  });
}

function buildLayersWithRemovedLayer(layers, idx) {
  const prevSize = idx === 1 ? layers[0].neuronCount : layers[idx - 1].neurons.length;
  const next = [...layers];
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
}

export default function App() {
  const [layers, setLayers] = useState(createInitialNetwork);
  const [inputValues, setInputValues] = useState(DEFAULT_INPUT_VALUES);
  const [parameterDrafts, setParameterDrafts] = useState(() => {
    const initialLayers = createInitialNetwork();
    return buildParameterDrafts(initialLayers, DEFAULT_INPUT_VALUES);
  });
  const [sel, setSel] = useState(null);

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

  const revealFrameRef = useRef(null);
  const celebrationTimeoutRef = useRef(null);
  const prevChallengeScoreRef = useRef(0);
  const layersRef = useRef(layers);
  const inputValuesRef = useRef(inputValues);
  const parameterDraftsRef = useRef(parameterDrafts);
  const importMenuRef = useRef(null);
  const exportMenuRef = useRef(null);
  const importFileInputRef = useRef(null);

  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isImportTextModalOpen, setIsImportTextModalOpen] = useState(false);
  const [importTextValue, setImportTextValue] = useState("");
  const [importTextError, setImportTextError] = useState("");
  const [validatedImport, setValidatedImport] = useState(null);

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

  useLayoutEffect(() => {
    layersRef.current = layers;
    inputValuesRef.current = inputValues;
    parameterDraftsRef.current = parameterDrafts;
  }, [layers, inputValues, parameterDrafts]);

  const activeChallenge = useMemo(
    () => challengeCatalog.find((c) => c.id === selectedChallengeId) ?? null,
    [challengeCatalog, selectedChallengeId]
  );
  const challengeComparisonActive = Boolean(activeChallenge);

  const draftValidity = useMemo(() => {
    const canonicalDrafts = buildParameterDrafts(layers, inputValues);
    const byKey = {};
    let allValid = true;
    for (const [key, canonicalText] of Object.entries(canonicalDrafts)) {
      const valid = parseRealNumber(typeof parameterDrafts[key] === "string" ? parameterDrafts[key] : canonicalText).valid;
      byKey[key] = valid;
      if (!valid) allValid = false;
    }
    return { byKey, allValid };
  }, [parameterDrafts, layers, inputValues]);

  const layerSizes = useMemo(
    () => layers.map((layer) => (layer.type === "input" ? layer.neuronCount : layer.neurons.length)),
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
    if (!activeChallenge) return 0;
    const mse = computeMSE(networkGrid.values, activeChallenge.targetGrid.values);
    const variance = activeChallenge.targetGrid.variance;
    if (variance <= 1e-12) return mse <= 1e-12 ? 100 : 0;
    const r2 = Math.max(0, 1 - mse / variance);
    return clamp(r2 * 100, 0, 100);
  }, [activeChallenge, networkGrid.values]);

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
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  useLayoutEffect(() => {
    if (isRevealingSolution) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParameterDrafts((prev) => reconcileParameterDrafts(prev, layers, inputValues));
  }, [layers, inputValues, isRevealingSolution]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify(solvedChallenges));
    } catch {
      // ignore storage write failures
    }
  }, [solvedChallenges]);

  useEffect(() => {
    if (!isImportMenuOpen && !isExportMenuOpen) return;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (importMenuRef.current?.contains(target) || exportMenuRef.current?.contains(target)) return;
      setIsImportMenuOpen(false);
      setIsExportMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isImportMenuOpen, isExportMenuOpen]);

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

  const handleSelectChallenge = (challengeId) => {
    if (isRevealingSolution || challengeId === selectedChallengeId) return;
    if (isSolutionRevealed && activeChallenge && savedAttempt && savedAttempt.challengeId === activeChallenge.id) {
      const confirmed = window.confirm(
        "Switch challenge? You'll keep the current network, but the restore controls for this challenge will be cleared."
      );
      if (!confirmed) return;
    }
    cancelRevealAnimation();
    setSelectedChallengeId(challengeId);
    setIsRevealingSolution(false);
    setSavedAttempt(null);
    setIsSolutionRevealed(false);
    setIsMatchCelebrating(false);
    prevChallengeScoreRef.current = 0;
    setSel(null);
  };

  const handleShowSolution = () => {
    if (!activeChallenge || isRevealingSolution || isSolutionRevealed) return;
    const confirmed = window.confirm("Reveal a solution? Your current weights will be saved so you can restore them while this challenge is active.");
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
    setSel(null);
  };

  const addHiddenLayer = () => {
    if (layers.length >= NETWORK_IMPORT_LIMITS.maxLayers) {
      window.alert(`Layer limit reached (${NETWORK_IMPORT_LIMITS.maxLayers}).`);
      return;
    }

    const nextLayers = buildLayersWithAddedHiddenLayer(layers);
    if (countNetworkWeights(nextLayers) > NETWORK_IMPORT_LIMITS.maxTotalWeights) {
      window.alert(`Weight limit reached (${NETWORK_IMPORT_LIMITS.maxTotalWeights}).`);
      return;
    }

    setLayers((prev) => {
      if (prev.length >= NETWORK_IMPORT_LIMITS.maxLayers) return prev;
      const withHiddenLayer = buildLayersWithAddedHiddenLayer(prev);
      if (countNetworkWeights(withHiddenLayer) > NETWORK_IMPORT_LIMITS.maxTotalWeights) return prev;
      return withHiddenLayer;
    });
    setSel(null);
  };

  const removeLayer = (idx) => {
    if (idx === 0 || idx === layers.length - 1) return;
    const nextLayers = buildLayersWithRemovedLayer(layers, idx);
    const currentWeightCount = countNetworkWeights(layers);
    const nextWeightCount = countNetworkWeights(nextLayers);
    if (nextWeightCount > NETWORK_IMPORT_LIMITS.maxTotalWeights && nextWeightCount >= currentWeightCount) {
      window.alert(`Weight limit reached (${NETWORK_IMPORT_LIMITS.maxTotalWeights}).`);
      return;
    }

    setLayers((prev) => {
      if (idx === 0 || idx === prev.length - 1) return prev;
      const withRemovedLayer = buildLayersWithRemovedLayer(prev, idx);
      const prevWeightCount = countNetworkWeights(prev);
      const nextWeightCount = countNetworkWeights(withRemovedLayer);
      if (nextWeightCount > NETWORK_IMPORT_LIMITS.maxTotalWeights && nextWeightCount >= prevWeightCount) return prev;
      return withRemovedLayer;
    });
    setSel(null);
  };

  const addNeuron = (layerIdx) => {
    if (layerIdx === 0 || layerIdx === layers.length - 1) return;
    if (layers[layerIdx].neurons.length >= NETWORK_IMPORT_LIMITS.maxNeuronsPerLayer) {
      window.alert(`Neuron limit reached (${NETWORK_IMPORT_LIMITS.maxNeuronsPerLayer}) for this layer.`);
      return;
    }

    const nextLayers = buildLayersWithAddedNeuron(layers, layerIdx);
    if (countNetworkWeights(nextLayers) > NETWORK_IMPORT_LIMITS.maxTotalWeights) {
      window.alert(`Weight limit reached (${NETWORK_IMPORT_LIMITS.maxTotalWeights}).`);
      return;
    }

    setLayers((prev) => {
      if (layerIdx <= 0 || layerIdx >= prev.length - 1) return prev;
      if (prev[layerIdx].neurons.length >= NETWORK_IMPORT_LIMITS.maxNeuronsPerLayer) return prev;
      const withNeuron = buildLayersWithAddedNeuron(prev, layerIdx);
      if (countNetworkWeights(withNeuron) > NETWORK_IMPORT_LIMITS.maxTotalWeights) return prev;
      return withNeuron;
    });
  };

  const removeNeuron = (layerIdx, neuronIdx) => {
    if (layerIdx === 0 || layerIdx === layers.length - 1) return;
    if (layers[layerIdx].neurons.length <= 1) return;
    setLayers((prev) =>
      prev.map((layer, i) => {
        if (i === layerIdx) {
          return { ...layer, neurons: layer.neurons.filter((_, j) => j !== neuronIdx) };
        }
        if (i === layerIdx + 1) {
          return {
            ...layer,
            neurons: layer.neurons.map((n) => ({
              ...n,
              weights: n.weights.filter((_, j) => j !== neuronIdx),
            })),
          };
        }
        return layer;
      })
    );
    if (sel && sel.layerIdx === layerIdx) setSel(null);
  };

  const updateParameterDraft = useCallback(
    (key, text) => {
      if (isRevealingSolution) return;
      const nextDrafts = { ...parameterDraftsRef.current, [key]: text };
      parameterDraftsRef.current = nextDrafts;
      setParameterDrafts(nextDrafts);

      const parsedState = parseDraftsToNetwork(nextDrafts, layersRef.current, inputValuesRef.current);
      if (!parsedState) return;

      if (!networkParametersEqual(layersRef.current, parsedState.layers)) {
        layersRef.current = parsedState.layers;
        setLayers(parsedState.layers);
      }
      if (!numericArraysEqual(inputValuesRef.current, parsedState.inputValues)) {
        inputValuesRef.current = parsedState.inputValues;
        setInputValues(parsedState.inputValues);
      }
    },
    [isRevealingSolution]
  );

  const setLayerActivation = (layerIdx, act) => {
    setLayers((prev) => prev.map((layer, i) => (i === layerIdx ? { ...layer, activation: act } : layer)));
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
      prev.map((layer, i) => {
        if (i === 0) return layer;
        return {
          ...layer,
          neurons: layer.neurons.map((n) => ({
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
    setInputValues(DEFAULT_INPUT_VALUES);
    setIsRevealingSolution(false);
    setIsSolutionRevealed(false);
    setRevealSolvedLockId(null);
    setSavedAttempt(null);
    setIsMatchCelebrating(false);
    prevChallengeScoreRef.current = 0;
    setSel(null);
  };

  const applyImportedNetwork = useCallback(
    (imported) => {
      cancelRevealAnimation();
      setLayers(imported.layers);
      setInputValues(imported.inputValues);
      setIsRevealingSolution(false);
      setIsSolutionRevealed(false);
      setRevealSolvedLockId(null);
      setSavedAttempt(null);
      setIsMatchCelebrating(false);
      prevChallengeScoreRef.current = 0;
      setSel(null);
    },
    [cancelRevealAnimation]
  );

  const parseImportedNetworkFromRawText = useCallback((rawText) => {
    if (typeof rawText !== "string" || rawText.trim().length === 0) {
      return { valid: false, error: "JSON text is empty." };
    }
    if (new Blob([rawText]).size > NETWORK_IMPORT_LIMITS.maxFileBytes) {
      return { valid: false, error: `JSON is too large (max ${NETWORK_IMPORT_LIMITS.maxFileBytes} bytes).` };
    }

    try {
      const parsedJson = JSON.parse(rawText);
      const imported = parseNetworkImportPayload(parsedJson);
      if (!imported.valid) return { valid: false, error: imported.error };
      return { valid: true, imported };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { valid: false, error: "Text is not valid JSON." };
      }
      return { valid: false, error: "Unable to read JSON text." };
    }
  }, []);

  const getValidatedExportNetworkJson = useCallback(() => {
    const payload = createNetworkExportPayload(layersRef.current, inputValuesRef.current);
    const validation = parseNetworkImportPayload(payload);
    if (!validation.valid) {
      return { valid: false, error: validation.error };
    }
    return { valid: true, json: JSON.stringify(payload, null, 2) };
  }, []);

  const handleExportNetworkFile = () => {
    const exportResult = getValidatedExportNetworkJson();
    if (!exportResult.valid) {
      window.alert(`Export blocked: ${exportResult.error}`);
      return;
    }
    const json = exportResult.json;
    const blob = new Blob([json], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const downloadLink = document.createElement("a");
    downloadLink.href = objectUrl;
    downloadLink.download = `nn-builder-network-${stamp}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 0);
  };

  const handleExportNetworkCopy = async () => {
    const exportResult = getValidatedExportNetworkJson();
    if (!exportResult.valid) {
      window.alert(`Export blocked: ${exportResult.error}`);
      return;
    }

    try {
      await copyTextToClipboard(exportResult.json);
      window.alert("Network JSON copied to clipboard.");
    } catch {
      window.alert("Export failed: unable to copy JSON to clipboard.");
    }
  };

  const handleImportFromFile = () => {
    setIsImportMenuOpen(false);
    importFileInputRef.current?.click();
  };

  const handleOpenImportTextModal = () => {
    setIsImportMenuOpen(false);
    setIsImportTextModalOpen(true);
    setImportTextValue("");
    setImportTextError("");
    setValidatedImport(null);
  };

  const handleValidateImportText = () => {
    const result = parseImportedNetworkFromRawText(importTextValue);
    if (!result.valid) {
      setValidatedImport(null);
      setImportTextError(result.error);
      return;
    }
    setValidatedImport(result.imported);
    setImportTextError("");
  };

  const handleConfirmImportText = () => {
    if (!validatedImport) return;
    const result = parseImportedNetworkFromRawText(importTextValue);
    if (!result.valid) {
      setValidatedImport(null);
      setImportTextError(result.error);
      return;
    }
    applyImportedNetwork(result.imported);
    setIsImportTextModalOpen(false);
    setImportTextValue("");
    setImportTextError("");
    setValidatedImport(null);
  };

  const handleImportNetworkFile = async (event) => {
    const inputElement = event.target;
    const file = inputElement.files?.[0];
    inputElement.value = "";
    if (!file) return;
    if (file.size > NETWORK_IMPORT_LIMITS.maxFileBytes) {
      window.alert("Import failed: file is too large.");
      return;
    }

    try {
      const rawText = await file.text();
      const result = parseImportedNetworkFromRawText(rawText);
      if (!result.valid) {
        window.alert(`Import failed: ${result.error}`);
        return;
      }
      const confirmed = window.confirm("Import this network JSON? Your current network will be replaced.");
      if (!confirmed) return;

      applyImportedNetwork(result.imported);
    } catch (error) {
      if (error instanceof SyntaxError) {
        window.alert("Import failed: file is not valid JSON.");
        return;
      }
      window.alert("Import failed: unable to read file.");
    }
  };

  const menuStyle = {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    zIndex: 20,
    minWidth: 120,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: 6,
    background: COLORS.panel,
    border: `1px solid ${COLORS.panelBorder}`,
    borderRadius: 8,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
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
            {layers.reduce((sum, layer, i) => sum + (i === 0 ? layer.neuronCount : layer.neurons.length), 0)} neurons
          </span>
          {activeChallenge && (
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
              {`Challenge: ${activeChallenge.name}`}
            </span>
          )}
          {!draftValidity.allValid && (
            <span
              style={{
                fontSize: 11,
                color: COLORS.negative,
                background: COLORS.negativeDim,
                border: `1px solid ${COLORS.negative}40`,
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              Invalid parameter value - updates paused
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <input
            ref={importFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportNetworkFile}
            style={{ display: "none" }}
          />
          <div ref={importMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => {
                setIsImportMenuOpen((prev) => !prev);
                setIsExportMenuOpen(false);
              }}
              style={btnStyle}
            >
              Import JSON ▾
            </button>
            {isImportMenuOpen && (
              <div style={menuStyle}>
                <button onClick={handleOpenImportTextModal} style={btnStyle}>
                  Text
                </button>
                <button onClick={handleImportFromFile} style={btnStyle}>
                  File
                </button>
              </div>
            )}
          </div>
          <div ref={exportMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => {
                setIsExportMenuOpen((prev) => !prev);
                setIsImportMenuOpen(false);
              }}
              style={btnStyle}
            >
              Export JSON ▾
            </button>
            {isExportMenuOpen && (
              <div style={menuStyle}>
                <button
                  onClick={async () => {
                    await handleExportNetworkCopy();
                    setIsExportMenuOpen(false);
                  }}
                  style={btnStyle}
                >
                  Copy
                </button>
                <button
                  onClick={() => {
                    handleExportNetworkFile();
                    setIsExportMenuOpen(false);
                  }}
                  style={btnStyle}
                >
                  File
                </button>
              </div>
            )}
          </div>
          <button onClick={randomizeAll} style={btnStyle}>
            ⟳ Randomize
          </button>
          <button onClick={resetAll} style={{ ...btnStyle, borderColor: `${COLORS.negative}60`, color: COLORS.negative }}>
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
            display: "flex",
            overflow: "hidden",
          }}
        >
          <ChallengeLibrary
            challengeCatalog={challengeCatalog}
            solvedChallenges={solvedChallenges}
            activeChallenge={activeChallenge}
            isRevealingSolution={isRevealingSolution}
            handleSelectChallenge={handleSelectChallenge}
          />
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
            {layers.map((layer, i) => {
              const isInput = i === 0;
              const isOutput = i === layers.length - 1;
              const label = isInput ? "Input (2)" : isOutput ? "Output (1)" : `Hidden ${i}`;
              const size = isInput ? layer.neuronCount : layer.neurons.length;
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
                      value={layer.activation}
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
                      {Object.entries(ACT_FNS).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {!isInput && !isOutput && (
                    <>
                      <button
                        onClick={() => removeNeuron(i, layer.neurons.length - 1)}
                        style={smallBtnStyle}
                        title="Remove neuron"
                        disabled={layer.neurons.length <= 1}
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
                        style={{ ...smallBtnStyle, color: COLORS.negative, borderColor: `${COLORS.negative}40` }}
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
                borderColor: `${COLORS.accent}40`,
              }}
            >
              + Hidden Layer
            </button>
          </div>

          <NetworkGraph
            layers={layers}
            layerSizes={layerSizes}
            activations={activations}
            preActivations={preActivations}
            sel={sel}
            setSel={setSel}
            parameterDrafts={parameterDrafts}
            inputValues={inputValues}
            draftValidityByKey={draftValidity.byKey}
            isRevealingSolution={isRevealingSolution}
            updateParameterDraft={updateParameterDraft}
          />

          <HeatmapPanel
            challengeComparisonActive={challengeComparisonActive}
            activeChallenge={activeChallenge}
            isRevealingSolution={isRevealingSolution}
            isSolutionRevealed={isSolutionRevealed}
            challengeScore={challengeScore}
            challengeScoreDisplay={challengeScoreDisplay}
            scoreLabel={scoreLabel}
            scoreColor={scoreColor}
            scoreGlow={scoreGlow}
            canRestoreAttempt={canRestoreAttempt}
            networkGrid={networkGrid}
            heatmapScale={heatmapScale}
            handleShowSolution={handleShowSolution}
            handleRestoreAttempt={handleRestoreAttempt}
            handleTryAnother={handleTryAnother}
          />
        </div>
      </div>

      {isImportTextModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(5, 8, 16, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 12,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textBright }}>Import JSON from text</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>
              Paste a network JSON payload, validate it, then confirm import.
            </div>
            <textarea
              value={importTextValue}
              onChange={(event) => {
                setImportTextValue(event.target.value);
                setImportTextError("");
                setValidatedImport(null);
              }}
              placeholder='{"schema":"nn-builder/network", ...}'
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: 230,
                resize: "vertical",
                background: COLORS.bg,
                color: COLORS.text,
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
                lineHeight: 1.5,
                outline: "none",
                fontFamily: "'DM Mono', monospace",
              }}
            />
            {importTextError && <div style={{ fontSize: 12, color: COLORS.negative }}>Validation failed: {importTextError}</div>}
            {validatedImport && (
              <div style={{ fontSize: 12, color: COLORS.success }}>
                Valid network JSON detected. You can now confirm the import.
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setIsImportTextModalOpen(false);
                  setImportTextValue("");
                  setImportTextError("");
                  setValidatedImport(null);
                }}
                style={btnStyle}
              >
                Cancel
              </button>
              <button onClick={handleValidateImportText} style={btnStyle}>
                Validate JSON
              </button>
              {validatedImport && (
                <button
                  onClick={handleConfirmImportText}
                  style={{ ...btnStyle, borderColor: `${COLORS.accent}60`, color: COLORS.accent }}
                >
                  Confirm Import
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
