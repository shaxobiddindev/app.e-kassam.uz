/* ══════════════════════════════════════════════════════════════════════════
   ZAL VA STOLLAR — sozlash (2-bosqich T1, V153, docs/22-RESTORAN.md)

   Yangi restoranni sozlash bir daqiqalik ish bo'lsin: zal qo'shiladi va
   «Stol 1–12» bir bosishda yaratiladi. Stolni bosib nomi yoki o'rinlari
   o'zgartiriladi.

   ⚠ O'CHIRISH = NOFAOL: yopilgan buyurtmalar stolga havola qiladi. Ochiq
   buyurtmasi bor stol yoki zalni server o'chirmaydi (pul ochiq turibdi).
   ══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { tableApi } from "../api";
import { Modal } from "../components";
import { Empty, Field, FormGroup } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { SkeletonList, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { asArray } from "../lib/ek-array";
import FloorEditor from "../components/FloorEditor";

export default function TablesSetupPage({ toast }) {
  const confirm = useConfirm();
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [modal, setModal] = useState(null);   // {kind: "hall"|"batch"|"table", ...}
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState(null);      // zal rejasi muharriri (D2)

  const load = useCallback(async () => {
    setLoading(true);
    try { setHalls(asArray((await tableApi.halls())?.data)); }
    catch (err) { toast?.error(err.message); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setSaving(true);
    try { await fn(); toast?.success(t("common.saved")); setModal(null); load(); }
    catch (err) { toast?.error(err.message); }
    finally { setSaving(false); }
  };

  const save = () => {
    const m = modal;
    if (m.kind === "hall") return run(() => (m.id ? tableApi.updateHall(m.id, { name: m.name }) : tableApi.createHall({ name: m.name })));
    if (m.kind === "batch") return run(() => tableApi.createTables(m.hallId, {
      prefix: m.prefix, from: Number(m.from) || 1, to: Number(m.to) || Number(m.from) || 1, seats: Number(m.seats) || null,
    }));
    return run(() => tableApi.updateTable(m.id, { name: m.name, seats: Number(m.seats) || null }));
  };

  const removeHall = async (h) => {
    if (!(await confirm({ title: t("tbl.removeHall"), message: t("tbl.removeHallConfirm", { name: h.name }), confirmText: t("common.delete"), type: "danger" }))) return;
    run(() => tableApi.archiveHall(h.id));
  };
  const removeTable = async (m) => {
    if (!(await confirm({ title: t("tbl.removeTable"), message: t("tbl.removeTableConfirm", { name: m.name }), confirmText: t("common.delete"), type: "danger" }))) return;
    run(() => tableApi.archiveTable(m.id));
  };

  const canSave = modal && (modal.kind === "batch" ? Number(modal.to || modal.from) >= Number(modal.from || 1) : String(modal.name || "").trim());

  return (
    <div>
      <div className="page-header mod-head">
        <h2 className="page-title">{t("tbl.setupTitle")}</h2>
        <button className="btn btn-primary" onClick={() => setModal({ kind: "hall", name: "" })}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> {t("tbl.addHall")}
        </button>
      </div>
      <p className="text-muted mod-intro">{t("tbl.setupIntro")}</p>

      {busy ? <SkeletonList rows={3} /> : halls.length === 0 ? (
        <Empty icon="fa-chair" text={t("tbl.noneSetup")} />
      ) : (
        <div className="mod-list">
          {halls.map((h) => (
            <section key={h.id} className="card mod-card">
              <div className="mod-card__head">
                <h3 className="mod-card__name">{h.name}</h3>
                <span className="badge">{t("tbl.count", { n: asArray(h.tables).length })}</span>
                <span className="mod-card__actions">
                  <button className="btn btn-outline btn-sm" onClick={() => setPlan(h)} disabled={!asArray(h.tables).length}>
                    <i className="fa-solid fa-map" aria-hidden="true" /> {t("fe.open")}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setModal({ kind: "hall", id: h.id, name: h.name })}>
                    <i className="fa-solid fa-pen" aria-hidden="true" /> {t("common.edit")}
                  </button>
                  <button className="btn-icon danger" aria-label={`${h.name} — ${t("common.delete")}`} onClick={() => removeHall(h)}>
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </button>
                </span>
              </div>
              <div className="mod-chips">
                {asArray(h.tables).map((tb) => (
                  <button key={tb.id} type="button" className="mod-chip tbl-chip"
                          onClick={() => setModal({ kind: "table", id: tb.id, name: tb.name, seats: tb.seats ?? "" })}>
                    {tb.name}{tb.seats ? <span className="text-muted"> · {tb.seats}</span> : null}
                    {tb.order && <i className="fa-solid fa-circle tbl-chip__busy" aria-label={t("tbl.busy")} />}
                  </button>
                ))}
              </div>
              <div>
                <button className="btn btn-outline btn-sm" onClick={() => {
                  const n = asArray(h.tables).length;
                  setModal({ kind: "batch", hallId: h.id, prefix: t("tbl.defaultPrefix"), from: n + 1, to: n + 10, seats: 4 });
                }}>
                  <i className="fa-solid fa-plus" aria-hidden="true" /> {t("tbl.addTables")}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}

      {plan && <FloorEditor hall={plan} toast={toast} onClose={() => setPlan(null)} onSaved={load} />}

      {modal && (
        <Modal
          title={modal.kind === "hall" ? (modal.id ? t("tbl.editHall") : t("tbl.addHall"))
            : modal.kind === "batch" ? t("tbl.addTables") : t("tbl.editTable")}
          onClose={() => setModal(null)}
          maxWidth={440}
          footer={
            <>
              {modal.kind === "table" && (
                <button className="btn btn-outline btn-sm danger" style={{ marginInlineEnd: "auto" }} onClick={() => removeTable(modal)}>
                  <i className="fa-solid fa-trash" aria-hidden="true" /> {t("common.delete")}
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !canSave}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" aria-hidden="true" />} {t("common.save")}
              </button>
            </>
          }
        >
          {modal.kind !== "batch" ? (
            <>
              <FormGroup label={t("common.name")}>
                <Field className="form-input" autoFocus maxLength={modal.kind === "hall" ? 60 : 30}
                       placeholder={modal.kind === "hall" ? t("tbl.hallPh") : t("tbl.tablePh")}
                       value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
              </FormGroup>
              {modal.kind === "table" && (
                <FormGroup label={t("tbl.seats")}>
                  <Field kind="int" className="form-input ek-num" value={modal.seats}
                         onChange={(e) => setModal({ ...modal, seats: e.target.value })} />
                </FormGroup>
              )}
            </>
          ) : (
            <>
              <FormGroup label={t("tbl.prefix")}>
                <Field className="form-input" maxLength={20} value={modal.prefix}
                       onChange={(e) => setModal({ ...modal, prefix: e.target.value })} />
              </FormGroup>
              <div className="grid-2">
                <FormGroup label={t("tbl.from")}>
                  <Field kind="int" className="form-input ek-num" value={modal.from}
                         onChange={(e) => setModal({ ...modal, from: e.target.value })} />
                </FormGroup>
                <FormGroup label={t("tbl.to")}>
                  <Field kind="int" className="form-input ek-num" value={modal.to}
                         onChange={(e) => setModal({ ...modal, to: e.target.value })} />
                </FormGroup>
              </div>
              <FormGroup label={t("tbl.seats")}>
                <Field kind="int" className="form-input ek-num" value={modal.seats}
                       onChange={(e) => setModal({ ...modal, seats: e.target.value })} />
              </FormGroup>
              <p className="form-hint">{t("tbl.batchHint", { a: `${modal.prefix} ${modal.from || 1}`.trim(), b: `${modal.prefix} ${modal.to || modal.from || 1}`.trim() })}</p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
