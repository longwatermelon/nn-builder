import { useCallback, useEffect, useRef, useState } from "react";
import App from "./App";
import MathText from "./components/MathText";
import WorkspaceGuideOverlay from "./components/WorkspaceGuideOverlay";
import { DOMAIN } from "./lib/heatmap";
import { btnStyle, COLORS } from "./styles/theme";

const ONBOARDING_STORAGE_KEY = "nn-builder-onboarding-v2";
const TARGET_FUNCTION_EXAMPLE_TEX = String.raw`f(x_1, x_2) = \lvert x_1 - x_2 \rvert`;
const RELU_COMPOSITION_EXAMPLE_TEX = String.raw`f(x_1, x_2) = \operatorname{ReLU}(x_1 - x_2) + \operatorname{ReLU}(x_2 - x_1)`;
const DOMAIN_TEX = String.raw`${DOMAIN[0]} \le x_1, x_2 \le ${DOMAIN[1]}`;

function detectMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const hasUaDataMobileFlag = typeof navigator.userAgentData?.mobile === "boolean"
    ? navigator.userAgentData.mobile
    : false;
  const userAgent = navigator.userAgent || "";
  const hasMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
  const isLikelyIPadDesktopUa = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return hasUaDataMobileFlag || hasMobileUserAgent || isLikelyIPadDesktopUa;
}

function createDefaultOnboardingState() {
  return {
    status: "prompt",
    hasCompletedGuide: false,
    updatedAt: Date.now(),
  };
}

function loadOnboardingState() {
  if (typeof window === "undefined") return createDefaultOnboardingState();

  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return createDefaultOnboardingState();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return createDefaultOnboardingState();

    if (parsed.status === "ready") {
      return {
        status: "ready",
        hasCompletedGuide: parsed.hasCompletedGuide === true,
        updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
      };
    }

    return createDefaultOnboardingState();
  } catch {
    return createDefaultOnboardingState();
  }
}

function persistOnboardingState(state) {
  if (typeof window === "undefined") return;
  if (state.status === "prompt") return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage write failures
  }
}

export default function RootApp() {
  const [onboardingState, setOnboardingState] = useState(loadOnboardingState);
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [isMobileBlocked] = useState(detectMobileDevice);

  const topBarGuideRef = useRef(null);
  const challengeLibraryGuideRef = useRef(null);
  const graphPaneGuideRef = useRef(null);
  const inspectorPaneGuideRef = useRef(null);
  const resultsPanelGuideRef = useRef(null);

  const guideRefs = {
    topBarRef: topBarGuideRef,
    challengeLibraryRef: challengeLibraryGuideRef,
    networkGraphRef: graphPaneGuideRef,
    neuronInspectorRef: inspectorPaneGuideRef,
    resultsPanelRef: resultsPanelGuideRef,
  };

  const guideStops = [
    {
      id: "top-bar",
      title: "Top bar controls",
      description:
        "Use these controls to import/export JSON, toggle sliders, randomize parameters, and reset the active network.",
      targetRef: topBarGuideRef,
    },
    {
      id: "challenge-library",
      title: "Challenge library",
      description:
        "Pick a target function here to enter challenge mode, compare against a known target, and track solved progress.",
      targetRef: challengeLibraryGuideRef,
    },
    {
      id: "network-graph",
      title: "Network graph",
      description:
        "This is your main workbench. Click neurons, inspect activations, and edit architecture controls directly on each layer card.",
      targetRef: graphPaneGuideRef,
    },
    {
      id: "neuron-inspector",
      title: "Neuron inspector",
      description:
        "When a neuron is selected, tune its input value, bias, and incoming weights here. Changes apply live as soon as values are valid.",
      targetRef: inspectorPaneGuideRef,
    },
    {
      id: "results-panel",
      title: "Results area",
      description:
        "Watch the output heatmap update in real time. In challenge mode this panel also shows score, target heatmap, and solution actions.",
      targetRef: resultsPanelGuideRef,
    },
  ];

  useEffect(() => {
    persistOnboardingState(onboardingState);
  }, [onboardingState]);

  useEffect(() => {
    if (document.getElementById("nn-builder-fonts")) return;
    const link = document.createElement("link");
    link.id = "nn-builder-fonts";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const handleStartGuide = useCallback(() => {
    setOnboardingState({
      status: "ready",
      hasCompletedGuide: false,
      updatedAt: Date.now(),
    });
    setIsGuideActive(true);
  }, []);

  const handleSkipGuide = useCallback(() => {
    setOnboardingState((prev) => ({
      status: "ready",
      hasCompletedGuide: prev.hasCompletedGuide,
      updatedAt: Date.now(),
    }));
  }, []);

  const handleOpenGuide = useCallback(() => {
    setIsGuideActive(true);
  }, []);

  const handleCloseGuide = useCallback(() => {
    setIsGuideActive(false);
  }, []);

  const handleCompleteGuide = useCallback(() => {
    setIsGuideActive(false);
    setOnboardingState({
      status: "ready",
      hasCompletedGuide: true,
      updatedAt: Date.now(),
    });
  }, []);

  if (isMobileBlocked) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: COLORS.bg,
          color: COLORS.text,
          fontFamily: "'Sora', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          role="alert"
          style={{
            width: "min(560px, 100%)",
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 8,
            padding: "22px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.textBright }}>Desktop only</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            This website is intended to be accessed on desktop.
          </div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.55 }}>
            Please open this app from a desktop or laptop browser to use the neural network builder.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        aria-hidden={isGuideActive}
        inert={isGuideActive ? "" : undefined}
        style={{ width: "100%", height: "100%" }}
      >
        <App guideRefs={guideRefs} />
      </div>

      {onboardingState.status === "prompt" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-overview-title"
            aria-describedby="onboarding-overview-description onboarding-overview-build-note onboarding-overview-example-summary onboarding-overview-question"
            style={{
              width: "min(540px, 100%)",
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 8,
              padding: 16,
              maxHeight: "calc(100dvh - 32px)",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div id="onboarding-overview-title" style={{ fontSize: 16, fontWeight: 700, color: COLORS.textBright }}>
              Quick workspace walkthrough?
            </div>
            <div id="onboarding-overview-description" style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>
              Each challenge gives you a target function <MathText tex="f(x_1, x_2)" style={{ fontSize: 13 }} /> over the domain
              <MathText tex={DOMAIN_TEX} style={{ fontSize: 13, marginLeft: 4 }} />. Your job is to tune a neural network so its output matches
              the target function as closely as possible across that domain.
            </div>
            <div id="onboarding-overview-build-note" style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.45 }}>
              Want a guided tour of this regular UI with spotlights, or skip and explore freely?
            </div>
            <div
              id="onboarding-overview-example-summary"
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                border: 0,
              }}
            >
              Example: the absolute difference of x1 and x2 can be composed as ReLU of x1 minus x2 plus ReLU of x2 minus x1.
            </div>
            <div
              id="onboarding-overview-example"
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 6,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase", color: COLORS.textMuted }}>Example</div>
              <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
                Target function:
                <div style={{ marginTop: 4, overflowX: "auto", paddingBottom: 2 }}>
                  <MathText tex={TARGET_FUNCTION_EXAMPLE_TEX} displayMode style={{ fontSize: 13, color: COLORS.textBright }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
                One composition with ReLU blocks:
                <div style={{ marginTop: 4, overflowX: "auto", paddingBottom: 2 }}>
                  <MathText tex={RELU_COMPOSITION_EXAMPLE_TEX} displayMode style={{ fontSize: 13, color: COLORS.textBright }} />
                </div>
              </div>
            </div>
            <div id="onboarding-overview-question" style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.45 }}>
              You can replay the guide any time from the bottom-right button.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleSkipGuide} style={btnStyle}>
                Explore on your own
              </button>
              <button
                onClick={handleStartGuide}
                style={{
                  ...btnStyle,
                  borderColor: `${COLORS.accent}70`,
                  color: COLORS.accent,
                }}
              >
                Start guided walkthrough
              </button>
            </div>
          </div>
        </div>
      )}

      {onboardingState.status === "ready" && !isGuideActive && (
        <button
          onClick={handleOpenGuide}
          style={{
            ...btnStyle,
            position: "fixed",
            right: 14,
            bottom: 14,
            zIndex: 50,
            borderColor: `${COLORS.accent}60`,
            color: COLORS.accent,
            background: COLORS.panel,
          }}
        >
          {onboardingState.hasCompletedGuide ? "Replay guide" : "Start guide"}
        </button>
      )}

      {isGuideActive && (
        <WorkspaceGuideOverlay
          stops={guideStops}
          onClose={handleCloseGuide}
          onComplete={handleCompleteGuide}
        />
      )}
    </>
  );
}
