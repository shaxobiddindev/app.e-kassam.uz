/* ══════════════════════════════════════════════════════════════════════════
   Push bildirishnomalar (V33) — faqat Android ilova ichida.

   Oqim: ruxsat so'raladi → FCM tokeni olinadi → serverga yoziladi
   (`POST /push/register`). Server kunlik xulosa va smena yopilishini shu
   tokenga yuboradi.

   ⚠ Hamma bosqich HIMOYALANGAN: plagin yo'q (web/desktop), ruxsat rad
   etilgan, server xatosi — ilova baribir ishlayveradi, faqat holat
   Sozlamalarda «o'chiq» bo'lib ko'rinadi.
   ══════════════════════════════════════════════════════════════════════════ */
import { isMobileApp } from "./ek-desktop";
import { pushApi } from "../api";

export async function registerPushIfPossible() {
  if (!isMobileApp()) return "unsupported";
  let PushNotifications;
  try {
    ({ PushNotifications } = await import("@capacitor/push-notifications"));
  } catch (_) {
    return "unsupported";
  }
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return "off";

    return await new Promise((resolve) => {
      let done = false;
      PushNotifications.addListener("registration", async ({ value }) => {
        if (done) return; done = true;
        try {
          await pushApi.register(value);
          resolve("on");
        } catch (_) {
          resolve("off");
        }
      });
      PushNotifications.addListener("registrationError", () => {
        if (!done) { done = true; resolve("off"); }
      });
      PushNotifications.register();
      // Javob kelmasa ham osilib qolmaymiz
      setTimeout(() => { if (!done) { done = true; resolve("off"); } }, 8000);
    });
  } catch (_) {
    return "off";
  }
}
