import { useEffect, useRef } from "react";
import { drawHeatmap } from "../lib/heatmap";
import { COLORS } from "../styles/theme";

export default function ChallengeThumbnail({ values, min, max }) {
  const thumbRef = useRef(null);

  useEffect(() => {
    drawHeatmap(thumbRef.current, values, min, max, { showAxes: false, showColorBar: false });
  }, [values, min, max]);

  return (
    <canvas
      ref={thumbRef}
      width={76}
      height={76}
      style={{
        width: 76,
        height: 76,
        borderRadius: 8,
        border: `1px solid ${COLORS.panelBorder}`,
        background: COLORS.bg,
      }}
    />
  );
}
