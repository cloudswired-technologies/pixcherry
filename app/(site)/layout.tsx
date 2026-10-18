import { WhatsAppButton } from "@/components/whatsapp-button";

// Marketing pages (home, guide, demo, legal, login): each page draws its own header and footer;
// this layout only adds the WhatsApp button.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <WhatsAppButton />
    </>
  );
}
