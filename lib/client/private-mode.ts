// Is this a private window? A private window forgets the guest when it closes, so
// joining from one would hand out a fresh roll every time: private windows can look
// at the album but not join. This must never lock out a real guest, so:
//  - any doubt or error = not private;
//  - in-app browsers (WhatsApp, Instagram, Facebook, TikTok…) are never private:
//    their storage can behave like a private window's;
//  - only Safari and Firefox can be told: they refuse their private file system in a
//    private window. Chrome, Edge and Samsung Internet can't (checked 2026-10-17: a
//    real Edge InPrivate window reports the same storage as a normal one), so there
//    the "same IPv6 address, same phone" match in lib/guests.ts is what applies.

const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|WhatsApp|Line\/|Messenger|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter|LinkedInApp|GSA\/|Telegram|; wv\)|WebView/i;

async function detect() {
  const ua = navigator.userAgent;
  if (IN_APP.test(ua)) return false;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // On iPhone every browser is Safari underneath; without "Safari/" it's an app's web view.
  if (iOS && !/Safari\//.test(ua)) return false;
  const webkit = iOS || (/Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua));
  if ((!webkit && !/Firefox/.test(ua)) || !navigator.storage?.getDirectory) return false;
  try {
    await navigator.storage.getDirectory();
    return false;
  } catch (e) {
    return /unknown transient reason|security error/i.test(String((e as Error)?.message ?? e));
  }
}

export async function isPrivateWindow() {
  try {
    return await Promise.race([detect(), new Promise<boolean>((r) => setTimeout(() => r(false), 1500))]);
  } catch {
    return false;
  }
}
