import { WHATSAPP_URL } from "@/lib/seo";

// Floating "chat on WhatsApp" button, bottom-right, on the marketing pages only (not on guest
// albums, where it would invite guests to message us about someone else's event). Phones get the
// round icon; wider screens also get a label.
export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with PixCherry on WhatsApp"
      className="group fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-3 sm:right-6"
    >
      <span className="hidden rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-lift ring-1 ring-border transition group-hover:-translate-x-0.5 md:inline">
        Questions? Chat with us
      </span>
      <span className="grid size-14 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_10px_30px_rgb(37_211_102/0.45)] transition group-hover:scale-105 group-active:scale-95">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
          <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
        </svg>
      </span>
    </a>
  );
}
