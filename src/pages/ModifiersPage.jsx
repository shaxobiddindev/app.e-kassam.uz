/* ══════════════════════════════════════════════════════════════════════════
   TAOM QO'SHIMCHALARI — boshqaruv (R2, V149, docs/22-RESTORAN.md)

   Egasi guruh ochadi («Sous»), ichiga variantlarni yozadi («Ketchup
   + 2 000», «Mayonez + 2 000») va qaysi taomlarga tegishli ekanini
   belgilaydi. Kassada o'sha taom bosilsa tanlov oynasi ochiladi.

   ⚠ BITTA FORMA, BITTA SAQLASH. Guruh, variantlar va taomlar birga
   yuboriladi — alohida saqlansa oradagi xato «variantsiz majburiy
   guruh» qoldirardi va kassa taomni umuman sota olmasdi.

   ⚠ «O'CHIRISH» = NOFAOL. Sotilgan chekda qo'shimcha nomi qoladi, guruh
   esa ro'yxatdan va taomlardan yo'qoladi (server shunday qiladi).
   ══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import { modifierApi, productApi } from "../api";
import { Modal } from "../components";
import { Empty, Field, FormGroup } from "../components/ui";
import { money } from "../lib/ek-format";
import { useConfirm } from "../context/ConfirmProvider";
import { SkeletonList, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { asArray } from "../lib/ek-array";

const blankForm = () => ({
  id: null, name: "", minSelect: "0", maxSelect: "",
  options: [{ key: 1, id: null, name: "", price: "" }],
  products: [],
});

/** Guruh qoidasi — kassadagi oyna bilan BIR XIL matn (`ModifierModal`). */
export function ruleText(g) {
  const min = Number(g.minSelect) || 0;
  const max = Number(g.maxSelect) || 0;
  if (min > 0 && max === min) return t("mod.ruleExact", { n: min });
  if (min > 0) return max ? t("mod.ruleRange", { min, max }) : t("mod.ruleMin", { n: min });
  return max ? t("mod.ruleUpTo", { n: max }) : t("mod.ruleAny");
}

export default function ModifiersPage({ toast }) {
  const confirm = useConfirm();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await modifierApi.list();
      setGroups(asArray(r?.data));
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const edit = (g) => setForm({
    id: g.id, name: g.name,
    minSelect: String(g.minSelect ?? 0),
    maxSelect: g.maxSelect == null ? "" : String(g.maxSelect),
    options: asArray(g.options).map((o, i) => ({ key: i + 1, id: o.id, name: o.name, price: String(o.price ?? "") })),
    products: asArray(g.products),
  });

  const save = async () => {
    const options = form.options
      .filter((o) => o.name.trim())
      .map((o) => ({ id: o.id, name: o.name.trim(), price: o.price === "" ? 0 : Number(o.price) }));
    const body = {
      name: form.name.trim(),
      minSelect: Number(form.minSelect) || 0,
      maxSelect: form.maxSelect === "" ? null : Number(form.maxSelect),
      options,
      productIds: form.products.map((p) => p.id),
    };
    setSaving(true);
    try {
      if (form.id) await modifierApi.update(form.id, body);
      else await modifierApi.create(body);
      toast?.success(t("common.saved"));
      setForm(null);
      load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g) => {
    const ok = await confirm({
      title: t("mod.removeTitle"),
      message: t("mod.removeConfirm", { name: g.name }),
      confirmText: t("common.delete"),
      type: "danger",
    });
    if (!ok) return;
    try {
      await modifierApi.archive(g.id);
      toast?.success(t("common.saved"));
      load();
    } catch (err) {
      toast?.error(err.message);
    }
  };

  const canSave = form && form.name.trim() && form.options.some((o) => o.name.trim());

  return (
    <div>
      <div className="page-header mod-head">
        <h2 className="page-title">{t("nav.modifiers")}</h2>
        <button className="btn btn-primary" onClick={() => setForm(blankForm())}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> {t("mod.newGroup")}
        </button>
      </div>
      <p className="text-muted mod-intro">{t("mod.intro")}</p>

      {busy ? (
        <SkeletonList rows={4} />
      ) : groups.length === 0 ? (
        <Empty icon="fa-utensils" text={t("mod.empty")} />
      ) : (
        <div className="mod-list">
          {groups.map((g) => (
            <section key={g.id} className="card mod-card">
              <div className="mod-card__head">
                <h3 className="mod-card__name">{g.name}</h3>
                <span className="badge">{ruleText(g)}</span>
                <span className="mod-card__actions">
                  <button className="btn btn-outline btn-sm" onClick={() => edit(g)}>
                    <i className="fa-solid fa-pen" aria-hidden="true" /> {t("common.edit")}
                  </button>
                  <button className="btn-icon danger" aria-label={`${g.name} — ${t("common.delete")}`}
                          onClick={() => remove(g)}>
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </button>
                </span>
              </div>
              <ul className="mod-card__opts">
                {asArray(g.options).map((o) => (
                  <li key={o.id}>
                    <span>{o.name}</span>
                    <span className="ek-num">{Number(o.price) > 0 ? `+${money(o.price)}` : t("mod.free")}</span>
                  </li>
                ))}
              </ul>
              <div className="mod-card__dishes text-muted">
                <i className="fa-solid fa-bowl-food" aria-hidden="true" />{" "}
                {asArray(g.products).length
                  ? asArray(g.products).map((p) => p.name).join(", ")
                  : t("mod.noDishes")}
              </div>
            </section>
          ))}
        </div>
      )}

      {form && (
        <Modal
          title={form.id ? t("mod.editGroup") : t("mod.newGroup")}
          onClose={() => setForm(null)}
          maxWidth={560}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setForm(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !canSave}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" aria-hidden="true" />} {t("common.save")}
              </button>
            </>
          }
        >
          <FormGroup label={t("mod.groupName")}>
            <Field className="form-input" maxLength={80} autoFocus placeholder={t("mod.groupNamePh")}
                   value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormGroup>
          <div className="grid-2">
            <FormGroup label={t("mod.minSelect")}>
              <Field kind="int" className="form-input ek-num" value={form.minSelect}
                     onChange={(e) => setForm({ ...form, minSelect: e.target.value })} />
            </FormGroup>
            <FormGroup label={t("mod.maxSelect")}>
              <Field kind="int" className="form-input ek-num" placeholder={t("mod.noLimit")}
                     value={form.maxSelect} onChange={(e) => setForm({ ...form, maxSelect: e.target.value })} />
            </FormGroup>
          </div>
          <p className="form-hint mod-hint">{t("mod.selectHint")}</p>

          <FormGroup label={t("mod.options")}>
            <div className="mod-rows">
              {form.options.map((o, idx) => (
                <div className="mod-row" key={o.key}>
                  <Field className="form-input" maxLength={80} placeholder={t("mod.optionPh")}
                         aria-label={t("mod.optionName")} value={o.name}
                         onChange={(e) => setForm({ ...form, options: form.options.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)) })} />
                  <Field kind="money" className="form-input ek-num mod-row__price" placeholder="0"
                         aria-label={t("mod.optionPrice")} value={o.price}
                         onChange={(e) => setForm({ ...form, options: form.options.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)) })} />
                  <button type="button" className="btn-icon danger" aria-label={t("common.delete")}
                          disabled={form.options.length === 1}
                          onClick={() => setForm({ ...form, options: form.options.filter((_, i) => i !== idx) })}>
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm"
                      onClick={() => setForm({ ...form, options: [...form.options,
                        { key: Math.max(0, ...form.options.map((x) => x.key)) + 1, id: null, name: "", price: "" }] })}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> {t("mod.addOption")}
              </button>
            </div>
          </FormGroup>

          <FormGroup label={t("mod.dishes")}>
            <DishPicker value={form.products} onChange={(products) => setForm({ ...form, products })} />
          </FormGroup>
        </Modal>
      )}
    </div>
  );
}

/**
 * Taomlarni tanlash: qidiruv + tanlanganlar chiplar ko'rinishida.
 *
 * ⚠ Ro'yxat qidiruv bilan, butun katalog emas: kafeda ham ichimlik,
 * sigaret, saqich bo'ladi va ularning hammasini ochib ko'rsatish
 * kerakli taomni topishni qiyinlashtirardi.
 */
function DishPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const seq = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (!text) { setFound([]); return undefined; }
    const my = ++seq.current;
    const id = setTimeout(() => {
      productApi.search(text, 0, 12)
        .then((r) => { if (my === seq.current) setFound(asArray(r?.data)); })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const has = (id) => value.some((p) => p.id === id);

  return (
    <div className="mod-dishes">
      {value.length > 0 && (
        <div className="mod-chips">
          {value.map((p) => (
            <span key={p.id} className="mod-chip">
              {p.name}
              <button type="button" aria-label={`${p.name} — ${t("common.delete")}`}
                      onClick={() => onChange(value.filter((x) => x.id !== p.id))}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Field className="form-input" placeholder={t("mod.findDish")} aria-label={t("mod.findDish")}
             value={q} onChange={(e) => setQ(e.target.value)} />
      {found.length > 0 && (
        <ul className="mod-found">
          {found.map((p) => (
            <li key={p.id}>
              <button type="button" disabled={has(p.id)}
                      onClick={() => onChange([...value, { id: p.id, name: p.name }])}>
                <i className={`fa-solid ${has(p.id) ? "fa-check" : "fa-plus"}`} aria-hidden="true" /> {p.name}
                {p.salePrice != null && <span className="ek-num text-muted"> · {money(p.salePrice)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
