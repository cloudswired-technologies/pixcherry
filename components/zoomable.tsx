"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

// A photo you can zoom right where it is: pinch with two fingers, scroll wheel,
// or double-tap/double-click; drag to look around while zoomed. Starts with the
// light preview and swaps in the full-size file as soon as you zoom in.

export type ZoomHandle = { toggle: () => void; reset: () => void };

const MAX = 5;
type T = { s: number; x: number; y: number };

export function ZoomableImage({
  src,
  full,
  alt,
  onZoomChange,
  onDoubleTap,
  handle,
  className,
}: {
  src: string;
  /** Full-size file, loaded once the photo is zoomed. */
  full?: string;
  alt: string;
  onZoomChange?: (zoomed: boolean) => void;
  /** Replaces "double-tap zooms" (e.g. double-tap to heart). Pinch and wheel still zoom. */
  onDoubleTap?: () => void;
  handle?: Ref<ZoomHandle>;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<T>({ s: 1, x: 0, y: 0 });
  const [hi, setHi] = useState(false);
  const [moving, setMoving] = useState(false); // fingers down: follow them without easing
  const tRef = useRef(t);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number; cx: number; cy: number; x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);
  const zoomedRef = useRef(false);
  const cb = useRef(onZoomChange);
  useEffect(() => {
    cb.current = onZoomChange;
  });

  const apply = (n: T) => {
    const el = box.current;
    const s = Math.min(MAX, Math.max(1, n.s));
    // Keep the photo covering the frame: no panning past its edges.
    const mx = el ? ((s - 1) * el.clientWidth) / 2 : 0;
    const my = el ? ((s - 1) * el.clientHeight) / 2 : 0;
    const next = s === 1 ? { s: 1, x: 0, y: 0 } : { s, x: Math.max(-mx, Math.min(mx, n.x)), y: Math.max(-my, Math.min(my, n.y)) };
    tRef.current = next;
    setT(next);
    const z = next.s > 1.01;
    if (z !== zoomedRef.current) {
      zoomedRef.current = z;
      cb.current?.(z);
    }
    if (z) setHi(true);
  };

  /** Zoom to scale s keeping the point (px, py) — relative to the frame centre — still. */
  const zoomAt = (s: number, px: number, py: number) => {
    const c = tRef.current;
    const k = Math.min(MAX, Math.max(1, s)) / c.s;
    apply({ s: c.s * k, x: px - (px - c.x) * k, y: py - (py - c.y) * k });
  };

  const rel = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: cx - r.left - r.width / 2, y: cy - r.top - r.height / 2 };
  };

  useImperativeHandle(handle, () => ({
    toggle: () => (tRef.current.s > 1.01 ? apply({ s: 1, x: 0, y: 0 }) : zoomAt(2.5, 0, 0)),
    reset: () => apply({ s: 1, x: 0, y: 0 }),
  }));

  // New photo: back to fit.
  useEffect(() => {
    const id = setTimeout(() => {
      tRef.current = { s: 1, x: 0, y: 0 };
      setT(tRef.current);
      setHi(false);
      if (zoomedRef.current) {
        zoomedRef.current = false;
        cb.current?.(false);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [src]);

  // Wheel zoom needs a non-passive listener.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = rel(e.clientX, e.clientY);
      zoomAt(tRef.current.s * Math.exp(-e.deltaY * 0.0025), p.x, p.y);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  const down = (e: React.PointerEvent) => {
    box.current?.setPointerCapture(e.pointerId);
    setMoving(true);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const c = rel((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: tRef.current.s, cx: c.x, cy: c.y, x: tRef.current.x, y: tRef.current.y };
      drag.current = null;
    } else if (pointers.current.size === 1 && tRef.current.s > 1.01) {
      drag.current = { x: e.clientX, y: e.clientY, tx: tRef.current.x, ty: tRef.current.y };
    }
  };
  const move = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (p && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const k = Math.hypot(a.x - b.x, a.y - b.y) / p.d;
      const c = rel((a.x + b.x) / 2, (a.y + b.y) / 2);
      const s = Math.min(MAX, Math.max(1, p.s * k));
      const r = s / p.s;
      apply({ s, x: c.x - (p.cx - p.x) * r, y: c.y - (p.cy - p.y) * r });
      return;
    }
    const d = drag.current;
    if (d) apply({ ...tRef.current, x: d.tx + e.clientX - d.x, y: d.ty + e.clientY - d.y });
  };
  const up = (e: React.PointerEvent) => {
    const wasPinch = pointers.current.size >= 2;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      drag.current = null;
      setMoving(false);
    }
    if (wasPinch || e.pointerType === "mouse") return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (onDoubleTap) return onDoubleTap();
      const p = rel(e.clientX, e.clientY);
      if (tRef.current.s > 1.01) apply({ s: 1, x: 0, y: 0 });
      else zoomAt(2.5, p.x, p.y);
    } else lastTap.current = now;
  };

  return (
    <div
      ref={box}
      className={`relative size-full touch-none select-none overflow-hidden ${t.s > 1.01 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"} ${className ?? ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={(e) => {
        if (onDoubleTap) return onDoubleTap();
        const p = rel(e.clientX, e.clientY);
        if (tRef.current.s > 1.01) apply({ s: 1, x: 0, y: 0 });
        else zoomAt(2.5, p.x, p.y);
      }}
      data-zoomed={t.s > 1.01 ? "true" : "false"}
    >
      <img
        src={hi && full ? full : src}
        alt={alt}
        draggable={false}
        className="absolute inset-0 size-full object-contain will-change-transform"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transition: moving ? "none" : "transform 0.18s ease-out" }}
      />
    </div>
  );
}
