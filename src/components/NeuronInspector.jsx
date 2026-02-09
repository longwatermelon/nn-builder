import { useEffect, useRef } from "react";
import {
  biasFieldKey,
  clamp,
  getDefaultNeuronName,
  getNeuronCustomName,
  getNeuronName,
  inputFieldKey,
  numberToDraftText,
  parseRealNumber,
  weightFieldKey,
} from "../lib/networkMath";
import { COLORS } from "../styles/theme";
import MathText from "./MathText";

const ZERO_EPSILON = 1e-12;
const UNIT_COEFFICIENT_EPSILON = 1e-9;
const LATEX_TEXT_ESCAPE_PATTERN = /[\\{}$&#_%^~]/g;
const LATEX_TEXT_ESCAPE_MAP = Object.freeze({
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "$": "\\$",
  "&": "\\&",
  "#": "\\#",
  "_": "\\_",
  "%": "\\%",
  "^": "\\^{}",
  "~": "\\~{}",
});

function escapeLatexText(text) {
  return text.replace(LATEX_TEXT_ESCAPE_PATTERN, (char) => LATEX_TEXT_ESCAPE_MAP[char] ?? char);
}

function getDefaultNeuronTex(layerIdx, neuronIdx, layerCount) {
  if (layerIdx === 0) return `x_{${neuronIdx + 1}}`;
  if (layerIdx === layerCount - 1) return "\\mathrm{out}";
  return `h_{${layerIdx},${neuronIdx + 1}}`;
}

export default function NeuronInspector({
  sel,
  setSel,
  layers,
  parameterDrafts,
  inputValues,
  draftValidityByKey,
  isRevealingSolution,
  showParamSliders,
  updateParameterDraft,
  setNeuronName,
}) {
  const layerIdx = sel?.layerIdx ?? 0;
  const neuronIdx = sel?.neuronIdx ?? 0;
  const isInput = layerIdx === 0;
  const layerLabel = layerIdx === 0 ? "Input" : layerIdx === layers.length - 1 ? "Output" : `Hidden ${layerIdx}`;
  const defaultNeuronLabel = getDefaultNeuronName(layerIdx, neuronIdx, layers.length);
  const customNeuronName = getNeuronCustomName(layers, layerIdx, neuronIdx);
  const neuronLabel = getNeuronName(layers, layerIdx, neuronIdx);
  const nameInputRef = useRef(null);
  const shouldFocusNameFieldRef = useRef(false);

  useEffect(() => {
    if (!sel) {
      shouldFocusNameFieldRef.current = false;
      return;
    }
    if (!shouldFocusNameFieldRef.current) return;
    const target = nameInputRef.current;
    if (!target) return;
    target.focus();
    requestAnimationFrame(() => target.select());
    shouldFocusNameFieldRef.current = false;
  }, [sel]);

  if (!sel) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 10,
          color: COLORS.textMuted,
          fontFamily: "'Sora', sans-serif",
          fontSize: 12,
          textAlign: "center",
          userSelect: "none",
        }}
      >
        click a neuron to inspect
      </div>
    );
  }

  const getFieldText = (key, fallback) => parameterDrafts[key] ?? numberToDraftText(fallback);

  const getFieldNumericValue = (key, fallback) => {
    const parsed = parseRealNumber(parameterDrafts[key]);
    return parsed.valid ? parsed.value : fallback;
  };

  const selectTextOnFocus = (event) => {
    const target = event.target;
    requestAnimationFrame(() => target.select());
  };

  const getIncomingSourceLabel = (weightIdx) => getNeuronName(layers, layerIdx - 1, weightIdx);

  const commitNameValue = (nextValue) => {
    if (nextValue === customNeuronName) return;
    setNeuronName(layerIdx, neuronIdx, nextValue);
  };

  const selectNextNeuronInLayer = () => {
    const neuronCount = layerIdx === 0 ? layers[0]?.neuronCount ?? 0 : layers[layerIdx]?.neurons?.length ?? 0;
    const nextNeuronIdx = neuronIdx + 1;
    if (nextNeuronIdx >= neuronCount) {
      shouldFocusNameFieldRef.current = false;
      setSel(null);
      return;
    }
    shouldFocusNameFieldRef.current = true;
    setSel({ layerIdx, neuronIdx: nextNeuronIdx });
  };

  const getNeuronTex = (targetLayerIdx, targetNeuronIdx) => {
    const customName = getNeuronCustomName(layers, targetLayerIdx, targetNeuronIdx);
    if (customName) return `\\text{${escapeLatexText(customName)}}`;
    return getDefaultNeuronTex(targetLayerIdx, targetNeuronIdx, layers.length);
  };

  const getIncomingSourceTex = (weightIdx) => getNeuronTex(layerIdx - 1, weightIdx);

  const formatLatexNumber = (value) => {
    if (!Number.isFinite(value)) return "0";
    const normalized = Math.abs(value) < ZERO_EPSILON ? 0 : value;
    const magnitude = Math.abs(normalized);
    if (magnitude !== 0 && (magnitude >= 1000 || magnitude < 0.001)) {
      const [mantissa, exponent] = normalized.toExponential(2).split("e");
      return `${Number(mantissa)}\\,10^{${Number(exponent)}}`;
    }
    return String(Number(normalized.toFixed(3)));
  };

  const wrapActivationTex = (activationKey, affineTex) => {
    switch (activationKey) {
      case "relu":
        return `\\operatorname{ReLU}\\left(${affineTex}\\right)`;
      case "lrelu":
        return `\\operatorname{LeakyReLU}\\left(${affineTex}\\right)`;
      case "sigmoid":
        return `\\sigma\\left(${affineTex}\\right)`;
      case "tanh":
        return `\\tanh\\left(${affineTex}\\right)`;
      case "sin":
        return `\\sin\\left(${affineTex}\\right)`;
      case "cos":
        return `\\cos\\left(${affineTex}\\right)`;
      case "linear":
      default:
        return affineTex;
    }
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
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            selectNextNeuronInLayer();
          }}
          onFocus={selectTextOnFocus}
          disabled={isRevealingSolution}
          aria-invalid={isInvalid}
          style={{
            flex: 1,
            background: "rgba(30,30,30,0.9)",
            border: `1px solid ${isInvalid ? COLORS.negative : COLORS.panelBorder}`,
            borderRadius: 3,
            padding: "5px 7px",
            color: COLORS.textBright,
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            boxShadow: isInvalid ? `0 0 0 1px ${COLORS.negativeDim}` : "none",
          }}
        />
      </div>
    );
  };

  const neuronEquationTex = !isInput
    ? (() => {
        const neuron = layers[layerIdx].neurons[neuronIdx];
        const weightedTerms = [];
        for (let weightIdx = 0; weightIdx < neuron.weights.length; weightIdx++) {
          const weight = neuron.weights[weightIdx];
          const weightValue = getFieldNumericValue(weightFieldKey(layerIdx, neuronIdx, weightIdx), weight);
          if (Math.abs(weightValue) <= ZERO_EPSILON) continue;
          const sourceTex = getIncomingSourceTex(weightIdx);
          const absWeight = Math.abs(weightValue);
          const coefficientTex = Math.abs(absWeight - 1) < UNIT_COEFFICIENT_EPSILON ? "" : formatLatexNumber(absWeight);
          weightedTerms.push({
            isNegative: weightValue < 0,
            tex: `${coefficientTex}${sourceTex}`,
          });
        }

        const affineTerms = weightedTerms.map((term, idx) => {
          if (idx === 0) return term.isNegative ? `-${term.tex}` : term.tex;
          return `${term.isNegative ? "-" : "+"} ${term.tex}`;
        });

        const biasValue = getFieldNumericValue(biasFieldKey(layerIdx, neuronIdx), neuron.bias);
        if (Math.abs(biasValue) > ZERO_EPSILON) {
          const biasTerm = formatLatexNumber(Math.abs(biasValue));
          if (affineTerms.length === 0) {
            affineTerms.push(biasValue < 0 ? `-${biasTerm}` : biasTerm);
          } else {
            affineTerms.push(`${biasValue < 0 ? "-" : "+"} ${biasTerm}`);
          }
        }

        const hasAnyAffineTerm = affineTerms.length > 0;
        const affineTex = hasAnyAffineTerm ? affineTerms.join(" ") : "0";
        const activatedTex = wrapActivationTex(layers[layerIdx].activation, affineTex);
        const neuronTex = getNeuronTex(layerIdx, neuronIdx);
        return `${neuronTex} = ${activatedTex}`;
      })()
    : "";

  return (
    <div
      style={{
        padding: 10,
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
          aria-label="Clear selection"
          style={{
            background: "rgba(30,30,30,0.7)",
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 3,
            color: COLORS.textMuted,
            cursor: "pointer",
            padding: "3px 7px",
            fontSize: 11,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>NAME</div>
        <input
          ref={nameInputRef}
          key={`name-input-${layerIdx}-${neuronIdx}-${customNeuronName}`}
          type="text"
          defaultValue={customNeuronName}
          placeholder={defaultNeuronLabel}
          onBlur={(event) => commitNameValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitNameValue(event.currentTarget.value);
              selectNextNeuronInLayer();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.currentTarget.value = customNeuronName;
              event.currentTarget.blur();
            }
          }}
          disabled={isRevealingSolution}
          style={{
            width: "100%",
            background: "rgba(30,30,30,0.9)",
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 3,
            padding: "5px 7px",
            color: COLORS.textBright,
            fontFamily: "'Sora', sans-serif",
            fontSize: 12,
            boxSizing: "border-box",
          }}
        />
      </div>

      {isInput && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>INPUT VALUE</div>
          {numberInput(inputFieldKey(neuronIdx), inputValues[neuronIdx], neuronLabel)}
          {showParamSliders && (
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
          )}
        </div>
      )}

      {!isInput && (
        <div
          style={{
            marginBottom: 10,
            background: "rgba(30,30,30,0.8)",
            borderRadius: 4,
            padding: 9,
            border: `1px solid ${COLORS.panelBorder}`,
          }}
        >
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>EQUATION</div>
          <MathText tex={neuronEquationTex} style={{ fontSize: 13, color: COLORS.textBright, lineHeight: 1.35 }} />
        </div>
      )}

      {!isInput && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>BIAS</div>
          {numberInput(biasFieldKey(layerIdx, neuronIdx), layers[layerIdx].neurons[neuronIdx].bias, "b")}
          {showParamSliders && (
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
          )}
        </div>
      )}

      {!isInput && (
        <div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>INCOMING WEIGHTS</div>
          {layers[layerIdx].neurons[neuronIdx].weights.map((w, wi) => {
            const prevLabel = getIncomingSourceLabel(wi);
            const key = weightFieldKey(layerIdx, neuronIdx, wi);
            const sliderValue = clamp(getFieldNumericValue(key, w), -5, 5);
            return (
              <div key={wi}>
                {numberInput(key, w, `w(${prevLabel})`)}
                {showParamSliders && (
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
