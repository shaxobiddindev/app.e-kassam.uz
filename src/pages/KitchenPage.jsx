import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import "../lib/ek-rest-words";
import { kitchenApi } from "../api";
import { asArray } from "../lib/ek-array";
import { quantity } from "../lib/ek-format";
import { minutesSince } from "../lib/ek-table-order";
import { urgencyOf } from "../lib/ek-floor";
import { subscribeTables } from "../lib/ek-live";
import { roleSet } from "../lib/ek-roles";
import { SkeletonCards, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";

/* ══════════════════════════════════════════════════════════════════════════
   OSHXONA EKRANI (3-bosqich D5, prototip 5-ekran)

   Oshxonadagi monitor yoki planshet: «Oshxonaga yuborish»dan kelgan
   buyurtmalar sex bo'yicha, eng eskisi birinchi. «Tayyor» — zal (ofitsiant)
   darhol ko'radi.

   ⚠ YANGILANISH — JONLI OQIM, TAYMER EMAS: yangi buyurtma kelganda yoki
   boshqa ekranda «tayyor» bosilganda. Daqiqa hisoblagichi faqat raqamni
   yangilaydi — kartalar o'rni sakramaydi (egasi: «avtomatik yangilanib
   ketyapti»).
   ⚠ KECHIKISH RANG BILAN YOLG'IZ EMAS: «Yangi · Shoshiling · Kechikdi» matni.
   ══════════════════════════════════════════════════════════════════════════ */
const MANAGERS = ["OWNER", "SHOP_ADMIN", "ADMIN"];

export default function KitchenPage({ toast }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [station, setStation] = useState("all");
  const [now, setNow] = useState(Date.now());
  const [pending, setPending] = useState(null);
  const manager = MANAGERS.some((r) => roleSet(localStorage.getItem("ek_role") || "").has(r));

  const load = useCallback(() => {
    kitchenApi.tickets()
      .then((r) => { setTickets(asArray(r?.data)); setNow(Date.now()); })
      .catch((err) => toast?.error(err.message))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
    let soon = null;
    const off = subscribeTables((e) => {
      if (e.kind !== "kitchen" && e.kind !== "hello") return;
      clearTimeout(soon);
      soon = setTimeout(load, 200);
    });
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { off(); clearTimeout(soon); clearInterval(tick); };
  }, [load]);

  const fresh = tickets.filter((x) => x.status === "NEW");
  const readyCount = tickets.filter((x) => x.status === "READY").length;
  const stations = useMemo(() => [...new Set(fresh.map((x) => x.station))].sort(), [fresh]);
  const shown = fresh.filter((x) => station === "all" || x.station === station);

  const ready = async (tk) => {
    setPending(tk.id);
    try {
      await kitchenApi.ready(tk.id);
      setTickets((list) => list.map((x) => (x.id === tk.id ? { ...x, status: "READY" } : x)));
    } catch (err) {
      toast?.error(err.message);
      load();
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="kd">
      <header className="kd-head">
        <span className="kd-title"><i className="fa-solid fa-fire-burner" aria-hidden="true" /> {t("kd.title")}</span>
        <nav className="kd-tabs" role="tablist" aria-label={t("kd.stations")}>
          {["all", ...stations].map((s) => (
            <button key={s} type="button" role="tab" aria-selected={station === s}
                    className={`rt-pill${station === s ? " is-on" : ""}`} onClick={() => setStation(s)}>
              {s === "all" ? t("kd.all") : s}{" "}
              <span className="ek-num">{s === "all" ? fresh.length : fresh.filter((x) => x.station === s).length}</span>
            </button>
          ))}
        </nav>
        <div className="kd-head__end">
          <span className="kd-stat">{t("kd.readyWaiting")}: <b className="ek-num">{readyCount}</b></span>
          <button type="button" className="btn btn-outline" onClick={load} aria-label={t("common.refresh")}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" /> {t("common.refresh")}
          </button>
          {manager && (
            <button type="button" className="btn btn-outline" onClick={() => navigate("/restaurant")}>
              <i className="fa-solid fa-utensils" aria-hidden="true" /> {t("nav.restaurant")}
            </button>
          )}
        </div>
      </header>

      {busy ? <SkeletonCards count={6} /> : shown.length === 0 ? (
        <p className="kd-empty"><i className="fa-solid fa-check" aria-hidden="true" /> {t("kd.empty")}</p>
      ) : (
        <div className="kd-grid">
          {shown.map((tk) => {
            const min = minutesSince(tk.createdAt, now) ?? 0;
            const u = urgencyOf(tk.createdAt, now);
            const lines = [...asArray(tk.lines)].sort((a, b) => (a.course || 0) - (b.course || 0));
            let course = null;
            return (
              <article key={tk.id} className={`kd-card kd-card--${u}`} aria-label={`${tk.tableName || ""} — ${t(`kd.u.${u}`)}`}>
                <div className="kd-card__head">
                  <span>
                    <b>{tk.tableName || t("kd.noTable")}</b>
                    <small>{[tk.waiter, tk.station].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className="kd-card__age">
                    <b className="ek-num">{t("tbl.minutes", { n: min })}</b>
                    <small>{t(`kd.u.${u}`)}</small>
                  </span>
                </div>
                <div className="kd-card__body">
                  {lines.map((l, i) => {
                    const head = l.course && l.course !== course ? (course = l.course) : null;
                    return (
                      <div key={i}>
                        {head && <div className="kd-course">{t("rt.courseN", { n: head })}</div>}
                        {/* «BEKOR» (V162): rahbar bekor qildi — pishirmang. Rang yolg'iz
                            emas: «BEKOR» so'zi va chizilgan nom ham bor. */}
                        <div className="kd-line" style={l.voided ? { background: "var(--bg-danger-subtle)", borderRadius: 8, padding: "4px 6px" } : undefined}>
                          <span className="kd-line__q ek-num" style={l.voided ? { color: "var(--fg-danger)" } : undefined}>{quantity(l.quantity)}×</span>
                          <span className="kd-line__t">
                            {l.voided && <b style={{ color: "var(--fg-danger)", letterSpacing: ".04em" }}><i className="fa-solid fa-ban" aria-hidden="true" /> {t("void.kitchen")} — {t("void.kitchenHint")}</b>}
                            <b style={l.voided ? { textDecoration: "line-through", color: "var(--fg-danger)" } : undefined}>{l.name}{l.seat ? ` (M${l.seat})` : ""}</b>
                            {l.mods && <small>+ {l.mods}</small>}
                            {l.note && <small className="kd-note">! {l.note}</small>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" className="btn btn-green kd-ready" onClick={() => ready(tk)} disabled={pending === tk.id}>
                  {pending === tk.id ? <Spinner /> : <i className="fa-solid fa-check" aria-hidden="true" />} {t("kd.ready")}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
