import { LegalPage } from "../legal";

export const metadata = { title: "Terms" };

// Written from how the service actually works (2026-10-18). Have it reviewed by a lawyer.
const COMPANY = "Cloudswired Technologies (202003293747 (003180326-U))";

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      updated="Last updated 18 October 2026."
      sections={[
        [
          "The service",
          `PixCherry (pixcherry.com) is operated by ${COMPANY}, Johor, Malaysia ("we", "us"). Organisers create an event album; guests join it through a link or QR code and share photos, captions and wishes. By using PixCherry you agree to these terms and to our privacy notice.`,
        ],
        [
          "Organiser accounts",
          "Organisers sign in with a one-time code sent to their email. You must be at least 18 to buy a package. Keep access to your email secure: anyone who can read it can sign in to your account. You can delete your account at any time from the Account page.",
        ],
        [
          "Packages and payment",
          "• Each event is paid once, for the package chosen at checkout. Prices are in Malaysian Ringgit (RM).\n• Payments are made by FPX online banking and processed by CHIP. Upgrades and add-ons are charged separately. Promo codes have their own limits and cannot be exchanged for cash.\n• Your event keeps the limits and features of the package you paid for, even if we change our packages later.\n• One payment covers one event: the album opens to guests at the event's start time, and once it starts the event dates can no longer be changed.",
        ],
        [
          "Guests",
          "Guests do not need an account. A guest's photos count against the limits of the event's package. Organisers can hide or remove photos, block guests and merge guests who are the same person.",
        ],
        [
          "Storage and deletion",
          "Photos are kept for the storage period of the event's package, counted from the end of the event, and then deleted permanently. The deletion date is shown on the event page and we email the organiser before it. Download the album before that date: deleted photos cannot be recovered. Copies held in caches may take up to 24 hours to clear.",
        ],
        [
          "Your content and permissions",
          "Organisers and guests keep the rights to their photos. You allow us to store, process (resize, remove hidden data, run automatic checks) and show your content only to provide the service. By uploading, guests let the organiser, and anyone with the event link, view their photos and, where the package allows, download them.\nYou must have the right to share what you upload. Organisers are responsible for their event, including telling guests how photos will be shared and having permission to share photos of others, especially children.",
        ],
        [
          "Acceptable use",
          "Do not upload content that is illegal, sexual, violent, hateful, harassing or that you have no right to share, and do not try to get around the limits, bot checks or security of the service, or copy content from it in bulk. Photos are checked automatically and anyone can report a photo. We may remove content, or suspend an event or account that breaks these rules, without refund.",
        ],
        [
          "Demo albums",
          "The live demo albums are public and visitors' photos and wishes are cleared after 24 hours. Do not share private photos in a demo album.",
        ],
        ["Refunds", "Contact us within 7 days of payment if the service did not work for your event and we will review it."],
        [
          "Availability and changes",
          "We work to keep PixCherry running, but we do not guarantee it will always be available or free of errors, for example during maintenance. We may change or improve features. We may update these terms; the date at the top shows the latest version and we email organisers about important changes before they take effect.",
        ],
        [
          "Liability",
          "The service is provided as is. To the extent allowed by law, we are not liable for indirect or consequential loss, and our total liability for an event is limited to the amount paid for that event. Nothing in these terms limits rights you have under Malaysian consumer law that cannot be excluded.",
        ],
        ["Governing law", "These terms are governed by the laws of Malaysia, and the courts of Malaysia have jurisdiction."],
        ["Contact", `${COMPANY}, Johor, Malaysia.\nEmail: support@pixcherry.com`],
      ]}
    />
  );
}
