/* ══════════════════════════════════════════════════════════════════════════
   TELEGRAM «NATIVE LOGIN» KO'PRIGI (V41)

   Telegramning nativ SDK si Telegram ILOVASINI ochadi (brauzer umuman
   aralashmaydi) va imzolangan `id_token` qaytaradi. Biz uni serverga
   yuboramiz, server esa imzoni Telegram kaliti bilan tekshirib sessiya
   beradi.

   ⚠ Plagin BO'LMASLIGI MUMKIN: SDK faqat GitHub Packages'da va tokensiz
   olinmaydi, ya'ni tokensiz qurilgan APK da plagin yo'q. Shuning uchun
   `available()` tekshiruvi bor va kirish ekrani tugmani faqat shunda
   chizadi — ishlamaydigan tugma odamni bekorga urintiradi.

   ⚠ Token BU YERDA tekshirilmaydi va tekshirilmasligi ham kerak:
   telefondagi tekshiruvni ilovani o'zgartirgan odam chetlab o'tadi.
   Yagona haqiqiy tekshiruv — serverda (`/app/auth/telegram/native`).
   ══════════════════════════════════════════════════════════════════════════ */

const plugin = () => window.Capacitor?.Plugins?.TelegramLogin;

/** Nativ kirish shu qurilmada mumkinmi. */
export const nativeTelegramAvailable = () => !!plugin()?.login;

/**
 * Telegram ilovasini ochadi va `id_token` qaytaradi.
 *
 * ⚠ Va'da UZOQ kutishi mumkin: odam Telegramga o'tadi, u yerda
 * tasdiqlaydi va qaytadi. Chaqiruvchi shuni hisobga olib «kutilmoqda»
 * holatini ko'rsatishi kerak.
 */
export async function loginWithTelegramApp() {
  const p = plugin();
  if (!p?.login) throw new Error("Bu qurilmada mavjud emas");
  const { idToken } = await p.login();
  if (!idToken) throw new Error("Telegram javob bermadi");
  return idToken;
}
