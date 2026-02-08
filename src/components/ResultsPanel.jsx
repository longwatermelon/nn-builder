import { useEffect, useMemo, useRef, useState } from "react";
import { MATCH_SCORE_THRESHOLD } from "../features/challenges/score";
import { copyTextToClipboard } from "../lib/clipboard";
import { DOMAIN, GRID, drawHeatmap } from "../lib/heatmap";
import MathText from "./MathText";
import { COLORS, subtleBtnStyle } from "../styles/theme";

const HEATMAP_DRAW_OPTIONS = { showAxes: true, showColorBar: true };

export default function ResultsPanel({
  isChallengeSelected,
  activeChallenge,
  isRevealingSolution,
  isSolutionRevealed,
  challengeScore,
  challengeScoreDisplay,
  matchThreshold = MATCH_SCORE_THRESHOLD,
  scoreLabel,
  scoreColor,
  scoreGlow,
  canRestoreAttempt,
  networkGrid,
  heatmapScale,
  inputValues,
  handleShowSolution,
  handleRestoreAttempt,
  handleTryAnother,
}) {
  const userCanvasRef = useRef(null);
  const targetCanvasRef = useRef(null);
  const formulaCopyTimeoutRef = useRef(null);
  const [copiedFormulaChallengeId, setCopiedFormulaChallengeId] = useState(null);
  const [isInputMarkerVisible, setIsInputMarkerVisible] = useState(false);

  const markerPoint = useMemo(() => {
    if (!isInputMarkerVisible) return null;
    return {
      x1: inputValues[0] ?? 0,
      x2: inputValues[1] ?? 0,
    };
  }, [isInputMarkerVisible, inputValues]);

  const heatmapDrawOptions = useMemo(
    () => ({ ...HEATMAP_DRAW_OPTIONS, markerPoint }),
    [markerPoint]
  );

  // clear pending copied-state timer on unmount
  useEffect(
    () => () => {
      if (formulaCopyTimeoutRef.current) clearTimeout(formulaCopyTimeoutRef.current);
    },
    []
  );

  const handleCopyFormula = async () => {
    if (!activeChallenge?.formula) return;
    try {
      await copyTextToClipboard(activeChallenge.formula);
      setCopiedFormulaChallengeId(activeChallenge.id);
      if (formulaCopyTimeoutRef.current) clearTimeout(formulaCopyTimeoutRef.current);
      formulaCopyTimeoutRef.current = setTimeout(() => {
        setCopiedFormulaChallengeId(null);
      }, 1400);
    } catch {
      window.alert("Unable to copy formula to clipboard.");
    }
  };

  // redraw user output whenever network samples or scale changes
  useEffect(() => {
    drawHeatmap(userCanvasRef.current, networkGrid.values, heatmapScale.min, heatmapScale.max, heatmapDrawOptions);
  }, [networkGrid, heatmapScale.min, heatmapScale.max, isChallengeSelected, heatmapDrawOptions]);

  // redraw target only while challenge mode is active
  useEffect(() => {
    if (!isChallengeSelected || !activeChallenge) return;
    drawHeatmap(
      targetCanvasRef.current,
      activeChallenge.targetGrid.values,
      heatmapScale.min,
      heatmapScale.max,
      heatmapDrawOptions
    );
  }, [isChallengeSelected, activeChallenge, heatmapScale.min, heatmapScale.max, heatmapDrawOptions]);

  return (
    <div
      style={{
        background: COLORS.panel,
        borderRadius: 10,
        border: `1px solid ${COLORS.panelBorder}`,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: COLORS.textMuted,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        {isChallengeSelected ? (
          "Challenge Matchup"
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span>Output Heatmap ·</span>
            <MathText tex="f(x_1, x_2)" style={{ fontSize: 12, color: COLORS.textMuted, textTransform: "none", letterSpacing: 0 }} />
          </span>
        )}
      </div>

      <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setIsInputMarkerVisible((prev) => !prev)}
          aria-pressed={isInputMarkerVisible}
          style={{
            ...subtleBtnStyle,
            color: isInputMarkerVisible ? COLORS.accent : COLORS.textMuted,
            borderColor: isInputMarkerVisible ? `${COLORS.accent}65` : COLORS.panelBorder,
          }}
        >
          {isInputMarkerVisible ? "Hide Input Marker" : "Show Input Marker"}
        </button>
      </div>

      {isChallengeSelected && activeChallenge && (
        <>
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <MathText tex={activeChallenge.formula} style={{ fontSize: 16, color: "#fff", fontWeight: 600 }} />
              {activeChallenge.hint && <div style={{ fontSize: 12, color: COLORS.accent, marginTop: 5 }}>Hint: {activeChallenge.hint}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={handleCopyFormula}
                style={{
                  ...subtleBtnStyle,
                  color: copiedFormulaChallengeId === activeChallenge.id ? COLORS.success : COLORS.accent,
                  borderColor:
                    copiedFormulaChallengeId === activeChallenge.id ? `${COLORS.success}70` : `${COLORS.accent}50`,
                }}
              >
                {copiedFormulaChallengeId === activeChallenge.id ? "Copied LaTeX" : "Copy LaTeX"}
              </button>
              <button
                onClick={handleShowSolution}
                disabled={isRevealingSolution || isSolutionRevealed}
                style={{
                  ...subtleBtnStyle,
                  opacity: isRevealingSolution || isSolutionRevealed ? 0.6 : 1,
                  cursor: isRevealingSolution || isSolutionRevealed ? "default" : "pointer",
                }}
              >
                {isRevealingSolution ? "Revealing..." : isSolutionRevealed ? "Solution Shown" : "Show Solution"}
              </button>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              background: COLORS.bg,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: scoreColor, fontWeight: 600 }}>
                {scoreLabel}
                {challengeScore >= matchThreshold ? " ✓" : ""}
              </span>
              <span style={{ fontSize: 13, color: COLORS.textBright, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                {challengeScoreDisplay.toFixed(2)}%
              </span>
            </div>
            <div
              style={{
                height: 12,
                borderRadius: 999,
                background: "#1e2d48",
                border: `1px solid ${COLORS.panelBorder}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${challengeScoreDisplay.toFixed(2)}%`,
                  background: scoreColor,
                  transition: "width 120ms linear, background 140ms linear",
                  boxShadow: scoreGlow ? `0 0 16px ${scoreColor}` : "none",
                }}
              />
            </div>
          </div>

          {isSolutionRevealed && (
            <div
              style={{
                width: "100%",
                border: `1px solid ${COLORS.accent}55`,
                background: COLORS.accentDim,
                borderRadius: 10,
                padding: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>Solution revealed</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleRestoreAttempt}
                  disabled={!canRestoreAttempt}
                  style={{
                    ...subtleBtnStyle,
                    opacity: canRestoreAttempt ? 1 : 0.5,
                    cursor: canRestoreAttempt ? "pointer" : "default",
                  }}
                >
                  Restore my attempt
                </button>
                <button onClick={handleTryAnother} style={subtleBtnStyle}>
                  Try another
                </button>
              </div>
            </div>
          )}

          <div style={{ width: "100%", display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                background: COLORS.bg,
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 10,
                padding: 8,
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Your Network</div>
              <canvas
                ref={userCanvasRef}
                width={360}
                height={360}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${COLORS.panelBorder}`,
                  width: "min(360px, 42vw)",
                  height: "min(360px, 42vw)",
                  background: COLORS.bg,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                background: COLORS.bg,
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 10,
                padding: 8,
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Target</div>
              <canvas
                ref={targetCanvasRef}
                width={360}
                height={360}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${COLORS.panelBorder}`,
                  width: "min(360px, 42vw)",
                  height: "min(360px, 42vw)",
                  background: COLORS.bg,
                }}
              />
            </div>
          </div>
        </>
      )}

      {!isChallengeSelected && (
        <>
          <canvas
            ref={userCanvasRef}
            width={400}
            height={400}
            style={{
              borderRadius: 6,
              border: `1px solid ${COLORS.panelBorder}`,
              width: 380,
              height: 380,
              background: COLORS.bg,
            }}
          />
        </>
      )}

      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 4,
          fontSize: 11,
          color: COLORS.textMuted,
          fontFamily: "'DM Mono', monospace",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span>
          Domain: [{DOMAIN[0]}, {DOMAIN[1]}] × [{DOMAIN[0]}, {DOMAIN[1]}]
        </span>
        <span>
          Resolution: {GRID}×{GRID}
        </span>
      </div>
    </div>
  );
}
