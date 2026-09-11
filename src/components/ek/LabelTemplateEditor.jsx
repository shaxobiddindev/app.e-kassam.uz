import { useMemo, useRef, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { Field, FormGroup } from "../ui";
import Select from "./Select";
import { Spinner } from "./Loading";
import LabelPreview from "./LabelPreview";
import { blocking, validateTemplate } from "../../lib/ek-label-validate";
import {
  diffPaths, fieldPath, formOf, mediaIssues, resetAll, resetPath, toTemplate,
} from "../../lib/ek-label-diff";

/* ══════════════════════════════════════════════════════════════════════════
   SHABLON TAHRIRLAGICH (F4 + G6)

   ⚠ XATO DARHOL KO'RINADI — maydonning YONIDA, `submit` da emas.
   Saqlashda ro'yxat bilan chiqadigan xatolar do'konchini formaning
   boshiga qaytarib, qaysi maydon aybdor ekanini izlashga majbur
   qiladi.

   ⚠ BLOKLANGAN TUGMA SABABSIZ QOLMAYDI.

   ⚠ XATO va OGOHLANTIRISH AJRATILGAN: xato saqlashni to'sadi,
   ogohlantirish esa to'smaydi.

   ── G6 ─────────────────────────────────────────────────────────────
   ⚠ HAR MAYDON O'ZI HAQIDA JAVOB BERADI: «shablondagidek» yoki
   «siz o'zgartirgansiz» — belgi VA matn bilan, faqat rang bilan
   emas. Yonida qaytarish tugmasi.

   ⚠ VARAQ (A4) BO'LIMI OLIB TASHLANDI. O'lchandi: `spec.sheet` ni
   butun tizimda HECH KIM o'qimasdi — chop etish `sheetFor` bilan
   qog'oz va yorliq o'lchamidan hisoblanadi, server esa `sheet`
   haqida umuman bilmaydi. Ya'ni 7 ta o'lik tugma turardi: do'konchi
   ustun sonini o'zgartirardi va HECH NARSA o'zgarmasdi. Bundan
   yomoni — tahrirlagich shablonda YO'Q `sheet` ni o'zi qo'shib
   qo'yardi (A4 210×297, 2×7) va hech narsaga tegmasdan «Saqlash»
   bosilsa ham 15/15 shablon A4 varaq shabloniga aylanardi.
   A4 yo'qolmadi — u chop etish oynasida, qog'oz tanlovida qoldi.

   ⚠ MEDIA ALMASHSA — OGOHLANTIRADI, TUZATMAYDI.
   ══════════════════════════════════════════════════════════════════════════ */

const ALIGNS   = ["left", "center", "right"];
const OVERFLOW = ["shrink", "clip", "none"];
const BOX      = ["x", "y", "w", "h"];

export default function LabelTemplateEditor({ template, product, media, mediaList, saving, onSave, onCancel }) {
  /* ⚠ ASL NUSXA — `useRef`, `useState` emas: u hech qachon
     o'zgarmaydi va o'zgarganda qayta chizish ham shart emas.
     «Farq qiladi» belgisi aynan shunga qarab qo'yiladi. */
  const base = useRef(formOf(template)).current;

  const [form, setForm] = useState(() => formOf(template));
  const [makeDefault, setMakeDefault] = useState(false);

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const setField = (i, k, v) => setForm((p) => {
    const fields = p.spec.fields.map((f, j) => (j === i ? { ...f, [k]: v } : f));
    return { ...p, spec: { ...p.spec, fields } };
  });
  const undo = (path) => setForm((p) => resetPath(p, base, path));

  const asTemplate = useMemo(() => ({
    kind: form.kind, widthMm: form.widthMm, heightMm: form.heightMm,
    dpi: form.dpi, thermal: form.thermal, spec: form.spec,
  }), [form]);

  /* ⚠ HAR O'ZGARISHDA qayta hisoblanadi — `submit` ni kutmaydi. */
  const issues = useMemo(() => {
    const list = validateTemplate(asTemplate);
    if (!String(form.name).trim()) list.push({ level: "error", field: "name", text: t("lbl.needName") });
    return list;
  }, [asTemplate, form.name]);

  /* ⚠ UZLUKSIZ rulonda balandlik yo'q — u yerdan tayyor o'lcham
     chiqmaydi, chunki balandlikni do'konchi o'zi yozadi. */
  const sizes = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const m of mediaList || []) {
      const w = Number(m.labelWidthMm), h = Number(m.labelHeightMm);
      if (!(w > 0 && h > 0)) continue;
      const key = `${w}x${h}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, w, h });
    }
    return out;
  }, [mediaList]);

  const changed  = useMemo(() => new Set(diffPaths(form, base)), [form, base]);
  const misfit   = useMemo(() => mediaIssues(form, media), [form, media]);
  const errors   = blocking(issues);
  const warnings = issues.filter((x) => x.level === "warning");
  const forField = (name) => issues.filter((x) => x.field === name);

  const submit = () => {
    if (errors.length) return;
    onSave({ ...toTemplate({ ...form, name: form.name.trim() }), makeDefault });
  };

  /* Bitta maydonning «farq qiladi» belgisi + qaytarish tugmasi. */
  const Mark = ({ path }) => (changed.has(path) ? (
    <span className="lbl-diff">
      <i className="fa-solid fa-pen" aria-hidden="true" />
      <span>{t("lbl.diffMark")}</span>
      <button type="button" className="lbl-diff__undo"
              title={t("lbl.resetOne")} aria-label={t("lbl.resetOne")}
              onClick={() => undo(path)}>
        <i className="fa-solid fa-rotate-left" aria-hidden="true" />
      </button>
    </span>
  ) : null);

  return (
    <div className="lbl-editor">
      <div className="lbl-editor__form">
        {/* ⚠ NECHTA MAYDON O'ZGARGANI YUQORIDA — pastdagi belgilarni
            qidirib chiqmasin. */}
        {changed.size > 0 && (
          <div className="lbl-diffbar">
            <span>
              <i className="fa-solid fa-pen" aria-hidden="true" />
              {t("lbl.diffCount", { n: changed.size })}
            </span>
            <button type="button" className="btn btn-outline btn-xs"
                    onClick={() => setForm(resetAll(base))}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true" />
              {t("lbl.resetAll")}
            </button>
          </div>
        )}

        {/* ⚠ MEDIA ALMASHGANDA — nima sig'maydi. Tuzatilmaydi. */}
        {misfit.length > 0 && (
          <ul className="lbl-warn lbl-warn--soft">
            <li className="fw-700">{t("lbl.mediaMisfit", { media: media?.name || "" })}</li>
            {misfit.map((m, i) => (
              <li key={i}>
                <i className="fa-solid fa-circle-info" aria-hidden="true" />
                {/* ⚠ MAYDON NOMI TARJIMA QILINMAYDI: u shablon
                    ichidagi kalit (`price`, `name`) va tahrirlagichda
                    ham aynan shu ko'rinishda turadi. Tarjima qilinsa,
                    ogohlantirishdagi nom bilan formadagi nom mos
                    kelmay qolardi. */}
                <span>{t(`lbl.misfit.${m.code}`, {
                  field: m.field || "", need: m.need, have: m.have,
                })}</span>
              </li>
            ))}
            <li className="form-hint">{t("lbl.misfitNoAuto")}</li>
          </ul>
        )}

        <FormGroup label={`${t("common.name")} *`}>
          <Field className="form-input" value={form.name}
                 onChange={(e) => set("name")(e.target.value)} autoFocus />
          <Mark path="name" />
          <FieldIssues list={forField("name")} />
        </FormGroup>

        <div className="grid-2">
          <FormGroup label={t("lbl.widthMm")}>
            <Field className="form-input ek-num" type="number" step="0.1"
                   value={form.widthMm}
                   onChange={(e) => set("widthMm")(Number(e.target.value))} />
            <Mark path="widthMm" />
            <FieldIssues list={forField("widthMm")} />
          </FormGroup>
          <FormGroup label={t("lbl.heightMm")}>
            <Field className="form-input ek-num" type="number" step="0.1"
                   value={form.heightMm}
                   onChange={(e) => set("heightMm")(Number(e.target.value))} />
            <Mark path="heightMm" />
            <FieldIssues list={forField("heightMm")} />
          </FormGroup>
        </div>

        {/* ⚠ TAYYOR O'LCHAMLAR — DO'KONNING HAQIQIY QOG'OZIDAN.
            Ilgari bu yerda kodga yozib qo'yilgan yettita o'lcham
            turardi (70×37, 50×30 …) va ular do'konda bor rulon
            bilan bog'liq emas edi. Endi ro'yxat qog'oz
            profillaridan keladi: tanlangan zahoti o'lcham
            «shablondan farq qiladi» deb belgilanadi — ya'ni
            jimgina emas, ko'rinib o'zgaradi. */}
        {sizes.length > 0 && (
          <FormGroup label={t("lbl.fromMedia")}>
            <div className="lbl-sizes">
              {sizes.map((m) => (
                <button key={m.key} type="button" className="btn btn-outline btn-xs"
                        onClick={() => setForm((p) => ({ ...p, widthMm: m.w, heightMm: m.h }))}>
                  {m.w} × {m.h} {t("lbl.mm")}
                </button>
              ))}
            </div>
          </FormGroup>
        )}

        <FormGroup label={t("lbl.dpi")}>
          <Select block variant="field" ariaLabel={t("lbl.dpi")}
            value={form.dpi} onChange={(v) => set("dpi")(Number(v))}
            options={[{ value: 203, label: "203 dpi" }, { value: 300, label: "300 dpi" }]} />
          <Mark path="dpi" />
          <FieldIssues list={forField("dpi")} />
        </FormGroup>

        <label className="ek-check">
          <input type="checkbox" checked={form.thermal}
                 onChange={(e) => set("thermal")(e.target.checked)} />
          <span>{t("lbl.thermal")}</span>
        </label>
        <Mark path="thermal" />
        {/* ⚠ TERMALDA RANG YO'Q va SABABI yozib qo'yiladi. */}
        {form.thermal && <div className="form-hint">{t("lbl.thermalNoColor")}</div>}

        <h4 className="lbl-editor__head">{t("lbl.fields")}</h4>
        {form.spec.fields.map((f, i) => (
          <div key={f.key ?? i} className="lbl-field">
            <label className="ek-check">
              <input type="checkbox" checked={f.visible !== false}
                     onChange={(e) => setField(i, "visible", e.target.checked)} />
              <span className="fw-700">{f.key}</span>
            </label>
            <Mark path={fieldPath(f.key, "visible")} />
            <div className="lbl-field__grid">
              {BOX.map((k) => (
                <Field key={k} className="form-input ek-num" type="number" step="0.1"
                       aria-label={`${f.key} ${k}`} value={f[k] ?? 0}
                       onChange={(e) => setField(i, k, Number(e.target.value))} />
              ))}
              {f.key !== "barcode" && f.key !== "qr" && (
                <Field className="form-input ek-num" type="number" step="1"
                       aria-label={`${f.key} pt`} value={f.size ?? 8}
                       onChange={(e) => setField(i, "size", Number(e.target.value))} />
              )}
            </div>
            {BOX.concat(["size"]).map((k) => <Mark key={k} path={fieldPath(f.key, k)} />)}
            {f.key !== "barcode" && f.key !== "qr" && (
              <div className="lbl-field__grid">
                <Select variant="field" ariaLabel={`${f.key} align`}
                  value={f.align || "left"} onChange={(v) => setField(i, "align", v)}
                  options={ALIGNS.map((a) => ({ value: a, label: t(`lbl.align.${a}`) }))} />
                <Select variant="field" ariaLabel={`${f.key} overflow`}
                  value={f.overflow || "none"} onChange={(v) => setField(i, "overflow", v)}
                  options={OVERFLOW.map((o) => ({ value: o, label: t(`lbl.overflow.${o}`) }))} />
              </div>
            )}
            <Mark path={fieldPath(f.key, "align")} />
            <Mark path={fieldPath(f.key, "overflow")} />
            <FieldIssues list={forField(f.key)} />
          </div>
        ))}

        <label className="ek-check">
          <input type="checkbox" checked={makeDefault}
                 onChange={(e) => setMakeDefault(e.target.checked)} />
          <span>{t("lbl.makeDefault")}</span>
        </label>

        {warnings.length > 0 && (
          <ul className="lbl-warn lbl-warn--soft">
            {warnings.map((w, i) => (
              <li key={i}>
                <i className="fa-solid fa-circle-info" aria-hidden="true" />
                <span>{w.text}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="lbl-editor__actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="button" className="btn btn-primary btn-sm"
                  onClick={submit} disabled={saving || errors.length > 0}>
            {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>

        {/* ⚠ BLOKLANGAN TUGMANING SABABI — YONIDA. */}
        {errors.length > 0 && (
          <ul className="lbl-warn lbl-warn--bad">
            {errors.map((e, i) => (
              <li key={i}>
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lbl-editor__preview">
        {/* ⚠ AYNAN O'SHA ko'rish oynasi — tahrirlagichning o'z chizuvchisi yo'q. */}
        {product && <LabelPreview template={asTemplate} product={product} />}
      </div>
    </div>
  );
}

function FieldIssues({ list }) {
  if (!list?.length) return null;
  return (
    <div className="lbl-field__issues">
      {list.map((x, i) => (
        <div key={i} className={x.level === "error" ? "lbl-issue lbl-issue--bad" : "lbl-issue"}>
          <i className={`fa-solid ${x.level === "error"
            ? "fa-triangle-exclamation" : "fa-circle-info"}`} aria-hidden="true" />
          <span>{x.text}</span>
        </div>
      ))}
    </div>
  );
}
