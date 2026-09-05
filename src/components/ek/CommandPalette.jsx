import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Overlay from "./Overlay";
import { useT } from "../../lib/ek-i18n";
import { normSearch } from "../../lib/ek-search";
import { roleSet } from "../../lib/ek-roles";
import { NAV } from "../Layout";
import { productApi, customerApi } from "../../api";
import { money } from "../../utils";

/* ══════════════════════════════════════════════════════════════════════════
   BUYRUQ QATORI — Ctrl+K (V74)

   ═══ NEGA KERAK ═════════════════════════════════════════════════════════

   Do'konda kunlik ish bir xil: bir tovarni qidirish, bir mijozning
   qarzini ko'rish, bir bo'limga o'tish. Har biri uchun menyuni ochish,
   guruhni yoyish, sahifani kutish va yana qidirish kerak edi — kuniga
   o'nlab marta.

   Ctrl+K esa qayerda bo'lsangiz ham bitta oynani ochadi va yozganingiz
   bo'yicha HAM bo'limni, HAM tovarni, HAM mijozni topadi.

   ═══ IKKI TEZLIKDA ISHLAYDI ═════════════════════════════════════════════

   Bo'limlar va amallar — MAHALLIY ro'yxat, ya'ni javob bir zumda
   chiqadi. Tovar va mijoz esa serverdan keladi va KECHIKTIRILADI: har
   harfda so'rov yuborish do'kondagi sekin internetni bo'g'ib qo'yardi
   va natija baribir eskisi ustiga tushardi.

   ⚠ Natijalar KELGANDA ham, so'rov ESKIRGAN bo'lsa tashlanadi
   (`seq` hisoblagichi). Aks holda sekin javob tez javobning ustiga
   chiqib, foydalanuvchi yozib bo'lgan so'zga BOSHQA natija ko'rsatardi.
   ══════════════════════════════════════════════════════════════════════════ */

const DEBOUNCE = 220;
const LIMIT_SECTION = 6;

/** Menyudagi barcha bandlar — guruhlar yoyilgan holda, rolga qarab. */
function pagesFor(role, t) {
  const set = roleSet(role);
  const flat = [];
  for (const item of NAV) {
    for (const child of item.children || [item]) {
      if (child.roles && !child.roles.some((r) => set.has(r))) continue;
      flat.push({
        id: `page:${child.id}`,
        icon: child.icon || "fa-arrow-right",
        title: t(child.key),
        /* Guruh nomi ostida ko'rsatiladi: «Ombor → Sanoq» — bitta
           so'zli bandlar (masalan «Narxlar») yolg'iz turganda qaysi
           bo'limga tegishli ekani ko'rinmasdi. */
        sub: item.children ? t(item.key) : null,
        to: child.path,
      });
    }
  }
  return flat;
}

/** Tezkor amallar — sahifaga emas, ISHGA olib boradi. */
function actionsFor(role, t) {
  const set = roleSet(role);
  const can = (...rs) => rs.some((r) => set.has(r));
  const out = [];
  if (can("OWNER", "SHOP_ADMIN", "ADMIN", "CASHIER"))
    out.push({ id: "act:sale", icon: "fa-cash-register", title: t("dash.qaSale"), to: "/sale" });
  if (can("OWNER", "SHOP_ADMIN", "ADMIN", "STOREKEEPER"))
    out.push({ id: "act:product", icon: "fa-plus", title: t("dash.qaProduct"), to: "/products?new=1" });
  if (can("OWNER", "SHOP_ADMIN", "ADMIN", "STOREKEEPER"))
    out.push({ id: "act:supply", icon: "fa-truck-ramp-box", title: t("dash.qaSupply"), to: "/supply?new=1" });
  if (can("OWNER", "SHOP_ADMIN", "ADMIN"))
    out.push({ id: "act:expense", icon: "fa-money-bill-wave", title: t("dash.qaExpense"), to: "/expenses?new=1" });
  if (can("OWNER", "SHOP_ADMIN"))
    out.push({ id: "act:report", icon: "fa-chart-bar", title: t("dash.qaReport"), to: "/reports" });
  return out;
}

/** Mahalliy ro'yxatdan tanlash — normalizatsiya `normSearch` da. */
function pick(list, q) {
  if (!q) return list.slice(0, LIMIT_SECTION);
  const n = normSearch(q);
  return list
    .filter((x) => normSearch(`${x.title} ${x.sub || ""}`).includes(n))
    .slice(0, LIMIT_SECTION);
}

export default function CommandPalette({ open, onClose, role, branchId }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState({ products: [], customers: [] });
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const seq = useRef(0);

  const pages = useMemo(() => pagesFor(role, t), [role, t]);
  const actions = useMemo(() => actionsFor(role, t), [role, t]);

  /* Ochilganda maydonga fokus va eski qidiruvni tozalash. */
  useEffect(() => {
    if (!open) return;
    setQ(""); setRemote({ products: [], customers: [] }); setCursor(0);
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [open]);

  /* ── Serverdagi qidiruv ────────────────────────────────────────────
     ⚠ Ikki himoya: kechiktirish (har harfda so'rov yo'q) va navbat
     raqami (eskirgan javob yangisining ustiga chiqmaydi). */
  useEffect(() => {
    if (!open) return;
    const text = q.trim();
    if (text.length < 2) { setRemote({ products: [], customers: [] }); setBusy(false); return; }

    const mine = ++seq.current;
    setBusy(true);
    const id = setTimeout(() => {
      Promise.all([
        productApi.search(text, 0, LIMIT_SECTION, branchId).then((r) => r.data?.content || r.data || []).catch(() => []),
        customerApi.getAll(branchId).then((r) => r.data || []).catch(() => []),
      ]).then(([products, customers]) => {
        if (mine !== seq.current) return;      // eskirgan javob — tashlanadi
        const n = normSearch(text);
        setRemote({
          products: products.slice(0, LIMIT_SECTION),
          customers: customers
            .filter((c) => normSearch(`${c.fullName || ""} ${c.phone || ""}`).includes(n))
            .slice(0, LIMIT_SECTION),
        });
        setBusy(false);
      });
    }, DEBOUNCE);
    return () => clearTimeout(id);
  }, [q, open, branchId]);

  /* Barcha natijalar bitta tekis ro'yxatda — klaviatura shu bo'yicha yuradi. */
  const groups = useMemo(() => {
    const g = [];
    const acts = pick(actions, q);
    if (acts.length) g.push({ key: "actions", title: t("dash.cmdActions"), items: acts });
    const pgs = pick(pages, q);
    if (pgs.length) g.push({ key: "pages", title: t("dash.cmdPages"), items: pgs });
    if (remote.products.length) g.push({
      key: "products", title: t("dash.cmdProducts"),
      items: remote.products.map((p) => ({
        id: `p:${p.id}`, icon: "fa-box", title: p.name,
        sub: p.salePrice != null ? money(p.salePrice) : null,
        to: `/products?q=${encodeURIComponent(p.name || "")}`,
      })),
    });
    if (remote.customers.length) g.push({
      key: "customers", title: t("dash.cmdCustomers"),
      items: remote.customers.map((c) => ({
        id: `c:${c.id}`, icon: "fa-user", title: c.fullName || c.phone,
        sub: Number(c.balance) > 0 ? money(c.balance) : null,
        to: `/customers?q=${encodeURIComponent(c.fullName || c.phone || "")}`,
      })),
    });
    return g;
  }, [actions, pages, remote, q, t]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  /* Ro'yxat qisqarganda kursor tashqarida qolmasin. */
  useEffect(() => { setCursor((c) => Math.min(c, Math.max(0, flat.length - 1))); }, [flat.length]);

  const go = (item) => { if (!item) return; onClose(); navigate(item.to); };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(flat[cursor]); }
  };

  if (!open) return null;

  let idx = -1;
  return (
    <Overlay className="cmd__back" onEscape={onClose}>
      <div className="cmd" role="dialog" aria-modal="true" aria-label={t("dash.cmdTitle")}>
        <div className="cmd__head">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input
            ref={inputRef}
            className="cmd__input"
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={onKey}
            placeholder={t("dash.cmdPlaceholder")}
            aria-label={t("dash.cmdPlaceholder")}
          />
          {busy && <span className="cmd__busy" aria-hidden="true" />}
          <button type="button" className="cmd__x" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="cmd__body">
          {flat.length === 0 ? (
            <div className="cmd__empty">{t("dash.cmdEmpty")}</div>
          ) : groups.map((g) => (
            <div key={g.key} className="cmd__group">
              <div className="cmd__gtitle">{g.title}</div>
              {g.items.map((it) => {
                idx++;
                const active = idx === cursor;
                const my = idx;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`cmd__row${active ? " is-active" : ""}`}
                    onMouseEnter={() => setCursor(my)}
                    onClick={() => go(it)}
                  >
                    <i className={`fa-solid ${it.icon}`} aria-hidden="true" />
                    <span className="cmd__t">{it.title}</span>
                    {it.sub && <span className="cmd__s">{it.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="cmd__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> {t("dash.cmdMove")}</span>
          <span><kbd>Enter</kbd> {t("dash.cmdOpen")}</span>
          <span><kbd>Esc</kbd> {t("common.close")}</span>
        </div>
      </div>
    </Overlay>
  );
}
