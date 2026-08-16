package uz.ekassam.app;

import android.app.Activity;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ScreenBrightness — mijoz kartasi ko'rsatilayotganda ekranni maksimal
 * yorug'likka o'tkazadi.
 *
 * Nega kerak: kartadagi QR/shtrixni kassada SKANER o'qiydi. Telefon esa
 * batareyani tejab ekranni xiralashtiradi va xira ekrandan lazerli skaner
 * ham, kamera ham kodni ko'pincha ololmaydi.
 *
 * ⚠ NEGA TIZIM SOZLAMASI EMAS: bu yerda OYNANING o'z yorug'ligi
 * (`WindowManager.LayoutParams.screenBrightness`) o'zgartiriladi. U faqat
 * ilova oldinda turganida amal qiladi va Android uni ilova fonga o'tishi
 * bilanoq O'ZI qaytaradi — ilova qulab tushsa ham telefon eng yorug'ida
 * qolib ketmaydi. Qurilma sozlamasini o'zgartiradigan kutubxonalar esa
 * aynan shu xavfni olib keladi va ruxsat ham talab qiladi.
 *
 * `FLAG_KEEP_SCREEN_ON` shu yerda: kod ko'rsatilib turganda ekran so'nsa,
 * mijoz uni qaytadan yoqishga majbur bo'lardi (navbatda turib).
 *
 * JS tomoni: `src/lib/ek-brightness.js`.
 */
@CapacitorPlugin(name = "ScreenBrightness")
public class ScreenBrightnessPlugin extends Plugin {

    @PluginMethod
    public void max(PluginCall call) {
        apply(1.0f, true);
        call.resolve();
    }

    @PluginMethod
    public void restore(PluginCall call) {
        /* BRIGHTNESS_OVERRIDE_NONE (-1) — «tizim o'zi hal qilsin» */
        apply(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE, false);
        call.resolve();
    }

    private void apply(final float value, final boolean keepOn) {
        final Activity act = getActivity();
        if (act == null) return;

        act.runOnUiThread(() -> {
            try {
                Window w = act.getWindow();
                WindowManager.LayoutParams lp = w.getAttributes();
                lp.screenBrightness = value;
                w.setAttributes(lp);
                if (keepOn) {
                    w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            } catch (Exception ignored) {
                /* Yorug'lik o'zgarmadi — karta baribir ko'rinadi */
            }
        });
    }
}
