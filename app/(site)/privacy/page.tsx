import { LegalPage } from "../legal";

export const metadata = { title: "Privacy" };

// Template wording (PDPA 2010). Have it reviewed by a lawyer before launch.
export default function Privacy() {
  return (
    <LegalPage
      title="Privacy notice"
      sections={[
        ["Who we are", "Cloudswired Technologies (\"we\") runs EventSnap. This notice explains how we handle personal data under the Personal Data Protection Act 2010."],
        ["What we collect", "Organisers: email address, name and phone number if given, payment records. Guests: the name they choose to enter (optional) and the photos they upload. We keep a one-way hash of the network address used, to prevent abuse."],
        ["Photos", "Photos are stored on Cloudflare R2. Location and camera data (EXIF) are removed when a photo is processed. Anyone with the event link can view the gallery, so share the link only with your guests."],
        ["How long we keep data", "Photos are deleted permanently at the end of the event's storage period. Payment records are kept for 7 years for tax purposes. Organiser accounts stay until you ask us to delete them."],
        ["Who we share with", "Our processors only: Cloudflare (hosting and storage), Supabase (database), CHIP (payments) and Zoho ZeptoMail (email). We do not sell personal data."],
        ["Your rights", "You may ask to access, correct or delete your personal data. Guests who want a photo removed can ask the event organiser or contact us."],
        ["Contact", "support@eventsnap.my"],
      ]}
    />
  );
}
