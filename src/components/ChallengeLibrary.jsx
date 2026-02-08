import ChallengeThumbnail from "./ChallengeThumbnail";
import MathText from "./MathText";
import { COLORS, DIFFICULTY_COLORS } from "../styles/theme";

export default function ChallengeLibrary({
  challengeCatalog,
  solvedChallenges,
  activeChallenge,
  isRevealingSolution,
  handleSelectChallenge,
}) {
  const selectedChallengeId = activeChallenge?.id ?? null;

  return (
    <div style={{ padding: 14, fontFamily: "'Sora', sans-serif", display: "flex", flexDirection: "column", gap: 12, height: "100%", width: "100%" }}>
      <div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textBright }}>Challenge Library</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Pick a target function to overlay on the sandbox.</div>
        </div>
      </div>

      <div style={{ overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2, flex: 1, minHeight: 0 }}>
        {challengeCatalog.map((challenge) => {
          const solved = Boolean(solvedChallenges[challenge.id]);
          const isSelected = challenge.id === selectedChallengeId;
          const showFormula = true;
          const difficultyRaw = typeof challenge.difficulty === "string" ? challenge.difficulty : "unknown";
          const difficultyLabel = difficultyRaw.charAt(0).toUpperCase() + difficultyRaw.slice(1);
          const difficultyColor = DIFFICULTY_COLORS[difficultyRaw] ?? COLORS.textMuted;
          return (
            <button
              key={challenge.id}
              onClick={() => handleSelectChallenge(challenge.id)}
              disabled={isRevealingSolution}
              style={{
                background: isSelected ? COLORS.accentDim : COLORS.surface,
                border: `1px solid ${isSelected ? `${COLORS.accent}70` : COLORS.panelBorder}`,
                borderRadius: 10,
                color: COLORS.text,
                padding: 10,
                cursor: isRevealingSolution ? "default" : "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                boxShadow: isSelected ? `0 0 0 1px ${COLORS.accent}40 inset` : "none",
                opacity: isRevealingSolution ? 0.7 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textBright }}>{challenge.name}</div>
                <span
                  style={{
                    fontSize: 10,
                    color: difficultyColor,
                    border: `1px solid ${difficultyColor}55`,
                    background: `${difficultyColor}22`,
                    borderRadius: 999,
                    padding: "2px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {difficultyLabel}
                </span>
              </div>
              {showFormula && (
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                  <MathText tex={challenge.formula} style={{ fontSize: 13, color: COLORS.textMuted }} />
                </div>
              )}
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
