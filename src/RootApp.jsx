import { useCallback, useEffect, useState } from "react";
import App from "./App";
import TutorialExperience from "./components/TutorialExperience";
import { TUTORIAL_STEPS, TUTORIAL_STORAGE_KEY } from "./features/tutorial/steps";
import { btnStyle, COLORS } from "./styles/theme";

function clampStepIndex(value) {
  if (!Number.isInteger(value)) return 0;
  return Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, value));
}

function loadOnboardingState() {
  if (typeof window === "undefined") {
    return {
      status: "prompt",
      stepIndex: 0,
      updatedAt: Date.now(),
      startedFromCompleted: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) {
      return {
        status: "prompt",
        stepIndex: 0,
        updatedAt: Date.now(),
        startedFromCompleted: false,
      };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {
        status: "prompt",
        stepIndex: 0,
        updatedAt: Date.now(),
        startedFromCompleted: false,
      };
    }

    const status = parsed.status;
    if (status === "in_progress") {
      return {
        status,
        stepIndex: clampStepIndex(parsed.stepIndex),
        updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
        startedFromCompleted: parsed.startedFromCompleted === true,
      };
    }

    if (status === "completed" || status === "skipped") {
      return {
        status,
        stepIndex: clampStepIndex(parsed.stepIndex),
        updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
        startedFromCompleted: false,
      };
    }

    return {
      status: "prompt",
      stepIndex: 0,
      updatedAt: Date.now(),
      startedFromCompleted: false,
    };
  } catch {
    return {
      status: "prompt",
      stepIndex: 0,
      updatedAt: Date.now(),
      startedFromCompleted: false,
    };
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
    });
  }, []);

  const handleSkipTutorial = useCallback(() => {
    setOnboardingState({
      status: "skipped",
      stepIndex: 0,
      updatedAt: Date.now(),
      startedFromCompleted: false,
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
        };
      }

      return {
        status: "skipped",
        stepIndex: clampedStepIndex,
        updatedAt: Date.now(),
        startedFromCompleted: false,
      };
    });
  }, []);

  const handleCompleteTutorial = useCallback(() => {
    setOnboardingState({
      status: "completed",
      stepIndex: TUTORIAL_STEPS.length - 1,
      updatedAt: Date.now(),
      startedFromCompleted: false,
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
    }));
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
            onStepIndexChange={handleStepIndexChange}
            onExitTutorial={handleExitTutorial}
            onCompleteTutorial={handleCompleteTutorial}
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
          }}
        >
          <div
            style={{
              width: "min(540px, 100%)",
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 8,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textBright }}>New here?</div>
            <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>
              Want a quick interactive tutorial before jumping into the full challenge library?
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.45 }}>
              The tutorial starts with a simplified editor and unlocks concepts one at a time.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleSkipTutorial} style={btnStyle}>
                No thanks
              </button>
              <button
                onClick={handleStartTutorial}
                style={{
                  ...btnStyle,
                  borderColor: `${COLORS.accent}70`,
                  color: COLORS.accent,
                }}
              >
                Start tutorial
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
