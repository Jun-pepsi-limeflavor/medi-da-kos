"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function AdminMotionShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion() || !shellRef.current) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-admin-content]",
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.28, ease: "power2.out" },
      );
    }, shellRef);

    return () => context.revert();
  }, [pathname]);

  return <div ref={shellRef}>{children}</div>;
}
