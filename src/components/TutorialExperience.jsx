import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getScoreColor, getScoreLabel, MATCH_SCORE_THRESHOLD } from "../features/challenges/score";
import { TUTORIAL_STEPS } from "../features/tutorial/steps";
import { computeGrid, computeMSE, computeVariance, drawHeatmap } from "../lib/heatmap";
import {
  DEFAULT_INPUT_VALUES,
  buildParameterDrafts,
  clamp,
  computeOutput,
  forwardPassFull,
  networkParametersEqual,
  numericArraysEqual,
  parseDraftsToNetwork,
  parseRealNumber,
  reconcileParameterDrafts,
} from "../lib/networkMath";
import { btnStyle, COLORS, subtleBtnStyle } from "../styles/theme";
import MathText from "./MathText";
import NetworkView from "./NetworkView";

function clampStepIndex(value) {
  if (!Number.isInteger(value)) return 0;
  return Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, value));
}

function createStepRuntimeState(step) {
  const nextLayers = step.initialNetworkFactory();
  const nextInputValues = Array.isArray(step.initialInputValues)
    ? [...step.initialInputValues]
    : [...DEFAULT_INPUT_VALUES];
  return {
    layers: nextLayers,
    inputValues: nextInputValues,
    parameterDrafts: buildParameterDrafts(nextLayers, nextInputValues),
    sel: step.initialSelection
      ? { ...step.initialSelection }
      : {
        layerIdx: nextLayers.length - 1,
        neuronIdx: 0,
      },
  };
}

export default function TutorialExperience({
  initialStepIndex = 0,
  onStepIndexChange,
  onExitTutorial,
  onCompleteTutorial,
}) {
  const clampedInitialStepIndex = clampStepIndex(initialStepIndex);
  const initialRuntimeState = useMemo(
    () => createStepRuntimeState(TUTORIAL_STEPS[clampedInitialStepIndex]),
    [clampedInitialStepIndex]
  );

  const [stepIndex, setStepIndex] = useState(clampedInitialStepIndex);
  const [layers, setLayers] = useState(initialRuntimeState.layers);
  const [inputValues, setInputValues] = useState(initialRuntimeState.inputValues);
  const [parameterDrafts, setParameterDrafts] = useState(initialRuntimeState.parameterDrafts);
  const [sel, setSel] = useState(initialRuntimeState.sel);
  const [showHint, setShowHint] = useState(false);

  const userCanvasRef = useRef(null);
  const targetCanvasRef = useRef(null);
  const layersRef = useRef(layers);
  const inputValuesRef = useRef(inputValues);
  const parameterDraftsRef = useRef(parameterDrafts);

  const activeStep = TUTORIAL_STEPS[stepIndex];
  const layerSizes = useMemo(
    () => layers.map((layer) => (layer.type === "input" ? layer.neuronCount : layer.neurons.length)),
    [layers]
  );
  const { activations } = useMemo(() => forwardPassFull(layers, inputValues), [layers, inputValues]);

  const targetGrid = useMemo(() => {
    const sampled = computeGrid(activeStep.targetFn);
    return {
      ...sampled,
      variance: computeVariance(sampled.values),
    };
  }, [activeStep]);

  const networkGrid = useMemo(() => computeGrid((x1, x2) => computeOutput(layers, x1, x2)), [layers]);

  const heatmapScale = useMemo(
    () => ({
      min: Math.min(targetGrid.min, networkGrid.min),
      max: Math.max(targetGrid.max, networkGrid.max),
    }),
    [targetGrid.min, targetGrid.max, networkGrid.min, networkGrid.max]
  );

  const score = useMemo(() => {
    const mse = computeMSE(networkGrid.values, targetGrid.values);
    if (targetGrid.variance <= 1e-12) return mse <= 1e-12 ? 100 : 0;
    const r2 = Math.max(0, 1 - mse / targetGrid.variance);
    return clamp(r2 * 100, 0, 100);
  }, [networkGrid.values, targetGrid.values, targetGrid.variance]);

  const scoreDisplay = Math.floor(score * 100) / 100;
  const scoreLabel = getScoreLabel(score);
  const scoreColor = getScoreColor(score);
  const scoreThreshold = Number.isFinite(activeStep.scoreThreshold) ? activeStep.scoreThreshold : MATCH_SCORE_THRESHOLD;
  const passesCompletionCheck =
    typeof activeStep.completionCheck === "function"
      ? activeStep.completionCheck({ layers, inputValues, score })
      : true;
  const isStepMatched = score >= scoreThreshold && passesCompletionCheck;
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
  const lockedSelectionLayerIdx = Number.isInteger(activeStep.lockedSelectionLayerIdx)
    ? activeStep.lockedSelectionLayerIdx
    : null;

  useEffect(() => {
    onStepIndexChange?.(stepIndex);
  }, [stepIndex, onStepIndexChange]);

  useEffect(() => {
    drawHeatmap(userCanvasRef.current, networkGrid.values, heatmapScale.min, heatmapScale.max);
  }, [networkGrid.values, heatmapScale.min, heatmapScale.max]);

  useEffect(() => {
    drawHeatmap(targetCanvasRef.current, targetGrid.values, heatmapScale.min, heatmapScale.max);
  }, [targetGrid.values, heatmapScale.min, heatmapScale.max]);

  useLayoutEffect(() => {
    layersRef.current = layers;
    inputValuesRef.current = inputValues;
    parameterDraftsRef.current = parameterDrafts;
  }, [layers, inputValues, parameterDrafts]);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParameterDrafts((prev) => reconcileParameterDrafts(prev, layers, inputValues));
  }, [layers, inputValues]);

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

  const updateParameterDraft = useCallback((key, text) => {
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
  }, []);

  const setLayerActivation = useCallback((layerIdx, activation) => {
    setLayers((prev) => prev.map((layer, index) => (index === layerIdx ? { ...layer, activation } : layer)));
  }, []);

  const setNeuronName = useCallback(() => undefined, []);

  const setStep = useCallback((nextIndex) => {
    const clampedNextIndex = clampStepIndex(nextIndex);
    const nextState = createStepRuntimeState(TUTORIAL_STEPS[clampedNextIndex]);
    setStepIndex(clampedNextIndex);
    setLayers(nextState.layers);
    setInputValues(nextState.inputValues);
    setParameterDrafts(nextState.parameterDrafts);
    setSel(nextState.sel);
    setShowHint(false);
  }, []);

  const handleSelectionChange = useCallback(
    (nextSelection) => {
      if (lockedSelectionLayerIdx === null) {
        setSel(nextSelection);
        return;
      }

      if (!nextSelection) {
        setSel(null);
        return;
      }
      if (nextSelection.layerIdx !== lockedSelectionLayerIdx) return;
      setSel(nextSelection);
    },
    [lockedSelectionLayerIdx]
  );

  const handleBack = useCallback(() => {
    if (stepIndex === 0) return;
    setStep(stepIndex - 1);
  }, [stepIndex, setStep]);

  const handleAdvance = useCallback(() => {
    if (!isStepMatched || !draftValidity.allValid) return;
    if (isLastStep) {
      onCompleteTutorial?.();
      return;
    }
    setStep(stepIndex + 1);
  }, [draftValidity.allValid, isStepMatched, isLastStep, onCompleteTutorial, setStep, stepIndex]);

  const networkViewPolicy = activeStep.networkViewPolicy ?? {};
  const inspectorPolicy = activeStep.inspectorPolicy ?? {};

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
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          background: COLORS.panel,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textBright }}>Beginner Tutorial</div>
          <span
            style={{
              fontSize: 11,
              color: COLORS.accent,
              background: COLORS.accentDim,
              border: `1px solid ${COLORS.accent}40`,
              borderRadius: 4,
              padding: "2px 8px",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {`Step ${stepIndex + 1} / ${TUTORIAL_STEPS.length}`}
          </span>
          {!draftValidity.allValid && (
            <span
              style={{
                fontSize: 11,
                color: COLORS.negative,
                background: COLORS.negativeDim,
                border: `1px solid ${COLORS.negative}40`,
                borderRadius: 4,
                padding: "2px 8px",
              }}
            >
              Invalid parameter value - updates paused
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowHint((prev) => !prev)} style={subtleBtnStyle}>
            {showHint ? "Hide hint" : "Need a hint"}
          </button>
          <button onClick={() => onExitTutorial?.(stepIndex)} style={{ ...subtleBtnStyle, color: COLORS.textMuted }}>
            Exit tutorial
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            flex: "1 1 280px",
            maxWidth: 360,
            minWidth: 250,
            alignSelf: "flex-start",
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 6,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, color: COLORS.accent, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 700 }}>
            {activeStep.name}
          </div>
          <div style={{ fontSize: 14, color: COLORS.textBright, fontWeight: 600, lineHeight: 1.4 }}>{activeStep.lesson}</div>

          <div
            style={{
              background: COLORS.bg,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 4,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>Target</div>
            <MathText tex={activeStep.formula} style={{ fontSize: 16, color: COLORS.textBright }} />
          </div>

          <div
            style={{
              background: COLORS.bg,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 4,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
              Objective
            </div>
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.45 }}>{activeStep.objective}</div>
          </div>

          {showHint && (
            <div
              style={{
                background: COLORS.accentDim,
                border: `1px solid ${COLORS.accent}50`,
                borderRadius: 4,
                padding: 10,
                fontSize: 12,
                color: COLORS.accent,
                lineHeight: 1.45,
              }}
            >
              {activeStep.hint}
            </div>
          )}

          <div
            style={{
              background: COLORS.bg,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 4,
              padding: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: scoreColor, fontWeight: 700 }}>{scoreLabel}</span>
              <span style={{ fontSize: 13, color: COLORS.textBright, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                {scoreDisplay.toFixed(2)}%
              </span>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 3,
                overflow: "hidden",
                background: COLORS.surface,
                border: `1px solid ${COLORS.panelBorder}`,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${scoreDisplay.toFixed(2)}%`,
                  background: scoreColor,
                  transition: "width 120ms linear",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
            <button onClick={handleBack} disabled={stepIndex === 0} style={{ ...btnStyle, opacity: stepIndex === 0 ? 0.45 : 1 }}>
              Back
            </button>
            <button
              onClick={handleAdvance}
              disabled={!isStepMatched || !draftValidity.allValid}
              style={{
                ...btnStyle,
                borderColor: `${COLORS.accent}70`,
                color: COLORS.accent,
                opacity: isStepMatched && draftValidity.allValid ? 1 : 0.45,
              }}
            >
              {isLastStep ? "Finish tutorial" : "Next step"}
            </button>
          </div>

          {!isStepMatched && (
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>
              Reach {scoreThreshold}% to continue.
            </div>
          )}
          {!passesCompletionCheck && score >= scoreThreshold && typeof activeStep.completionHint === "string" && (
            <div style={{ fontSize: 11, color: COLORS.accent }}>{activeStep.completionHint}</div>
          )}
          {!draftValidity.allValid && <div style={{ fontSize: 11, color: COLORS.negative }}>Fix invalid values to continue.</div>}
        </div>

        <div style={{ flex: "999 1 760px", minWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
          <NetworkView
            layers={layers}
            layerSizes={layerSizes}
            activations={activations}
            sel={sel}
            setSel={handleSelectionChange}
            parameterDrafts={parameterDrafts}
            inputValues={inputValues}
            draftValidityByKey={draftValidity.byKey}
            isRevealingSolution={false}
            showParamSliders={true}
            updateParameterDraft={updateParameterDraft}
            setLayerActivation={setLayerActivation}
            addNeuron={() => {}}
            removeNeuron={() => {}}
            removeLayer={() => {}}
            addHiddenLayer={() => {}}
            setNeuronName={setNeuronName}
            showLayerCards={networkViewPolicy.showLayerCards ?? true}
            showActivationControls={networkViewPolicy.showActivationControls ?? true}
            showArchitectureControls={networkViewPolicy.showArchitectureControls ?? true}
            inspectorOptions={inspectorPolicy}
          />

          <div
            style={{
              background: COLORS.panel,
              borderRadius: 6,
              border: `1px solid ${COLORS.panelBorder}`,
              padding: 10,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                background: COLORS.bg,
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 4,
                padding: 8,
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>Your network</div>
              <canvas
                ref={userCanvasRef}
                width={340}
                height={340}
                style={{
                  width: "min(340px, 80vw)",
                  height: "min(340px, 80vw)",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.panelBorder}`,
                  background: COLORS.bg,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                background: COLORS.bg,
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 4,
                padding: 8,
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>Target</div>
              <canvas
                ref={targetCanvasRef}
                width={340}
                height={340}
                style={{
                  width: "min(340px, 80vw)",
                  height: "min(340px, 80vw)",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.panelBorder}`,
                  background: COLORS.bg,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
