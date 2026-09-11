import { useEffect } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   TOVAR KATAKCHASI — RASM NISBATI VA QATOR BALANDLIGI

   ⚠ NEGA BU JS DA, CSS DA EMAS. Uch xil sof CSS yechimi sinaldi va
   uchalasi ham bir xil sababdan ishlamadi: grid QATORI katakchaning
   haqiqiy balandligini o'lchay olmaydi.

     · `aspect-ratio` — rasm balandligi KENGLIKDAN keyin aniqlanadi,
       qator o'lchami esa undan oldin hisoblanadi;
     · foizli `padding-top` — ichki o'lcham hisobida foizli padding
       nolga tenglashtiriladi;
     · blok joylashuviga o'tkazish ham yordam bermadi.

   Natijada qator 129px deb hisoblanar, kontent esa 185px bo'lib
   tashqariga chiqib ketardi: nom ham, narx ham pastdagi qator ostida
   qolardi.

   Qat'iy piksel balandlik buni yopgan edi, lekin nisbat saqlanmasdi —
   ekran kengaysa rasm faqat enига cho'zilardi. Foydalanuvchi esa aynan
   NISBAT saqlanishini so'radi.

   Shuning uchun o'lchov shu yerda: ustun kengligi o'qiladi, rasm
   balandligi undan NISBAT bo'yicha hisoblanadi va ikkalasi ham CSS
   o'zgaruvchisiga yoziladi. Ustun kengaysa — rasm ham eni bilan birga
   bo'yiga o'sadi.

   ⚠ MATN BALANDLIGI HAM O'LCHANADI, taxmin qilinmaydi: narx va miqdor
   tor katakchada ikki qatorga tushadi (`@container`) va uni sanab
   qo'yish keyingi o'zgarishda jimgina eskirardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Rasm qutisining nisbati: balandlik = kenglik × shu son (3:4). */
const RATIO = 0.75;

/** Rasm bilan matn orasidagi masofa — `.product-card--tile` dagi bilan bir xil. */
const THUMB_GAP = 8;

/**
 * @param gridRef  `.product-grid` elementiga havola
 * @param active   `false` bo'lsa (zich ko'rinish) o'lchov o'chiriladi
 * @param deps     qayta o'lchashni talab qiladigan qiymatlar
 */
export function useTileMetrics(gridRef, active, deps = []) {
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    if (!active) {
      // Zich ko'rinishda qator balandligi kontentdan kelib chiqadi.
      grid.style.removeProperty("--tile-thumb-h");
      grid.style.removeProperty("--tile-row-h");
      return undefined;
    }

    let frame = 0;

    const measure = () => {
      const card = grid.querySelector(".product-card--tile");
      if (!card) return;

      /* Ustun kengligi CSS dan o'qiladi: `repeat(auto-fill, minmax(...))`
         allaqachon piksellarga yechilgan bo'ladi. Barcha ustun bir xil,
         shuning uchun birinchisi yetarli. */
      const cols = getComputedStyle(grid).gridTemplateColumns.split(" ");
      const colW = parseFloat(cols[0]);
      if (!Number.isFinite(colW) || colW <= 0) return;

      const cs = getComputedStyle(card);
      const px = (v) => parseFloat(v) || 0;
      const padX = px(cs.paddingLeft) + px(cs.paddingRight);
      const padY = px(cs.paddingTop) + px(cs.paddingBottom);
      const bordX = px(cs.borderLeftWidth) + px(cs.borderRightWidth);
      const bordY = px(cs.borderTopWidth) + px(cs.borderBottomWidth);

      const thumbH = Math.round((colW - padX - bordX) * RATIO);

      /* ⚠ Matn balandligi HAQIQIY elementdan olinadi. Uni sanab qo'yish
         mumkin edi-yu, `@container` qoidasi narx va miqdorni ikki
         qatorga tushirganda son jimgina eskirardi. */
      const body = card.querySelector(".product-body");
      const bodyH = body ? Math.ceil(body.getBoundingClientRect().height) : 0;
      if (!bodyH) return;

      grid.style.setProperty("--tile-thumb-h", `${thumbH}px`);
      grid.style.setProperty("--tile-row-h", `${thumbH + THUMB_GAP + bodyH + padY + bordY}px`);
    };

    /* Ikki qadamda: birinchi o'lchovdan keyin `@container` qoidasi
       o'zgargan bo'lishi mumkin (katakcha kengligi yangilangan), ya'ni
       matn balandligi ham boshqacha bo'ladi. Ikkinchi kadr uni tutadi. */
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        measure();
        frame = requestAnimationFrame(measure);
      });
    };

    schedule();

    /* ⚠ Kuzatiladigan element — TO'RNING O'ZI, katakcha emas. To'r
       o'lchami qator balandligiga bog'liq emas (u `flex: 1` bilan
       ustunga tayanadi), demak cheksiz halqa hosil bo'lmaydi:
       o'zgaruvchini yozish kuzatuvchini qayta uyg'otmaydi. */
    const ro = new ResizeObserver(schedule);
    ro.observe(grid);
    return () => { ro.disconnect(); cancelAnimationFrame(frame); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridRef, active, ...deps]);
}
