import ChallengeThumbnail from "./ChallengeThumbnail";
import { COLORS, DIFFICULTY_COLORS, subtleBtnStyle } from "../styles/theme";

export default function ChallengeLibrary({
  challengeCatalog,
  solvedChallenges,
  activeChallenge,
  isSolutionRevealed,
  isRevealingSolution,
  handleSelectChallenge,
  onExitChallenge,
}) {
  if (activeChallenge) {
    const solved = Boolean(solvedChallenges[activeChallenge.id]);
    return (
      <div style={{ padding: 14, fontFamily: "'Sora', sans-serif", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textBright }}>Active Challenge</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Adjust your network to match the target.</div>
          </div>
          <button
            onClick={onExitChallenge}
            disabled={isRevealingSolution}
            style={{
              ...subtleBtnStyle,
              opacity: isRevealingSolution ? 0.6 : 1,
              cursor: isRevealingSolution ? "default" : "pointer",
            }}
          >
            Exit challenge
          </button>
        </div>

        <div
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 10,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textBright }}>{activeChallenge.name}</div>
            <span
              style={{
                fontSize: 10,
                color: DIFFICULTY_COLORS[activeChallenge.difficulty],
                border: `1px solid ${DIFFICULTY_COLORS[activeChallenge.difficulty]}55`,
                background: "rgba(255,255,255,0.02)",
                borderRadius: 999,
                padding: "2px 8px",
                whiteSpace: "nowrap",
              }}
            >
              {activeChallenge.difficulty}
            </span>
          </div>

          <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{activeChallenge.formula}</div>

          <ChallengeThumbnail values={activeChallenge.targetGrid.values} min={activeChallenge.targetGrid.min} max={activeChallenge.targetGrid.max} />

          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: COLORS.textMuted }}>
            <div>Par: {activeChallenge.par}</div>
            <div style={{ color: solved ? COLORS.success : COLORS.textMuted, fontWeight: 600 }}>{solved ? "✓ Solved" : "Unsolved"}</div>
          </div>

          {isSolutionRevealed && (
            <div
              style={{
                marginTop: 2,
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${COLORS.accent}55`,
                background: COLORS.accentDim,
                fontSize: 11,
                color: COLORS.accent,
                lineHeight: 1.5,
              }}
            >
              Solution is currently revealed for this challenge.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 14, fontFamily: "'Sora', sans-serif", display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textBright }}>Challenge Library</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Pick a target function to overlay on the sandbox.</div>
        </div>
      </div>

      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 170px)", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2 }}>
        {challengeCatalog.map((challenge) => {
          const solved = Boolean(solvedChallenges[challenge.id]);
          return (
            <button
              key={challenge.id}
              onClick={() => handleSelectChallenge(challenge.id)}
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 10,
                color: COLORS.text,
                padding: 10,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textBright }}>{challenge.name}</div>
                <span
                  style={{
                    fontSize: 10,
                    color: DIFFICULTY_COLORS[challenge.difficulty],
                    border: `1px solid ${DIFFICULTY_COLORS[challenge.difficulty]}55`,
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 999,
                    padding: "2px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {challenge.difficulty}
                </span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{challenge.formula}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <ChallengeThumbnail values={challenge.targetGrid.values} min={challenge.targetGrid.min} max={challenge.targetGrid.max} />
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 11, color: COLORS.textMuted }}>
                  <div>Par: {challenge.par}</div>
                  <div style={{ color: solved ? COLORS.success : COLORS.textMuted, fontWeight: 600 }}>{solved ? "✓ Solved" : "Unsolved"}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
