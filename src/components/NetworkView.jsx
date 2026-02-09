import { useEffect, useMemo, useRef, useState } from "react";
import { ACT_FNS, fmt, getNeuronName, neuronColor } from "../lib/networkMath";
import NeuronInspector from "./NeuronInspector";
import { COLORS } from "../styles/theme";

const SVG_W = 560;
const PAD_X = 60;
const PAD_Y = 30;
const NEURON_R = 22;
const SELECTED_NEURON_RADIUS_BOOST = 3;
const MAX_NEURON_R = NEURON_R + SELECTED_NEURON_RADIUS_BOOST;
const NEURON_NAME_FONT_SIZE = 9;
const NEURON_NAME_GAP = 6;
const NEURON_NAME_ASCENT = Math.ceil(NEURON_NAME_FONT_SIZE * 0.9);
const NEURON_NAME_OFFSET = NEURON_R + NEURON_NAME_GAP;
const NEURON_NAME_SAFE_MARGIN = 6;
const NEURON_TOP_BUFFER = NEURON_NAME_OFFSET + NEURON_NAME_ASCENT + NEURON_NAME_SAFE_MARGIN + SELECTED_NEURON_RADIUS_BOOST;
const LAYER_CONTROL_BOTTOM = 8;
const LAYER_CONTROL_HEIGHT = 86;
const LAYER_CONTROL_NEURON_GAP = 12;
const LAYER_CONTROL_ZONE = LAYER_CONTROL_BOTTOM + LAYER_CONTROL_HEIGHT;
const NEURON_BOTTOM_BUFFER = Math.max(PAD_Y + MAX_NEURON_R, MAX_NEURON_R + LAYER_CONTROL_NEURON_GAP + LAYER_CONTROL_ZONE);
const LAYER_CARD_WIDTH = 100;
const GRAPH_LAYER_MAX_GAP = 260;
const GRAPH_LAYER_MIN_GAP = 120;
const MIN_GRAPH_HEIGHT = 200;
const MAX_GRAPH_HEIGHT = 800;

const LAYER_CARD_BASE_STYLE = {
  position: "absolute",
  bottom: LAYER_CONTROL_BOTTOM,
  transform: "translateX(-50%)",
  width: LAYER_CARD_WIDTH,
  background: COLORS.surface,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 4,
  padding: "8px 8px 7px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  pointerEvents: "auto",
};

const LAYER_CARD_LABEL_STYLE = {
  fontSize: 11,
  lineHeight: 1.25,
  fontWeight: 600,
  color: COLORS.textMuted,
  textAlign: "center",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const LAYER_ACTIVATION_SELECT_STYLE = {
  width: "100%",
  background: COLORS.bg,
  color: COLORS.accent,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 4,
  padding: "3px 4px",
  fontSize: 11,
  fontFamily: "'DM Mono', monospace",
  cursor: "pointer",
};

const HIDDEN_LAYER_ROW_STYLE = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
};

const LAYER_CONTROL_BUTTON_BASE_STYLE = {
  minWidth: 22,
  lineHeight: "18px",
  borderRadius: 4,
  border: `1px solid ${COLORS.panelBorder}`,
  background: COLORS.bg,
  color: COLORS.textMuted,
  cursor: "pointer",
  padding: "0 6px",
  fontSize: 12,
  fontFamily: "'DM Mono', monospace",
};

const LAYER_CONTROL_COUNT_STYLE = {
  minWidth: 18,
  textAlign: "center",
  color: COLORS.textMuted,
  fontSize: 11,
  fontFamily: "'DM Mono', monospace",
};

const INSERT_HIDDEN_BUTTON_SIZE = 28;
const INSERT_HIDDEN_BUTTON_RADIUS = INSERT_HIDDEN_BUTTON_SIZE / 2;
const INSERT_HIDDEN_BUTTON_Y_OFFSET = 0;
const INSERT_HIDDEN_BUTTON_EDGE_GAP = 8;

const INSERT_HIDDEN_LAYER_BUTTON_STYLE = {
  position: "absolute",
  transform: "translate(-50%, -50%)",
  width: INSERT_HIDDEN_BUTTON_SIZE,
  height: INSERT_HIDDEN_BUTTON_SIZE,
  borderRadius: "50%",
  border: `1px solid ${COLORS.accent}55`,
  background: COLORS.accentDim,
  color: COLORS.accent,
  cursor: "pointer",
  fontSize: 18,
  fontWeight: 700,
  padding: 0,
  pointerEvents: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  zIndex: 1,
  fontFamily: "'DM Mono', monospace",
};

export default function NetworkView({
  layers,
  layerSizes,
  activations,
  sel,
  setSel,
  parameterDrafts,
  inputValues,
  draftValidityByKey,
  isRevealingSolution,
  showParamSliders,
  updateParameterDraft,
  setLayerActivation,
  addNeuron,
  removeNeuron,
  removeLayer,
  addHiddenLayer,
  setNeuronName,
}) {
  const [netHeight, setNetHeight] = useState(340);
  const [dragging, setDragging] = useState(false);
  const [graphViewportWidth, setGraphViewportWidth] = useState(SVG_W);

  const dragStartY = useRef(0);
  const dragStartH = useRef(0);
  const graphPaneRef = useRef(null);

  const layerConnectionCount = Math.max(1, layers.length - 1);
  const graphLayerGap = useMemo(() => {
    const unclampedGap = GRAPH_LAYER_MAX_GAP / layerConnectionCount;
    return Math.max(GRAPH_LAYER_MIN_GAP, Math.min(GRAPH_LAYER_MAX_GAP, unclampedGap));
  }, [layerConnectionCount]);
  const graphLayoutWidth = graphLayerGap * layerConnectionCount;
  const graphMinWidth = useMemo(() => Math.ceil(PAD_X * 2 + graphLayoutWidth), [graphLayoutWidth]);
  const graphWidth = Math.max(graphViewportWidth, graphMinWidth);
  const minGraphHeight = useMemo(() => {
    const largestLayerSize = layerSizes.reduce((maxSize, size) => Math.max(maxSize, size || 0), 1);
    const minNeuronSpacing = NEURON_R * 2 + SELECTED_NEURON_RADIUS_BOOST;
    const minimumUsableHeight = Math.max(0, largestLayerSize - 1) * minNeuronSpacing;
    const requiredHeight = Math.ceil(NEURON_TOP_BUFFER + NEURON_BOTTOM_BUFFER + minimumUsableHeight);
    return Math.min(MAX_GRAPH_HEIGHT, Math.max(MIN_GRAPH_HEIGHT, requiredHeight));
  }, [layerSizes]);
  const effectiveNetHeight = Math.max(netHeight, minGraphHeight);
  const SVG_H = effectiveNetHeight;

  // recompute svg positions whenever architecture or panel size changes
  const neuronPositions = useMemo(() => {
    const positions = [];
    const numLayers = layers.length;
    const layerSpan = numLayers === 1 ? 0 : graphLayerGap * (numLayers - 1);
    const firstLayerX = (graphWidth - layerSpan) / 2;
    const neuronTop = NEURON_TOP_BUFFER;
    const neuronBottom = SVG_H - NEURON_BOTTOM_BUFFER;
    const usableH = Math.max(0, neuronBottom - neuronTop);
    for (let l = 0; l < numLayers; l++) {
      const size = layerSizes[l];
      const x = numLayers === 1 ? graphWidth / 2 : firstLayerX + l * graphLayerGap;
      const layerPositions = [];
      for (let n = 0; n < size; n++) {
        const y = size === 1 ? (neuronTop + neuronBottom) / 2 : neuronTop + (n / (size - 1)) * usableH;
        layerPositions.push({ x, y });
      }
      positions.push(layerPositions);
    }
    return positions;
  }, [layers.length, layerSizes, SVG_H, graphWidth, graphLayerGap]);

  useEffect(() => {
    if (!graphPaneRef.current) return;

    const updateViewportWidth = (nextWidth) => {
      const sanitizedWidth = Math.max(0, Math.floor(nextWidth));
      if (sanitizedWidth > 0) setGraphViewportWidth(sanitizedWidth);
    };

    updateViewportWidth(graphPaneRef.current.clientWidth);
    if (typeof ResizeObserver !== "function") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateViewportWidth(entry.contentRect.width);
    });

    observer.observe(graphPaneRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const pane = graphPaneRef.current;
    if (!pane) return;
    const maxScrollLeft = Math.max(0, graphWidth - graphViewportWidth);
    if (maxScrollLeft <= 0) {
      pane.scrollLeft = 0;
      return;
    }
    const shouldCenterOverflow = layers.length > 2 && graphLayerGap <= GRAPH_LAYER_MIN_GAP;
    pane.scrollLeft = shouldCenterOverflow ? maxScrollLeft / 2 : 0;
  }, [graphWidth, graphViewportWidth, layers.length, graphLayerGap]);

  // drag handle adjusts graph height without changing other panel layout
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dy = (e.clientY || e.touches?.[0]?.clientY || 0) - dragStartY.current;
      setNetHeight(Math.max(minGraphHeight, Math.min(MAX_GRAPH_HEIGHT, dragStartH.current + dy)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, minGraphHeight]);

  return (
    <div
      style={{
        background: COLORS.panel,
        borderRadius: 4,
        border: `1px solid ${COLORS.panelBorder}`,
        padding: 8,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", height: effectiveNetHeight }}>
        <div ref={graphPaneRef} style={{ flex: "0 0 60%", minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ position: "relative", width: graphWidth, height: "100%" }}>
            <svg
              width={graphWidth}
              height={SVG_H}
              viewBox={`0 0 ${graphWidth} ${SVG_H}`}
              style={{ width: "100%", height: "100%", display: "block", userSelect: dragging ? "none" : undefined }}
            >
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {layers.map((layer, li) => {
                if (li === 0) return null;
                const prevPositions = neuronPositions[li - 1];
                const curPositions = neuronPositions[li];
                return layer.neurons.map((neuron, ni) =>
                  neuron.weights.map((w, wi) => {
                    const from = prevPositions[wi];
                    const to = curPositions[ni];
                    if (!from || !to) return null;
                    const absW = Math.abs(w);
                    const opacity = Math.min(0.15 + absW * 0.3, 0.9);
                    const strokeW = Math.max(0.5, Math.min(absW * 2, 4));
                    const color = absW < 1e-9 ? COLORS.textMuted : w > 0 ? COLORS.accent : COLORS.negative;
                    const isSel = sel && sel.layerIdx === li && sel.neuronIdx === ni;
                    return (
                      <line
                        key={`${li}-${ni}-${wi}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={color}
                        strokeWidth={isSel ? strokeW + 1 : strokeW}
                        opacity={isSel ? Math.min(opacity + 0.3, 1) : opacity}
                        strokeLinecap="round"
                      />
                    );
                  })
                );
              })}
              {neuronPositions.map((layerPositions, li) =>
                layerPositions.map((pos, ni) => {
                  const isInput = li === 0;
                  const isOutput = li === layers.length - 1;
                  const actVal = activations[li]?.[ni] ?? 0;
                  const isSel = sel && sel.layerIdx === li && sel.neuronIdx === ni;
                  const fillColor = neuronColor(actVal, 0.7);
                  const strokeColor = isSel
                    ? COLORS.selected
                    : isInput
                      ? COLORS.inputNeuron
                      : isOutput
                        ? COLORS.outputNeuron
                        : "#555";
                  return (
                    <g key={`${li}-${ni}`} onClick={() => setSel({ layerIdx: li, neuronIdx: ni })} style={{ cursor: "pointer" }}>
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={NEURON_R + (isSel ? SELECTED_NEURON_RADIUS_BOOST : 0)}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isSel ? 2.5 : 1.5}
                        filter={isSel ? "url(#glow)" : undefined}
                      />
                      <text
                        x={pos.x}
                        y={pos.y + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={COLORS.textBright}
                        fontSize="10"
                        fontFamily="'DM Mono', monospace"
                        fontWeight="500"
                        style={{ pointerEvents: "none" }}
                      >
                        {fmt(actVal)}
                      </text>
                      <text
                        x={pos.x}
                        y={pos.y - NEURON_NAME_OFFSET}
                        textAnchor="middle"
                        fill={COLORS.textMuted}
                        fontSize={NEURON_NAME_FONT_SIZE}
                        fontFamily="'Sora', sans-serif"
                        fontWeight="500"
                        style={{ pointerEvents: "none" }}
                      >
                        {getNeuronName(layers, li, ni)}
                      </text>
                    </g>
                  );
                })
              )}
            </svg>

            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {layers.map((layer, layerIdx) => {
                const x = neuronPositions[layerIdx]?.[0]?.x;
                if (typeof x !== "number") return null;

                const isInput = layerIdx === 0;
                const isOutput = layerIdx === layers.length - 1;
                const layerSize = layerSizes[layerIdx] ?? 0;
                const layerLabel = isInput ? `Input (${layerSize})` : isOutput ? `Output (${layerSize})` : `Hidden ${layerIdx}`;
                const canRemoveNeuron = !isInput && !isOutput && layer.neurons.length > 1;

                return (
                  <div key={`layer-controls-${layerIdx}`} style={{ ...LAYER_CARD_BASE_STYLE, left: `${(x / graphWidth) * 100}%` }}>
                    <div style={LAYER_CARD_LABEL_STYLE} title={layerLabel}>
                      {layerLabel}
                    </div>

                    {!isInput && (
                      <select
                        value={layer.activation}
                        onChange={(e) => setLayerActivation(layerIdx, e.target.value)}
                        style={LAYER_ACTIVATION_SELECT_STYLE}
                      >
                        {Object.entries(ACT_FNS).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {!isInput && !isOutput && (
                      <div style={HIDDEN_LAYER_ROW_STYLE}>
                        <button
                          onClick={() => removeNeuron(layerIdx, layer.neurons.length - 1)}
                          title="Remove neuron"
                          disabled={!canRemoveNeuron}
                          style={{
                            ...LAYER_CONTROL_BUTTON_BASE_STYLE,
                            cursor: canRemoveNeuron ? "pointer" : "not-allowed",
                            opacity: canRemoveNeuron ? 1 : 0.45,
                          }}
                        >
                          −
                        </button>
                        <span style={LAYER_CONTROL_COUNT_STYLE}>{layer.neurons.length}</span>
                        <button onClick={() => addNeuron(layerIdx)} title="Add neuron" style={LAYER_CONTROL_BUTTON_BASE_STYLE}>
                          +
                        </button>
                        <button
                          onClick={() => removeLayer(layerIdx)}
                          title="Remove layer"
                          style={{
                            ...LAYER_CONTROL_BUTTON_BASE_STYLE,
                            border: `1px solid ${COLORS.negative}40`,
                            color: COLORS.negative,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {layers.length >= 2 && (() => {
                const leftLayerPositions = neuronPositions[layers.length - 2];
                const rightLayerPositions = neuronPositions[layers.length - 1];
                const leftBottom = leftLayerPositions?.[leftLayerPositions.length - 1] ?? leftLayerPositions?.[0];
                const rightAnchor = rightLayerPositions?.[rightLayerPositions.length - 1] ?? rightLayerPositions?.[0];
                if (!leftBottom || !rightAnchor) return null;

                const midpointX = (leftBottom.x + rightAnchor.x) / 2;
                const minX = INSERT_HIDDEN_BUTTON_RADIUS + INSERT_HIDDEN_BUTTON_EDGE_GAP;
                const maxX = graphWidth - INSERT_HIDDEN_BUTTON_RADIUS - INSERT_HIDDEN_BUTTON_EDGE_GAP;
                const insertX = Math.min(maxX, Math.max(minX, midpointX));
                const minY = INSERT_HIDDEN_BUTTON_RADIUS + INSERT_HIDDEN_BUTTON_EDGE_GAP;
                const maxY = SVG_H - INSERT_HIDDEN_BUTTON_RADIUS - INSERT_HIDDEN_BUTTON_EDGE_GAP;
                const insertY = Math.min(maxY, Math.max(minY, leftBottom.y + INSERT_HIDDEN_BUTTON_Y_OFFSET));

                return (
                  <button
                    onClick={addHiddenLayer}
                    title="Add hidden layer"
                    aria-label="Add hidden layer"
                    style={{
                      ...INSERT_HIDDEN_LAYER_BUTTON_STYLE,
                      left: `${(insertX / graphWidth) * 100}%`,
                      top: `${(insertY / SVG_H) * 100}%`,
                    }}
                  >
                    +
                  </button>
                );
              })()}
            </div>
        </div>
        </div>
        <div
          style={{
            flex: "0 0 40%",
            minWidth: 0,
            borderLeft: `1px solid ${COLORS.panelBorder}`,
            overflowY: "auto",
          }}
        >
          <NeuronInspector
            sel={sel}
            setSel={setSel}
            layers={layers}
            parameterDrafts={parameterDrafts}
            inputValues={inputValues}
            draftValidityByKey={draftValidityByKey}
            isRevealingSolution={isRevealingSolution}
            showParamSliders={showParamSliders}
            updateParameterDraft={updateParameterDraft}
            setNeuronName={setNeuronName}
          />
        </div>
      </div>
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          dragStartY.current = e.clientY;
          dragStartH.current = effectiveNetHeight;
          setDragging(true);
        }}
        onTouchStart={(e) => {
          dragStartY.current = e.touches[0].clientY;
          dragStartH.current = effectiveNetHeight;
          setDragging(true);
        }}
        style={{
          height: 14,
          cursor: "ns-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "0 0 4px 4px",
          userSelect: "none",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = COLORS.surface;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <div style={{ width: 40, height: 3, borderRadius: 2, background: COLORS.panelBorder }} />
      </div>
    </div>
  );
}
