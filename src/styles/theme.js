export const COLORS = {
  bg: "#080c14",
  panel: "#0f1523",
  panelBorder: "#1a2540",
  surface: "#151d30",
  accent: "#00e0a0",
  accentDim: "#00e0a040",
  negative: "#ff4070",
  negativeDim: "#ff407040",
  text: "#c8d4e8",
  textMuted: "#5a6f8f",
  textBright: "#e8f0ff",
  inputNeuron: "#3b82f6",
  outputNeuron: "#f59e0b",
  selected: "#00e0a0",
  success: "#2df577",
};

export const DIFFICULTY_COLORS = {
  Beginner: "#4ade80",
  Intermediate: "#f59e0b",
  Advanced: "#fb7185",
  Expert: "#a78bfa",
  Boss: "#38bdf8",
};

export const btnStyle = {
  background: "none",
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 6,
  color: COLORS.text,
  cursor: "pointer",
  padding: "5px 12px",
  fontSize: 12,
  fontFamily: "'Sora', sans-serif",
  fontWeight: 500,
  transition: "all 0.15s",
};

export const subtleBtnStyle = {
  background: "none",
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 6,
  color: COLORS.textMuted,
  cursor: "pointer",
  padding: "5px 10px",
  fontSize: 11,
  fontFamily: "'Sora', sans-serif",
  fontWeight: 500,
  transition: "all 0.15s",
};

export const smallBtnStyle = {
  background: COLORS.bg,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 4,
  color: COLORS.textMuted,
  cursor: "pointer",
  padding: "1px 6px",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: "18px",
};
