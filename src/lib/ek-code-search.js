/**
 * ══════════════════════════════════════════════════════════════════════════
 * `*` — RAQAM BO'YICHA QIDIRUV, BARCHA SAHIFADA BIR XIL
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Javondagi yorliqda tovarning QISQA RAQAMI turadi (V107). Kassada
 * `*2` terilganda shu raqam bo'yicha qidiriladi. Lekin xuddi shu
 * raqam ombor, ta'minot, ko'chirish, inventarizatsiya sahifalarida
 * ham kerak: yorliqni qo'lida ushlab turgan odam uchun tovarning
 * NOMI emas, RAQAMI birlamchi.
 *
 * ═══ ⚠ NEGA MAHALLIY EMAS, SERVER ═══
 *
 * Raqamni sahifadagi ro'yxatdan qidirish oson yo'l edi, lekin u
 * kassa bilan BOSHQA javob berardi:
 *
 *   · ESKI KOD (alias). Tovar qayta kodlanganda javondagi eski
 *     yorliq ishlashda davom etadi — bu bog'lanish faqat bazada
 *     (`product_code_aliases`). Mahalliy qidiruv uni ko'rmasdi va
 *     eski yorliq ombor sahifasida «topilmadi» berardi, kassada esa
 *     topilardi. Bir xil raqam, ikki xil javob — eng yomon turdagi
 *     nomuvofiqlik: foydalanuvchi qaysi biriga ishonishni bilmaydi.
 *   · TARTIB. Server aynan mos kodni birinchi qo'yadi, arxivdagini
 *     oxirida. Bu qoida bir joyda yozilgan va shunday qolishi kerak.
 *
 * Shuning uchun bu yerda AYNAN kassa chaqiradigan yo'l chaqiriladi.
 * Sahifa esa javobdagi `productId` lar bo'yicha o'z qatorlarini
 * filtrlaydi — ya'ni qatori tovar bo'lmagan sahifalar (ombor
 * qoldig'i, ta'minot qatori, partiya) ham xuddi shu qidiruvni
 * oladi.
 */
import { useEffect, useRef, useState } from "react";
import { productApi } from "../api";

/** So'rov raqam rejimidami? */
export const isCodeQuery = (s) => String(s ?? "").trim().startsWith("*");

/**
 * Yulduzchadan keyin faqat raqam qoladi.
 *
 * ⚠ Boshqa belgi JIMGINA tashlanadi — xato belgi uchun foydalanuvchini
 * to'xtatib turishning ma'nosi yo'q. Uzunlik chegarasi kassadagi bilan
 * bir xil (12).
 */
export const normalizeCodeQuery = (s) =>
  "*" + String(s ?? "").slice(1).replace(/\D/g, "").slice(0, 12);

/** Raqam rejimida qidirilayotgan raqamning o'zi (yulduzchasiz). */
export const codeDigits = (s) => String(s ?? "").trim().slice(1).replace(/\D/g, "");

/**
 * `*123` ni tovar `id` lariga aylantiradi.
 *
 * @returns {{active: boolean, ids: Set<number>, loading: boolean, ready: boolean}}
 *   `active` — so'rov raqam rejimida; `ready` — javob keldi (shu paytgacha
 *   sahifa «topilmadi» deb ko'rsatmasligi kerak).
 */
export function useCodeSearch(query, shopId, limit = 200) {
  const active = isCodeQuery(query);
  const digits = active ? codeDigits(query) : "";
  const [state, setState] = useState({ ids: new Set(), loading: false, ready: false });

  /* ⚠ HAR JAVOB O'Z NAVBATINI TEKSHIRADI. Tez terilganda `*1`, `*12`,
     `*123` ketma-ket ketadi va ular TARTIBSIZ qaytishi mumkin: `*1`
     kechikib kelsa, u `*123` natijasini bosib ketardi va ekranda
     so'rovga umuman aloqasi yo'q ro'yxat qolardi. */
  const seq = useRef(0);

  useEffect(() => {
    if (!active || !digits) {
      setState({ ids: new Set(), loading: false, ready: !digits });
      return;
    }
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, ready: false }));

    const timer = setTimeout(() => {
      productApi
        .search("*" + digits, 0, limit, shopId)
        .then((r) => {
          if (mine !== seq.current) return;
          const list = Array.isArray(r?.data) ? r.data : [];
          setState({ ids: new Set(list.map((p) => p.id)), loading: false, ready: true });
        })
        .catch(() => {
          if (mine !== seq.current) return;
          /* ⚠ XATO = BO'SH EMAS, «hali tayyor emas». Aks holda tarmoq
             uzilganda sahifa ishonch bilan «bunday raqam yo'q» deb
             ko'rsatardi — holbuki u shunchaki so'ray olmadi. */
          setState({ ids: new Set(), loading: false, ready: false });
        });
    }, 180);

    return () => clearTimeout(timer);
  }, [active, digits, shopId, limit]);

  return { active, ...state };
}

/**
 * Qatorlarni raqam qidiruvi bo'yicha filtrlaydi.
 *
 * @param rows    sahifaning qatorlari
 * @param getId   qatordan tovar `id` sini oladi
 * @param code    {@link useCodeSearch} natijasi
 */
export function filterByCode(rows, getId, code) {
  if (!code.active) return rows;
  if (!code.ready) return [];
  return (rows || []).filter((r) => code.ids.has(getId(r)));
}
