import { LegalPage } from "../legal";

export const metadata = {
  title: "Privacy policy",
  description: "How PixCherry handles your data and your guests' photos under Malaysia's PDPA, in English and Bahasa Melayu.",
  alternates: { canonical: "/privacy" },
};

// Personal Data Protection Act 2010 notice, in English and Bahasa Melayu (s.7(3) requires both).
// Written from how the service actually handles data (2026-10-18). Have it reviewed by a lawyer.
const COMPANY = "Cloudswired Technologies (202003293747 (003180326-U))";

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy notice"
      updated="Last updated 18 October 2026."
      sections={[
        [
          "Who we are",
          `PixCherry (pixcherry.com) is operated by ${COMPANY}, Johor, Malaysia ("we", "us"). This notice explains how we collect, use and protect personal data under Malaysia's Personal Data Protection Act 2010 (PDPA). It covers organisers (people who create an event) and guests (people who join an event album).`,
        ],
        [
          "What we collect from organisers",
          "• Your email address, to sign you in with a one-time code and to send receipts and reminders.\n• Your name and phone number, if you add them.\n• Your events: name, date, venue, description, cover photo, logo and settings.\n• Payment records: package, amount, date, receipt number and the payment reference from CHIP. We never see or store your bank or card details.",
        ],
        [
          "What we collect from guests",
          "• The name you type when you join (some events don't ask for one).\n• An optional selfie, shown as your picture in that album.\n• The photos you share, and the captions, hashtags, wishes, hearts and reports you add.\n• A cookie that keeps you signed in to that album.\n• To keep one phone to one roll and to stop abuse: basic information your browser reports (screen size, pixel ratio, time zone, touch support, number of processor cores, graphics name and operating system) and one-way hashes of your network address. We do not keep your IP address in readable form.\nWe do not ask guests for a phone number, email address or location.",
        ],
        [
          "Photos",
          "Photos go straight to our storage (Cloudflare R2). When a photo is processed we remove its hidden data, including GPS location and camera details. Every photo is checked automatically for nudity on our own server; no outside service sees it. Flagged photos are hidden until the organiser reviews them.\nAnyone who has an event's link or QR code can view that album, so organisers should share it only with their guests. Albums are kept out of search engines.",
        ],
        [
          "How we use personal data",
          "• To run the service: albums, uploads, downloads, slideshows, missions and leaderboards.\n• To sign you in, take payments and issue receipts.\n• To send service emails: sign-in codes, receipts and deletion reminders.\n• To prevent abuse, keep the service secure and answer support requests.\nWe do not sell personal data, we do not use it for advertising, and we do not use analytics or tracking tools.",
        ],
        [
          "Cookies and storage on your device",
          "We only use cookies the service needs: a sign-in cookie for organisers and one cookie per album for guests. Your browser's storage also remembers small choices, such as having seen the welcome screens. Cloudflare Turnstile, our anti-bot check, may process technical details about your browser to tell people from bots.",
        ],
        [
          "Who processes data for us",
          "• Vultr: our servers (Singapore).\n• Supabase: our database (Singapore).\n• Cloudflare: network security, content delivery, photo storage (R2) and the anti-bot check.\n• CHIP: payments (Malaysia).\n• Zoho ZeptoMail: email delivery.\nThey process data only to provide their service to us. Your data is stored in Singapore and may pass through Cloudflare's global network, so it is transferred outside Malaysia. By using PixCherry you agree to this transfer. We protect data with encryption in transit and restricted access.",
        ],
        [
          "Who can see it, and when we disclose it",
          "A guest's name, selfie, photos, captions and wishes are visible to the organiser and to anyone with the album link. We may also disclose personal data when the law requires it or a public authority makes a valid request, to protect the rights or safety of people or of the service, or as part of a sale or reorganisation of our business (we will give notice first).",
        ],
        [
          "How long we keep it",
          "• Photos, selfies, captions, hashtags, wishes, hearts and reports are deleted at the end of the event's storage period, shown on the event page. We email the organiser before that date. They are deleted sooner if the organiser deletes the event, a photo or a guest. Copies held in caches may take up to 24 hours to clear.\n• When an album is deleted, the guests' names and device information are erased too. Only anonymous counts remain.\n• Payment records and receipts are kept for 7 years for tax and accounting.\n• Organiser accounts stay until you delete yours (Account page). We then erase your personal details and keep only anonymised payment records.\n• Database backups are kept for up to 35 days.",
        ],
        [
          "Children",
          "PixCherry is not meant for children under 13 to sign up or join on their own. Events often include photos of children: organisers and guests must have permission, for example from a parent, before sharing them. A parent may ask us to remove a photo of their child at any time.",
        ],
        [
          "Your rights",
          "Under the PDPA you may ask to see the personal data we hold about you, ask us to correct it, or withdraw your consent and ask us to delete it. Guests who want a photo removed can ask the event organiser, or email us. Write to support@pixcherry.com. We reply within 21 days and may need to confirm who you are first. If you withdraw consent, we may not be able to keep providing the service to you.",
        ],
        [
          "Changes to this notice",
          "We may update this notice. The date at the top shows the latest version, and we email organisers about important changes before they take effect.",
        ],
        ["Contact", `${COMPANY}, Johor, Malaysia.\nEmail: support@pixcherry.com`],
      ]}
      translation={{
        id: "bm",
        label: "Versi Bahasa Melayu",
        title: "Notis privasi",
        updated: "Kemas kini terakhir 18 Oktober 2026. Jika terdapat percanggahan, versi Bahasa Inggeris di atas terpakai.",
        sections: [
          [
            "Siapa kami",
            `PixCherry (pixcherry.com) dikendalikan oleh ${COMPANY}, Johor, Malaysia ("kami"). Notis ini menerangkan cara kami mengumpul, menggunakan dan melindungi data peribadi di bawah Akta Perlindungan Data Peribadi 2010 (PDPA). Ia meliputi penganjur (individu yang mencipta acara) dan tetamu (individu yang menyertai album acara).`,
          ],
          [
            "Data yang kami kumpul daripada penganjur",
            "• Alamat e-mel anda, untuk log masuk dengan kod sekali guna dan untuk menghantar resit serta peringatan.\n• Nama dan nombor telefon anda, jika anda menambahnya.\n• Acara anda: nama, tarikh, tempat, keterangan, gambar muka depan, logo dan tetapan.\n• Rekod pembayaran: pakej, jumlah, tarikh, nombor resit dan rujukan pembayaran daripada CHIP. Kami tidak pernah melihat atau menyimpan butiran bank atau kad anda.",
          ],
          [
            "Data yang kami kumpul daripada tetamu",
            "• Nama yang anda taip semasa menyertai (sesetengah acara tidak memintanya).\n• Swafoto pilihan, dipaparkan sebagai gambar anda dalam album itu.\n• Gambar yang anda kongsi, serta kapsyen, tanda pagar, ucapan, 'heart' dan laporan yang anda tambah.\n• Kuki yang mengekalkan log masuk anda dalam album itu.\n• Untuk memastikan satu telefon satu 'roll' dan mencegah penyalahgunaan: maklumat asas yang dilaporkan oleh pelayar anda (saiz skrin, nisbah piksel, zon waktu, sokongan sentuhan, bilangan teras pemproses, nama grafik dan sistem pengendalian) serta cincangan sehala alamat rangkaian anda. Kami tidak menyimpan alamat IP anda dalam bentuk yang boleh dibaca.\nKami tidak meminta nombor telefon, alamat e-mel atau lokasi daripada tetamu.",
          ],
          [
            "Gambar",
            "Gambar dihantar terus ke storan kami (Cloudflare R2). Semasa gambar diproses, kami membuang data tersembunyinya, termasuk lokasi GPS dan butiran kamera. Setiap gambar disemak secara automatik untuk kandungan bogel di pelayan kami sendiri; tiada perkhidmatan luar yang melihatnya. Gambar yang ditanda akan disembunyikan sehingga disemak oleh penganjur.\nSesiapa yang mempunyai pautan atau kod QR sesuatu acara boleh melihat album itu, jadi penganjur hendaklah berkongsi hanya dengan tetamu mereka. Album tidak dipaparkan dalam enjin carian.",
          ],
          [
            "Cara kami menggunakan data peribadi",
            "• Untuk menjalankan perkhidmatan: album, muat naik, muat turun, tayangan slaid, misi dan papan pendahulu.\n• Untuk log masuk, menerima bayaran dan mengeluarkan resit.\n• Untuk menghantar e-mel perkhidmatan: kod log masuk, resit dan peringatan pemadaman.\n• Untuk mencegah penyalahgunaan, menjaga keselamatan perkhidmatan dan menjawab pertanyaan sokongan.\nKami tidak menjual data peribadi, tidak menggunakannya untuk pengiklanan, dan tidak menggunakan alat analitik atau penjejakan.",
          ],
          [
            "Kuki dan storan pada peranti anda",
            "Kami hanya menggunakan kuki yang diperlukan oleh perkhidmatan: kuki log masuk untuk penganjur dan satu kuki bagi setiap album untuk tetamu. Storan pelayar anda juga mengingati pilihan kecil, seperti telah melihat skrin aluan. Cloudflare Turnstile, semakan anti-bot kami, mungkin memproses butiran teknikal pelayar anda untuk membezakan manusia daripada bot.",
          ],
          [
            "Pihak yang memproses data bagi pihak kami",
            "• Vultr: pelayan kami (Singapura).\n• Supabase: pangkalan data kami (Singapura).\n• Cloudflare: keselamatan rangkaian, penghantaran kandungan, storan gambar (R2) dan semakan anti-bot.\n• CHIP: pembayaran (Malaysia).\n• Zoho ZeptoMail: penghantaran e-mel.\nMereka memproses data hanya untuk menyediakan perkhidmatan mereka kepada kami. Data anda disimpan di Singapura dan mungkin melalui rangkaian global Cloudflare, maka ia dipindahkan ke luar Malaysia. Dengan menggunakan PixCherry, anda bersetuju dengan pemindahan ini. Kami melindungi data dengan penyulitan semasa penghantaran dan akses yang terhad.",
          ],
          [
            "Siapa yang boleh melihatnya, dan bila kami mendedahkannya",
            "Nama, swafoto, gambar, kapsyen dan ucapan tetamu boleh dilihat oleh penganjur dan sesiapa yang mempunyai pautan album. Kami juga mungkin mendedahkan data peribadi apabila dikehendaki oleh undang-undang atau atas permintaan sah pihak berkuasa awam, untuk melindungi hak atau keselamatan orang ramai atau perkhidmatan, atau sebagai sebahagian daripada penjualan atau penyusunan semula perniagaan kami (kami akan memberi notis terlebih dahulu).",
          ],
          [
            "Tempoh kami menyimpannya",
            "• Gambar, swafoto, kapsyen, tanda pagar, ucapan, 'heart' dan laporan dipadam pada akhir tempoh simpanan acara, seperti yang ditunjukkan di halaman acara. Kami menghantar e-mel kepada penganjur sebelum tarikh itu. Ia dipadam lebih awal jika penganjur memadam acara, gambar atau tetamu. Salinan dalam cache mungkin mengambil masa sehingga 24 jam untuk hilang.\n• Apabila album dipadam, nama dan maklumat peranti tetamu turut dipadam. Hanya kiraan tanpa nama yang kekal.\n• Rekod pembayaran dan resit disimpan selama 7 tahun untuk tujuan cukai dan perakaunan.\n• Akaun penganjur kekal sehingga anda memadamnya (halaman Akaun). Kami kemudian memadam butiran peribadi anda dan hanya menyimpan rekod pembayaran tanpa nama.\n• Salinan sandaran pangkalan data disimpan sehingga 35 hari.",
          ],
          [
            "Kanak-kanak",
            "PixCherry tidak bertujuan untuk kanak-kanak di bawah 13 tahun mendaftar atau menyertai sendiri. Acara sering mengandungi gambar kanak-kanak: penganjur dan tetamu mesti mendapat kebenaran, contohnya daripada ibu bapa, sebelum berkongsi gambar tersebut. Ibu bapa boleh meminta kami membuang gambar anak mereka pada bila-bila masa.",
          ],
          [
            "Hak anda",
            "Di bawah PDPA, anda boleh meminta untuk melihat data peribadi yang kami simpan tentang anda, meminta kami membetulkannya, atau menarik balik persetujuan dan meminta kami memadamnya. Tetamu yang mahu sesuatu gambar dibuang boleh meminta penganjur acara, atau menghantar e-mel kepada kami. Tulis kepada support@pixcherry.com. Kami akan membalas dalam tempoh 21 hari dan mungkin perlu mengesahkan identiti anda terlebih dahulu. Jika anda menarik balik persetujuan, kami mungkin tidak dapat terus menyediakan perkhidmatan kepada anda.",
          ],
          [
            "Perubahan kepada notis ini",
            "Kami mungkin mengemas kini notis ini. Tarikh di atas menunjukkan versi terkini, dan kami akan menghantar e-mel kepada penganjur tentang perubahan penting sebelum ia berkuat kuasa.",
          ],
          ["Hubungi kami", `${COMPANY}, Johor, Malaysia.\nE-mel: support@pixcherry.com`],
        ],
      }}
    />
  );
}
