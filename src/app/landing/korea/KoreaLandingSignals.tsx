"use client";

import { LandingSignals } from "@/components/landing/LandingSignals";
import { track } from "./analytics";

export function KoreaLandingSignals({ arm }: { arm: string }) {
  return <LandingSignals variant="korea" arm={arm} emit={track} />;
}
