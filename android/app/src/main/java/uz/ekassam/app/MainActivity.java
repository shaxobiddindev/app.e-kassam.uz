package uz.ekassam.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /* ⚠ TEPA YOPISHISH TUZATISHI (2-qatlam, 2026-08-15).
     *
     * targetSdk 36 → Android 15/16 webview'ni status-bar OSTIGA chizadi
     * (majburiy edge-to-edge). capacitor.config.json'dagi
     * `adjustMarginsForEdgeToEdge` Capacitor 8.5 da mavjud EMAS edi —
     * hech narsa kompensatsiya qilmagan.
     *
     * Qatlamlar:
     *   1. styles.xml: `windowOptOutEdgeToEdgeEnforcement` — Android 15 da
     *      ishlaydi, dekor insetlarni O'ZI yutadi (bu yerga 0 keladi).
     *   2. Shu listener — Android 16+ da (opt-out e'tiborsiz) insetlarni
     *      qo'lda padding qilib beradi. Ikkalasi birga IKKI MARTA surmaydi:
     *      qaysi biri ishlasa, ikkinchisiga nol tegadi.
     *
     * IME (klaviatura) pastki insetga qo'shilgan: Android 16 da adjustResize
     * o'rniga aynan shu mexanizm ishlaydi — usiz klaviatura maydonlarni
     * to'sib qo'yardi.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Status-bar belgilari doim OQ — fon brend ko'ki (#1663D8).
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
                .setAppearanceLightStatusBars(false);

        final View content = findViewById(android.R.id.content);
        // Padding ochib beradigan yuqori/pastki chiziq orti — brend ko'ki:
        // shaffof status-bar ostida oq belgilarga kontrast fon bo'ladi.
        content.setBackgroundColor(Color.parseColor("#1663D8"));
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
