// A real still photo from the camera (Android Chrome's ImageCapture.takePhoto):
// full sensor resolution and the phone's own photo processing, instead of a
// frame from the video stream. Scaled down here with high-quality resampling so
// the upload stays small. Returns null where it isn't supported (iPhone), and
// the camera then uses the video frame as before.

type ImageCaptureLike = { takePhoto(): Promise<Blob> };
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

export async function stillPhoto(track: MediaStreamTrack | undefined, maxLong: number): Promise<ImageBitmap | null> {
  const Ctor = (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
  if (!Ctor || !track || track.readyState !== "live") return null;
  try {
    const blob = await Promise.race([new Ctor(track).takePhoto(), timeout(3000)]);
    const full = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const k = Math.min(1, maxLong / Math.max(full.width, full.height));
    if (k >= 1) return full;
    const small = await createImageBitmap(full, { resizeWidth: Math.round(full.width * k), resizeHeight: Math.round(full.height * k), resizeQuality: "high" });
    full.close();
    return small;
  } catch {
    return null;
  }
}
