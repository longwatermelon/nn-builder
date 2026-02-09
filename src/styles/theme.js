// shared palette tokens — vscode dark+ inspired
export const COLORS = {
  bg: "#1e1e1e",
  panel: "#252526",
  panelBorder: "#3c3c3c",
  surface: "#2d2d2d",
  accent: "#0098ff",
  accentDim: "#0098ff20",
  negative: "#f44747",
  negativeDim: "#f4474720",
  text: "#cccccc",
  textMuted: "#858585",
  textBright: "#e8e8e8",
  inputNeuron: "#569cd6",
  outputNeuron: "#dcdcaa",
  selected: "#0098ff",
  success: "#4ec9b0",
};

export const DIFFICULTY_COLORS = {
  tutorial: "#4ec9b0",
  easy: "#569cd6",
  medium: "#dcdcaa",
  hard: "#f44747",
  insane: "#c586c0",
};

// base action button style
export const btnStyle = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 4,
  color: COLORS.text,
  cursor: "pointer",
  padding: "5px 12px",
  fontSize: 12,
  fontFamily: "'Sora', sans-serif",
  fontWeight: 500,
  transition: "background 0.12s, border-color 0.12s",
};

export const subtleBtnStyle = {
  background: "transparent",
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 4,
  color: COLORS.textMuted,
  cursor: "pointer",
  padding: "5px 10px",
  fontSize: 11,
  fontFamily: "'Sora', sans-serif",
  fontWeight: 500,
  transition: "background 0.12s, border-color 0.12s",
};

// compact icon-style controls used in layer chips
export const smallBtnStyle = {
  background: COLORS.bg,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 3,
  color: COLORS.textMuted,
  cursor: "pointer",
  padding: "1px 6px",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: "18px",
};
