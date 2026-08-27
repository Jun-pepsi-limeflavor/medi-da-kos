"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export default function CountUpNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: Props) {
  const numRef = useRef<HTMLSpanElement>(null);
  const prevVal = useRef(0);

  useEffect(() => {
    if (!numRef.current) return;

    const obj = { val: prevVal.current };
    gsap.to(obj, {
      val: value,
      duration: 1.2,
      ease: "power2.out",
      onUpdate: () => {
        if (numRef.current) {
          numRef.current.innerText =
            prefix +
            obj.val.toLocaleString(undefined, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            }) +
            suffix;
        }
      },
    });

    prevVal.current = value;
  }, [value, prefix, suffix, decimals]);

  return <span ref={numRef} className={className}>{prefix + value.toLocaleString() + suffix}</span>;
}
