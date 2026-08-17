package uz.ekassam.app;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.telegram.login.TelegramLogin;

import java.util.Arrays;

/**
 * TELEGRAM «NATIVE LOGIN» (V41) — brauzersiz kirish.
 *
 * Oqim: ilova `startLogin` ni chaqiradi → TELEGRAM ILOVASI ochiladi →
 * odam tasdiqlaydi → Telegram `https://app<id>-login.tg.dev/tglogin`
 * havolasiga qaytaradi va Android uni App Link sifatida SHU ilovaga
 * beradi (`MainActivity.onNewIntent`) → bu yerda imzolangan `id_token`
 * olinadi va JS tomonga uzatiladi.
 *
 * ⚠ NEGA BU FAYL ALOHIDA PAPKADA (`src/telegram/java`): SDK faqat GitHub
 * Packages'da va tokensiz olinmaydi. Token yo'q bo'lsa bu fayl umuman
 * kompilyatsiya qilinmaydi va ilova avvalgidek quriladi — bitta ixtiyoriy
 * imkoniyat butun APK ni yiqitmasligi kerak.
 *
 * ⚠ Token BU YERDA ISHONCHLI DEB QABUL QILINMAYDI: u JS ga uzatiladi,
 * JS esa serverga yuboradi va imzo/`aud`/`exp` O'SHA YERDA tekshiriladi
 * (`TelegramIdTokenService`). Telefondagi tekshiruvning qiymati yo'q —
 * ilovani o'zgartirgan odam uni chetlab o'tadi.
 */
@CapacitorPlugin(name = "TelegramLogin")
public class TelegramLoginPlugin extends Plugin {

    /** Bot id — `aud` shu bo'ladi (BotFather bergan client id). */
    private static final String CLIENT_ID = "8341953645";

    /** BotFather «Native App» ro'yxatidan: `app<nativeAppId>-login.tg.dev`. */
    private static final String REDIRECT_URI = "https://app3938439594-login.tg.dev/tglogin";

    /** ⚠ `phone` SHART: hisobning kaliti — telefon (do'kondagi karta shu
        bo'yicha bog'lanadi). Usiz kirish faqat mavjud hisobni taniydi. */
    private static final String[] SCOPES = { "openid", "profile", "phone" };

    /** Javob kelguncha kutayotgan chaqiruv (Telegram alohida ilova). */
    private PluginCall pending;

    @Override
    public void load() {
        TelegramLogin.INSTANCE.init(CLIENT_ID, REDIRECT_URI, Arrays.asList(SCOPES));
    }

    @PluginMethod
    public void login(PluginCall call) {
        /* ⚠ Chaqiruv SAQLANADI: javob boshqa ilovadan, boshqa `Intent`
           bilan qaytadi — oddiy `resolve` bu yerda ishlamaydi. */
        call.setKeepAlive(true);
        pending = call;
        getActivity().runOnUiThread(() -> TelegramLogin.INSTANCE.startLogin(getActivity()));
    }

    /**
     * `MainActivity` qaytgan havolani shu yerga uzatadi.
     *
     * @return havola BIZNIKI bo'lsa `true` (boshqa deep link'lar o'z
     *         yo'lida davom etsin)
     */
    public boolean handleIntent(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (uri == null || uri.getHost() == null
                || !uri.getHost().equals(Uri.parse(REDIRECT_URI).getHost())) {
            return false;
        }

        TelegramLogin.INSTANCE.handleLoginResponse(uri,
                data -> {
                    if (pending != null) {
                        JSObject res = new JSObject();
                        res.put("idToken", data.getIdToken());
                        pending.resolve(res);
                        pending.release(getBridge());
                        pending = null;
                    }
                    return null;
                },
                error -> {
                    if (pending != null) {
                        pending.reject(error.getMessage());
                        pending.release(getBridge());
                        pending = null;
                    }
                    return null;
                });
        return true;
    }
}
