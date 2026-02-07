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
  layers,
  activations,
  preActivations,
  parameterDrafts,
  inputValues,
  draftValidityByKey,
  isRevealingSolution,
  updateParameterDraft,
}) {
  if (!sel) return null;

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
        <span style={{ fontSize: 11, color: COLORS.textMuted, minWidth: 52, fontFamily: "'DM Mono', monospace" }}>{label}</span>
        <input
          type="text"
          inputMode="decimal"
          value={getFieldText(key, fallback)}
          onChange={(e) => updateParameterDraft(key, e.target.value)}
          disabled={isRevealingSolution}
          aria-invalid={isInvalid}
          style={{
            flex: 1,
            background: "rgba(8,12,20,0.86)",
            border: `1px solid ${isInvalid ? COLORS.negative : COLORS.panelBorder}`,
            borderRadius: 6,
            padding: "5px 7px",
            color: COLORS.textBright,
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            outline: "none",
            boxShadow: isInvalid ? `0 0 0 1px ${COLORS.negativeDim}` : "none",
          }}
        />
      </div>
    );
  };

  return (
    <div
      style={{
        width: "100%",
        maxHeight: "100%",
        overflowY: "auto",
        padding: 10,
        borderRadius: 10,
        border: `1px solid ${COLORS.panelBorder}`,
        background: "rgba(15,21,35,0.78)",
        backdropFilter: "blur(7px)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        color: COLORS.text,
        fontFamily: "'Sora', sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: COLORS.accent, fontWeight: 600, letterSpacing: 1.1, textTransform: "uppercase" }}>
            {layerLabel} layer
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textBright }}>Neuron {neuronLabel}</div>
        </div>
        <button
          onClick={() => setSel(null)}
          style={{
            background: "rgba(8,12,20,0.6)",
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 6,
            color: COLORS.textMuted,
            cursor: "pointer",
            padding: "3px 7px",
            fontSize: 11,
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          background: "rgba(8,12,20,0.72)",
          borderRadius: 8,
          padding: 9,
          marginBottom: 10,
          border: `1px solid ${COLORS.panelBorder}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: COLORS.textMuted }}>{isInput ? "Value" : "Activation"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textBright, fontFamily: "'DM Mono', monospace" }}>{fmt(act)}</span>
        </div>
        {!isInput && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: COLORS.textMuted }}>Pre-activation</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{fmt(pre)}</span>
          </div>
        )}
        {!isInput && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
            <span style={{ fontSize: 10, color: COLORS.textMuted }}>Activation fn</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>
              {ACT_FNS[layers[layerIdx].activation].label}
            </span>
          </div>
        )}
      </div>

      {isInput && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>INPUT VALUE</div>
          {numberInput(inputFieldKey(neuronIdx), inputValues[neuronIdx], neuronLabel)}
          <input
            type="range"
            min={-5}
            max={5}
            step={0.01}
            value={clamp(getFieldNumericValue(inputFieldKey(neuronIdx), inputValues[neuronIdx]), -5, 5)}
            onChange={(e) => updateParameterDraft(inputFieldKey(neuronIdx), e.target.value)}
            disabled={isRevealingSolution}
            style={{ width: "100%", accentColor: COLORS.accent, marginTop: 2 }}
          />
        </div>
      )}

      {!isInput && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>BIAS</div>
          {numberInput(biasFieldKey(layerIdx, neuronIdx), layers[layerIdx].neurons[neuronIdx].bias, "b")}
          <input
            type="range"
            min={-5}
            max={5}
            step={0.01}
            value={clamp(getFieldNumericValue(biasFieldKey(layerIdx, neuronIdx), layers[layerIdx].neurons[neuronIdx].bias), -5, 5)}
            onChange={(e) => updateParameterDraft(biasFieldKey(layerIdx, neuronIdx), e.target.value)}
            disabled={isRevealingSolution}
            style={{ width: "100%", accentColor: COLORS.accent, marginTop: 1 }}
          />
        </div>
      )}

      {!isInput && (
        <div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>INCOMING WEIGHTS</div>
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
                    marginBottom: 5,
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
