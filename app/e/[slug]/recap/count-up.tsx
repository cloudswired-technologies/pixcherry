"use client";

import { useEffect, useRef, useState } from "react";

/** Counts up from 0 when it scrolls into view. */
export function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400);
        setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(node);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return (
    <span ref={el} className="tabular-nums">
      {n.toLocaleString("en-MY")}
    </span>
  );
}
