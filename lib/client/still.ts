// A real still photo from the camera (Chrome on Android: ImageCapture.takePhoto):
// full sensor resolution and the phone's own photo processing, instead of a
// frame from the video stream. Scaled down here with high-quality resampling so
// the upload stays small. Returns null where it isn't supported (iPhone); the
// camera then uses the video frame.

type ImageCaptureLike = { takePhoto(): Promise<Blob> };
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

/** `crop` keeps the centre 1/crop of the photo (digital zoom where the camera has no optical zoom). */
export async function stillPhoto(track: MediaStreamTrack | null, maxLong: number, crop = 1): Promise<ImageBitmap | null> {
  const Ctor = (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
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
