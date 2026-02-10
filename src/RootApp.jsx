import { useCallback, useEffect, useState } from "react";
import App from "./App";
import MathText from "./components/MathText";
import TutorialExperience from "./components/TutorialExperience";
import { TUTORIAL_STEPS, TUTORIAL_STORAGE_KEY } from "./features/tutorial/steps";
import { DOMAIN } from "./lib/heatmap";
import { btnStyle, COLORS } from "./styles/theme";

const TARGET_FUNCTION_EXAMPLE_TEX = String.raw`f(x_1, x_2) = \lvert x_1 - x_2 \rvert`;
const RELU_COMPOSITION_EXAMPLE_TEX = String.raw`f(x_1, x_2) = \operatorname{ReLU}(x_1 - x_2) + \operatorname{ReLU}(x_2 - x_1)`;
const DOMAIN_TEX = String.raw`${DOMAIN[0]} \le x_1, x_2 \le ${DOMAIN[1]}`;

function clampStepIndex(value) {
  if (!Number.isInteger(value)) return 0;
  return Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, value));
}

function createDefaultOnboardingState() {
  return {
    status: "prompt",
    stepIndex: 0,
    updatedAt: Date.now(),
    startedFromCompleted: false,
    hasSeenWorkspaceTour: false,
    hasCompletedWarmup: false,
  };
}

function loadOnboardingState() {
  if (typeof window === "undefined") return createDefaultOnboardingState();

  try {
    const raw = window.localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) return createDefaultOnboardingState();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return createDefaultOnboardingState();

    const status = parsed.status;
    const hasSeenWorkspaceTour = parsed.hasSeenWorkspaceTour === true;
    const hasCompletedWarmup = parsed.hasCompletedWarmup === true;
    if (status === "in_progress") {
      return {
        status,
        stepIndex: clampStepIndex(parsed.stepIndex),
        updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
        startedFromCompleted: parsed.startedFromCompleted === true,
        hasSeenWorkspaceTour,
        hasCompletedWarmup,
      };
    }

    if (status === "completed") {
      return {
        status,
        stepIndex: clampStepIndex(parsed.stepIndex),
        updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
        startedFromCompleted: false,
        hasSeenWorkspaceTour: true,
        hasCompletedWarmup: true,
      };
    }

    if (status === "skipped") {
      return {
        status,
        stepIndex: clampStepIndex(parsed.stepIndex),
        updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
        startedFromCompleted: false,
        hasSeenWorkspaceTour,
        hasCompletedWarmup,
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
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage write failures
  }
}

export default function RootApp() {
  const [onboardingState, setOnboardingState] = useState(loadOnboardingState);

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

  const handleStartTutorial = useCallback(() => {
    setOnboardingState({
      status: "in_progress",
      stepIndex: 0,
      updatedAt: Date.now(),
      startedFromCompleted: false,
      hasSeenWorkspaceTour: false,
      hasCompletedWarmup: false,
    });
  }, []);

  const handleSkipTutorial = useCallback(() => {
    setOnboardingState({
      status: "skipped",
      stepIndex: 0,
      updatedAt: Date.now(),
      startedFromCompleted: false,
      hasSeenWorkspaceTour: false,
      hasCompletedWarmup: false,
    });
  }, []);

  const handleExitTutorial = useCallback((stepIndexAtExit) => {
    setOnboardingState((prev) => {
      const clampedStepIndex = clampStepIndex(
        Number.isInteger(stepIndexAtExit) ? stepIndexAtExit : prev.stepIndex
      );

      if (prev.startedFromCompleted) {
        return {
          status: "completed",
          stepIndex: TUTORIAL_STEPS.length - 1,
          updatedAt: Date.now(),
          startedFromCompleted: false,
          hasSeenWorkspaceTour: true,
          hasCompletedWarmup: true,
        };
      }

      return {
        status: "skipped",
        stepIndex: clampedStepIndex,
        updatedAt: Date.now(),
        startedFromCompleted: false,
        hasSeenWorkspaceTour: prev.hasSeenWorkspaceTour,
        hasCompletedWarmup: prev.hasCompletedWarmup,
      };
    });
  }, []);

  const handleCompleteTutorial = useCallback(() => {
    setOnboardingState({
      status: "completed",
      stepIndex: TUTORIAL_STEPS.length - 1,
      updatedAt: Date.now(),
      startedFromCompleted: false,
      hasSeenWorkspaceTour: true,
      hasCompletedWarmup: true,
    });
  }, []);

  const handleStepIndexChange = useCallback((stepIndex) => {
    setOnboardingState((prev) => {
      if (prev.status !== "in_progress") return prev;
      return {
        ...prev,
        stepIndex: clampStepIndex(stepIndex),
        updatedAt: Date.now(),
      };
    });
  }, []);

  const handleOpenTutorial = useCallback(() => {
    setOnboardingState((prev) => ({
      status: "in_progress",
      stepIndex: prev.status === "completed" ? 0 : clampStepIndex(prev.stepIndex),
      updatedAt: Date.now(),
      startedFromCompleted: prev.status === "completed",
      hasSeenWorkspaceTour: prev.hasSeenWorkspaceTour,
      hasCompletedWarmup: prev.hasCompletedWarmup,
    }));
  }, []);

  const handleWorkspaceTourSeen = useCallback(() => {
    setOnboardingState((prev) => {
      if (prev.status !== "in_progress" || prev.hasSeenWorkspaceTour) return prev;
      return {
        ...prev,
        hasSeenWorkspaceTour: true,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const handleWarmupCompleted = useCallback(() => {
    setOnboardingState((prev) => {
      if (prev.status !== "in_progress" || prev.hasCompletedWarmup) return prev;
      return {
        ...prev,
        hasCompletedWarmup: true,
        updatedAt: Date.now(),
      };
    });
  }, []);

  return (
    <>
      <div style={{ width: "100%", height: "100%", display: onboardingState.status === "in_progress" ? "none" : "block" }}>
        <App />
      </div>

      {onboardingState.status === "in_progress" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90 }}>
          <TutorialExperience
            initialStepIndex={onboardingState.stepIndex}
            hasSeenWorkspaceTour={onboardingState.hasSeenWorkspaceTour}
            hasCompletedWarmup={onboardingState.hasCompletedWarmup}
            onStepIndexChange={handleStepIndexChange}
            onExitTutorial={handleExitTutorial}
            onCompleteTutorial={handleCompleteTutorial}
            onWorkspaceTourSeen={handleWorkspaceTourSeen}
            onWarmupCompleted={handleWarmupCompleted}
          />
        </div>
      )}

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
              How this puzzle game works
            </div>
            <div id="onboarding-overview-description" style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>
              Each challenge gives you a target function <MathText tex="f(x_1, x_2)" style={{ fontSize: 13 }} /> over the domain
              <MathText tex={DOMAIN_TEX} style={{ fontSize: 13, marginLeft: 4 }} />. Your job is to tune a neural network so its output matches
              the target function as closely as possible across that domain.
            </div>
            <div id="onboarding-overview-build-note" style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.45 }}>
              You build complex behavior by composing simpler neuron activations, layer by layer.
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
              Want to enter the tutorial or skip and explore on your own?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleSkipTutorial} style={btnStyle}>
                Explore on your own
              </button>
              <button
                onClick={handleStartTutorial}
                style={{
                  ...btnStyle,
                  borderColor: `${COLORS.accent}70`,
                  color: COLORS.accent,
                }}
              >
                Enter tutorial
              </button>
            </div>
          </div>
        </div>
      )}

      {onboardingState.status !== "prompt" && onboardingState.status !== "in_progress" && (
        <button
          onClick={handleOpenTutorial}
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
          Open tutorial
        </button>
      )}
    </>
  );
}
