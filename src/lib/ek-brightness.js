/* ══════════════════════════════════════════════════════════════════════════
   EKRAN YORUG'LIGI — kod ko'rsatilayotgan paytda maksimal (Android)

   Nega kerak: mijoz kartasini kassada KO'RSATADI. Telefon esa batareyani
   tejab ekranni xiralashtiradi va o'sha xira ekrandan lazerli skaner ham,
   kameraviy skaner ham kodni ko'pincha O'QIY OLMAYDI — mijoz yorug'likni
   qo'lda ko'tarishga majbur bo'lardi.

   ⚠ NEGA O'Z PLAGINI: `@capacitor-community/screen-brightness` QURILMA
   yorug'ligini (tizim sozlamasini) o'zgartiradi va uni tiklashni ilovaning
   o'zi eslab qolishi kerak — ilova qulab tushsa telefon eng yorug'ida qolib
   ketadi. Bu yerdagi `Window.screenBrightness` esa OYNAGA tegishli: Android
   uni ilova fonga o'tishi bilanoq o'zi qaytaradi. Ruxsat ham talab qilmaydi.
   Nativ tomoni: `ScreenBrightnessPlugin.java`.

   ⚠ Brauzerda (va `.exe` da) IMKONI YO'Q — veb standartida yorug'likni
   boshqarish yo'q. U yerda kod shunchaki OQ FONDA va katta chiziladi: bu
   ham skanerlashni sezilarli osonlashtiradi. Chaqiruvchi hech narsa
   tekshirmasligi kerak, bu yerdagi funksiyalar jim o'tadi.
   ══════════════════════════════════════════════════════════════════════════ */

const plugin = () => window.Capacitor?.Plugins?.ScreenBrightness;

/* ⚠ Bo'sh `{}` ATAYLAB uzatiladi: Capacitor ko'prigi metodni
   `(options, callback)` deb chaqiradi va argumentsiz chaqiruvda ba'zi
   versiyalarda `undefined.toJSON` da yiqiladi. */

/** Ekranni maksimal yorug'likka o'tkazadi va so'nishiga yo'l qo'ymaydi. */
export function maxBrightness() {
  try { plugin()?.max?.({}); } catch (e) { /* eski APK — jim o'tamiz */ }
}

/** Yorug'likni tizim boshqaruviga qaytaradi. */
export function restoreBrightness() {
  try { plugin()?.restore?.({}); } catch (e) { /* eski APK — jim o'tamiz */ }
}
