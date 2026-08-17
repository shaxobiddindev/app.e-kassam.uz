package uz.ekassam.app;

import android.app.Activity;
import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ReceiptPrint — elektron chekni PDF qilib saqlash.
 *
 * ⚠ NEGA PLAGIN KERAK: `window.print()` Android WebView'da JIM — hech
 * qanday oyna ochilmaydi va hech qanday xato ham bermaydi. Ya'ni brauzerda
 * ishlaydigan tugma ilovada shunchaki «bosilmaydigan» bo'lib qolardi.
 *
 * Bu yerda tizimning o'z chop etish oynasi ochiladi. Telefonda printer
 * ulanmagan bo'lsa uning standart manzili — «PDF sifatida saqlash», ya'ni
 * foydalanuvchi aynan kutgan natija (fayl nomi = `name`).
 *
 * ⚠ WebView SAHIFA ICHIDAGISI EMAS, YANGISI: chop etish adapteri o'zi
 * biriktirilgan WebView'ning HOZIRGI holatini bosadi — ilovaning butun
 * ekranini (pastki navigatsiya, tugmalar) qog'ozga chiqarardi.
 *
 * ⚠ WebView'ga MAYDONDA havola saqlanadi. Chop etish ishi asinxron: metod
 * tugab, mahalliy o'zgaruvchi yo'qolsa, GC WebView'ni ish o'rtasida yig'ib
 * ketishi va chop etish jimgina to'xtashi mumkin (Android'ning ma'lum
 * tuzog'i). `onWriteFinished` da bo'shatiladi.
 *
 * JS tomoni: `src/lib/ek-receipt-pdf.js`.
 */
@CapacitorPlugin(name = "ReceiptPrint")
public class ReceiptPrintPlugin extends Plugin {

    /** 58 mm chek tasmasi — mils (1 mil = 1/1000 dyuym). 58 mm ≈ 2283. */
    private static final PrintAttributes.MediaSize TAPE_58 =
            new PrintAttributes.MediaSize("EK_TAPE_58", "Chek 58 mm", 2283, 11693);

    /** Ish tugaguncha yashaydigan WebView (yuqoridagi GC izohiga qarang). */
    private WebView printView;

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html");
        final String name = call.getString("name", "Chek");
        if (html == null || html.isEmpty()) {
            call.reject("html bo'sh");
            return;
        }

        final Activity act = getActivity();
        if (act == null) {
            call.reject("Oyna topilmadi");
            return;
        }

        act.runOnUiThread(() -> {
            try {
                WebView wv = new WebView(act);
                wv.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        try {
                            PrintManager pm = (PrintManager) act.getSystemService(Context.PRINT_SERVICE);
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(name);
                            PrintAttributes attrs = new PrintAttributes.Builder()
                                    .setMediaSize(TAPE_58)
                                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                    .build();
                            /* ⚠ Tasma o'lchamini tizim qo'llab-quvvatlamasa, u
                               o'zi A4 ga almashtiradi — chek varaqning tepasida
                               chiqadi. Bu ko'rinish masalasi, xato emas:
                               foydalanuvchi o'lchamni o'sha oynada tanlay oladi. */
                            pm.print(name, adapter, attrs);
                            call.resolve();
                        } catch (Exception e) {
                            call.reject("Chop etish oynasi ochilmadi", e);
                        } finally {
                            printView = null;
                        }
                    }
                });
                printView = wv;
                /* baseUrl = null: hujjat o'zi yetarli (uslub ichida, rasmlar
                   SVG). Tashqi manba yuklanmaydi — internetsiz ham ishlaydi. */
                wv.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                printView = null;
                call.reject("Chekni tayyorlab bo'lmadi", e);
            }
        });
    }
}
