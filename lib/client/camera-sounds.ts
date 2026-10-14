// Synthesised disposable-camera sounds (no audio files): the two-stage
// mechanical shutter "clack" and the thumb-wheel film advance "zrrrt".

let ac: AudioContext | null = null;

function ctx() {
  if (!ac) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}

/** Call from a tap so iOS unlocks audio. */
export function unlockAudio() {
  ctx();
}

let noiseBuf: AudioBuffer | null = null;
function noise(a: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function click(a: AudioContext, at: number, freq: number, dur: number, gain: number, q = 1.4) {
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  src.connect(bp).connect(g).connect(a.destination);
  src.start(at, Math.random() * 0.3, dur + 0.02);
}

function thump(a: AudioContext, at: number, gain: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(190, at);
  o.frequency.exponentialRampToValueAtTime(55, at + 0.05);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0008, at + 0.06);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + 0.07);
}

/** Mechanical shutter: mirror/blade release, then the curtain closing. */
export function playShutter() {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + 0.005;
  click(a, t, 3600, 0.028, 0.9);
  thump(a, t, 0.45);
  click(a, t + 0.012, 6500, 0.012, 0.25, 3);
  click(a, t + 0.062, 2400, 0.035, 0.7);
  thump(a, t + 0.062, 0.3);
  click(a, t + 0.085, 5200, 0.014, 0.18, 4);
}

/** Thumb-wheel film advance: a quick ratchet with a little friction. */
export function playAdvance() {
  const a = ctx();
  if (!a) return;
  let t = a.currentTime + 0.01;
  for (let i = 0; i < 10; i++) {
    click(a, t, 2100 + Math.random() * 700, 0.014, 0.28 * (0.7 + Math.random() * 0.3), 6);
    t += 0.028 + Math.random() * 0.016;
  }
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const lp = a.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const g = a.createGain();
  const s = a.currentTime;
  g.gain.setValueAtTime(0, s);
  g.gain.linearRampToValueAtTime(0.06, s + 0.05);
  g.gain.linearRampToValueAtTime(0, s + 0.42);
  src.connect(lp).connect(g).connect(a.destination);
  src.start(s, 0, 0.45);
}
