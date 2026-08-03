"use client";

import { useEffect } from "react";
import { getBriefStepLabel, isCMBriefStep } from "@/lib/brief-steps";
import { BRIEF_STEP_DWELL_MS } from "@/lib/brief-step-dwell";
import { syncBriefStepToChannelTalk } from "@/lib/channel-talk";

/**
 * Syncs the CM wizard step to Channel Talk after the user stays on the same step
 * for {@link BRIEF_STEP_DWELL_MS}. Resets whenever the step changes.
 */
export function useBriefStepDwellSync(step: number | null, enabled: boolean) {
  useEffect(() => {
    if (!enabled || step === null || !isCMBriefStep(step)) return;

    const label = getBriefStepLabel(step);
    const timer = window.setTimeout(() => {
      syncBriefStepToChannelTalk(step, label, { source: "dwell" });
    }, BRIEF_STEP_DWELL_MS);

    return () => window.clearTimeout(timer);
  }, [step, enabled]);
}
