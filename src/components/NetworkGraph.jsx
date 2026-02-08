import { useEffect, useMemo, useRef, useState } from "react";
import { ACT_FNS, fmt, neuronColor } from "../lib/networkMath";
import InspectorSidebar from "./InspectorSidebar";
import { COLORS } from "../styles/theme";

const SVG_W = 560;
const PAD_X = 60;
const PAD_Y = 30;
const NEURON_R = 22;
const NEURON_TOP_BUFFER = PAD_Y + 10;
const NEURON_BOTTOM_BUFFER = PAD_Y + 20;
const LAYER_LABEL_BOTTOM_BUFFER = 10;

export default function NetworkGraph({
  layers,
  layerSizes,
  activations,
  preActivations,
  sel,
  setSel,
  parameterDrafts,
  inputValues,
  draftValidityByKey,
  isRevealingSolution,
  updateParameterDraft,
}) {
  const [netHeight, setNetHeight] = useState(340);
  const [dragging, setDragging] = useState(false);

  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  const SVG_H = netHeight;

  const neuronPositions = useMemo(() => {
    const positions = [];
    const numLayers = layers.length;
    const usableW = SVG_W - PAD_X * 2;
    const neuronTop = NEURON_TOP_BUFFER;
    const neuronBottom = SVG_H - NEURON_BOTTOM_BUFFER;
    const usableH = Math.max(0, neuronBottom - neuronTop);
    for (let l = 0; l < numLayers; l++) {
      const size = layerSizes[l];
      const x = numLayers === 1 ? SVG_W / 2 : PAD_X + (l / (numLayers - 1)) * usableW;
      const layerPositions = [];
      for (let n = 0; n < size; n++) {
        const y = size === 1 ? (neuronTop + neuronBottom) / 2 : neuronTop + (n / (size - 1)) * usableH;
        layerPositions.push({ x, y });
      }
      positions.push(layerPositions);
    }
    return positions;
  }, [layers.length, layerSizes, SVG_H]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dy = (e.clientY || e.touches?.[0]?.clientY || 0) - dragStartY.current;
      setNetHeight(Math.max(200, Math.min(800, dragStartH.current + dy)));
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
  }, [dragging]);

  return (
    <div
      style={{
        background: COLORS.panel,
        borderRadius: 10,
        border: `1px solid ${COLORS.panelBorder}`,
        padding: 8,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", height: netHeight }}>
        <div style={{ flex: "0 0 60%", minWidth: 0 }}>
          <svg
            width={SVG_W}
            height={SVG_H}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
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
                    : "#4a6088";
              return (
                <g key={`${li}-${ni}`} onClick={() => setSel({ layerIdx: li, neuronIdx: ni })} style={{ cursor: "pointer" }}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={NEURON_R + (isSel ? 3 : 0)}
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
                    y={pos.y - NEURON_R - 6}
                    textAnchor="middle"
                    fill={COLORS.textMuted}
                    fontSize="9"
                    fontFamily="'Sora', sans-serif"
                    fontWeight="500"
                    style={{ pointerEvents: "none" }}
                  >
                    {isInput ? (ni === 0 ? "x₁" : "x₂") : isOutput ? "out" : `h${li}.${ni + 1}`}
                  </text>
                </g>
              );
            })
          )}
          {layers.map((layer, li) => {
            const x = neuronPositions[li]?.[0]?.x ?? 0;
            const isInput = li === 0;
            const isOutput = li === layers.length - 1;
            const label = isInput ? "Input" : isOutput ? "Output" : `Hidden ${li}`;
            return (
              <text
                key={`lbl-${li}`}
                x={x}
                y={SVG_H - LAYER_LABEL_BOTTOM_BUFFER}
                textAnchor="middle"
                fill={COLORS.textMuted}
                fontSize="9"
                fontFamily="'Sora', sans-serif"
                fontWeight="500"
              >
                {label}
                {!isInput ? ` · ${ACT_FNS[layer.activation].abbr}` : ""}
              </text>
            );
          })}
        </svg>
        </div>
        <div
          style={{
            flex: "0 0 40%",
            minWidth: 0,
            borderLeft: `1px solid ${COLORS.panelBorder}`,
            overflowY: "auto",
          }}
        >
          <InspectorSidebar
            sel={sel}
            setSel={setSel}
            layers={layers}
            activations={activations}
            preActivations={preActivations}
            parameterDrafts={parameterDrafts}
            inputValues={inputValues}
            draftValidityByKey={draftValidityByKey}
            isRevealingSolution={isRevealingSolution}
            updateParameterDraft={updateParameterDraft}
          />
        </div>
      </div>
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          dragStartY.current = e.clientY;
          dragStartH.current = netHeight;
          setDragging(true);
        }}
        onTouchStart={(e) => {
          dragStartY.current = e.touches[0].clientY;
          dragStartH.current = netHeight;
          setDragging(true);
        }}
        style={{
          height: 14,
          cursor: "ns-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "0 0 10px 10px",
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
