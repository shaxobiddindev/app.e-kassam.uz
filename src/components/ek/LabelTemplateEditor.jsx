import { useMemo, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { Field, FormGroup } from "../ui";
import Select from "./Select";
import { Spinner } from "./Loading";
import LabelPreview from "./LabelPreview";
import { blocking, validateSheet, validateTemplate } from "../../lib/ek-label-validate";

/* ══════════════════════════════════════════════════════════════════════════
   SHABLON TAHRIRLAGICH (F4)

   ⚠ XATO DARHOL KO'RINADI — maydonning YONIDA, `submit` da emas.
   Saqlashda ro'yxat bilan chiqadigan xatolar do'konchini formaning
   boshiga qaytarib, qaysi maydon aybdor ekanini izlashga majbur
   qiladi.

   ⚠ BLOKLANGAN TUGMA SABABSIZ QOLMAYDI. Bosib bo'lmaydigan, lekin
   nega bo'lmasligi aytilmagan tugma — foydalanuvchini bezovta
   qiladigan eng oson yo'l.

   ⚠ XATO va OGOHLANTIRISH AJRATILGAN: xato saqlashni to'sadi
   (fizik jihatdan chiqmaydi), ogohlantirish esa to'smaydi — nom
   kesiladi, shrift kichik, termalda rang tanlangan.
   ══════════════════════════════════════════════════════════════════════════ */

const SIZES = [
  { value: "70x37",   w: 70,  h: 37 },
  { value: "70x50",   w: 70,  h: 50 },
  { value: "50x30",   w: 50,  h: 30 },
  { value: "100x60",  w: 100, h: 60 },
  { value: "30x20",   w: 30,  h: 20 },
  { value: "40x30",   w: 40,  h: 30 },
  { value: "58x40",   w: 58,  h: 40 },
];

const ALIGNS   = ["left", "center", "right"];
const OVERFLOW = ["shrink", "clip", "none"];

export default function LabelTemplateEditor({ template, product, saving, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: template?.name ?? "",
    kind: template?.kind ?? "SHELF",
    widthMm: Number(template?.widthMm ?? 50),
    heightMm: Number(template?.heightMm ?? 30),
    dpi: Number(template?.dpi ?? 203),
    thermal: Boolean(template?.thermal),
    makeDefault: false,
    spec: parse(template?.spec),
  }));

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const setField = (i, k, v) => setForm((p) => {
    const fields = p.spec.fields.map((f, j) => (j === i ? { ...f, [k]: v } : f));
    return { ...p, spec: { ...p.spec, fields } };
  });
  const setSheet = (k, v) => setForm((p) => ({
    ...p, spec: { ...p.spec, sheet: { ...(p.spec.sheet || {}), [k]: v } },
  }));

  const asTemplate = useMemo(() => ({
    kind: form.kind, widthMm: form.widthMm, heightMm: form.heightMm,
    dpi: form.dpi, thermal: form.thermal, spec: form.spec,
  }), [form]);

  /* ⚠ HAR O'ZGARISHDA qayta hisoblanadi — `submit` ni kutmaydi. */
  const issues = useMemo(() => {
    const list = validateTemplate(asTemplate);
    if (form.spec.sheet) list.push(...validateSheet(asTemplate, form.spec.sheet));
    if (!String(form.name).trim()) list.push({ level: "error", field: "name", text: t("lbl.needName") });
    return list;
  }, [asTemplate, form.name, form.spec.sheet]);

  const errors   = blocking(issues);
  const warnings = issues.filter((x) => x.level === "warning");
  const forField = (name) => issues.filter((x) => x.field === name);

  const submit = () => {
    if (errors.length) return;
    onSave({
      name: form.name.trim(), kind: form.kind,
      widthMm: form.widthMm, heightMm: form.heightMm,
      dpi: form.dpi, thermal: form.thermal,
      spec: JSON.stringify(form.spec), makeDefault: form.makeDefault,
    });
  };

  return (
    <div className="lbl-editor">
      <div className="lbl-editor__form">
        <FormGroup label={`${t("common.name")} *`}>
          <Field className="form-input" value={form.name}
                 onChange={(e) => set("name")(e.target.value)} autoFocus />
          <FieldIssues list={forField("name")} />
        </FormGroup>

        <div className="grid-2">
          <FormGroup label={t("lbl.size")}>
            <Select block variant="field" ariaLabel={t("lbl.size")}
              value={`${form.widthMm}x${form.heightMm}`}
              onChange={(v) => {
                const s = SIZES.find((x) => x.value === v);
                if (s) setForm((p) => ({ ...p, widthMm: s.w, heightMm: s.h }));
              }}
              options={SIZES.map((s) => ({ value: s.value, label: `${s.w} × ${s.h} ${t("lbl.mm")}` }))}
            />
          </FormGroup>
          <FormGroup label={t("lbl.dpi")}>
            <Select block variant="field" ariaLabel={t("lbl.dpi")}
              value={form.dpi} onChange={(v) => set("dpi")(Number(v))}
              options={[{ value: 203, label: "203 dpi" }, { value: 300, label: "300 dpi" }]} />
            <FieldIssues list={forField("dpi")} />
          </FormGroup>
        </div>

        <div className="grid-2">
          <FormGroup label={t("lbl.widthMm")}>
            <Field className="form-input ek-num" type="number" step="0.1"
                   value={form.widthMm}
                   onChange={(e) => set("widthMm")(Number(e.target.value))} />
            <FieldIssues list={forField("widthMm")} />
          </FormGroup>
          <FormGroup label={t("lbl.heightMm")}>
            <Field className="form-input ek-num" type="number" step="0.1"
                   value={form.heightMm}
                   onChange={(e) => set("heightMm")(Number(e.target.value))} />
            <FieldIssues list={forField("heightMm")} />
          </FormGroup>
        </div>

        <label className="ek-check">
          <input type="checkbox" checked={form.thermal}
                 onChange={(e) => set("thermal")(e.target.checked)} />
          <span>{t("lbl.thermal")}</span>
        </label>
        {/* ⚠ TERMALDA RANG YO'Q va SABABI yozib qo'yiladi: aks holda
            do'konchi «rang nega ishlamadi?» deb o'ylardi. */}
        {form.thermal && <div className="form-hint">{t("lbl.thermalNoColor")}</div>}

        <h4 className="lbl-editor__head">{t("lbl.fields")}</h4>
        {form.spec.fields.map((f, i) => (
          <div key={i} className="lbl-field">
            <label className="ek-check">
              <input type="checkbox" checked={f.visible !== false}
                     onChange={(e) => setField(i, "visible", e.target.checked)} />
              <span className="fw-700">{f.key}</span>
            </label>
            <div className="lbl-field__grid">
              {["x", "y", "w", "h"].map((k) => (
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
            <FieldIssues list={forField(f.key)} />
          </div>
        ))}

        <h4 className="lbl-editor__head">{t("lbl.sheet")}</h4>
        <div className="grid-2">
          {[["cols", t("lbl.cols")], ["rows", t("lbl.rows")],
            ["marginLeftMm", t("lbl.marginLeft")], ["marginTopMm", t("lbl.marginTop")],
            ["gapXMm", t("lbl.gapX")], ["gapYMm", t("lbl.gapY")],
            ["startPosition", t("lbl.startPosition")]].map(([k, label]) => (
            <FormGroup key={k} label={label}>
              <Field className="form-input ek-num" type="number" step={k.endsWith("Mm") ? "0.1" : "1"}
                     value={form.spec.sheet?.[k] ?? defaultSheet()[k]}
                     onChange={(e) => setSheet(k, Number(e.target.value))} />
              <FieldIssues list={forField(k)} />
            </FormGroup>
          ))}
        </div>

        <label className="ek-check">
          <input type="checkbox" checked={form.makeDefault}
                 onChange={(e) => set("makeDefault")(e.target.checked)} />
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

const defaultSheet = () => ({
  sheetWidthMm: 210, sheetHeightMm: 297,
  marginLeftMm: 8, marginRightMm: 8, marginTopMm: 10, marginBottomMm: 10,
  gapXMm: 2, gapYMm: 0, cols: 2, rows: 7, startPosition: 1,
});

function parse(spec) {
  const base = typeof spec === "string" ? JSON.parse(spec) : (spec || {});
  return {
    ...base,
    fields: Array.isArray(base.fields) ? base.fields : [],
    sheet: base.sheet ? { ...defaultSheet(), ...base.sheet } : defaultSheet(),
  };
}
