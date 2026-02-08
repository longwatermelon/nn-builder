import { useEffect, useRef } from "react";
import { DOMAIN, GRID, drawHeatmap } from "../lib/heatmap";
import MathText from "./MathText";
import { COLORS, subtleBtnStyle } from "../styles/theme";

export default function HeatmapPanel({
  challengeComparisonActive,
  activeChallenge,
  isRevealingSolution,
  isSolutionRevealed,
  challengeScore,
  challengeScoreDisplay,
  scoreLabel,
  scoreColor,
  scoreGlow,
  canRestoreAttempt,
  networkGrid,
  heatmapScale,
  handleShowSolution,
  handleRestoreAttempt,
  handleTryAnother,
}) {
  const userCanvasRef = useRef(null);
  const targetCanvasRef = useRef(null);

  useEffect(() => {
    drawHeatmap(userCanvasRef.current, networkGrid.values, heatmapScale.min, heatmapScale.max, {
      showAxes: true,
      showColorBar: true,
    });
  }, [networkGrid, heatmapScale.min, heatmapScale.max, challengeComparisonActive]);

  useEffect(() => {
    if (!challengeComparisonActive || !activeChallenge) return;
    drawHeatmap(targetCanvasRef.current, activeChallenge.targetGrid.values, heatmapScale.min, heatmapScale.max, {
      showAxes: true,
      showColorBar: true,
    });
  }, [challengeComparisonActive, activeChallenge, heatmapScale.min, heatmapScale.max]);

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
        {challengeComparisonActive ? (
          "Challenge Matchup"
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span>Output Heatmap ·</span>
            <MathText tex="f(x_1, x_2)" style={{ fontSize: 12, color: COLORS.textMuted, textTransform: "none", letterSpacing: 0 }} />
          </span>
        )}
      </div>

      {challengeComparisonActive && activeChallenge && (
        <>
          <div style={{ width: "100%", position: "relative" }}>
            <div style={{ textAlign: "center", padding: "0 90px" }}>
              <MathText tex={activeChallenge.formula} style={{ fontSize: 16, color: "#fff", fontWeight: 600 }} />
              {activeChallenge.hint && <div style={{ fontSize: 12, color: COLORS.accent, marginTop: 5 }}>Hint: {activeChallenge.hint}</div>}
            </div>
            <button
              onClick={handleShowSolution}
              disabled={isRevealingSolution || isSolutionRevealed}
              style={{
                ...subtleBtnStyle,
                position: "absolute",
                right: 0,
                top: 0,
                opacity: isRevealingSolution || isSolutionRevealed ? 0.6 : 1,
                cursor: isRevealingSolution || isSolutionRevealed ? "default" : "pointer",
              }}
            >
              {isRevealingSolution ? "Revealing..." : isSolutionRevealed ? "Solution Shown" : "Show Solution"}
            </button>
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
                {challengeScore >= 95 ? " ✓" : ""}
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

      {!challengeComparisonActive && (
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
