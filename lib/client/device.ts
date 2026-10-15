// Signals of the phone itself (not the browser): screen, pixel ratio, time zone,
// touch points, CPU cores, GPU and OS. Sent as separate values so the server can
// match them loosely: one browser hiding the GPU name (Edge) or reporting a
// different OS string mustn't make the same phone look new. Same-model phones
// can look alike, so these are only ever used together with other signals.

export type DeviceInfo = { s: string; r: number; t: string; p: number; c: number; g: string; o: string };

export async function deviceSignals(): Promise<DeviceInfo | null> {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    const gpu = gl ? String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : "";
    const os = navigator.userAgent.match(/Android|iPhone|iPad|CPU OS|Windows|Mac OS X|CrOS|Linux/)?.[0] ?? "";
    return {
      s: `${Math.min(screen.width, screen.height)}x${Math.max(screen.width, screen.height)}`,
      r: Math.round(window.devicePixelRatio * 100) / 100,
      t: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
      p: navigator.maxTouchPoints ?? 0,
      c: navigator.hardwareConcurrency ?? 0,
      g: gpu.slice(0, 80),
      o: os,
    };
  } catch {
    return null;
  }
}
