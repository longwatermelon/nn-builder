import ChallengeThumbnail from "./ChallengeThumbnail";
import { COLORS, DIFFICULTY_COLORS, subtleBtnStyle } from "../styles/theme";

export default function ChallengeLibrary({
  challengeCatalog,
  solvedChallenges,
  activeChallenge,
  isSolutionRevealed,
  handleSelectChallenge,
  onBack,
}) {
  return (
    <div style={{ padding: 14, fontFamily: "'Sora', sans-serif", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textBright }}>Challenge Library</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Pick any target function and match it.</div>
        </div>
        {activeChallenge && (
          <button onClick={onBack} style={subtleBtnStyle}>
            Back
          </button>
        )}
      </div>

      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 170px)", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2 }}>
        {challengeCatalog.map((challenge) => {
          const solved = Boolean(solvedChallenges[challenge.id]);
          const selected = challenge.id === activeChallenge?.id;
          const disabledByReveal = isSolutionRevealed && challenge.id !== activeChallenge?.id;
          return (
            <button
              key={challenge.id}
              onClick={() => handleSelectChallenge(challenge.id)}
              disabled={disabledByReveal}
              style={{
                background: selected ? COLORS.accentDim : COLORS.surface,
                border: `1px solid ${selected ? COLORS.accent : COLORS.panelBorder}`,
                borderRadius: 10,
                color: COLORS.text,
                padding: 10,
                cursor: disabledByReveal ? "default" : "pointer",
                opacity: disabledByReveal ? 0.5 : 1,
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
