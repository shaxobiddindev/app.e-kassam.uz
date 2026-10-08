import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { tableApi } from "../api";
import { money } from "../lib/ek-format";
import { asArray } from "../lib/ek-array";
import { minutesSince } from "../lib/ek-table-order";
import { subscribeTables, isLive } from "../lib/ek-live";
import { isTerminal, lockNow } from "../lib/ek-terminal";
import { roleSet } from "../lib/ek-roles";
import { roleLabel } from "../lib/ek-labels";
import { PLANE, autoPlace, sizeOf, statusOf, attention, hhmm, atToday } from "../lib/ek-floor";
import { Modal } from "../components";
import { Field, FormGroup } from "../components/ui";
import { SkeletonTiles, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";

/* ══════════════════════════════════════════════════════════════════════════
   ZAL — restoranning bosh ekrani (3-bosqich D1–D2, prototip 2-ekran)

   Do'kon kassasidan farqi: birinchi ekran MAHSULOT EMAS, ZAL. Stollar
   rejadagi joyida va shaklida (1000 × 640 tekislik foizga aylanadi —
   planshetda ham, katta monitorda ham bir xil). Joyi yo'q stol vaqtincha
   bo'sh joyga qo'yiladi (`autoPlace`, serverga yozilmaydi).

   Bosish: band stol — darhol buyurtma; bo'sh — «ochish / bron»; bron —
   «mehmon keldi / bekor qilish». Tez yo'l eng ko'p ishlatiladiganiga.

   ⚠ HOLAT RANG BILAN YOLG'IZ EMAS (6-qoida): har holatda matn va belgi bor.
   ⚠ «Taom kechikmoqda» va «tayyor» — D3/D5 da (oshxona vaqti kerak).
   ══════════════════════════════════════════════════════════════════════════ */
const MANAGERS = ["OWNER", "SHOP_ADMIN", "ADMIN"];
const ICON = { free: "fa-chair", busy: "fa-utensils", bill: "fa-receipt", resv: "fa-calendar-check" };

export default function RestaurantFloorPage({ toast }) {
  const navigate = useNavigate();
  const [halls, setHalls] = useState([]);
  const [hallId, setHallId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [sheet, setSheet] = useState(null);       // { table, mode: "free"|"resv"|"reserve" }
  const [form, setForm] = useState({ at: "", name: "", guests: "" });
  const [saving, setSaving] = useState(false);
  const busy = useLoading(loading);
  const me = localStorage.getItem("ek_username") || "";
  const role = localStorage.getItem("ek_role") || "";
  const fullName = localStorage.getItem("ek_fullName") || me;
  const manager = MANAGERS.some((r) => roleSet(role).has(r));
  const terminal = isTerminal();

  const load = useCallback(() => {
    tableApi.halls()
      .then((r) => {
        const list = asArray(r?.data);
        setHalls(list);
        setHallId((cur) => (cur && list.some((h) => h.id === cur) ? cur : list[0]?.id ?? null));
        setNow(Date.now());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    let soon = null;
    const off = subscribeTables(() => { clearTimeout(soon); soon = setTimeout(load, 250); });
    const id = setInterval(() => { if (!isLive()) load(); else setNow(Date.now()); }, 15000);
    return () => { off(); clearTimeout(soon); clearInterval(id); };
  }, [load]);

  const hall = halls.find((h) => h.id === hallId) || null;
  const placedTables = useMemo(() => autoPlace(asArray(hall?.tables)), [hall]);
  const all = useMemo(() => halls.flatMap((h) => asArray(h.tables)), [halls]);
  const alerts = useMemo(() => attention(halls, now), [halls, now]);
  const stats = useMemo(() => {
    const busyT = all.filter((x) => x.order);
    return {
      busy: busyT.length, total: all.length,
      guests: busyT.reduce((s, x) => s + (Number(x.order.guests) || 0), 0),
      open: busyT.reduce((s, x) => s + (Number(x.order.total) || 0), 0),
    };
  }, [all]);

  /* D3: stol restoranning O'Z ekranida ochiladi (mehmon, kurs, oshxonaga
     yuborish); to'lov uchun u yerdan kassaga o'tiladi. */
  const openOrder = (tb) => navigate(`/restaurant/table/${tb.id}`);
  const pick = (tb) => {
    const st = statusOf(tb);
    if (st === "busy" || st === "bill") return openOrder(tb);
    setSheet({ table: tb, mode: st === "resv" ? "resv" : "free" });
  };

  const run = async (fn) => {
    setSaving(true);
    try { await fn(); setSheet(null); load(); }
    catch (err) { toast?.error(err.message); }
    finally { setSaving(false); }
  };
  const saveReserve = () => {
    const at = atToday(form.at);
    if (!at) { toast?.error(t("rf.resvTimeBad")); return; }
    run(() => tableApi.reserve(sheet.table.id, { at, name: form.name, guests: Number(form.guests) || null }));
  };

  const line = (tb) => {
    const o = tb.order;
    const st = statusOf(tb);
    const who = o?.openedByName || o?.openedBy || "";
    if (st === "bill") return [t("rf.billGiven"), `${money(o.total)}${who ? ` · ${who}` : ""}`];
    if (st === "busy") return [money(o.total), `${t("tbl.minutes", { n: minutesSince(o.openedAt, now) })}${who ? ` · ${who}` : ""}`];
    if (st === "resv") return [t("rf.resvAt", { time: hhmm(tb.reservation.at) }),
      [tb.reservation.name, tb.reservation.guests ? t("rf.people", { n: tb.reservation.guests }) : ""].filter(Boolean).join(" · ")];
    return [t("tbl.free"), tb.seats ? t("rf.seats", { n: tb.seats }) : ""];
  };

  return (
    <div className="rf">
      <header className="rf-head">
        <span className="rf-brand">e-Kassam <span>Restaurant</span></span>
        {halls.length > 1 && (
          <nav className="rf-halls" role="tablist" aria-label={t("tbl.halls")}>
            {halls.map((h) => {
              const taken = asArray(h.tables).filter((x) => x.order).length;
              return (
                <button key={h.id} type="button" role="tab" aria-selected={h.id === hallId}
                        className={`rf-hall${h.id === hallId ? " is-on" : ""}`} onClick={() => setHallId(h.id)}>
                  {h.name} <span className="ek-num">{taken}/{asArray(h.tables).length}</span>
                </button>
              );
            })}
          </nav>
        )}
        <div className="rf-head__end">
          <button type="button" className={`rf-mine${mine ? " is-on" : ""}`} aria-pressed={mine} onClick={() => setMine((v) => !v)}>
            <i className="fa-solid fa-user" aria-hidden="true" /> {t("rf.mine")}
          </button>
          {manager && !terminal && (
            <button type="button" className="btn btn-outline rf-manage" onClick={() => navigate("/")}>
              <i className="fa-solid fa-gauge-high" aria-hidden="true" /> {t("rf.manage")}
            </button>
          )}
          <div className="rf-who">
            <span className="rf-who__txt"><b>{fullName}</b><small>{roleLabel(role.split(",")[0])}</small></span>
            {terminal && (
              <button type="button" className="rf-lock" onClick={lockNow} aria-label={t("term.lockNow")}>
                <i className="fa-solid fa-lock" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="rf-stats">
        <div><small>{t("rf.busy")}</small><b className="ek-num">{stats.busy} / {stats.total}</b></div>
        <div><small>{t("rf.guests")}</small><b className="ek-num">{stats.guests}</b></div>
        <div><small>{t("rf.open")}</small><b className="ek-num">{money(stats.open)}</b></div>
      </div>

      <div className="rf-main">
        <main className="rf-body">
          {busy ? (
            <SkeletonTiles count={12} />
          ) : !hall ? (
            <p className="rf-empty">{manager ? t("tbl.none") : t("rf.noneStaff")}</p>
          ) : (
            <div className="rf-plan" aria-label={t("rf.plan")}>
              {placedTables.map((tb) => {
                const st = statusOf(tb);
                const [l1, l2] = line(tb);
                const s = sizeOf(tb.shape);
                const dim = mine && (!tb.order || tb.order.openedBy !== me);
                return (
                  <button key={tb.id} type="button"
                          className={`rf-table rf-table--${st} rf-shape--${String(tb.shape || "SQUARE").toLowerCase()}${dim ? " is-dim" : ""}`}
                          style={{ left: `${(tb.x / PLANE.w) * 100}%`, top: `${(tb.y / PLANE.h) * 100}%`,
                                   width: `${(s.w / PLANE.w) * 100}%`, height: `${(s.h / PLANE.h) * 100}%` }}
                          onClick={() => pick(tb)}
                          aria-label={`${tb.name}: ${t(`rf.st.${st}`)}. ${l1}${l2 ? `, ${l2}` : ""}`}>
                    <span className="rf-table__name"><i className={`fa-solid ${ICON[st]}`} aria-hidden="true" /> {tb.name}</span>
                    <span className="rf-table__l1 ek-num">{l1}</span>
                    {l2 && <span className="rf-table__meta">{l2}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <div className="rf-legend" aria-hidden="true">
            {["free", "busy", "bill", "resv"].map((st) => (
              <span key={st}><span className={`rf-sw rf-table--${st}`} /> {t(`rf.st.${st}`)}</span>
            ))}
          </div>
        </main>

        <aside className="rf-side" aria-label={t("rf.attention")}>
          <h2>{t("rf.attention")}</h2>
          {alerts.length === 0 ? (
            <p className="rf-empty">{t("rf.allCalm")}</p>
          ) : alerts.map((a) => (
            <button key={`${a.kind}-${a.table.id}`} type="button" className={`rf-alert rf-table--${a.kind}`} onClick={() => pick(a.table)}>
              <span className="rf-alert__top">
                <b>{a.table.name}{halls.length > 1 ? ` · ${a.hall.name}` : ""}</b>
                <span className="ek-num">{a.kind === "bill" ? t("tbl.minutes", { n: minutesSince(a.table.order.billAt, now) }) : hhmm(a.table.reservation.at)}</span>
              </span>
              <span>{a.kind === "bill" ? t("rf.alertBill") : t("rf.alertResv", { name: a.table.reservation.name || "—" })}</span>
            </button>
          ))}
        </aside>
      </div>

      {sheet && (
        <Modal title={sheet.table.name} onClose={() => setSheet(null)} maxWidth={420}
               footer={sheet.mode === "reserve" ? (
                 <>
                   <button className="btn btn-outline btn-sm" onClick={() => setSheet({ ...sheet, mode: "free" })}>{t("common.back")}</button>
                   <button className="btn btn-primary btn-sm" onClick={saveReserve} disabled={saving || !form.at}>
                     {saving ? <Spinner /> : <i className="fa-solid fa-check" aria-hidden="true" />} {t("common.save")}
                   </button>
                 </>
               ) : null}>
          {sheet.mode === "free" && (
            <div className="rf-sheet">
              <button type="button" className="btn btn-primary rf-sheet__btn" onClick={() => openOrder(sheet.table)}>
                <i className="fa-solid fa-utensils" aria-hidden="true" /> {t("rf.openTable")}
              </button>
              <button type="button" className="btn btn-outline rf-sheet__btn"
                      onClick={() => { setForm({ at: "", name: "", guests: "" }); setSheet({ ...sheet, mode: "reserve" }); }}>
                <i className="fa-solid fa-calendar-plus" aria-hidden="true" /> {t("rf.reserve")}
              </button>
            </div>
          )}
          {sheet.mode === "resv" && (
            <div className="rf-sheet">
              <p className="rf-sheet__info">
                {t("rf.resvAt", { time: hhmm(sheet.table.reservation.at) })}
                {sheet.table.reservation.name ? ` · ${sheet.table.reservation.name}` : ""}
                {sheet.table.reservation.guests ? ` · ${t("rf.people", { n: sheet.table.reservation.guests })}` : ""}
              </p>
              <button type="button" className="btn btn-primary rf-sheet__btn" onClick={() => openOrder(sheet.table)}>
                <i className="fa-solid fa-door-open" aria-hidden="true" /> {t("rf.guestCame")}
              </button>
              <button type="button" className="btn btn-outline rf-sheet__btn danger" disabled={saving}
                      onClick={() => run(() => tableApi.unreserve(sheet.table.id))}>
                <i className="fa-solid fa-calendar-xmark" aria-hidden="true" /> {t("rf.unreserve")}
              </button>
            </div>
          )}
          {sheet.mode === "reserve" && (
            <>
              <FormGroup label={t("rf.resvTime")}>
                <input type="time" className="form-input ek-num" value={form.at} autoFocus
                       onChange={(e) => setForm({ ...form, at: e.target.value })} />
              </FormGroup>
              <FormGroup label={t("rf.resvName")}>
                <Field className="form-input" maxLength={60} value={form.name}
                       onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </FormGroup>
              <FormGroup label={t("rf.resvGuests")}>
                <Field kind="int" className="form-input ek-num" value={form.guests}
                       onChange={(e) => setForm({ ...form, guests: e.target.value })} />
              </FormGroup>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
