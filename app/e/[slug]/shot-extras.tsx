"use client";

import { useState } from "react";
import { Check, Hash, Target, Type } from "lucide-react";
import { TagPicker } from "./panels";

// The extras of a photo before it's shared — mission, hashtags, caption — as
// three small pills under the photo. Each opens its own panel, so the review
// screen stays clean on a phone. Used by the camera review and "develop".

type Mission = { id: string; title: string; emoji: string | null };
type Panel = "mission" | "tags" | "caption" | null;

function Pill({ icon: Icon, label, on, onClick }: { icon: typeof Hash; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 min-w-0 max-w-[45%] items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${on ? "bg-white text-black" : "bg-white/12 text-white"}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function ShotExtras({
  missions,
  mission,
  onMission,
  suggestedTags,
  tags,
  onTags,
  caption,
  onCaption,
}: {
  missions: Mission[];
  mission: string | null;
  onMission: (id: string | null) => void;
  suggestedTags: string[] | null;
  tags: string[];
  onTags: (t: string[]) => void;
  caption: string;
  onCaption: (c: string) => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const m = missions.find((x) => x.id === mission) ?? null;
  return (
    <>
      <div className="flex flex-wrap justify-center gap-2" aria-label="Photo extras">
        {missions.length ? <Pill icon={Target} label={m ? `${m.emoji ?? "🎯"} ${m.title}` : "Mission"} on={!!m} onClick={() => setPanel("mission")} /> : null}
        {suggestedTags ? <Pill icon={Hash} label={tags.length ? tags.map((t) => `#${t}`).join(" ") : "Hashtags"} on={tags.length > 0} onClick={() => setPanel("tags")} /> : null}
        <Pill icon={Type} label={caption ? "Caption" : "Add caption"} on={!!caption} onClick={() => setPanel("caption")} />
      </div>

      {panel ? (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/50" onClick={() => setPanel(null)}>
          <div
            role="dialog"
            aria-label={panel === "mission" ? "Choose a mission" : panel === "tags" ? "Add hashtags" : "Write a caption"}
            className="grid gap-4 rounded-t-[1.75rem] bg-[#1a1a1e] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white [animation:pc-rise_0.2s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-white/20" />
            {panel === "mission" ? (
              <div className="grid gap-2">
                <h2 className="text-lg font-bold">Which mission is this?</h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => (onMission(null), setPanel(null))} className={`rounded-full px-3.5 py-2 text-sm font-semibold ${mission ? "bg-white/10" : "bg-white text-black"}`}>
                    No mission
                  </button>
                  {missions.map((x) => (
                    <button key={x.id} type="button" onClick={() => (onMission(x.id), setPanel(null))} className={`rounded-full px-3.5 py-2 text-left text-sm font-semibold ${mission === x.id ? "bg-brand text-white" : "bg-white/10"}`}>
                      {x.emoji ?? "🎯"} {x.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : panel === "tags" && suggestedTags ? (
              <div className="grid gap-2">
                <h2 className="text-lg font-bold">Hashtags</h2>
                <p className="-mt-1 text-sm text-white/60">Each one becomes an album everyone can browse. Up to 5.</p>
                <TagPicker suggested={suggestedTags} value={tags} onChange={onTags} dark wrap />
              </div>
            ) : (
              <div className="grid gap-2">
                <h2 className="text-lg font-bold">Caption</h2>
                <textarea
                  value={caption}
                  onChange={(e) => onCaption(e.target.value.replace(/\n/g, " ").slice(0, 140))}
                  autoFocus
                  rows={2}
                  placeholder="Say something about this moment…"
                  aria-label="Caption"
                  enterKeyHint="done"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), setPanel(null))}
                  className="w-full resize-none rounded-2xl bg-white/10 px-4 py-3 text-base text-white outline-none placeholder:text-white/40"
                />
                <div className="text-right text-xs text-white/40">{caption.length}/140</div>
              </div>
            )}
            <button type="button" onClick={() => setPanel(null)} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand font-bold">
              <Check className="size-5" aria-hidden /> Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** The caption shown on the photo while reviewing, like text on a story. */
export function CaptionOverlay({ caption }: { caption: string }) {
  if (!caption) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 rounded-b-xl bg-gradient-to-t from-black/75 to-transparent px-4 pb-4 pt-10 text-center text-[15px] font-semibold leading-snug text-white">
      {caption}
    </div>
  );
}
