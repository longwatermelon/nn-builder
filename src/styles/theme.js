export const COLORS = {
  bg: "#0b1018",
  panel: "#131b2c",
  panelBorder: "#2a3a56",
  surface: "#1a2540",
  accent: "#00ecb0",
  accentDim: "#00ecb025",
  negative: "#ff5080",
  negativeDim: "#ff508025",
  text: "#cdd8ee",
  textMuted: "#7e90ad",
  textBright: "#eef3ff",
  inputNeuron: "#4b90f7",
  outputNeuron: "#f7a830",
  selected: "#00ecb0",
  success: "#36f880",
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
