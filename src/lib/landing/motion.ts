"use client";

/**
 * Motion for the public landing pages is deliberately opt-in.  On a reduced
 * motion device, components keep their normal DOM styles and render at once.
 */
export function shouldReduceLandingMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
