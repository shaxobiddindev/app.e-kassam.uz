import { useEffect, useState } from "react";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * KECHIKTIRILGAN QIYMAT — HAR HARFGA SO'ROV KETMASIN
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ NEGA KERAK BO'LDI. Qidiruv SERVERGA ko'chgach, `search` holati
 * har harfda o'zgaradi va u `useInfinite` ning `fetcher` iga kiradi.
 * Kechiktirilmasa «shokolad» so'zi 8 ta so'rov yuborardi — ularning
 * 7 tasi darhol keraksiz bo'lib qoladi.
 *
 * ⚠ SEKINLASHTIRISH EMAS, TEZLASHTIRISH: 7 keraksiz so'rov navbatda
 * turib, KERAKLISINI ham kechiktiradi. Bundan tashqari ularning
 * javobi tartibsiz kelib, ekranga eski natijani chizishi ham mumkin
 * (`useInfinite` dagi `runRef` buni to'sadi, lekin so'rovni umuman
 * yubormaslik arzonroq).
 *
 * ⚠ 300 ms — TERISH TEZLIGIDAN OLINGAN: odam harflar orasida odatda
 * 100–200 ms tanaffus qiladi, so'z oxirida esa uzunroq. 150 ms
 * qilinsa so'z o'rtasida ham so'rov ketardi; 600 ms esa ekran
 * «kechikayotgandek» seziladi.
 *
 * ⚠ BO'SH QIYMAT DARHOL O'TADI: qidiruvni tozalash (× tugmasi yoki
 * Esc) darhol ishlashi kerak — foydalanuvchi natijani KUTMAYDI,
 * u ro'yxatni qaytarishni xohlaydi.
 */
export function useDebounced(value, ms = 300) {
  const [slow, setSlow] = useState(value);

  useEffect(() => {
    if (value === "" || value == null) {
      setSlow(value);
      return;
    }
    const timer = setTimeout(() => setSlow(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return slow;
}

export default useDebounced;
