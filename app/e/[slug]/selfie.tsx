"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";

// Optional selfie for the guest's avatar: the front camera opens, the photo is
// cut to a centred square and shrunk on the phone (a few KB), then uploaded
// after joining (see uploadSelfie).

async function square(file: File, size = 512) {
  const img = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  img.close();
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.85));
  c.width = c.height = 0;
  return blob;
}

/** Uploads the selfie; never blocks joining for long (one retry, 12 s each). */
export async function uploadSelfie(slug: string, blob: Blob) {
  for (let i = 0; i < 2; i++) {
    const r = await fetch(`/api/e/${slug}/avatar`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob, signal: AbortSignal.timeout(12_000) }).catch(() => null);
    if (r?.ok) return ((await r.json().catch(() => ({}))) as { avatar?: string }).avatar ?? null;
    if (r && r.status < 500) return null;
  }
  return null;
}

/** Round button showing the selfie (or a camera); `onPick` gets the prepared square JPEG. */
export function SelfieButton({ preview, onPick, size = "md", label }: { preview: string | null; onPick: (blob: Blob, url: string) => void; size?: "md" | "lg"; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const cls = size === "lg" ? "size-16" : "size-14";
  return (
    <>
      <button type="button" onClick={() => input.current?.click()} className={`relative ${cls} shrink-0 overflow-hidden rounded-full border-2 border-dashed border-brand/50 bg-brand-soft text-brand`} aria-label={label}>
        {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <Camera className="mx-auto size-6" aria-hidden />}
        {preview ? <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-[9px] font-bold uppercase text-white">Change</span> : null}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const blob = await square(f).catch(() => null);
          if (blob) onPick(blob, URL.createObjectURL(blob));
        }}
      />
    </>
  );
}
