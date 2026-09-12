import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_SIZE, mergePage, readPage, shouldLoadMore } from "../lib/ek-page";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * CHEKSIZ RO'YXAT — REACT QATLAMI
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Hisob `ek-page.js` da (u node'dan sinaladi), bu yerda faqat React
 * holati va so'rovlar tartibi.
 *
 * ⚠ SO'ROV RAQAMI (`runRef`) — ENG NOZIK JOY. Foydalanuvchi qidiruvni
 * o'zgartirsa yoki filtrni almashtirsa, ESKI so'rov hali yo'lda bo'ladi.
 * U kechikib kelib YANGI ro'yxat ustiga qo'shilsa — ekranda qidiruvga
 * mos kelmaydigan qatorlar paydo bo'ladi va foydalanuvchi buni nuqson
 * deb ham tushunmaydi, «qidiruv ishlamaydi» deb o'ylaydi.
 *
 * Shuning uchun har `reset` da hisoblagich oshadi va eski so'rovning
 * javobi TASHLANADI.
 *
 * ⚠ `fetcher` HAR RENDERDA YANGI BO'LSA — cheksiz aylanish. Chaqiruvchi
 * uni `useCallback` bilan o'rashi SHART; shuning uchun u `deps` ga
 * kiritilgan va bu yerda hech qanday "aqlli" himoya yo'q: jimgina
 * ishlab turadigan, lekin har sekundda so'rov yuboradigan sahifadan
 * ko'ra darhol ko'rinadigan aylanish yaxshi.
 *
 * @param fetcher (page, size) => Promise<{data}>  — API chaqiruvi
 * @param opts    {size, key, enabled}
 */
export function useInfinite(fetcher, { size = PAGE_SIZE, key = "id", enabled = true } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasNext, setHasNext] = useState(true);
  const [total, setTotal] = useState(null);

  /* Keyingi so'raladigan sahifa — renderga ta'sir qilmaydi, shuning
     uchun `state` emas: uni `state` qilish har sahifada ortiqcha
     render berardi. */
  const pageRef = useRef(0);
  const runRef = useRef(0);
  /* ⚠ `loading` ni `ref` da HAM saqlaymiz: `loadMore` ni
     `IntersectionObserver` chaqiradi va u eski closure'ni ko'rishi
     mumkin — o'shanda ikkita bir xil so'rov ketardi. */
  const busyRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (!enabled) return;
    if (busyRef.current) return;
    if (!shouldLoadMore({ hasNext, loading: busyRef.current, error })) return;

    const run = runRef.current;
    const page = pageRef.current;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher(page, size);
      /* ⚠ ESKI SO'ROV — javob tashlanadi. */
      if (run !== runRef.current) return;

      const p = readPage(res?.data);
      setRows((have) => mergePage(have, p.rows, key));
      setHasNext(p.hasNext);
      if (p.total !== null && p.total !== undefined) setTotal(p.total);
      pageRef.current = page + 1;
    } catch (e) {
      if (run !== runRef.current) return;
      /* ⚠ XATO SAQLANADI va avtomatik takrorlanmaydi — `shouldLoadMore`
         buni to'sadi. Foydalanuvchi «Qayta urinish» ni o'zi bosadi. */
      setError(e?.message || String(e));
    } finally {
      if (run === runRef.current) {
        busyRef.current = false;
        setLoading(false);
      }
    }
  }, [fetcher, size, key, enabled, hasNext, error]);

  /** Boshidan boshlash — qidiruv yoki filtr o'zgarganda. */
  const reset = useCallback(() => {
    runRef.current += 1;
    pageRef.current = 0;
    busyRef.current = false;
    setRows([]);
    setHasNext(true);
    setTotal(null);
    setError(null);
    setLoading(false);
  }, []);

  /** Xatodan keyin qo'lda takrorlash. */
  const retry = useCallback(() => {
    setError(null);
  }, []);

  /* ⚠ `fetcher` O'ZGARSA — RO'YXAT BOSHIDAN. Qidiruv so'zi yoki filtr
     o'zgarganda chaqiruvchi yangi `fetcher` beradi va bu aynan
     «boshqa ro'yxat» degani. Buni chaqiruvchiga qoldirish har
     sahifada takrorlanadigan va bir joyda unutiladigan qadam
     bo'lardi. */
  useEffect(() => {
    reset();
  }, [fetcher, reset]);

  /* Birinchi sahifa — ro'yxat bo'sh va yana bor bo'lsa. */
  useEffect(() => {
    if (enabled && !rows.length && hasNext && !busyRef.current && !error) {
      loadMore();
    }
  }, [enabled, rows.length, hasNext, error, loadMore]);

  return { rows, loading, error, hasNext, total, loadMore, reset, retry };
}

export default useInfinite;
