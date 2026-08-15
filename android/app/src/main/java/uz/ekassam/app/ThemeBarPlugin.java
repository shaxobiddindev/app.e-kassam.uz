package uz.ekassam.app;

import android.content.Context;
import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ThemeBar — status-bar zonasini ILOVA TEMASIGA bo'yaydi.
 *
 * Nega o'z plagini kerak (@capacitor/status-bar yetmaydi):
 * uning `setBackgroundColor` metodi Android 16 da JIM O'TADI (no-op), chunki
 * u eskirgan `Window.setStatusBarColor` ga tayanadi. Android 16 da esa
 * status-bar shaffof va uning ortida MainActivity'ning content view foni
 * ko'rinadi — aynan o'sha "ko'k ajratuvchi chiziq" shundan chiqqan edi.
 * Bu yerda content view foni TO'G'RIDAN-TO'G'RI o'zgartiriladi, ya'ni
 * hamma Android versiyasida ishlaydi.
 *
 * JS tomoni: `src/lib/ek-statusbar.js` (tema o'zgarishini kuzatadi).
 */
@CapacitorPlugin(name = "ThemeBar")
public class ThemeBarPlugin extends Plugin {

    @PluginMethod
    public void apply(PluginCall call) {
        final String hex = call.getString("color", "#FFFFFF");
        final Boolean darkArg = call.getBoolean("dark", Boolean.FALSE);
        final boolean dark = Boolean.TRUE.equals(darkArg);

        final MainActivity act = (MainActivity) getActivity();
        if (act == null) { call.resolve(); return; }

        act.runOnUiThread(() -> {
            try {
                act.applyBar(Color.parseColor(hex), dark);
                /* Keyingi ochilishda BIRINCHI KADR ham to'g'ri bo'lsin:
                   ilova ko'tarilganda JS hali yuklanmagan bo'ladi va
                   usiz bir lahza noto'g'ri rang yonib ketardi. */
                act.getSharedPreferences(MainActivity.PREF, Context.MODE_PRIVATE)
                   .edit()
                   .putString(MainActivity.KEY_BAR, hex)
                   .putBoolean(MainActivity.KEY_DARK, dark)
                   .apply();
            } catch (Exception ignored) {
                /* Noto'g'ri hex — rang o'zgarmaydi, ilova ishlayveradi */
            }
        });
        call.resolve();
    }
}
