import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { tableApi } from "../api";
import { money } from "../lib/ek-format";
import { asArray } from "../lib/ek-array";
import { minutesSince, elapsed } from "../lib/ek-table-order";
import { subscribeTables, isLive } from "../lib/ek-live";
import { isTerminal, lockNow } from "../lib/ek-terminal";
import { roleSet } from "../lib/ek-roles";
import { roleLabel } from "../lib/ek-labels";
import { autoPlace, byPlace, floorView, statusOf, attention, hhmm, atToday, openTables, freeCapacity, waiterLoad, planWidth, PLAN_MIN } from "../lib/ek-floor";
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
const ICON = { free: "fa-chair", busy: "fa-utensils", bill: "fa-receipt", resv: "fa-calendar-check",
               ready: "fa-bell-concierge", late: "fa-hourglass-half" };

/** Reja eni (ajratgich bilan tanlangan) — shu qurilmada eslab qolinadi. */
const PLAN_KEY = "ek.rf.planRatio";
const readRatio = () => {
  try { const v = Number(localStorage.getItem(PLAN_KEY)); return v > 0 && v < 1 ? v : null; } catch { return null; }
};
const saveRatio = (v) => {
  try { v == null ? localStorage.removeItem(PLAN_KEY) : localStorage.setItem(PLAN_KEY, String(v)); } catch { /* xotira yopiq */ }
};

const since = (min) => { const e = elapsed(min); return t(e.key, e.vars); };

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
  const placedTables = useMemo(() => byPlace(autoPlace(asArray(hall?.tables))), [hall]);
  /* ⚠ FAQAT STOLLAR EGALLAGAN QISM (V164), katta bo'shliqlar qisqargan va
     stol stullar zonasiga kirib chizilgan (2026-10-13, `ek-floor.floorView`). */
  const { view, items: placeOf } = useMemo(() => {
    const v = floorView(placedTables);
    return { view: v.view, items: new Map(v.items.map((i) => [i.id, i])) };
  }, [placedTables]);

  /* ⚠ REJA O'LCHAMI HAQIQIY BO'SH JOYDAN (2026-10-13). Ilgari bo'y
     `100dvh - 260px` deb TAXMIN qilinardi: zal deyarli kvadrat, ekran keng —
     reja bo'yga sig'ib, o'rtada tor turardi va ikki yoni bo'sh qolardi.
     Endi keng ekranda stat kartochkalari o'ng ustunda (bo'y rejaga qoladi),
     reja chapga yopishadi va o'ng ustun qolgan kenglikni oladi. */
  const mainRef = useRef(null);
  const bodyRef = useRef(null);
  const legendRef = useRef(null);
  const [size, setSize] = useState(null);
  const [ratio, setRatio] = useState(readRatio);
  const ar = view.w / view.h;
  useLayoutEffect(() => {
    const main = mainRef.current, body = bodyRef.current;
    if (!main || !body) return undefined;
    const measure = () => {
      if (matchMedia("(max-width: 640px)").matches) { setSize(null); return; }
      const wide = matchMedia("(min-width: 1100px)").matches;
      const top = body.getBoundingClientRect().top + window.scrollY;
      const legend = legendRef.current?.offsetHeight || 0;
      const availH = Math.max(300, window.innerHeight - top - legend - 26);
      const { w, max } = planWidth({ mainW: main.clientWidth, availH, ar, ratio, wide });
      setSize((old) => (old && Math.abs(old.w - w) < 1 && Math.abs(old.max - max) < 1 ? old : { w, h: w / ar, max }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [ar, hall, ratio]);

  /* Ajratgich: sudrash (sichqoncha va barmoq), strelkalar, ikki marta bosish — avtomatik. */
  /* ⚠ Bu yerda faqat NIYAT saqlanadi; chegarani `planWidth` har o'lchovda
     YANGIDAN qo'yadi. Ilgari sudrash boshidagi `size.max` ishlatilardi va u
     eskirardi: reja torayganda legend ikki qatorga o'tib, bo'y kamayardi —
     o'ngga qaytarishda reja 642 o'rniga 608 da to'xtardi. */
  const setPlanW = (w) => {
    const mainW = mainRef.current?.clientWidth || 1;
    const v = Math.min(0.99, Math.max(PLAN_MIN, w) / mainW);
    setRatio(v);
    return v;
  };
  const resetGrip = () => { setRatio(null); saveRatio(null); };
  /* ⚠ Ikki marta bosish QO'LDA aniqlanadi: `pointerdown` dagi
     `preventDefault` brauzerning `dblclick` ini bosib qo'yadi, sensorli
     ekranda esa u umuman yo'q (zal terminali — planshet). */
  const lastTap = useRef(0);
  const onGripDown = (e) => {
    if (!size) return;
    e.preventDefault();
    const now = Date.now();
    if (now - lastTap.current < 350) { lastTap.current = 0; resetGrip(); return; }
    lastTap.current = now;
    /* Boshlangan nuqtaga NISBATAN: chegara barmoq ostiga sakramaydi. */
    const startX = e.clientX, startW = size.w;
    /* ⚠ Tinglovchilar OYNADA, elementda emas: ko'rsatkich chegaradan o'zib
       ketsa (tez sudrash) element hodisani olmay qolardi va reja orqada
       qolardi — sinovda o'ngga surish 642 o'rniga 608 da to'xtagan. */
    let last = null;
    const move = (ev) => {
      if (Math.abs(ev.clientX - startX) < 2) return;
      lastTap.current = 0;
      last = setPlanW(startW + (ev.clientX - startX));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (last != null) saveRatio(last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const onGripKey = (e) => {
    if (!size) return;
    const step = e.shiftKey ? 80 : 24;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      saveRatio(setPlanW(Math.min(size.max, size.w + (e.key === "ArrowLeft" ? -step : step))));
    } else if (e.key === "Home" || e.key === "Escape") {
      e.preventDefault();
      setRatio(null); saveRatio(null);
    }
  };

  const all = useMemo(() => halls.flatMap((h) => asArray(h.tables)), [halls]);
  const alerts = useMemo(() => attention(halls, now), [halls, now]);
  const opened = useMemo(() => openTables(halls, now), [halls, now]);
  const free = useMemo(() => freeCapacity(halls), [halls]);
  const waiters = useMemo(() => waiterLoad(halls), [halls]);
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
    const st = statusOf(tb, now);
    if (tb.order) return openOrder(tb);
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
    const st = statusOf(tb, now);
    const who = o?.openedByName || o?.openedBy || "";
    if (st === "ready") return [t("rf.readyN", { n: o.kitchenReady }), `${money(o.total)}${who ? ` · ${who}` : ""}`];
    if (st === "late") return [t("rf.lateMin", { n: minutesSince(o.kitchenWaitingSince, now) }), `${money(o.total)}${who ? ` · ${who}` : ""}`];
    if (st === "bill") return [t("rf.billGiven"), `${money(o.total)}${who ? ` · ${who}` : ""}`];
    if (st === "busy") return [money(o.total), `${since(minutesSince(o.openedAt, now))}${who ? ` · ${who}` : ""}`];
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

      <div className="rf-main" ref={mainRef} style={size ? { "--rf-w": `${Math.round(size.w)}px` } : undefined}>
        <div className="rf-stats">
          <div><small>{t("rf.busy")}</small><b className="ek-num">{stats.busy} / {stats.total}</b></div>
          <div><small>{t("rf.guests")}</small><b className="ek-num">{stats.guests}</b></div>
          <div><small>{t("rf.open")}</small><b className="ek-num">{money(stats.open)}</b></div>
        </div>

        <main className="rf-body" ref={bodyRef}>
          {busy ? (
            <SkeletonTiles count={12} />
          ) : !hall ? (
            <p className="rf-empty">{manager ? t("tbl.none") : t("rf.noneStaff")}</p>
          ) : (
            <div className="rf-plan" aria-label={t("rf.plan")}
                 style={{ "--rf-ar": `${view.w} / ${view.h}` }}>
              {placedTables.map((tb) => {
                const st = statusOf(tb, now);
                const [l1, l2] = line(tb);
                const at = placeOf.get(tb.id);
                const dim = mine && (!tb.order || tb.order.openedBy !== me);
                return (
                  <button key={tb.id} type="button"
                          className={`rf-table rf-table--${st} rf-shape--${String(tb.shape || "SQUARE").toLowerCase()}${dim ? " is-dim" : ""}`}
                          style={at ? { left: `${at.left}%`, top: `${at.top}%`, width: `${at.width}%`, height: `${at.height}%` } : undefined}
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
          <div className="rf-legend" aria-hidden="true" ref={legendRef}>
            {["free", "busy", "ready", "late", "bill", "resv"].map((st) => (
              <span key={st}><span className={`rf-sw rf-table--${st}`} /> {t(`rf.st.${st}`)}</span>
            ))}
          </div>
        </main>

        <div className="rf-grip" role="separator" aria-orientation="vertical" tabIndex={0}
             aria-label={t("rf.resize")} title={t("rf.resizeHint")}
             aria-valuemin={PLAN_MIN} aria-valuemax={Math.round(size?.max || PLAN_MIN)} aria-valuenow={Math.round(size?.w || PLAN_MIN)}
             onPointerDown={onGripDown} onKeyDown={onGripKey} onDoubleClick={resetGrip}>
          <span className="rf-grip__bar" aria-hidden="true" />
        </div>

        <aside className="rf-side" aria-label={t("rf.attention")}>
          <h2>{t("rf.attention")}</h2>
          {alerts.length === 0 ? (
            <p className="rf-empty">{t("rf.allCalm")}</p>
          ) : alerts.map((a) => (
            <button key={`${a.kind}-${a.table.id}`} type="button" className={`rf-alert rf-table--${a.kind}`} onClick={() => pick(a.table)}>
              <span className="rf-alert__top">
                <b>{a.table.name}{halls.length > 1 ? ` · ${a.hall.name}` : ""}</b>
                <span className="ek-num">{a.kind === "bill" ? since(minutesSince(a.table.order.billAt, now))
                  : a.kind === "late" ? t("tbl.minutes", { n: minutesSince(a.table.order.kitchenWaitingSince, now) })
                  : a.kind === "ready" ? t("rf.now") : hhmm(a.table.reservation.at)}</span>
              </span>
              <span>{a.kind === "bill" ? t("rf.alertBill") : a.kind === "ready" ? t("rf.alertReady", { n: a.table.order.kitchenReady })
                : a.kind === "late" ? t("rf.alertLate") : t("rf.alertResv", { name: a.table.reservation.name || "—" })}</span>
            </button>
          ))}
        </aside>

        {/* O'ng ustunning qolgan bo'yi (2026-10-13, egasi: «bo'sh qolmasin»):
            ochiq stollar — eng uzoq ochig'i tepada, keyin ofitsiantlar yuki. */}
        <aside className="rf-open" aria-label={t("rf.openTables")}>
          <section className="rf-open__part rf-open__part--grow">
            <h2>{t("rf.openTables")} <span className="ek-num">{opened.length}</span></h2>
            {opened.length === 0 ? (
              <p className="rf-empty">{t("rf.openNone")}</p>
            ) : (
              <div className="rf-open__list">
                {opened.map((o) => (
                  <button key={o.table.id} type="button" className={`rf-open__row${o.long ? " is-long" : ""}`} onClick={() => pick(o.table)}>
                    <span className="rf-open__name"><b>{o.table.name}</b>{halls.length > 1 ? ` · ${o.hall.name}` : ""}
                      {o.long && <span className="rf-open__flag"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {t("rf.longOpen")}</span>}
                    </span>
                    <span className="rf-open__who">{o.who || t("rf.noWaiter")}</span>
                    <span className="rf-open__time ek-num">{o.min == null ? "—" : since(o.min)}</span>
                    <span className="rf-open__sum ek-num">{money(o.total)}</span>
                  </button>
                ))}
              </div>
            )}
            {free.tables > 0 && <p className="rf-open__free">{t("rf.freeCap", { n: free.tables, seats: free.seats })}</p>}
          </section>
          {waiters.length > 0 && (
            <section className="rf-open__part">
              <h2>{t("rf.waiters")}</h2>
              {waiters.map((w) => (
                <div key={w.who || "-"} className="rf-open__wait">
                  <span>{w.who || t("rf.noWaiter")}</span>
                  <span className="ek-num">{t("rf.waiterTables", { n: w.tables })} · {money(w.total)}</span>
                </div>
              ))}
            </section>
          )}
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
