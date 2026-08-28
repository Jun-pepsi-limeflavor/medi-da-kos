import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = (path: string) =>
  readFile(
    new URL(path, import.meta.url),
    "utf8",
  );

test("LandingDashboardHeader contains 50/50 split hero, floating badges, and roadmap", async () => {
  const headerContent = await source("../src/components/landing/LandingDashboardHeader.tsx");

  // 1. Visual Hero Slideshow & Floating badges
  assert.match(headerContent, /\/medidakos_main1\.webp/);
  assert.match(headerContent, /\/landing\/catalog\/pdrn-glow-booster\.png/);
  assert.match(headerContent, /\/landing\/catalog\/cloud-root-soothing-serum\.png/);
  assert.match(headerContent, /\/landing\/catalog\/retinol-matrix-repair-serum\.png/);
  assert.match(headerContent, /\/landing\/catalog\/green-apple-capsule-serum\.png/);
  assert.match(headerContent, /HERO_GALLERY_SLIDES/);
  assert.match(headerContent, /currentSlideIndex/);
  assert.match(headerContent, /animate-float/);
  assert.match(headerContent, /animate-float-delayed/);
  assert.match(headerContent, /animate-float-slow/);
  assert.match(headerContent, /40%\+ Savings/);
  assert.match(headerContent, /1–2 Wks/);
  assert.match(headerContent, /ISO 22716 GMP/);

  // 2. Roadmap steps
  assert.match(headerContent, /Submit Brief/);
  assert.match(headerContent, /Lab Sampling & Review/);
  assert.match(headerContent, /1–2 weeks/);
  assert.match(headerContent, /Production & Delivery/);
  assert.match(headerContent, /SWIFT wire/);
  assert.match(headerContent, /How It Works/);

  // 3. Headline & Value proposition
  assert.match(headerContent, /Product Manufacturing Brief/);
  assert.match(headerContent, /verified Korean OEM\/ODM labs/);

  // 4. CTA button and progress indicators
  assert.match(headerContent, /SpecularButton/);
  assert.match(headerContent, /Start Your Product Brief/);
  assert.match(headerContent, /Brief in progress — editing below/);
  assert.match(headerContent, /Scroll to form ↓/);
  assert.match(headerContent, /Takes ~3 minutes · Free consultation/);
});

test("CMWizard integrates LandingDashboardHeader conditionally and manages progressive disclosure with smooth scroll", async () => {
  const wizardContent = await source("../src/components/dashboard/CMWizard.tsx");

  assert.ok(
    wizardContent.includes('import { LandingDashboardHeader } from "@/components/landing/LandingDashboardHeader";'),
  );
  assert.match(
    wizardContent,
    /mode === "consultation" \?\s*\(\s*<LandingDashboardHeader[\s\S]*currentStep=\{step\}[\s\S]*message=\{message\}[\s\S]*isStarted=\{activeStarted\}[\s\S]*onStart=\{handleStartBrief\}[\s\S]*\/>\s*\)\s*:\s*\(/,
  );
  assert.match(wizardContent, /handleStartBrief/);
  assert.match(wizardContent, /scrollIntoView\(\{/);
  assert.match(wizardContent, /ref=\{wizardCardRef\}/);
  assert.match(wizardContent, /scroll-mt-8/);
  assert.match(wizardContent, /\{activeStarted && \(/);
});
