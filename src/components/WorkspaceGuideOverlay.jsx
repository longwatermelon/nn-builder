import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { btnStyle, COLORS, subtleBtnStyle } from "../styles/theme";

const SPOTLIGHT_PADDING = 10;
const VIEWPORT_EDGE_PADDING = 8;
const TOOLTIP_WIDTH = 332;
const TOOLTIP_ESTIMATED_HEIGHT = 190;
const OVERLAY_COLOR = "rgba(0, 0, 0, 0.58)";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function WorkspaceGuideOverlay({
  stops = [],
  onClose,
  onComplete,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const cardRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastAutoScrollStepRef = useRef(-1);

  const activeStop = stops[stepIndex] ?? null;
  const activeTargetRef = activeStop?.targetRef ?? null;

  useEffect(() => {
    cardRef.current?.focus();
  }, [stepIndex]);

  const updateHighlight = useCallback(() => {
    if (!activeTargetRef?.current) {
      setHighlightRect((prev) => (prev === null ? prev : null));
      return;
    }

    const targetElement = activeTargetRef.current;
    const targetRect = targetElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    setViewport((prev) =>
      prev.width === viewportWidth && prev.height === viewportHeight
        ? prev
        : { width: viewportWidth, height: viewportHeight }
    );

    const viewportTop = VIEWPORT_EDGE_PADDING;
    const viewportLeft = VIEWPORT_EDGE_PADDING;
    const viewportBottom = viewportHeight - VIEWPORT_EDGE_PADDING;
    const viewportRight = viewportWidth - VIEWPORT_EDGE_PADDING;
    const isOutsideViewport =
      targetRect.top < viewportTop
      || targetRect.bottom > viewportBottom
      || targetRect.left < viewportLeft
      || targetRect.right > viewportRight;

    if (isOutsideViewport && lastAutoScrollStepRef.current !== stepIndex) {
      lastAutoScrollStepRef.current = stepIndex;
      targetElement.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }

    const minHighlightWidth = 40;
    const minHighlightHeight = 32;
    const maxLeft = Math.max(viewportLeft, viewportRight - minHighlightWidth);
    const maxTop = Math.max(viewportTop, viewportBottom - minHighlightHeight);
    const left = clamp(targetRect.left - SPOTLIGHT_PADDING, viewportLeft, maxLeft);
    const top = clamp(targetRect.top - SPOTLIGHT_PADDING, viewportTop, maxTop);
    const right = clamp(targetRect.right + SPOTLIGHT_PADDING, left + minHighlightWidth, viewportRight);
    const bottom = clamp(targetRect.bottom + SPOTLIGHT_PADDING, top + minHighlightHeight, viewportBottom);

    const nextRect = {
      left,
      top,
      width: Math.max(minHighlightWidth, right - left),
      height: Math.max(minHighlightHeight, bottom - top),
    };

    setHighlightRect((prev) => {
      if (!prev) return nextRect;
      if (
        Math.abs(prev.left - nextRect.left) < 0.5
        && Math.abs(prev.top - nextRect.top) < 0.5
        && Math.abs(prev.width - nextRect.width) < 0.5
        && Math.abs(prev.height - nextRect.height) < 0.5
      ) {
        return prev;
      }
      return nextRect;
    });
  }, [activeTargetRef, stepIndex]);

  useLayoutEffect(() => {
    const scheduleHighlightUpdate = () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = null;
        updateHighlight();
      });
    };

    scheduleHighlightUpdate();
    window.addEventListener("resize", scheduleHighlightUpdate);
    window.addEventListener("scroll", scheduleHighlightUpdate, true);

    return () => {
      window.removeEventListener("resize", scheduleHighlightUpdate);
      window.removeEventListener("scroll", scheduleHighlightUpdate, true);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [updateHighlight]);

  const handleBack = useCallback(() => {
    setStepIndex((prev) => (prev <= 0 ? 0 : prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    const lastStepIndex = Math.max(0, stops.length - 1);
    if (stepIndex >= lastStepIndex) {
      onComplete?.();
      return;
    }
    setStepIndex((prev) => Math.min(lastStepIndex, prev + 1));
  }, [onComplete, stepIndex, stops.length]);

  if (!activeStop) return null;

  const tooltipWidth = Math.max(260, Math.min(TOOLTIP_WIDTH, Math.max(260, viewport.width - 24)));
  const tooltipLeft = highlightRect
    ? clamp(highlightRect.left, 12, Math.max(12, viewport.width - tooltipWidth - 12))
    : 12;
  const preferredTooltipTop = highlightRect ? highlightRect.top + highlightRect.height + 12 : 12;
  const aboveTooltipTop = highlightRect
    ? Math.max(12, highlightRect.top - TOOLTIP_ESTIMATED_HEIGHT - 12)
    : 12;
  const shouldPlaceTooltipAbove = preferredTooltipTop + TOOLTIP_ESTIMATED_HEIGHT > viewport.height - 12;
  const unclampedTooltipTop = shouldPlaceTooltipAbove ? aboveTooltipTop : preferredTooltipTop;
  const tooltipTop = clamp(
    unclampedTooltipTop,
    12,
    Math.max(12, viewport.height - TOOLTIP_ESTIMATED_HEIGHT - 12)
  );
  const spotlightShadowSpread = Math.max(viewport.width, viewport.height, 2000);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120 }}>
      {!highlightRect && <div style={{ position: "absolute", inset: 0, background: OVERLAY_COLOR }} />}

      {highlightRect && (
        <div
          style={{
            position: "absolute",
            left: highlightRect.left,
            top: highlightRect.top,
            width: highlightRect.width,
            height: highlightRect.height,
            borderRadius: 8,
            border: `2px solid ${COLORS.accent}`,
            boxShadow: `0 0 0 ${spotlightShadowSpread}px ${OVERLAY_COLOR}, 0 0 0 1px ${COLORS.accent}55, 0 0 24px ${COLORS.accent}55`,
          }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Workspace guide"
        tabIndex={-1}
        style={{
          position: "absolute",
          top: highlightRect ? tooltipTop : 14,
          left: highlightRect ? tooltipLeft : 12,
          width: tooltipWidth,
          maxWidth: "calc(100vw - 24px)",
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 6,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 10, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
          {`Guide ${stepIndex + 1} / ${stops.length}`}
        </div>
        <div style={{ fontSize: 14, color: COLORS.textBright, fontWeight: 700 }}>{activeStop.title}</div>
        <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.45 }}>{activeStop.description}</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <button onClick={onClose} style={subtleBtnStyle}>
            Skip guide
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleBack}
              disabled={stepIndex === 0}
              style={{ ...btnStyle, opacity: stepIndex === 0 ? 0.45 : 1 }}
            >
              Back
            </button>
            <button
              onClick={handleNext}
              style={{ ...btnStyle, borderColor: `${COLORS.accent}70`, color: COLORS.accent }}
            >
              {stepIndex >= stops.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
