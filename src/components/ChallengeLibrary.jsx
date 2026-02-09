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
    <div style={{ padding: 12, fontFamily: "'Sora', sans-serif", display: "flex", flexDirection: "column", gap: 10, height: "100%", width: "100%" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1.2, textTransform: "uppercase" }}>Challenge Library</div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.4 }}>Pick a target function to match.</div>
      </div>

      <div style={{ overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2, flex: 1, minHeight: 0 }}>
        {/* keep all challenges visible so users can switch quickly */}
        {challengeCatalog.map((challenge) => {
          const solved = Boolean(solvedChallenges[challenge.id]);
          const isSelected = challenge.id === selectedChallengeId;
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
                border: `1px solid ${isSelected ? `${COLORS.accent}50` : COLORS.panelBorder}`,
                borderRadius: 4,
                color: COLORS.text,
                padding: 10,
                cursor: isRevealingSolution ? "default" : "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                boxShadow: isSelected ? `2px 0 0 ${COLORS.accent} inset` : "none",
                opacity: isRevealingSolution ? 0.7 : 1,
                transition: "background 0.1s, border-color 0.1s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textBright }}>{challenge.name}</div>
                <span
                  style={{
                    fontSize: 10,
                    color: difficultyColor,
                    background: `${difficultyColor}18`,
                    borderRadius: 3,
                    padding: "2px 7px",
                    whiteSpace: "nowrap",
                    fontWeight: 600,
                    letterSpacing: 0.3,
                  }}
                >
                  {difficultyLabel}
                </span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                <MathText tex={challenge.formula} style={{ fontSize: 13, color: COLORS.textMuted }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <ChallengeThumbnail values={challenge.targetGrid.values} min={challenge.targetGrid.min} max={challenge.targetGrid.max} />
                <div style={{ display: "flex", alignItems: "center", fontSize: 11, color: solved ? COLORS.success : COLORS.textMuted, fontWeight: 600 }}>
                  {solved ? "✓ Solved" : "Unsolved"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
