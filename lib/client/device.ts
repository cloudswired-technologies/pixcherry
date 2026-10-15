// A short signature of the phone itself (not the browser): screen, pixel ratio,
// GPU, CPU cores, touch points, OS version and time zone. Chrome, Edge, Samsung
// Internet and in-app browsers on one phone produce the same value, so a second
// browser can't quietly become a second guest. Same-model phones on the same
// Wi-Fi can collide, which is why it's only ever combined with other signals.

export async function deviceSignature(): Promise<string> {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    const gpu = gl ? String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : "";
    const os = navigator.userAgent.match(/Android [\d.]+|iPhone OS [\d_]+|iPad|CPU OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_]+|CrOS|Linux/)?.[0] ?? "";
    const parts = [
      Math.min(screen.width, screen.height),
      Math.max(screen.width, screen.height),
      window.devicePixelRatio,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency,
      navigator.maxTouchPoints,
      gpu,
      os,
    ];
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.join("|")));
    return Array.from(new Uint8Array(buf).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}
