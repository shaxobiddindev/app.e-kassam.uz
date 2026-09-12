import { useEffect, useRef } from "react";
import { t } from "../../lib/ek-i18n";
import { Spinner } from "./Loading";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * SCROLL BILAN YUKLANADIGAN RO'YXATNING OXIRI
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ro'yxatning O'ZINI chizmaydi — faqat oxiriga qo'yiladigan «sezgir
 * chiziq» va holat. Ro'yxat har sahifada boshqacha (jadval, kartochka,
 * plitka) va uni bu komponentga yuklash har birini bir qolipga
 * majburlardi.
 *
 * ⚠ TUGMA HAM BOR, FAQAT SCROLL EMAS — VA U MAJBURIY:
 *
 *   · klaviatura bilan yuruvchi foydalanuvchi scroll qilmaydi, Tab
 *     bosadi — sezgir chiziq unga hech qachon ishga tushmaydi;
 *   · ekran o'quvchi ro'yxat «tugadi» deb o'ylaydi, chunki DOM'da
 *     boshqa narsa yo'q;
 *   · `IntersectionObserver` ba'zi holatda ishga tushmaydi:
 *     ro'yxat `overflow: hidden` ichida bo'lsa, yoki oyna juda
 *     baland bo'lib sezgir chiziq hech qachon ko'rinmasa.
 *
 * Ya'ni tugma zaxira emas, ASOSIY yo'l; scroll esa uning ustidagi
 * qulaylik.
 *
 * ⚠ KO'RINMAYDIGAN «YUKLANMOQDA» BO'LMAYDI: har holatda ekranda
 * matn turadi. Bo'sh joy foydalanuvchi uchun «tugadi» degani va u
 * qolgan tovarlarni ko'rmasdan ketadi.
 */
export default function InfiniteList({
  loading, error, hasNext, total, count,
  onMore, onRetry,
  /** Scroll bilan avtomatik yuklash — sinovda o'chirib qo'yiladi. */
  auto = true,
}) {
  const ref = useRef(null);
  /* ⚠ `onMore` ni `ref` da saqlaymiz: u har renderda yangi bo'ladi va
     kuzatuvchini qayta-qayta ulash/uzish bergan bo'lardi. */
  const moreRef = useRef(onMore);
  moreRef.current = onMore;

  useEffect(() => {
    if (!auto || !hasNext || error) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") return undefined;

    /* ⚠ `rootMargin` — ro'yxat oxiriga YETMASDAN yuklanadi: aks holda
        foydalanuvchi pastga tegib, to'xtab, kutib turardi. 400 px
        taxminan bitta ekran balandligining yarmi. */
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) moreRef.current?.();
    }, { rootMargin: "400px" });

    io.observe(el);
    return () => io.disconnect();
  }, [auto, hasNext, error]);

  /* ── Xato ─────────────────────────────────────────────────────────
     ⚠ Xato ro'yxatni O'CHIRMAYDI: allaqachon yuklangan qatorlar
     joyida qoladi. Tarmoq uzilgani uchun ko'rilgan ma'lumotni
     yo'qotish eng keraksiz jazо bo'lardi. */
  if (error) {
    return (
      <div className="inf inf--error" role="alert">
        <span>{t("inf.failed")}</span>
        <button type="button" className="btn btn-outline btn-sm"
                onClick={() => { onRetry?.(); onMore?.(); }}>
          <i className="fa-solid fa-rotate-right" aria-hidden="true" />
          {t("common.retry")}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="inf" aria-live="polite">
        <Spinner small />
        <span>{t("inf.loading")}</span>
      </div>
    );
  }

  /* ── Tugadi ───────────────────────────────────────────────────────
     ⚠ «Hammasi ko'rsatildi» YOZILADI: bo'sh joy «yana bor, lekin
     yuklanmadi» degan shubha qoldiradi. Soni ham aytiladi — do'konchi
     «shuncha tovarim bormidi?» degan savolga javob oladi. */
  if (!hasNext) {
    if (!count) return null;
    return (
      <div className="inf inf--done">
        {total ? t("inf.allOf", { n: count, total }) : t("inf.all", { n: count })}
      </div>
    );
  }

  return (
    <div className="inf">
      {/* Sezgir chiziq — scroll shunga yetganda yuklanadi. */}
      <div ref={ref} className="inf__sentinel" aria-hidden="true" />
      <button type="button" className="btn btn-outline btn-sm" onClick={onMore}>
        <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        {total ? t("inf.moreOf", { n: count, total }) : t("inf.more")}
      </button>
    </div>
  );
}
