import {
  ACT_FNS,
  biasFieldKey,
  clamp,
  fmt,
  inputFieldKey,
  numberToDraftText,
  parseRealNumber,
  weightFieldKey,
} from "../lib/networkMath";
import { COLORS } from "../styles/theme";

export default function InspectorSidebar({
  sel,
  setSel,
  challengeComparisonActive,
  activeChallenge,
  scoreColor,
  challengeScoreDisplay,
  layers,
  activations,
  preActivations,
  parameterDrafts,
  inputValues,
  draftValidityByKey,
  isRevealingSolution,
  updateParameterDraft,
}) {
  if (!sel) {
    return (
      <div style={{ padding: 20, color: COLORS.textMuted, fontFamily: "'Sora', sans-serif", fontSize: 13 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>Neuron Inspector</div>
        <p style={{ lineHeight: 1.6 }}>Click on any neuron in the network to inspect and edit its properties.</p>
        {challengeComparisonActive && activeChallenge && (
          <div
            style={{
              marginBottom: 14,
              padding: 12,
              background: COLORS.bg,
              borderRadius: 8,
              border: `1px solid ${COLORS.panelBorder}`,
            }}
          >
            <div style={{ fontSize: 10, color: COLORS.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
              Active Challenge
            </div>
            <div style={{ fontSize: 14, color: COLORS.textBright, fontWeight: 600 }}>{activeChallenge.name}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{activeChallenge.formula}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: scoreColor, fontWeight: 600 }}>
              Match score: {challengeScoreDisplay.toFixed(2)}%
            </div>
          </div>
        )}
        <div
          style={{
            marginTop: 20,
            padding: 14,
            background: COLORS.bg,
            borderRadius: 8,
            border: `1px solid ${COLORS.panelBorder}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: COLORS.accent,
              marginBottom: 6,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Quick Tips
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, color: COLORS.textMuted, fontSize: 12, lineHeight: 1.8 }}>
            <li>Click neurons to select them</li>
            <li>Edit weights and biases below</li>
            <li>Heatmap updates in real time</li>
            <li>Add layers with the + button</li>
          </ul>
        </div>
      </div>
    );
  }

  const { layerIdx, neuronIdx } = sel;
  const isInput = layerIdx === 0;
  const layerLabel = layerIdx === 0 ? "Input" : layerIdx === layers.length - 1 ? "Output" : `Hidden ${layerIdx}`;
  const neuronLabel = isInput ? (neuronIdx === 0 ? "x₁" : "x₂") : `n${neuronIdx + 1}`;
  const act = activations[layerIdx]?.[neuronIdx];
  const pre = preActivations[layerIdx]?.[neuronIdx];

  const getFieldText = (key, fallback) => parameterDrafts[key] ?? numberToDraftText(fallback);

  const getFieldNumericValue = (key, fallback) => {
    const parsed = parseRealNumber(parameterDrafts[key]);
    return parsed.valid ? parsed.value : fallback;
  };

  const numberInput = (key, fallback, label) => {
    const isInvalid = draftValidityByKey[key] === false;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: COLORS.textMuted, minWidth: 60, fontFamily: "'DM Mono', monospace" }}>{label}</span>
        <input
          type="text"
          inputMode="decimal"
          value={getFieldText(key, fallback)}
          onChange={(e) => updateParameterDraft(key, e.target.value)}
          disabled={isRevealingSolution}
          aria-invalid={isInvalid}
          style={{
            flex: 1,
            background: COLORS.bg,
            border: `1px solid ${isInvalid ? COLORS.negative : COLORS.panelBorder}`,
            borderRadius: 6,
            padding: "6px 8px",
            color: COLORS.textBright,
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            outline: "none",
            boxShadow: isInvalid ? `0 0 0 1px ${COLORS.negativeDim}` : "none",
          }}
        />
      </div>
    );
  };

  return (
    <div style={{ padding: 16, fontFamily: "'Sora', sans-serif", overflowY: "auto", maxHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div
            style={{
              fontSize: 10,
              color: COLORS.accent,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            {layerLabel} Layer
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textBright }}>Neuron {neuronLabel}</div>
        </div>
        <button
          onClick={() => setSel(null)}
          style={{
            background: "none",
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 6,
            color: COLORS.textMuted,
            cursor: "pointer",
            padding: "4px 8px",
            fontSize: 11,
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          background: COLORS.bg,
          borderRadius: 8,
          padding: 12,
          marginBottom: 14,
          border: `1px solid ${COLORS.panelBorder}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>{isInput ? "Value" : "Activation"}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textBright, fontFamily: "'DM Mono', monospace" }}>{fmt(act)}</span>
        </div>
        {!isInput && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>Pre-activation</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{fmt(pre)}</span>
          </div>
        )}
        {!isInput && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>Activation fn</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>
              {ACT_FNS[layers[layerIdx].activation].label}
            </span>
          </div>
        )}
      </div>

      {isInput && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500, letterSpacing: 0.5 }}>INPUT VALUE</div>
          {numberInput(inputFieldKey(neuronIdx), inputValues[neuronIdx], neuronLabel)}
          <input
            type="range"
            min={-5}
            max={5}
            step={0.01}
            value={clamp(getFieldNumericValue(inputFieldKey(neuronIdx), inputValues[neuronIdx]), -5, 5)}
            onChange={(e) => updateParameterDraft(inputFieldKey(neuronIdx), e.target.value)}
            disabled={isRevealingSolution}
            style={{ width: "100%", accentColor: COLORS.accent, marginTop: 4 }}
          />
        </div>
      )}

      {!isInput && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500, letterSpacing: 0.5 }}>BIAS</div>
          {numberInput(biasFieldKey(layerIdx, neuronIdx), layers[layerIdx].neurons[neuronIdx].bias, "b")}
          <input
            type="range"
            min={-5}
            max={5}
            step={0.01}
            value={clamp(getFieldNumericValue(biasFieldKey(layerIdx, neuronIdx), layers[layerIdx].neurons[neuronIdx].bias), -5, 5)}
            onChange={(e) => updateParameterDraft(biasFieldKey(layerIdx, neuronIdx), e.target.value)}
            disabled={isRevealingSolution}
            style={{ width: "100%", accentColor: COLORS.accent, marginTop: 2 }}
          />
        </div>
      )}

      {!isInput && (
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500, letterSpacing: 0.5 }}>INCOMING WEIGHTS</div>
          {layers[layerIdx].neurons[neuronIdx].weights.map((w, wi) => {
            const prevLabel = layerIdx === 1 ? (wi === 0 ? "x₁" : wi === 1 ? "x₂" : `x${wi + 1}`) : `h${layerIdx - 1}n${wi + 1}`;
            const key = weightFieldKey(layerIdx, neuronIdx, wi);
            const sliderValue = clamp(getFieldNumericValue(key, w), -5, 5);
            return (
              <div key={wi}>
                {numberInput(key, w, `w(${prevLabel})`)}
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.01}
                  value={sliderValue}
                  onChange={(e) => updateParameterDraft(key, e.target.value)}
                  disabled={isRevealingSolution}
                  style={{
                    width: "100%",
                    accentColor: sliderValue >= 0 ? COLORS.accent : COLORS.negative,
                    marginTop: -2,
                    marginBottom: 6,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
