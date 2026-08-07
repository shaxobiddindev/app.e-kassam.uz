/* ══════════════════════════════════════════════════════════════════════════
   Bajik bilan tasdiqlash — bitta joyda

   ISHLASH TARTIBI:
     1. Amal odatdagidek chaqiriladi: `guard(() => saleApi.cancel(id))`
     2. Backend 428 qaytarsa (`BadgeRequiredError`), modal ochiladi
     3. Kassir bajikni skanerlaydi
     4. Bajik `setPendingBadgeToken` ga qo'yiladi va AYNI SHU amal qayta
        chaqiriladi — kassir hech narsani qayta bosmaydi

   ⚠ Nega har chaqiruvni o'rash kerak emas: `guard` faqat bajik SO'RALISHI
   mumkin bo'lgan joylarda ishlatiladi. Boshqa joylarda 428 kelmaydi, ya'ni
   `guard` bo'lmasa ham hech narsa buzilmaydi — u xato holatini chiroyli
   qiladi, himoyani emas. Himoya SERVERDA.

   ⚠⚠ Bajik hech qayerda saqlanmaydi: modal yopilishi bilan holatdan
   o'chadi, `api` moduli esa uni bitta so'rovdan keyin tozalaydi.
   ══════════════════════════════════════════════════════════════════════════ */

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import { setPendingBadgeToken } from "../api";
import { Modal } from "../components";
import { useScanner } from "../hooks/useScanner";

/** QR ichidagi matnning boshi — mahsulot shtrixidan ajratish uchun. */
const BADGE_PREFIX = "EKB-";

const BadgeCtx = createContext({ guard: (fn) => fn() });

export const useBadge = () => useContext(BadgeCtx);

export function BadgeProvider({ children, toast }) {
  const [ask, setAsk] = useState(null);   // null | { message, policy }
  const [manual, setManual] = useState("");
  const pending = useRef(null);           // qayta chaqiriladigan amal

  /**
   * Amalni bajik so'rovi bilan birga bajaradi.
   * Bajik kerak bo'lmasa — oddiy chaqiruvdan farq qilmaydi.
   */
  const guard = useCallback(async (fn) => {
    try {
      return await fn();
    } catch (err) {
      if (!err?.badgeRequired) throw err;
      // Amalni saqlab qo'yamiz va skanerlashni so'raymiz.
      return new Promise((resolve, reject) => {
        pending.current = { fn, resolve, reject };
        setAsk({ message: err.message, policy: err.policy, action: err.action });
        setManual("");
      });
    }
  }, []);

  const submit = useCallback(async (rawToken) => {
    const token = (rawToken || "").trim();
    if (!token) return;

    // Mahsulot shtrixi tasodifan tushib qolmasin — prefiks bo'yicha
    // ajratamiz va noto'g'ri kodni serverga umuman yubormaymiz.
    if (!token.startsWith(BADGE_PREFIX)) {
      toast?.error(t("badge.notABadge"));
      return;
    }

    const job = pending.current;
    setAsk(null);
    setManual("");
    if (!job) return;
    pending.current = null;

    try {
      setPendingBadgeToken(token);
      const result = await job.fn();
      job.resolve(result);
    } catch (err) {
      // Bajik noto'g'ri bo'lsa server yana 428 emas, 400/403 beradi —
      // ya'ni tsikl bo'lmaydi va kassir aniq sababni ko'radi.
      toast?.error(err.message);
      job.reject(err);
    } finally {
      setPendingBadgeToken(null);
    }
  }, [toast]);

  const cancel = useCallback(() => {
    const job = pending.current;
    pending.current = null;
    setAsk(null);
    setManual("");
    // Bekor qilish — XATO emas: chaqiruvchi `catch` da xabar ko'rsatmasligi
    // uchun maxsus belgi bilan rad etamiz.
    job?.reject(Object.assign(new Error("BADGE_CANCELLED"), { cancelled: true }));
  }, []);

  // Skaner faqat modal ochiq turganda tinglanadi — aks holda Kassa
  // ekranidagi tovar skanerlash bilan to'qnashardi.
  useScanner((code) => submit(code), { enabled: !!ask });

  return (
    <BadgeCtx.Provider value={{ guard }}>
      {children}
      {ask && (
        <Modal
          title={t("badge.title")}
          onClose={cancel}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={cancel}>
                {t("common.cancel")}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => submit(manual)} disabled={!manual.trim()}>
                <i className="fa-solid fa-check" /> {t("badge.confirm")}
              </button>
            </>
          }
        >
          <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
            <i className="fa-solid fa-qrcode" style={{ fontSize: 54, opacity: 0.45 }} aria-hidden="true" />
            <p style={{ marginTop: 14, fontSize: 15, fontWeight: 700 }}>
              {ask.policy === "MANAGER" ? t("badge.askManager") : t("badge.askSelf")}
            </p>
            <p className="text-muted" style={{ marginTop: 6, fontSize: 13 }}>
              {t("badge.hint")}
            </p>
          </div>

          {/* Zaxira kiritish: skaner ishlamay qolsa ish to'xtamasligi kerak.
              Bajik matni ko'rinmaydigan qilib yozilmaydi — u parol emas,
              lekin ekranda uzoq turmasligi uchun modal yopilishi bilan
              holatdan o'chadi. */}
          <div className="form-group">
            <label className="form-label">{t("badge.manual")}</label>
            <input
              className="form-input mono"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(manual)}
              placeholder="EKB-..."
              autoFocus
            />
          </div>
        </Modal>
      )}
    </BadgeCtx.Provider>
  );
}
