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
  zeroLayersLike,
} from "../lib/networkMath";
import { btnStyle, COLORS, subtleBtnStyle } from "../styles/theme";
import MathText from "./MathText";
import NetworkView from "./NetworkView";

function clampStepIndex(value) {
  if (!Number.isInteger(value)) return 0;
  return Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, value));
}

const TOUR_SPOTLIGHT_PADDING = 10;
const TOUR_VIEWPORT_EDGE_PADDING = 8;
const TOUR_TOOLTIP_WIDTH = 320;
const TOUR_TOOLTIP_ESTIMATED_HEIGHT = 190;
const TOUR_OVERLAY_COLOR = "rgba(0, 0, 0, 0.58)";

function getSelectionHintLabel(layers, selection) {
  if (!selection) return "";
  const layerLabel =
    selection.layerIdx === 0
      ? "input layer"
      : selection.layerIdx === layers.length - 1
        ? "output layer"
        : `hidden layer ${selection.layerIdx}`;
  return `${layerLabel}, neuron ${selection.neuronIdx + 1}`;
}

function createStepRuntimeState(step) {
  const nextLayers = zeroLayersLike(step.initialNetworkFactory());
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
  hasSeenWorkspaceTour = false,
  hasCompletedWarmup = false,
  onStepIndexChange,
  onExitTutorial,
  onCompleteTutorial,
  onWorkspaceTourSeen,
  onWarmupCompleted,
}) {
  const clampedInitialStepIndex = clampStepIndex(initialStepIndex);
  const initialRuntimeState = useMemo(() => {
    const nextState = createStepRuntimeState(TUTORIAL_STEPS[clampedInitialStepIndex]);
    if (clampedInitialStepIndex === 0 && !hasCompletedWarmup) nextState.sel = null;
    return nextState;
  }, [clampedInitialStepIndex, hasCompletedWarmup]);

  const [stepIndex, setStepIndex] = useState(clampedInitialStepIndex);
  const [layers, setLayers] = useState(initialRuntimeState.layers);
  const [inputValues, setInputValues] = useState(initialRuntimeState.inputValues);
  const [parameterDrafts, setParameterDrafts] = useState(initialRuntimeState.parameterDrafts);
  const [sel, setSel] = useState(initialRuntimeState.sel);
  const [showHint, setShowHint] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(hasSeenWorkspaceTour ? -1 : 0);
  const [tourHighlightRect, setTourHighlightRect] = useState(null);
  const [tourViewport, setTourViewport] = useState({ width: 0, height: 0 });
  const [isWarmupComplete, setIsWarmupComplete] = useState(hasCompletedWarmup);
  const [warmupChecklist, setWarmupChecklist] = useState({
    selectedNeuron: hasCompletedWarmup,
    adjustedWeight: hasCompletedWarmup,
    observedResponse: hasCompletedWarmup,
  });

  const tutorialRootRef = useRef(null);
  const userCanvasRef = useRef(null);
  const targetCanvasRef = useRef(null);
  const lessonPanelRef = useRef(null);
  const scoreControlsRef = useRef(null);
  const heatmapsPanelRef = useRef(null);
  const graphPaneTourRef = useRef(null);
  const inspectorPaneTourRef = useRef(null);
  const layersRef = useRef(layers);
  const inputValuesRef = useRef(inputValues);
  const parameterDraftsRef = useRef(parameterDrafts);
  const warmupChecklistRef = useRef(warmupChecklist);
  const warmupCompletionNotifiedRef = useRef(hasCompletedWarmup);
  const tourAnimationFrameRef = useRef(null);
  const lastTourAutoScrollStepRef = useRef(-1);
  const tourCardRef = useRef(null);

  const activeStep = TUTORIAL_STEPS[stepIndex];
  const tourStops = useMemo(
    () => [
      {
        id: "lesson",
        title: "Lesson panel",
        description: "This card explains the goal, target formula, and hint for the current tutorial step.",
      },
      {
        id: "graph",
        title: "Network graph",
        description: "Click any neuron in the graph to inspect it. Tutorial steps keep trainable neurons editable while guiding your focus.",
      },
      {
        id: "inspector",
        title: "Neuron inspector",
        description: "Use this pane to edit weights, bias, and other values for whichever neuron you selected.",
      },
      {
        id: "heatmaps",
        title: "Live comparison",
        description: "These heatmaps update live so you can compare your network output against the target surface.",
      },
      {
        id: "progress",
        title: "Score and navigation",
        description: "The score meter tracks progress, and Back/Next controls move you between tutorial steps.",
      },
    ],
    []
  );
  const tourTargetRefs = [lessonPanelRef, graphPaneTourRef, inspectorPaneTourRef, heatmapsPanelRef, scoreControlsRef];
  const isTourActive = tourStepIndex >= 0;
  const activeTourStop = isTourActive ? tourStops[tourStepIndex] ?? null : null;
  const activeTourTargetRef = isTourActive ? tourTargetRefs[tourStepIndex] ?? null : null;
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
  const isWarmupActive = stepIndex === 0 && !isWarmupComplete && !isTourActive;
  const recommendedFocusLabel = getSelectionHintLabel(layers, activeStep.initialSelection);
  const objectiveText = isWarmupActive
    ? "Before Step 1, do a quick first-touch lap so the workspace feels familiar."
    : activeStep.objective;
  const passesCompletionCheck =
    typeof activeStep.completionCheck === "function"
      ? activeStep.completionCheck({ layers, inputValues, score })
      : true;
  const isStepMatched = score >= scoreThreshold && passesCompletionCheck;
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    onStepIndexChange?.(stepIndex);
  }, [stepIndex, onStepIndexChange]);

  useEffect(() => {
    if (!isTourActive) return;
    tourCardRef.current?.focus();
  }, [isTourActive, tourStepIndex]);

  const updateTourHighlight = useCallback(() => {
    if (!isTourActive || !activeTourTargetRef?.current) {
      setTourHighlightRect((prev) => (prev === null ? prev : null));
      return;
    }

    const targetElement = activeTourTargetRef.current;
    const targetRect = targetElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    setTourViewport((prev) =>
      prev.width === viewportWidth && prev.height === viewportHeight
        ? prev
        : { width: viewportWidth, height: viewportHeight }
    );

    const viewportTopEdge = TOUR_VIEWPORT_EDGE_PADDING;
    const viewportLeftEdge = TOUR_VIEWPORT_EDGE_PADDING;
    const viewportBottomEdge = viewportHeight - TOUR_VIEWPORT_EDGE_PADDING;
    const viewportRightEdge = viewportWidth - TOUR_VIEWPORT_EDGE_PADDING;
    const isOutsideViewport =
      targetRect.top < viewportTopEdge
      || targetRect.bottom > viewportBottomEdge
      || targetRect.left < viewportLeftEdge
      || targetRect.right > viewportRightEdge;
    if (isOutsideViewport && lastTourAutoScrollStepRef.current !== tourStepIndex) {
      lastTourAutoScrollStepRef.current = tourStepIndex;
      targetElement.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }

    const minHighlightWidth = 40;
    const minHighlightHeight = 32;
    const maxLeft = Math.max(viewportLeftEdge, viewportRightEdge - minHighlightWidth);
    const maxTop = Math.max(viewportTopEdge, viewportBottomEdge - minHighlightHeight);
    const left = clamp(targetRect.left - TOUR_SPOTLIGHT_PADDING, viewportLeftEdge, maxLeft);
    const top = clamp(targetRect.top - TOUR_SPOTLIGHT_PADDING, viewportTopEdge, maxTop);
    const right = clamp(targetRect.right + TOUR_SPOTLIGHT_PADDING, left + minHighlightWidth, viewportRightEdge);
    const bottom = clamp(targetRect.bottom + TOUR_SPOTLIGHT_PADDING, top + minHighlightHeight, viewportBottomEdge);
    const nextRect = {
      left,
      top,
      width: Math.max(40, right - left),
      height: Math.max(32, bottom - top),
    };

    setTourHighlightRect((prev) => {
      if (!prev) return nextRect;
      if (
        Math.abs(prev.left - nextRect.left) < 0.5
        && Math.abs(prev.top - nextRect.top) < 0.5
        && Math.abs(prev.width - nextRect.width) < 0.5
        && Math.abs(prev.height - nextRect.height) < 0.5
      ) {
        return prev;
      }
      return nextRect;
    });
  }, [activeTourTargetRef, isTourActive, tourStepIndex]);

  useLayoutEffect(() => {
    if (!isTourActive) return;

    const scheduleHighlightUpdate = () => {
      if (tourAnimationFrameRef.current) cancelAnimationFrame(tourAnimationFrameRef.current);
      tourAnimationFrameRef.current = requestAnimationFrame(() => {
        tourAnimationFrameRef.current = null;
        updateTourHighlight();
      });
    };

    scheduleHighlightUpdate();
    window.addEventListener("resize", scheduleHighlightUpdate);
    window.addEventListener("scroll", scheduleHighlightUpdate, true);

    return () => {
      window.removeEventListener("resize", scheduleHighlightUpdate);
      window.removeEventListener("scroll", scheduleHighlightUpdate, true);
      if (tourAnimationFrameRef.current) {
        cancelAnimationFrame(tourAnimationFrameRef.current);
        tourAnimationFrameRef.current = null;
      }
    };
  }, [isTourActive, updateTourHighlight]);

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
    warmupChecklistRef.current = warmupChecklist;
  }, [layers, inputValues, parameterDrafts, warmupChecklist]);

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
  const canAdvance = isStepMatched && draftValidity.allValid && !isWarmupActive;

  const markWarmupComplete = useCallback(() => {
    if (isWarmupComplete) return;
    setIsWarmupComplete(true);
    if (warmupCompletionNotifiedRef.current) return;
    warmupCompletionNotifiedRef.current = true;
    onWarmupCompleted?.();
  }, [isWarmupComplete, onWarmupCompleted]);

  const applyWarmupChecklistPatch = useCallback(
    (patch) => {
      if (!isWarmupActive) return;
      const currentChecklist = warmupChecklistRef.current;
      const nextChecklist = {
        selectedNeuron:
          typeof patch.selectedNeuron === "boolean" ? patch.selectedNeuron : currentChecklist.selectedNeuron,
        adjustedWeight:
          typeof patch.adjustedWeight === "boolean" ? patch.adjustedWeight : currentChecklist.adjustedWeight,
        observedResponse:
          typeof patch.observedResponse === "boolean" ? patch.observedResponse : currentChecklist.observedResponse,
      };
      if (
        nextChecklist.selectedNeuron === currentChecklist.selectedNeuron
        && nextChecklist.adjustedWeight === currentChecklist.adjustedWeight
        && nextChecklist.observedResponse === currentChecklist.observedResponse
      ) {
        return;
      }

      warmupChecklistRef.current = nextChecklist;
      setWarmupChecklist(nextChecklist);
      if (nextChecklist.selectedNeuron && nextChecklist.adjustedWeight && nextChecklist.observedResponse) {
        markWarmupComplete();
      }
    },
    [isWarmupActive, markWarmupComplete]
  );

  const updateParameterDraft = useCallback((key, text) => {
    const nextDrafts = { ...parameterDraftsRef.current, [key]: text };
    parameterDraftsRef.current = nextDrafts;
    setParameterDrafts(nextDrafts);

    if (isWarmupActive && key.startsWith("w:")) {
      applyWarmupChecklistPatch({ adjustedWeight: true });
    }

    const parsedState = parseDraftsToNetwork(nextDrafts, layersRef.current, inputValuesRef.current);
    if (!parsedState) return;

    const didLayerParametersChange = !networkParametersEqual(layersRef.current, parsedState.layers);
    const didInputValuesChange = !numericArraysEqual(inputValuesRef.current, parsedState.inputValues);

    if (isWarmupActive && key.startsWith("w:") && (didLayerParametersChange || didInputValuesChange)) {
      applyWarmupChecklistPatch({ observedResponse: true });
    }

    if (didLayerParametersChange) {
      layersRef.current = parsedState.layers;
      setLayers(parsedState.layers);
    }
    if (didInputValuesChange) {
      inputValuesRef.current = parsedState.inputValues;
      setInputValues(parsedState.inputValues);
    }
  }, [applyWarmupChecklistPatch, isWarmupActive]);

  const setLayerActivation = useCallback((layerIdx, activation) => {
    setLayers((prev) => prev.map((layer, index) => (index === layerIdx ? { ...layer, activation } : layer)));
  }, []);

  const setNeuronName = useCallback(() => undefined, []);

  const setStep = useCallback((nextIndex) => {
    const clampedNextIndex = clampStepIndex(nextIndex);
    const nextState = createStepRuntimeState(TUTORIAL_STEPS[clampedNextIndex]);
    const shouldRequireWarmupSelection = clampedNextIndex === 0 && !isWarmupComplete;
    layersRef.current = nextState.layers;
    inputValuesRef.current = nextState.inputValues;
    parameterDraftsRef.current = nextState.parameterDrafts;
    setStepIndex(clampedNextIndex);
    setLayers(nextState.layers);
    setInputValues(nextState.inputValues);
    setParameterDrafts(nextState.parameterDrafts);
    setSel(shouldRequireWarmupSelection ? null : nextState.sel);
    setShowHint(false);
  }, [isWarmupComplete]);

  const handleSelectionChange = useCallback(
    (nextSelection) => {
      setSel(nextSelection);
      if (!nextSelection || !isWarmupActive) return;
      applyWarmupChecklistPatch({ selectedNeuron: true });
    },
    [applyWarmupChecklistPatch, isWarmupActive]
  );

  const handleBack = useCallback(() => {
    if (stepIndex === 0) return;
    setStep(stepIndex - 1);
  }, [stepIndex, setStep]);

  const handleAdvance = useCallback(() => {
    if (!canAdvance) return;
    if (isLastStep) {
      onCompleteTutorial?.();
      return;
    }
    setStep(stepIndex + 1);
  }, [canAdvance, isLastStep, onCompleteTutorial, setStep, stepIndex]);

  const finishWorkspaceTour = useCallback(() => {
    lastTourAutoScrollStepRef.current = -1;
    setTourStepIndex(-1);
    onWorkspaceTourSeen?.();
  }, [onWorkspaceTourSeen]);

  const handleTourBack = useCallback(() => {
    setTourStepIndex((prev) => (prev <= 0 ? 0 : prev - 1));
  }, []);

  const handleTourNext = useCallback(() => {
    if (tourStepIndex >= tourStops.length - 1) {
      finishWorkspaceTour();
      return;
    }
    const lastTourStepIndex = tourStops.length - 1;
    setTourStepIndex((prev) => Math.min(lastTourStepIndex, prev + 1));
  }, [finishWorkspaceTour, tourStepIndex, tourStops.length]);

  const handleReplayTour = useCallback(() => {
    lastTourAutoScrollStepRef.current = -1;
    setTourStepIndex(0);
  }, []);

  const networkViewPolicy = activeStep.networkViewPolicy ?? {};
  const inspectorPolicy = activeStep.inspectorPolicy ?? {};
  const showNameField = inspectorPolicy.showNameField ?? true;
  const showInputValueSection = inspectorPolicy.showInputValueSection ?? true;
  const showBiasSection = inspectorPolicy.showBiasSection ?? true;
  const showWeightsSection = inspectorPolicy.showWeightsSection ?? true;
  const selectionHasEditableControls = (() => {
    if (!sel) return false;
    if (showNameField) return true;
    if (sel.layerIdx === 0) return showInputValueSection;
    return showBiasSection || showWeightsSection;
  })();
  const showSelectionNudge = Boolean(sel) && !selectionHasEditableControls;
  const tourTooltipWidth = Math.max(260, Math.min(TOUR_TOOLTIP_WIDTH, Math.max(260, tourViewport.width - 24)));
  const tourTooltipLeft = tourHighlightRect
    ? clamp(tourHighlightRect.left, 12, Math.max(12, tourViewport.width - tourTooltipWidth - 12))
    : 12;
  const preferredTooltipTop = tourHighlightRect ? tourHighlightRect.top + tourHighlightRect.height + 12 : 12;
  const aboveTooltipTop = tourHighlightRect
    ? Math.max(12, tourHighlightRect.top - TOUR_TOOLTIP_ESTIMATED_HEIGHT - 12)
    : 12;
  const shouldPlaceTooltipAbove = preferredTooltipTop + TOUR_TOOLTIP_ESTIMATED_HEIGHT > tourViewport.height - 12;
  const unclampedTourTooltipTop = shouldPlaceTooltipAbove ? aboveTooltipTop : preferredTooltipTop;
  const tourTooltipTop = clamp(
    unclampedTourTooltipTop,
    12,
    Math.max(12, tourViewport.height - TOUR_TOOLTIP_ESTIMATED_HEIGHT - 12)
  );
  const spotlightShadowSpread = Math.max(tourViewport.width, tourViewport.height, 2000);

  return (
    <div
      ref={tutorialRootRef}
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
        aria-hidden={isTourActive}
        inert={isTourActive ? "" : undefined}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
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
            {isWarmupActive ? "Warm-up" : `Step ${stepIndex + 1} / ${TUTORIAL_STEPS.length}`}
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
          <button onClick={handleReplayTour} style={subtleBtnStyle}>
            Replay tour
          </button>
          <button
            onClick={() => setShowHint((prev) => !prev)}
            disabled={isWarmupActive}
            style={{ ...subtleBtnStyle, opacity: isWarmupActive ? 0.5 : 1, cursor: isWarmupActive ? "default" : "pointer" }}
          >
            {showHint ? "Hide hint" : "Need a hint"}
          </button>
          <button onClick={() => onExitTutorial?.(stepIndex)} style={{ ...subtleBtnStyle, color: COLORS.textMuted }}>
            Exit tutorial
          </button>
        </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div
          ref={lessonPanelRef}
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
            {isWarmupActive ? "Warm-up - First touch" : activeStep.name}
          </div>
          <div style={{ fontSize: 14, color: COLORS.textBright, fontWeight: 600, lineHeight: 1.4 }}>
            {isWarmupActive ? "Get comfortable with the workspace before scoring Step 1." : activeStep.lesson}
          </div>

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
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.45 }}>{objectiveText}</div>
          </div>

          {!isWarmupActive && recommendedFocusLabel && (
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 4,
                padding: "8px 10px",
                fontSize: 11,
                color: COLORS.textMuted,
                lineHeight: 1.45,
              }}
            >
              Recommended focus: <span style={{ color: COLORS.accent }}>{recommendedFocusLabel}</span>. You can still inspect any neuron and edit the trainable ones.
            </div>
          )}

          {showSelectionNudge && (
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 4,
                padding: "8px 10px",
                fontSize: 11,
                color: COLORS.textMuted,
                lineHeight: 1.45,
              }}
            >
              This selection has no editable parameters in this step. Try
              {" "}
              <span style={{ color: COLORS.accent }}>{recommendedFocusLabel || "the highlighted trainable neuron"}</span>
              {" "}
              instead.
            </div>
          )}

          {isWarmupActive && (
            <div
              style={{
                background: COLORS.accentDim,
                border: `1px solid ${COLORS.accent}55`,
                borderRadius: 4,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 10, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
                First-touch checklist
              </div>
              <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.45 }}>Do each action once to unlock Step 1.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: COLORS.textBright }}>
                <div>{warmupChecklist.selectedNeuron ? "✓" : "○"} Click any neuron in the graph.</div>
                <div>{warmupChecklist.adjustedWeight ? "✓" : "○"} Edit any weight value in the inspector.</div>
                <div>{warmupChecklist.observedResponse ? "✓" : "○"} Apply a valid weight change so outputs update.</div>
              </div>
            </div>
          )}

          {showHint && !isWarmupActive && (
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

          <div ref={scoreControlsRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                disabled={!canAdvance}
                style={{
                  ...btnStyle,
                  borderColor: `${COLORS.accent}70`,
                  color: COLORS.accent,
                  opacity: canAdvance ? 1 : 0.45,
                }}
              >
                {isLastStep ? "Finish tutorial" : "Next step"}
              </button>
            </div>

            {isWarmupActive && <div style={{ fontSize: 11, color: COLORS.accent }}>Complete the checklist above to unlock Step 1.</div>}
            {!isWarmupActive && !isStepMatched && (
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                Reach {scoreThreshold}% to continue.
              </div>
            )}
            {!isWarmupActive && !passesCompletionCheck && score >= scoreThreshold && typeof activeStep.completionHint === "string" && (
              <div style={{ fontSize: 11, color: COLORS.accent }}>{activeStep.completionHint}</div>
            )}
            {!draftValidity.allValid && <div style={{ fontSize: 11, color: COLORS.negative }}>Fix invalid values to continue.</div>}
          </div>
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
            graphPaneContainerRef={graphPaneTourRef}
            inspectorPaneContainerRef={inspectorPaneTourRef}
          />

          <div
            ref={heatmapsPanelRef}
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

      {isTourActive && activeTourStop && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120 }}>
          {!tourHighlightRect && <div style={{ position: "absolute", inset: 0, background: TOUR_OVERLAY_COLOR }} />}

          {tourHighlightRect && (
            <div
              style={{
                position: "absolute",
                left: tourHighlightRect.left,
                top: tourHighlightRect.top,
                width: tourHighlightRect.width,
                height: tourHighlightRect.height,
                borderRadius: 8,
                border: `2px solid ${COLORS.accent}`,
                boxShadow: `0 0 0 ${spotlightShadowSpread}px ${TOUR_OVERLAY_COLOR}, 0 0 0 1px ${COLORS.accent}55, 0 0 24px ${COLORS.accent}55`,
              }}
            />
          )}

          <div
            ref={tourCardRef}
            role="dialog"
            aria-modal="true"
            aria-label="Tutorial workspace tour"
            tabIndex={-1}
            style={{
              position: "absolute",
              top: tourHighlightRect ? tourTooltipTop : 14,
              left: tourHighlightRect ? tourTooltipLeft : 12,
              width: tourTooltipWidth,
              maxWidth: "calc(100vw - 24px)",
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 6,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 10, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
              {`Workspace tour ${tourStepIndex + 1} / ${tourStops.length}`}
            </div>
            <div style={{ fontSize: 14, color: COLORS.textBright, fontWeight: 700 }}>{activeTourStop.title}</div>
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.45 }}>{activeTourStop.description}</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
              <button onClick={finishWorkspaceTour} style={subtleBtnStyle}>
                Skip tour
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleTourBack}
                  disabled={tourStepIndex === 0}
                  style={{ ...btnStyle, opacity: tourStepIndex === 0 ? 0.45 : 1 }}
                >
                  Back
                </button>
                <button
                  onClick={handleTourNext}
                  style={{ ...btnStyle, borderColor: `${COLORS.accent}70`, color: COLORS.accent }}
                >
                  {tourStepIndex >= tourStops.length - 1 ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
