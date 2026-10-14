import { LegalPage } from "../legal";

export const metadata = { title: "Terms" };

// Template wording. Have it reviewed by a lawyer before launch.
export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      sections={[
        ["The service", "EventSnap is operated by Cloudswired Technologies, Johor, Malaysia. Organisers create an event gallery; guests upload photos to it through a link or QR code."],
        ["Payment", "Each event is paid once, by the package chosen at checkout. Prices are in Malaysian Ringgit. Upgrades and add-ons are charged separately. Payments are processed by CHIP."],
        ["Storage and deletion", "Photos are kept for the storage period of the event's package, counted from the end of the event, and then deleted permanently. The deletion date is shown on the event page and we email the organiser before it. Download the album before that date; deleted photos cannot be recovered."],
        ["Your content", "Organisers and guests keep the rights to their photos. By uploading, guests let the organiser and other people with the event link view and download them. Organisers are responsible for the event and may remove any photo."],
        ["Acceptable use", "Do not upload content that is illegal, sexual, violent, hateful or that you have no right to share. We may remove content or suspend an event that breaks these rules, without refund."],
        ["Refunds", "Contact us within 7 days of payment if the service did not work for your event and we will review it."],
        ["Liability", "The service is provided as is. To the extent allowed by law, our liability is limited to the amount paid for the event concerned."],
      ]}
    />
  );
}
