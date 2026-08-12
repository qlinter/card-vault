import { useState } from "react";

export function useShareWizardNavigation(stepCount: number, selectedCount: number) {
  const [activeStep, setActiveStep] = useState(0);
  const [message, setMessage] = useState("");

  function requireSelection() {
    if (selectedCount > 0) return true;
    setMessage("请至少选择一张卡片。");
    return false;
  }

  function goNext() {
    if (activeStep === 0 && !requireSelection()) return;
    setMessage("");
    setActiveStep((step) => Math.min(step + 1, stepCount - 1));
  }

  function goPrevious() {
    setMessage("");
    setActiveStep((step) => Math.max(step - 1, 0));
  }

  function goToStep(stepId: number) {
    if (stepId > 0 && !requireSelection()) return;
    setMessage("");
    setActiveStep(Math.max(0, Math.min(stepId, stepCount - 1)));
  }

  return { activeStep, setActiveStep, message, setMessage, goNext, goPrevious, goToStep };
}
