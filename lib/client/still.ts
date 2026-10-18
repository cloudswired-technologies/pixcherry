// A real still photo from the camera (Chrome on Android: ImageCapture.takePhoto): full sensor
// resolution and the phone's own photo processing, never a frame of the viewfinder. Scaled down
// here with high-quality resampling so the upload stays small. Browsers without ImageCapture
// (iPhone Safari) don't get the PixCamera at all: Snap opens the phone's own camera app there.

type PhotoCaps = { imageWidth?: { max?: number }; imageHeight?: { max?: number } };
type ImageCaptureLike = { takePhoto(): Promise<Blob>; getPhotoCapabilities(): Promise<PhotoCaps> };
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
const capture = () => (typeof window === "undefined" ? undefined : (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture);

/** Can this browser take a real still photo from the camera? */
export function canTakeStill() {
  return typeof capture() === "function";
}

/** The shape of the camera's photos as long side / short side (usually 4/3), or null if unknown. */
export async function photoAspect(track: MediaStreamTrack): Promise<number | null> {
  const Ctor = capture();
  if (!Ctor || track.readyState !== "live") return null;
  try {
    const caps = await Promise.race([new Ctor(track).getPhotoCapabilities(), timeout(3000)]);
    const w = caps.imageWidth?.max ?? 0;
    const h = caps.imageHeight?.max ?? 0;
    return w > 0 && h > 0 ? Math.max(w, h) / Math.min(w, h) : null;
  } catch {
    return null;
  }
}

/** `crop` keeps the centre 1/crop of the photo (digital zoom where the camera has no optical zoom). */
export async function stillPhoto(track: MediaStreamTrack | null, maxLong: number, crop = 1): Promise<ImageBitmap | null> {
  const Ctor = capture();
  if (!Ctor || !track || track.readyState !== "live") return null;
  try {
    const blob = await Promise.race([new Ctor(track).takePhoto(), timeout(4000)]);
    const full = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const cw = Math.round(full.width / crop);
    const ch = Math.round(full.height / crop);
    const k = Math.min(1, maxLong / Math.max(cw, ch));
    const out = await createImageBitmap(full, Math.round((full.width - cw) / 2), Math.round((full.height - ch) / 2), cw, ch, {
      resizeWidth: Math.round(cw * k),
      resizeHeight: Math.round(ch * k),
      resizeQuality: "high",
    });
    full.close();
    return out;
  } catch {
    return null;
  }
}
