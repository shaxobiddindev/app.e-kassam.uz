import { useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { shopApi } from "../api";
import { NumField } from "./ek/EkFields";
import Select from "./ek/Select";

/* ══════════════════════════════════════════════════════════════════════════
   TAROZI BARKODI FORMATI (V42)

   Do'kon tarozisi og'irlikli EAN-13 chop etadi, lekin format har ishlab
   chiqaruvchida boshqacha: CAS `2 PPPPP WWWWWW C` yoki `22 PPPP WWWWWW C`,
   Штрих-Принт esa ko'pincha og'irlik o'rniga NARX kodlaydi. Formati
   to'g'ri kelmasa tovar umuman topilmaydi va kassir har tortishda
   miqdorni qo'lda kiritadi.

   ⚠ FORMAT BIR BUTUN HOLDA SAQLANADI. Boshqa sozlamalar bittalab
   saqlanadi (`onBlur`), bu esa bo'lmaydi: qismlari o'zaro bog'liq va
   oraliq holat doim yaroqsiz bo'ladi. Faqat PLU xonasini o'zgartirib
   qo'ysa, jami uzunlik 13 dan chiqib ketadi va tarozi sozlash paytida
   ishlamay turardi. Shuning uchun — «Saqlash» tugmasi.

   ⚠ ASOSIY G'OYA: 13 TALABI KO'RINIB TURADI. Serverdan xato kutish
   o'rniga, yig'indi shu yerda jonli hisoblanadi va mos kelmasa nima
   yetishmayotgani aytiladi. Sozlash — bir martalik ish, lekin uni
   ko'r-ko'rona qilish kerak emas.
   ══════════════════════════════════════════════════════════════════════════ */

/** EAN-13 — prefiks + PLU + qiymat + nazorat raqami shunga yig'ilishi shart. */
const EAN13 = 13;

function Row({ label, hint, children }) {
  return (
    <div className="set-row">
      <div className="set-row__text">
        <div className="set-row__label">{label}</div>
        {hint && <div className="set-row__hint">{hint}</div>}
      </div>
      <div className="set-row__control">{children}</div>
    </div>
  );
}

/** `"2, 21 ,22"` → `["2","21","22"]` — server bilan bir xil qoida. */
const parsePrefixes = (raw) =>
  String(raw || "").split(",").map((p) => p.trim()).filter(Boolean)
    .filter((p, i, all) => all.indexOf(p) === i);

export default function ScaleSettings({ toast }) {
  const [prefixes, setPrefixes]   = useState("2");
  const [pluDigits, setPluDigits] = useState("5");
  const [valDigits, setValDigits] = useState("6");
  const [valType, setValType]     = useState("WEIGHT");
  const [valDec, setValDec]       = useState("3");
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    shopApi.getProfile().then((r) => {
      const d = r?.data || {};
      /* ⚠ `null` — «o'chiq» emas, STANDART. Server sozlanmagan do'konda
         `2 PPPPP WWWWWW C` ni ishlatadi, forma ham o'shani ko'rsatadi. */
      setPrefixes(d.scalePrefixes ?? "2");
      setPluDigits(String(d.scalePluDigits ?? 5));
      setValDigits(String(d.scaleValueDigits ?? 6));
      setValType(d.scaleValueType ?? "WEIGHT");
      setValDec(String(d.scaleValueDecimals ?? 3));
    }).catch(() => { /* profil o'qilmasa standart qiymatlar qoladi */ });
  }, []);

  const list = parsePrefixes(prefixes);
  const prefixLen = list.length ? list[0].length : 0;
  const mixedLength = list.some((p) => p.length !== prefixLen);
  const notDigits = list.some((p) => !/^\d+$/.test(p));
  const total = prefixLen + (Number(pluDigits) || 0) + (Number(valDigits) || 0) + 1;

  const error =
    list.length === 0 ? t("scale.err.prefix")
    : notDigits       ? t("scale.err.digits")
    : mixedLength     ? t("scale.err.mixed")
    : total !== EAN13 ? t("scale.err.total", { n: total })
    : null;

  const save = async () => {
    if (error) return;
    setSaving(true);
    try {
      await shopApi.setScale({
        prefixes: list.join(","),
        pluDigits: Number(pluDigits),
        valueDigits: Number(valDigits),
        valueType: valType,
        valueDecimals: Number(valDec),
      });
      toast?.success(t("common.saved"));
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* Standartga qaytarish — bo'sh tana yuboriladi. Bu «o'chirish» emas:
     standart format baribir ishlaydi. */
  const reset = async () => {
    setSaving(true);
    try {
      await shopApi.setScale({});
      setPrefixes("2"); setPluDigits("5"); setValDigits("6");
      setValType("WEIGHT"); setValDec("3");
      toast?.success(t("common.saved"));
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* Namuna barkod — sozlama nimani anglatishini SO'ZSIZ ko'rsatadi.
     Nazorat raqami hisoblanmaydi: bu ko'rgazma, skanerlash uchun emas. */
  const sample = error ? null
    : `${list[0]}${"P".repeat(Number(pluDigits))}${(valType === "PRICE" ? "N" : "W").repeat(Number(valDigits))}C`;

  return (
    <div className="card set-card">
      <div className="card-header">
        <span className="card-title">
          <i className="fa-solid fa-scale-balanced" aria-hidden="true" /> {t("scale.title")}
        </span>
      </div>
      <p className="set-card__hint">{t("scale.hint")}</p>

      <div className="set-list">
        <Row label={t("scale.prefixes")} hint={t("scale.prefixesHint")}>
          <input className="form-input ek-num" style={{ width: 160 }}
                 value={prefixes} onChange={(e) => setPrefixes(e.target.value)}
                 aria-label={t("scale.prefixes")} inputMode="numeric" />
        </Row>

        <Row label={t("scale.pluDigits")} hint={t("scale.pluDigitsHint")}>
          <NumField kind="int" className="form-input ek-num" style={{ width: 100 }}
                    value={pluDigits} onChange={(e) => setPluDigits(e.target.value)}
                    aria-label={t("scale.pluDigits")} />
        </Row>

        <Row label={t("scale.valueDigits")} hint={t("scale.valueDigitsHint")}>
          <NumField kind="int" className="form-input ek-num" style={{ width: 100 }}
                    value={valDigits} onChange={(e) => setValDigits(e.target.value)}
                    aria-label={t("scale.valueDigits")} />
        </Row>

        <Row label={t("scale.valueType")} hint={t("scale.valueTypeHint")}>
          <div style={{ width: 200 }}>
            <Select value={valType} onChange={setValType} block
                    ariaLabel={t("scale.valueType")}
                    options={[
                      { value: "WEIGHT", label: t("scale.type.weight") },
                      { value: "PRICE",  label: t("scale.type.price") },
                    ]} />
          </div>
        </Row>

        <Row label={t("scale.valueDecimals")} hint={t("scale.valueDecimalsHint")}>
          <NumField kind="int" className="form-input ek-num" style={{ width: 100 }}
                    value={valDec} onChange={(e) => setValDec(e.target.value)}
                    aria-label={t("scale.valueDecimals")} />
        </Row>

        {/* ⚠ 13 TALABI SHU YERDA KO'RINADI. Serverdan xato kutish o'rniga
            yig'indi jonli hisoblanadi — sozlayotgan odam nima
            yetishmayotganini darhol ko'radi. */}
        {/* ⚠ BADGE EMAS, oddiy matn. `badge-green` ichidagi kichik qalin
            yozuv qorong'i temada 3.08:1 berardi (kerak: 4.5) — a11y
            tekshiruvi aynan shuni tutdi. `--fg-success`/`--fg-danger`
            kartochka foniga qo'yilgan MATN uchun mo'ljallangan tokenlar
            va ikkala temada ham yetarli. */}
        <Row label={t("scale.total")}>
          <span style={{ color: error ? "var(--fg-danger)" : "var(--fg-success)", fontWeight: 700 }}>
            {error || <>{t("scale.ok")} · <span className="mono">{sample}</span></>}
          </span>
        </Row>

        <Row label="">
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={!!error || saving}>
              <i className="fa-solid fa-check" aria-hidden="true" /> {t("common.save")}
            </button>
            <button className="btn btn-outline" onClick={reset} disabled={saving}>
              {t("scale.reset")}
            </button>
          </div>
        </Row>
      </div>
    </div>
  );
}
