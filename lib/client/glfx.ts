// GPU film looks for the disposable camera. One fragment shader renders both the
// live viewfinder and the captured photo, so the result is exactly what the
// guest saw. Overlays (date stamp, letterbox, polaroid frame) are drawn with
// the 2D canvas on top of the shader output.

export type Look = {
  id: string;
  name: string;
  exposure?: number; // stops
  contrast?: number; // 1 = none
  curve?: number; // 0..1 S-curve
  saturation?: number; // 1 = none
  temp?: number; // -1 cool .. 1 warm
  tint?: number; // -1 magenta .. 1 green
  fade?: number; // 0..0.3 lifted blacks
  shadow?: [number, number, number]; // split-tone colours (0..1)
  highlight?: [number, number, number];
  split?: number; // 0..1
  mono?: number; // 0..1
  vignette?: number; // 0..1
  grain?: number; // 0..0.2
  chroma?: number; // 0..0.01 chromatic aberration
  glow?: number; // 0..1
  leak?: number; // 0..1 light leak
  leakColor?: [number, number, number];
  leakPos?: [number, number];
  scan?: number; // VHS scanlines 0..1
  stamp?: "digital" | "vhs"; // date stamp overlay
  bars?: boolean; // cinematic letterbox
  polaroid?: boolean; // white frame + caption
  swatch: string; // CSS gradient for the picker
};

export const LOOKS: Look[] = [
  { id: "natural", name: "Natural", swatch: "linear-gradient(135deg,#d9d4cc,#8c8478)" },
  {
    id: "disposable", name: "Disposable", exposure: 0.12, contrast: 1.12, curve: 0.25, saturation: 1.12, temp: 0.35, fade: 0.06,
    vignette: 0.55, grain: 0.07, chroma: 0.0015, stamp: "digital", swatch: "linear-gradient(135deg,#ffd27a,#e2603c)",
  },
  {
    id: "gold", name: "Kodak Gold", exposure: 0.05, contrast: 1.08, curve: 0.3, saturation: 1.22, temp: 0.45, highlight: [1, 0.85, 0.55],
    shadow: [0.35, 0.22, 0.12], split: 0.18, vignette: 0.3, grain: 0.05, swatch: "linear-gradient(135deg,#ffe08a,#c98a2d)",
  },
  {
    id: "fuji", name: "Fuji 400", contrast: 0.96, curve: 0.2, saturation: 0.95, temp: -0.12, tint: 0.12, fade: 0.08, shadow: [0.12, 0.35, 0.32],
    highlight: [0.95, 0.98, 0.9], split: 0.22, vignette: 0.25, grain: 0.05, swatch: "linear-gradient(135deg,#bfe3d2,#3d7f73)",
  },
  {
    id: "cinematic", name: "Cinematic", contrast: 1.12, curve: 0.35, saturation: 1.05, shadow: [0.0, 0.35, 0.45], highlight: [1, 0.7, 0.42],
    split: 0.35, vignette: 0.45, grain: 0.03, bars: true, swatch: "linear-gradient(135deg,#ffb36b,#16536b)",
  },
  {
    id: "y2k", name: "Y2K Digicam", exposure: 0.25, contrast: 1.05, saturation: 1.3, temp: -0.18, chroma: 0.002, glow: 0.25, grain: 0.03,
    stamp: "digital", swatch: "linear-gradient(135deg,#a8d8ff,#ff9ad5)",
  },
  {
    id: "dreamy", name: "Dreamy", exposure: 0.15, contrast: 0.9, saturation: 0.85, temp: 0.08, tint: -0.12, fade: 0.12, glow: 0.65,
    highlight: [1, 0.85, 0.92], split: 0.25, vignette: 0.15, swatch: "linear-gradient(135deg,#ffd6e7,#c9b6ff)",
  },
  {
    id: "golden", name: "Golden Hour", exposure: 0.08, contrast: 1.06, saturation: 1.18, temp: 0.6, leak: 0.55, leakColor: [1, 0.55, 0.15],
    leakPos: [1.05, -0.05], vignette: 0.35, grain: 0.03, swatch: "linear-gradient(135deg,#ffcf6b,#ff7a3d)",
  },
  {
    id: "leak", name: "Light Leak", contrast: 1.05, saturation: 1.1, temp: 0.25, leak: 0.85, leakColor: [1, 0.25, 0.1], leakPos: [-0.05, 0.15],
    vignette: 0.4, grain: 0.08, fade: 0.05, swatch: "linear-gradient(135deg,#ff6a3d,#ffd36b)",
  },
  {
    id: "vhs", name: "VHS", contrast: 1.1, saturation: 1.15, temp: 0.05, chroma: 0.006, scan: 0.35, grain: 0.06, fade: 0.06, vignette: 0.3,
    stamp: "vhs", swatch: "linear-gradient(135deg,#6b5bff,#ff4d8d)",
  },
  {
    id: "polaroid", name: "Polaroid", exposure: 0.08, contrast: 0.95, saturation: 0.9, temp: 0.25, tint: -0.05, fade: 0.14, shadow: [0.25, 0.2, 0.35],
    split: 0.15, vignette: 0.3, grain: 0.04, polaroid: true, swatch: "linear-gradient(135deg,#fffaf0,#d9c7a3)",
  },
  { id: "bw", name: "B&W Film", contrast: 1.18, curve: 0.3, mono: 1, vignette: 0.35, grain: 0.08, swatch: "linear-gradient(135deg,#eeeeee,#333333)" },
  { id: "noir", name: "Noir", exposure: -0.1, contrast: 1.45, curve: 0.5, mono: 1, vignette: 0.75, grain: 0.1, swatch: "linear-gradient(135deg,#777777,#050505)" },
];

const VS = `attribute vec2 a_pos; varying vec2 v_uv; void main(){ v_uv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.0,1.0); }`;

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time, u_mirror;
uniform float u_exposure, u_contrast, u_curve, u_saturation, u_temp, u_tint, u_fade;
uniform vec3 u_shadow, u_highlight; uniform float u_split;
uniform float u_mono, u_vignette, u_grain, u_chroma, u_glow, u_leak, u_scan;
uniform vec3 u_leakColor; uniform vec2 u_leakPos;
float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
vec3 tex(vec2 uv){ uv.y = 1.0-uv.y; if(u_mirror>0.5) uv.x = 1.0-uv.x; return texture2D(u_tex, clamp(uv,0.0,1.0)).rgb; }
void main(){
  vec2 uv = v_uv;
  vec3 col;
  if (u_chroma > 0.0) {
    vec2 d = (uv-0.5)*u_chroma*2.0;
    col = vec3(tex(uv+d).r, tex(uv).g, tex(uv-d).b);
  } else col = tex(uv);
  if (u_glow > 0.0) {
    vec2 px = 3.0/u_res; vec3 b = vec3(0.0);
    b += tex(uv+vec2(px.x,0.0)); b += tex(uv-vec2(px.x,0.0)); b += tex(uv+vec2(0.0,px.y)); b += tex(uv-vec2(0.0,px.y));
    b += tex(uv+px*2.0); b += tex(uv-px*2.0); b += tex(uv+vec2(px.x,-px.y)*2.0); b += tex(uv+vec2(-px.x,px.y)*2.0);
    b /= 8.0;
    col += max(b-0.55,0.0)*u_glow*1.6;
  }
  col *= exp2(u_exposure);
  col.r += u_temp*0.08; col.b -= u_temp*0.08; col.g += u_tint*0.06;
  col = (col-0.5)*u_contrast+0.5;
  vec3 c = clamp(col,0.0,1.0);
  col = mix(col, c*c*(3.0-2.0*c), u_curve);
  float lum = dot(col, vec3(0.2126,0.7152,0.0722));
  col = mix(vec3(lum), col, u_saturation);
  col = mix(col, vec3(lum), u_mono);
  if (u_split > 0.0) {
    float sw = smoothstep(0.55,0.0,lum), hw = smoothstep(0.45,1.0,lum);
    col = mix(col, col*(u_shadow*1.8), sw*u_split);
    col = mix(col, col*(u_highlight*1.15)+u_highlight*0.04, hw*u_split);
  }
  col = u_fade + (1.0-u_fade)*col;
  if (u_leak > 0.0) {
    float f = smoothstep(0.95, 0.0, distance(uv, u_leakPos));
    col = 1.0-(1.0-col)*(1.0-u_leakColor*u_leak*f);
  }
  float d = distance(uv, vec2(0.5));
  col *= mix(1.0, smoothstep(0.92, 0.28, d), u_vignette);
  if (u_scan > 0.0) col *= 1.0 - u_scan*0.35*(0.5+0.5*sin(uv.y*u_res.y*1.2));
  col += (rand(uv*u_res + u_time) - 0.5) * u_grain;
  gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);
}`;

export type Renderer = {
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement;
  maxSize: number;
  draw(source: TexImageSource, look: Look, opts: { mirror: boolean; time: number }): void;
  dispose(): void;
};

export function createRenderer(canvas: HTMLCanvasElement, preserve = false): Renderer | null {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: preserve, premultipliedAlpha: false, antialias: false }) as WebGLRenderingContext | null;
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  } catch {
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = {
    res: u("u_res"), time: u("u_time"), mirror: u("u_mirror"), exposure: u("u_exposure"), contrast: u("u_contrast"), curve: u("u_curve"),
    saturation: u("u_saturation"), temp: u("u_temp"), tint: u("u_tint"), fade: u("u_fade"), shadow: u("u_shadow"), highlight: u("u_highlight"),
    split: u("u_split"), mono: u("u_mono"), vignette: u("u_vignette"), grain: u("u_grain"), chroma: u("u_chroma"), glow: u("u_glow"),
    leak: u("u_leak"), leakColor: u("u_leakColor"), leakPos: u("u_leakPos"), scan: u("u_scan"),
  };
  const maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, (gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number) || 4096);
  return {
    gl,
    canvas,
    maxSize,
    draw(source, look, { mirror, time }) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, time);
      gl.uniform1f(U.mirror, mirror ? 1 : 0);
      gl.uniform1f(U.exposure, look.exposure ?? 0);
      gl.uniform1f(U.contrast, look.contrast ?? 1);
      gl.uniform1f(U.curve, look.curve ?? 0);
      gl.uniform1f(U.saturation, look.saturation ?? 1);
      gl.uniform1f(U.temp, look.temp ?? 0);
      gl.uniform1f(U.tint, look.tint ?? 0);
      gl.uniform1f(U.fade, look.fade ?? 0);
      gl.uniform3fv(U.shadow, look.shadow ?? [0.5, 0.5, 0.5]);
      gl.uniform3fv(U.highlight, look.highlight ?? [1, 1, 1]);
      gl.uniform1f(U.split, look.split ?? 0);
      gl.uniform1f(U.mono, look.mono ?? 0);
      gl.uniform1f(U.vignette, look.vignette ?? 0);
      gl.uniform1f(U.grain, look.grain ?? 0);
      gl.uniform1f(U.chroma, look.chroma ?? 0);
      gl.uniform1f(U.glow, look.glow ?? 0);
      gl.uniform1f(U.leak, look.leak ?? 0);
      gl.uniform3fv(U.leakColor, look.leakColor ?? [1, 0.5, 0.2]);
      gl.uniform2fv(U.leakPos, look.leakPos ?? [1, 1]);
      gl.uniform1f(U.scan, look.scan ?? 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

// ------------------------------------------------------------------ overlays (2D)

export function stampText(kind: "digital" | "vhs", d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  if (kind === "vhs") return `PLAY ▶  ${p(d.getHours())}:${p(d.getMinutes())}  ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}`;
  return `'${String(d.getFullYear()).slice(2)} ${p(d.getMonth() + 1)} ${p(d.getDate())}`;
}

/** Draws overlays on a 2D context that already holds the filtered photo (w x h). */
export function drawOverlays(ctx: CanvasRenderingContext2D, w: number, h: number, look: Look) {
  if (look.bars) {
    ctx.fillStyle = "#000";
    const bh = Math.round(h * 0.09);
    ctx.fillRect(0, 0, w, bh);
    ctx.fillRect(0, h - bh, w, bh);
  }
  if (look.stamp) {
    const size = Math.round(Math.min(w, h) * (look.stamp === "vhs" ? 0.04 : 0.055));
    ctx.font = `bold ${size}px "Courier New", ui-monospace, monospace`;
    ctx.textBaseline = "bottom";
    const text = stampText(look.stamp);
    if (look.stamp === "vhs") {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = size * 0.2;
      ctx.textAlign = "left";
      ctx.fillText(text, size * 1.2, h - size * 1.2);
    } else {
      ctx.fillStyle = "#ff9d2e";
      ctx.shadowColor = "rgba(255,120,20,0.9)";
      ctx.shadowBlur = size * 0.45;
      ctx.textAlign = "right";
      ctx.fillText(text, w - size * 1.1, h - size * 1.0);
    }
    ctx.shadowBlur = 0;
  }
}

/** Wraps a photo canvas in a Polaroid frame with a caption. Returns a new canvas. */
export function polaroid(src: HTMLCanvasElement, caption: string) {
  const side = Math.round(src.width * 0.06);
  const bottom = Math.round(src.width * 0.22);
  const out = document.createElement("canvas");
  out.width = src.width + side * 2;
  out.height = src.height + side + bottom;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fbf8f1";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, side, side);
  ctx.fillStyle = "#2b2622";
  ctx.font = `600 ${Math.round(bottom * 0.28)}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(caption.slice(0, 40), out.width / 2, src.height + side + bottom / 2, out.width - side * 2);
  return out;
}
