import { useCallback, useEffect, useState } from "react";
import { labelApi } from "../api";
import { asArray } from "../lib/ek-array";

/* ══════════════════════════════════════════════════════════════════════════
   Do'konning yorliq chiqishi — har tur uchun qog'oz va printer (2026-10-03)

   ⚠ NEGA HOOK. Sozlash sehrgari bularni saqlardi, lekin chop etish
   navbati ularni HECH QACHON o'qimasdi va har doim A4 varaq yasardi.
   Navbat ikki joyda yashaydi (Yorliqlar bo'limi va tovarlar sahifasidagi
   tez chop etish oynasi) — ikkalasi ham bir xil javob olishi uchun
   o'qish bitta joyda.

   ⚠ JIMGINA YIQILADI: sozlama o'qilmasa (oflayn, eski server) navbat
   baribir ishlaydi — dizayn o'lchamidagi drayver yo'li bilan, A4 bilan
   emas (`outputMode` izohi).
   ══════════════════════════════════════════════════════════════════════════ */
export function useLabelOutput() {
  const [outputs, setOutputs] = useState({});
  /* ⚠ «YUKLANDI» ALOHIDA: bo'sh `{}` ikki ma'noli — hali so'ralmagan yoki
     do'kon sozlamagan. Oddiy ekran ikkinchisida sozlashni ochadi va
     birinchisida buni qilsa, har kirishda sozlash bir lahza miltillardi. */
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [oRes, mRes, pRes] = await Promise.all([
        labelApi.outputList(), labelApi.mediaList(), labelApi.printerList(),
      ]);
      const medias = asArray(mRes.data), printers = asArray(pRes.data);
      const next = {};
      for (const o of asArray(oRes.data)) {
        next[o.kind] = {
          media: medias.find((m) => m.id === o.mediaProfileId) || null,
          printer: printers.find((p) => p.id === o.printerProfileId) || null,
        };
      }
      setOutputs(next);
    } catch { setOutputs({}); }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /* Sehrgar saqlaganda ochiq navbat darhol yangi qog'ozni ko'rsin. */
  useEffect(() => {
    const on = () => reload();
    window.addEventListener("ek:label-output", on);
    return () => window.removeEventListener("ek:label-output", on);
  }, [reload]);

  return { outputs, reload, loaded };
}

/** Sehrgar saqlagandan keyin chaqiriladi. */
export const announceLabelOutput = () => {
  try { window.dispatchEvent(new Event("ek:label-output")); } catch { /* sinov muhiti */ }
};
