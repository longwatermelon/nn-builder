import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  biasFieldKey,
  buildNeuronEquationTex,
  clamp,
  getDefaultNeuronName,
  getNeuronCustomName,
  getNeuronTex,
  inputFieldKey,
  normalizeNeuronName,
  numberToDraftText,
  parseRealNumber,
  weightFieldKey,
} from "../lib/networkMath";
import { COLORS } from "../styles/theme";
import MathText from "./MathText";

function NeuronNameInput({
  inputRef,
  nameValue,
  placeholder,
  commitNameValue,
  selectNextNeuronInLayer,
  isRevealingSolution,
}) {
  const [nameDraft, setNameDraft] = useState(nameValue);
  const [isEditing, setIsEditing] = useState(false);
  const nameEditStartValueRef = useRef(nameValue);
  const skipBlurCommitRef = useRef(false);
  const displayValue = isEditing ? nameDraft : nameValue;

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      placeholder={placeholder}
      onFocus={(event) => {
        const currentValue = event.currentTarget.value;
        nameEditStartValueRef.current = currentValue;
        setNameDraft(currentValue);
        setIsEditing(true);
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setNameDraft(nextValue);
        commitNameValue(nextValue);
      }}
      onBlur={(event) => {
        if (skipBlurCommitRef.current) {
          skipBlurCommitRef.current = false;
          setIsEditing(false);
          return;
        }
        const normalizedValue = normalizeNeuronName(event.target.value);
        setNameDraft(normalizedValue);
        commitNameValue(normalizedValue);
        setIsEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const normalizedValue = normalizeNeuronName(event.currentTarget.value);
          setNameDraft(normalizedValue);
          commitNameValue(normalizedValue);
          selectNextNeuronInLayer();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          skipBlurCommitRef.current = true;
          const priorValue = nameEditStartValueRef.current;
          setNameDraft(priorValue);
          commitNameValue(priorValue);
          setIsEditing(false);
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
  );
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
  showNameField = true,
  showInputValueSection = true,
  showEquationSection = true,
  showBiasSection = true,
  showWeightsSection = true,
  hiddenIncomingWeightIndexes = [],
  showClearSelectionButton = true,
  nameFieldFocusRequest = null,
}) {
  const layerIdx = sel?.layerIdx ?? 0;
  const neuronIdx = sel?.neuronIdx ?? 0;
  const isInput = layerIdx === 0;
  const layerLabel = layerIdx === 0 ? "Input" : layerIdx === layers.length - 1 ? "Output" : `Hidden ${layerIdx}`;
  const defaultNeuronLabel = getDefaultNeuronName(layerIdx, neuronIdx, layers.length);
  const customNeuronName = getNeuronCustomName(layers, layerIdx, neuronIdx);
  const neuronTex = getNeuronTex(layers, layerIdx, neuronIdx);
  const nameInputRef = useRef(null);
  const handledFocusRequestIdRef = useRef(0);
  const hiddenIncomingWeightIndexSet = useMemo(
    () => new Set(Array.isArray(hiddenIncomingWeightIndexes) ? hiddenIncomingWeightIndexes : []),
    [hiddenIncomingWeightIndexes]
  );

  useLayoutEffect(() => {
    if (!sel) return;
    if (!nameFieldFocusRequest || typeof nameFieldFocusRequest.requestId !== "number") return;
    if (nameFieldFocusRequest.layerIdx !== layerIdx || nameFieldFocusRequest.neuronIdx !== neuronIdx) return;
    if (nameFieldFocusRequest.requestId === handledFocusRequestIdRef.current) return;
    handledFocusRequestIdRef.current = nameFieldFocusRequest.requestId;
    if (!showNameField || isRevealingSolution) return;
    const target = nameInputRef.current;
    if (!target) return;
    target.focus();
    target.select();
  }, [sel, showNameField, isRevealingSolution, nameFieldFocusRequest, layerIdx, neuronIdx]);

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

  const commitNameValue = (nextValue) => {
    setNeuronName(layerIdx, neuronIdx, nextValue);
  };

  const selectNextNeuronInLayer = () => {
    const neuronCount = layerIdx === 0 ? layers[0]?.neuronCount ?? 0 : layers[layerIdx]?.neurons?.length ?? 0;
    const nextNeuronIdx = neuronIdx + 1;
    if (nextNeuronIdx >= neuronCount) {
      setSel(null);
      return;
    }
    setSel({ layerIdx, neuronIdx: nextNeuronIdx });
  };

  const getIncomingSourceTex = (weightIdx) => getNeuronTex(layers, layerIdx - 1, weightIdx);

  const numberInput = (key, fallback, labelTex) => {
    const isInvalid = draftValidityByKey[key] === false;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 52, display: "flex", alignItems: "center" }}>
          <MathText tex={labelTex} style={{ fontSize: 11, color: COLORS.textMuted }} />
        </div>
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
        const weights = neuron.weights.map((weight, weightIdx) =>
          getFieldNumericValue(weightFieldKey(layerIdx, neuronIdx, weightIdx), weight)
        );
        const sourceTerms = neuron.weights.map((_, weightIdx) => getIncomingSourceTex(weightIdx));
        const biasValue = getFieldNumericValue(biasFieldKey(layerIdx, neuronIdx), neuron.bias);
        const targetNeuronTex = getNeuronTex(layers, layerIdx, neuronIdx);
        return buildNeuronEquationTex(targetNeuronTex, layers[layerIdx].activation, biasValue, weights, sourceTerms);
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
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 700, color: COLORS.textBright }}>
            <span>Neuron</span>
            <MathText tex={neuronTex} style={{ fontSize: 14, color: COLORS.textBright }} />
          </div>
        </div>
        {showClearSelectionButton && (
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
        )}
      </div>

      {showNameField && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>NAME</div>
          <NeuronNameInput
            key={`name-input-${layerIdx}-${neuronIdx}`}
            inputRef={nameInputRef}
            nameValue={customNeuronName}
            placeholder={defaultNeuronLabel}
            commitNameValue={commitNameValue}
            selectNextNeuronInLayer={selectNextNeuronInLayer}
            isRevealingSolution={isRevealingSolution}
          />
        </div>
      )}

      {isInput && showInputValueSection && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>INPUT VALUE</div>
          {numberInput(inputFieldKey(neuronIdx), inputValues[neuronIdx], neuronTex)}
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

      {!isInput && showEquationSection && (
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

      {!isInput && showBiasSection && (
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

      {!isInput && showWeightsSection && (
        <div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>INCOMING WEIGHTS</div>
          {layers[layerIdx].neurons[neuronIdx].weights.map((w, wi) => {
            if (hiddenIncomingWeightIndexSet.has(wi)) return null;
            const sourceTex = getIncomingSourceTex(wi);
            const key = weightFieldKey(layerIdx, neuronIdx, wi);
            const sliderValue = clamp(getFieldNumericValue(key, w), -5, 5);
            return (
              <div key={wi}>
                {numberInput(key, w, `w\\left(${sourceTex}\\right)`)}
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
