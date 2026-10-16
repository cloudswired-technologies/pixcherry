import { Logo } from "@/components/brand";

// Unknown or unpaid event link: a friendly page with a real 404 status.
export default function EventNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="grid justify-items-center gap-3">
        <Logo className="text-lg" />
        <h1 className="text-xl font-bold">Event not found</h1>
        <p className="max-w-xs text-sm text-muted-foreground">Check the QR code or link with the organiser.</p>
      </div>
    </main>
  );
}
