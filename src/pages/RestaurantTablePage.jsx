import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { tableApi, productApi, modifierApi } from "../api";
import { money } from "../lib/ek-format";
import { asArray } from "../lib/ek-array";
import { roleSet } from "../lib/ek-roles";
import { linesOf, sigOf, itemsFrom, seatKey, minutesSince } from "../lib/ek-table-order";
import { groupsFor, lineFor, modsText } from "../lib/ek-modifiers";
import { stationMap, kitchenTickets } from "../lib/ek-kitchen";
import { printKitchen } from "../lib/ek-hardware";
import { isDesktop } from "../lib/ek-desktop";
import { isTerminal, lockNow } from "../lib/ek-terminal";
import { subscribeTables } from "../lib/ek-live";
import { useShopFeatures } from "../hooks/useShopFeatures";
import ModifierModal from "../components/ModifierModal";
import { Modal } from "../components";
import { SkeletonTiles, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";

/* ══════════════════════════════════════════════════════════════════════════
   STOL — restoranning buyurtma ekrani (3-bosqich D3, prototip 3-ekran)

   Do'kon kassasidan farqi: menyu bo'limlari katta tugmalar, har taom QAYSI
   MEHMONGA (M1…) va QAYSI KURSGA, izoh; buyurtma ikki bo'lim — «oshxonada»
   (ketgani) va «yangi». Asosiy tugma — «Oshxonaga yuborish»: faqat yangi
   qism oshxona chekiga chiqadi, server buni o'zi belgilaydi.

   ⚠ YUBORILGANNI KAMAYTIRISH — faqat rahbar (server ham rad etadi): taom
   pishyapti, jimgina o'chirish pul bilan bog'liq.
   ⚠ HAR O'ZGARISH 700 ms dan keyin serverga (versiya bilan); boshqa qurilma
   yozgan bo'lsa 409 — yangisi yuklanadi, ustidan yozilmaydi.
   ⚠ TO'LOV BU YERDA EMAS: kassir «To'lov» bilan kassaga o'tadi (chek, fiskal,
   xizmat haqi — o'sha yo'l). Ofitsiantda u tugma yo'q.
   ══════════════════════════════════════════════════════════════════════════ */
const MANAGERS = ["OWNER", "SHOP_ADMIN", "ADMIN"];
const COURSES = [1, 2, 3];

export default function RestaurantTablePage({ toast }) {
  const { id } = useParams();
  const tableId = Number(id);
  const navigate = useNavigate();
  const { has: hasFeature } = useShopFeatures();
  const role = localStorage.getItem("ek_role") || "";
  const fullName = localStorage.getItem("ek_fullName") || "";
  const roles = roleSet(role);
  const manager = MANAGERS.some((r) => roles.has(r));
  const canPay = manager || roles.has("CASHIER");

  const [order, setOrder] = useState(null);         // server ko'rinishi (id, version, tableName …)
  const [items, setItems] = useState([]);
  const [guests, setGuests] = useState(1);
  const [savedSig, setSavedSig] = useState("");
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [cats, setCats] = useState([]);
  const [stations, setStations] = useState(new Map());
  const [catId, setCatId] = useState(null);
  const [menu, setMenu] = useState([]);
  const [query, setQuery] = useState("");
  const [modGroups, setModGroups] = useState([]);
  const [modModal, setModModal] = useState(null);
  const [seat, setSeat] = useState(0);
  const [course, setCourse] = useState(1);
  const [noteFor, setNoteFor] = useState(null);     // { key, text }
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [now, setNow] = useState(Date.now());
  const versionRef = useRef(0);
  const savingRef = useRef(false);
  const stateRef = useRef({});
  stateRef.current = { items, guests, savedSig };

  /* ── yuklash ── */
  const productsFor = async (o) => {
    const ids = [...new Set((o?.lines || []).map((l) => l.productId))];
    const got = await Promise.all(ids.map((pid) => productApi.getById(pid).then((r) => r?.data).catch(() => null)));
    return new Map(got.filter(Boolean).map((p) => [String(p.id), p]));
  };
  const apply = useCallback(async (o, groups) => {
    const { items: list, missing } = itemsFrom(o, await productsFor(o), groups);
    if (missing) toast?.error(t("tbl.missing", { n: missing }));
    versionRef.current = o.version;
    setOrder(o);
    setItems(list);
    setGuests(o.guests || 1);
    setSavedSig(sigOf(list, { guests: o.guests || 1 }));
  }, [toast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const groups = hasFeature("MODIFIERS") ? asArray((await modifierApi.list().catch(() => null))?.data) : [];
        if (!alive) return;
        setModGroups(groups);
        const o = (await tableApi.open(tableId))?.data;
        if (!alive || !o) return;
        await apply(o, groups);
      } catch (err) {
        toast?.error(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    productApi.getCategories().then((r) => {
      const all = asArray(r?.data);
      setStations(stationMap(all));
      const list = all.filter((c) => c.productCount > 0);
      setCats(list);
      setCatId((cur) => cur ?? list[0]?.id ?? null);
    }).catch(() => {});
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { alive = false; clearInterval(tick); };
  }, [tableId]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = query.trim();
    if (!q && catId == null) return undefined;
    const timer = setTimeout(() => {
      productApi.search(q, 0, 120, undefined, q ? {} : { categoryId: catId })
        .then((r) => setMenu(asArray(r?.data)))
        .catch(() => {});
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [catId, query]);

  /* ── serverga yozish (700 ms) ── */
  const sig = sigOf(items, { guests });
  const dirty = order && sig !== savedSig;
  const save = useCallback(async () => {
    const { items: cur, guests: g } = stateRef.current;
    if (!order || savingRef.current) return false;
    savingRef.current = true;
    const curSig = sigOf(cur, { guests: g });
    try {
      const total = cur.reduce((s, i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0);
      const r = await tableApi.save(order.id, { version: versionRef.current, guests: g, total, lines: linesOf(cur) });
      versionRef.current = r?.data?.version ?? versionRef.current + 1;
      setSavedSig(curSig);
      return true;
    } catch (err) {
      toast?.error(err.message);
      /* 409 — boshqa qurilma yozgan; 400 — masalan ketgan taom kamaytirildi:
         ikkalasida ham serverdagi holat qaytariladi (ekran yolg'on gapirmasin). */
      if (err?.status === 409 || err?.status === 400) {
        const o = (await tableApi.get(order.id).catch(() => null))?.data;
        if (o?.status === "OPEN") await apply(o, modGroups);
        else if (o) navigate("/restaurant");
      }
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [order, toast, apply, modGroups, navigate]);

  useEffect(() => {
    if (!dirty) return undefined;
    const timer = setTimeout(save, 700);
    return () => clearTimeout(timer);
  }, [sig, dirty, save]);

  /* ── jonli: boshqa qurilma o'zgartirdi ── */
  useEffect(() => {
    if (!order) return undefined;
    return subscribeTables(async (e) => {
      if (e.kind !== "order" || e.orderId !== order.id) return;
      const st = stateRef.current;
      if (savingRef.current || sigOf(st.items, { guests: st.guests }) !== st.savedSig) return;
      if (e.status !== "OPEN") { toast?.info(t("rt.closedElsewhere")); navigate("/restaurant"); return; }
      if (Number(e.version) <= versionRef.current) return;
      const o = (await tableApi.get(order.id).catch(() => null))?.data;
      if (o?.status === "OPEN") await apply(o, modGroups);
    });
  }, [order, apply, modGroups, navigate, toast]);

  /* ── taom qo'shish ── */
  const addLine = (product, mods = []) => {
    const line = { ...lineFor(product, mods), seat: seat || undefined, course };
    const key = seatKey(line);
    setJustSent(false);
    setItems((list) => {
      const same = list.find((x) => seatKey(x) === key);
      if (same) return list.map((x) => (x === same ? { ...x, qty: Number(x.qty) + 1 } : x));
      return [...list, { ...line, _key: key, qty: 1 }];
    });
  };
  const pick = (p) => {
    const groups = groupsFor(modGroups, p.id);
    if (groups.length) setModModal({ product: p, groups });
    else addLine(p);
  };
  const step = (key, d) => setItems((list) => list
    .map((x) => (seatKey(x) === key ? { ...x, qty: Math.max(Number(x.sentQty) || 0, Number(x.qty) + d) } : x))
    .filter((x) => Number(x.qty) > 0));
  const setNote = (key, text) => setItems((list) => {
    const src = list.find((x) => seatKey(x) === key);
    if (!src) return list;
    /* Ketgan qism izohi o'zgarmaydi (oshxonada) — izoh faqat yangi qismga:
       qator ikkiga bo'linadi. */
    const sent = Number(src.sentQty) || 0;
    const fresh = { ...src, note: text || undefined, qty: Number(src.qty) - sent, sentQty: 0, sentAt: null };
    fresh._key = seatKey(fresh);
    const rest = list.filter((x) => x !== src);
    return sent > 0 ? [...rest, { ...src, qty: sent }, fresh] : [...rest, fresh];
  });

  /* ── oshxonaga yuborish ── */
  const send = async () => {
    if (!order || sending) return;
    setSending(true);
    try {
      if (dirty && !(await save())) return;
      const r = (await tableApi.send(order.id, { version: versionRef.current }))?.data;
      const products = await productsFor({ lines: r.sent });
      const groups = modGroups;
      const opts = new Map(); for (const g of groups) for (const op of g.options || []) opts.set(Number(op.id), op);
      const cart = r.sent.map((l) => {
        const p = products.get(String(l.productId));
        return p ? { ...lineFor(p, (l.modifierIds || []).map((x) => opts.get(Number(x))).filter(Boolean)),
                     qty: Number(l.quantity), seat: l.seat, course: l.course, note: l.note } : null;
      }).filter(Boolean);
      await apply(r.order, groups);
      if (hasFeature("KITCHEN") && isDesktop()) {
        const tickets = kitchenTickets(cart, stations);
        if (tickets.length) {
          printKitchen(tickets, { orderNo: r.order.tableName, at: new Date(), cashier: fullName,
                                  note: t("rt.ticketNote", { guests }) })
            .then((res) => {
              if (res.failed.length) toast?.error(t("kit.failed", { names: res.failed.map((f) => f.station).join(", ") }));
              else if (res.missing.length) toast?.error(t("kit.missing", { names: res.missing.join(", ") }));
            })
            .catch((err) => toast?.error(`${t("kit.title")}: ${err.message}`));
        }
      }
      toast?.success(t("rt.sent", { n: r.sent.length }));
      setJustSent(true);
      /* Umumiy monitorda yuborgach ekran o'zi qulflanadi (prototip). */
      if (isTerminal()) setTimeout(lockNow, 3000);
    } catch (err) {
      toast?.error(err.message);
      if (err?.status === 409) {
        const o = (await tableApi.get(order.id).catch(() => null))?.data;
        if (o?.status === "OPEN") await apply(o, modGroups);
      }
    } finally {
      setSending(false);
    }
  };

  const markBill = async () => {
    if (dirty && !(await save())) return;
    try {
      const r = await tableApi.bill(order.id);
      versionRef.current = r?.data?.version ?? versionRef.current + 1;
      toast?.success(t("rf.billDone", { name: order.tableName }));
    } catch (err) { toast?.error(err.message); }
  };
  const goPay = async () => {
    if (dirty && !(await save())) return;
    navigate(`/sale?table=${tableId}`);
  };

  /* ── ko'rinish ── */
  const sentRows = items.filter((x) => Number(x.sentQty) > 0);
  const newRows = items.filter((x) => Number(x.qty) - (Number(x.sentQty) || 0) > 0);
  const newCount = newRows.reduce((s, x) => s + Number(x.qty) - (Number(x.sentQty) || 0), 0);
  const total = useMemo(() => items.reduce((s, i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0), [items]);
  const meta = (x) => [x.seat ? `M${x.seat}` : t("rt.all"), x.course ? t("rt.courseN", { n: x.course }) : "", modsText(x), x.note || ""]
    .filter(Boolean).join(" · ");
  const seats = [0, ...Array.from({ length: Math.max(1, guests) }, (_, i) => i + 1)];

  return (
    <div className="rt">
      <header className="rt-head">
        <button type="button" className="btn btn-outline rt-back" onClick={() => navigate("/restaurant")}>
          <i className="fa-solid fa-chevron-left" aria-hidden="true" /> {t("nav.restaurant")}
        </button>
        <div className="rt-title">
          <b>{order?.tableName || "…"}</b>
          <small>
            {order?.hallName}{order?.openedAt ? ` · ${t("tbl.minutes", { n: minutesSince(order.openedAt, now) })}` : ""}
            {dirty ? ` · ${t("rt.saving")}` : ""}
          </small>
        </div>
        <div className="rt-guests" role="group" aria-label={t("rt.guests")}>
          <button type="button" aria-label={t("rt.guestLess")} onClick={() => setGuests((g) => Math.max(1, g - 1))}>−</button>
          <span><b className="ek-num">{guests}</b> {t("rt.guestsShort")}</span>
          <button type="button" aria-label={t("rt.guestMore")} onClick={() => setGuests((g) => Math.min(30, g + 1))}>+</button>
        </div>
        {isTerminal() && (
          <button type="button" className="rf-lock rt-lock" onClick={lockNow} aria-label={t("term.lockNow")}>
            <i className="fa-solid fa-lock" aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="rt-main">
        <nav className="rt-cats" aria-label={t("rt.menu")}>
          {cats.map((c) => (
            <button key={c.id} type="button" className={`rt-cat${c.id === catId && !query ? " is-on" : ""}`}
                    onClick={() => { setQuery(""); setCatId(c.id); }}>
              {c.name}<small className="ek-num">{c.productCount}</small>
            </button>
          ))}
        </nav>

        <section className="rt-menu">
          <div className="rt-tools">
            <label className="rt-search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              <input type="text" value={query} placeholder={t("rt.search")} aria-label={t("rt.search")}
                     onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="rt-pills" role="group" aria-label={t("rt.forWhom")}>
              <span>{t("rt.forWhom")}</span>
              {seats.map((s) => (
                <button key={s} type="button" className={`rt-pill${seat === s ? " is-on" : ""}`} aria-pressed={seat === s}
                        onClick={() => setSeat(s)}>{s ? `M${s}` : t("rt.all")}</button>
              ))}
            </div>
            <div className="rt-pills" role="group" aria-label={t("rt.course")}>
              <span>{t("rt.course")}</span>
              {COURSES.map((c) => (
                <button key={c} type="button" className={`rt-pill${course === c ? " is-on" : ""}`} aria-pressed={course === c}
                        onClick={() => setCourse(c)}><span className="ek-num">{c}</span></button>
              ))}
            </div>
          </div>
          {busy ? <SkeletonTiles count={12} /> : (
            <div className="rt-dishes">
              {menu.map((p) => (
                <button key={p.id} type="button" className="rt-dish" onClick={() => pick(p)}>
                  <span className="rt-dish__name">{p.name}</span>
                  <span className="rt-dish__price ek-num">{money(p.salePrice)}</span>
                </button>
              ))}
              {menu.length === 0 && <p className="rf-empty">{t("rt.noDishes")}</p>}
            </div>
          )}
        </section>

        <aside className="rt-order" aria-label={t("rt.order")}>
          <div className="rt-order__list">
            {sentRows.length > 0 && (
              <h3 className="rt-sec"><i className="fa-solid fa-lock" aria-hidden="true" /> {manager ? t("rt.sentMgr") : t("rt.sent2")}</h3>
            )}
            {sentRows.map((x) => (
              <div key={`s-${seatKey(x)}`} className="rt-line rt-line--sent">
                <span className="rt-line__q ek-num">{Number(x.sentQty)}×</span>
                <span className="rt-line__t"><b>{x.name}</b><small>{meta(x)}</small></span>
                <span className="rt-chip">{t("rt.sentAt", { time: x.sentAt ? new Date(x.sentAt).toTimeString().slice(0, 5) : "" })}</span>
              </div>
            ))}
            <h3 className="rt-sec rt-sec--new">{t("rt.newSec")}</h3>
            {newRows.length === 0 && <p className="rt-empty">{t("rt.tapDish")}</p>}
            {newRows.map((x) => {
              const key = seatKey(x);
              const fresh = Number(x.qty) - (Number(x.sentQty) || 0);
              return (
                <div key={`n-${key}`} className="rt-line rt-line--new">
                  <button type="button" className="rt-step" aria-label={t("rt.less", { name: x.name })} onClick={() => step(key, -1)}>−</button>
                  <span className="rt-line__q ek-num">{fresh}</span>
                  <button type="button" className="rt-step" aria-label={t("rt.more", { name: x.name })} onClick={() => step(key, 1)}>+</button>
                  <span className="rt-line__t"><b>{x.name}</b><small>{meta(x)}</small></span>
                  <button type="button" className="rt-step rt-note" aria-label={t("rt.noteFor", { name: x.name })}
                          onClick={() => setNoteFor({ key, text: x.note || "" })}>
                    <i className="fa-solid fa-comment" aria-hidden="true" />
                  </button>
                  <span className="rt-line__sum ek-num">{money(Number(x.salePrice) * fresh)}</span>
                </div>
              );
            })}
          </div>
          <div className="rt-foot">
            <div className="rt-total"><span>{t("rt.total")}</span><b className="ek-num">{money(total)}</b></div>
            {justSent && isTerminal() && <div className="ek-note ek-note--success rt-sentnote" role="status">{t("rt.sentLock")}</div>}
            <button type="button" className="btn btn-primary rt-send" onClick={send} disabled={sending || newCount === 0}>
              {sending ? <Spinner /> : <i className="fa-solid fa-paper-plane" aria-hidden="true" />}
              {t("rt.send")} <span className="ek-num">({newCount})</span>
            </button>
            <div className="rt-actions">
              <button type="button" className="btn btn-outline" onClick={markBill} disabled={!items.length}>
                <i className="fa-solid fa-receipt" aria-hidden="true" /> {t("rf.billBtn")}
              </button>
              {canPay ? (
                <button type="button" className="btn btn-green" onClick={goPay} disabled={!items.length}>
                  <i className="fa-solid fa-wallet" aria-hidden="true" /> {t("rt.pay")}
                </button>
              ) : (
                <button type="button" className="btn btn-outline" disabled title={t("rf.waiterNoPay")}>
                  <i className="fa-solid fa-user-tie" aria-hidden="true" /> {t("rf.waiterNoPay")}
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {modModal && (
        <ModifierModal product={modModal.product} groups={modModal.groups}
                       onConfirm={(mods) => { addLine(modModal.product, mods); setModModal(null); }}
                       onClose={() => setModModal(null)} />
      )}
      {noteFor && (
        <Modal title={t("rt.noteTitle")} onClose={() => setNoteFor(null)} maxWidth={420}
               footer={
                 <>
                   <button className="btn btn-outline btn-sm" onClick={() => setNoteFor(null)}>{t("common.cancel")}</button>
                   <button className="btn btn-primary btn-sm" onClick={() => { setNote(noteFor.key, noteFor.text.trim()); setNoteFor(null); }}>
                     <i className="fa-solid fa-check" aria-hidden="true" /> {t("common.save")}
                   </button>
                 </>
               }>
          <div className="rt-quick">
            {["rt.q1", "rt.q2", "rt.q3", "rt.q4"].map((k) => (
              <button key={k} type="button" className="btn btn-outline btn-sm" onClick={() => setNoteFor({ ...noteFor, text: t(k) })}>{t(k)}</button>
            ))}
          </div>
          <textarea className="form-input" rows={3} maxLength={120} value={noteFor.text} autoFocus aria-label={t("rt.noteTitle")}
                    onChange={(e) => setNoteFor({ ...noteFor, text: e.target.value })} />
        </Modal>
      )}
    </div>
  );
}
