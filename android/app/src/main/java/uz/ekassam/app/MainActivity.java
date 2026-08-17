package uz.ekassam.app;

import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /* Oxirgi qo'llangan status-bar rangi — ilova ochilishining BIRINCHI
       kadri uchun (JS hali yuklanmagan payt). ThemeBarPlugin yozadi. */
    static final String PREF = "ek_ui";
    static final String KEY_BAR = "barColor";
    static final String KEY_DARK = "barDark";

    private View content;

    /* ⚠ TEPA QISM TUZATISHI (2026-08-15).
     *
     * targetSdk 36 → Android 15/16 webview'ni status-bar OSTIGA chizadi
     * (majburiy edge-to-edge). capacitor.config.json'dagi
     * `adjustMarginsForEdgeToEdge` Capacitor 8.5 da MAVJUD EMAS edi —
     * hech narsa kompensatsiya qilmagan, kontent yopishib qolgan.
     *
     * Qatlamlar:
     *   1. styles.xml: `windowOptOutEdgeToEdgeEnforcement` — Android 15 da
     *      ishlaydi, dekor insetlarni O'ZI yutadi (bu yerga 0 keladi).
     *   2. Quyidagi listener — Android 16+ da (opt-out e'tiborsiz)
     *      insetlarni qo'lda padding qiladi. Ikkalasi birga IKKI MARTA
     *      surmaydi: qaysi biri ishlasa, ikkinchisiga nol tegadi.
     *
     * IME (klaviatura) pastki insetga qo'shilgan: Android 16 da
     * adjustResize o'rnini aynan shu bosadi.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* ⚠ super.onCreate() dan OLDIN: bridge aynan o'sha yerda quriladi
           va keyin ro'yxatga olingan plagin JS'da `undefined` bo'lib qoladi. */
        registerPlugin(ThemeBarPlugin.class);
        registerPlugin(ScreenBrightnessPlugin.class);
        registerTelegramLoginIfPresent();
        super.onCreate(savedInstanceState);

        content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });

        /* Boshlang'ich rang: oxirgi ma'lum (SharedPreferences) yoki
           qurilmaning DayNight rejimi. JS ko'tarilgach `ThemeBar.apply`
           haqiqiy tema rangini beradi. */
        SharedPreferences sp = getSharedPreferences(PREF, MODE_PRIVATE);
        boolean night = (getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        String saved = sp.getString(KEY_BAR, null);
        int color = ContextCompat.getColor(this, R.color.ek_window);
        boolean dark = night;
        if (saved != null) {
            try {
                color = Color.parseColor(saved);
                dark = sp.getBoolean(KEY_DARK, night);
            } catch (Exception ignored) { /* buzuq qiymat — DayNight qoladi */ }
        }
        applyBar(color, dark);
    }

    /* ══ TELEGRAM «NATIVE LOGIN» (V41) ═══════════════════════════════════
       ⚠ Plagin REFLEKSIYA bilan ro'yxatga olinadi: uning manbasi Telegram
       SDK siga tayanadi, SDK esa faqat GitHub Packages'da va tokensiz
       olinmaydi. Tokensiz qurilishda sinf UMUMAN bo'lmaydi va bu yer
       jimgina o'tishi kerak — aks holda bitta ixtiyoriy imkoniyat butun
       ilovani ishga tushmaydigan qilib qo'yardi. */
    private static final String TG_PLUGIN = "uz.ekassam.app.TelegramLoginPlugin";

    @SuppressWarnings("unchecked")
    private void registerTelegramLoginIfPresent() {
        try {
            Class<?> c = Class.forName(TG_PLUGIN);
            registerPlugin((Class<? extends com.getcapacitor.Plugin>) c);
        } catch (ClassNotFoundException e) {
            /* SDK siz qurilgan APK — nativ kirish tugmasi ko'rsatilmaydi */
        }
    }

    /**
     * Telegramdan qaytgan havola.
     *
     * ⚠ `singleTask` tufayli ilova qaytadan yaratilmaydi va havola
     * shu yerga keladi. Uni plaginga uzatamiz; plagin bo'lmasa yoki
     * havola boshqa narsa bo'lsa — Capacitor o'z ishini davom ettiradi
     * (masalan `ekassam://app`).
     */
    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        try {
            var handle = getBridge().getPlugin("TelegramLogin");
            if (handle != null) {
                /* ⚠ Sinf nomi bilan emas, REFLEKSIYA bilan: bu fayl SDK siz
                   ham kompilyatsiya bo'lishi kerak, ya'ni
                   `TelegramLoginPlugin` turiga bog'lanib qolmasligi shart. */
                Object instance = handle.getInstance();
                instance.getClass()
                        .getMethod("handleIntent", android.content.Intent.class)
                        .invoke(instance, intent);
            }
        } catch (Throwable ignored) {
            /* Plagin yo'q (SDK siz qurilgan) — hech narsa qilinmaydi */
        }
    }

    /**
     * Status-bar zonasini bo'yaydi. ThemeBarPlugin JS tomonidan chaqiradi.
     *
     * ⚠ Insets zonasi (status-bar orti) ILOVA FONI rangida bo'lishi SHART.
     * Ilgari bu yerda qattiq brend ko'ki (#1663D8) turardi va u sahifa foni
     * bilan mos kelmay, ekran tepasida xunuk AJRATUVCHI chiziq bo'lib
     * ko'rinardi (foydalanuvchi shikoyati).
     *
     * @param color fon rangi (ARGB)
     * @param dark  fon TO'Qmi — shunda belgilar oq bo'ladi
     */
    void applyBar(int color, boolean dark) {
        if (content != null) content.setBackgroundColor(color);
        /* Android 15+ da bu no-op, eski qurilmalarda esa aynan shu ishlaydi */
        try { getWindow().setStatusBarColor(color); } catch (Exception ignored) {}
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
                .setAppearanceLightStatusBars(!dark);
    }
}
