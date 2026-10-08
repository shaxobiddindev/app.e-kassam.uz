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
import { SkeletonTiles } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";

/* ══════════════════════════════════════════════════════════════════════════
   ZAL — restoranning bosh ekrani (3-bosqich D1, prototip 2-ekran)

   Do'kon kassasidan farqi: birinchi ekran MAHSULOT EMAS, ZAL. Ofitsiant
   stolni bosadi va buyurtma shu stol yorlig'ida ochiladi.

   ⚠ HOLAT RANG BILAN YOLG'IZ EMAS (6-qoida): band stolda summa, vaqt va
   ofitsiant matni, bo'shida «Bo'sh · N o'rin». ⚠ Plitka ≥ 96px (kassir
   ekrani ≥ 56px).

   D2 da: rejadagi joy va shakl, «hisob berildi / kechikmoqda / tayyor /
   bron» holatlari va diqqat ro'yxati.
   ══════════════════════════════════════════════════════════════════════════ */
const MANAGERS = ["OWNER", "SHOP_ADMIN", "ADMIN"];

export default function RestaurantFloorPage() {
  const navigate = useNavigate();
  const [halls, setHalls] = useState([]);
  const [hallId, setHallId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(false);
  const [now, setNow] = useState(Date.now());
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
  const all = useMemo(() => halls.flatMap((h) => asArray(h.tables)), [halls]);
  const stats = useMemo(() => {
    const busyT = all.filter((x) => x.order);
    return {
      busy: busyT.length, total: all.length,
      guests: busyT.reduce((s, x) => s + (Number(x.order.guests) || 0), 0),
      open: busyT.reduce((s, x) => s + (Number(x.order.total) || 0), 0),
    };
  }, [all]);

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

      <main className="rf-body">
        {busy ? (
          <SkeletonTiles count={12} />
        ) : !hall ? (
          <p className="rf-empty">{manager ? t("tbl.none") : t("rf.noneStaff")}</p>
        ) : (
          <div className="rf-grid">
            {asArray(hall.tables).map((tb) => {
              const o = tb.order;
              const dim = mine && (!o || o.openedBy !== me);
              const min = o ? minutesSince(o.openedAt, now) : 0;
              return (
                <button key={tb.id} type="button"
                        className={`rf-table${o ? " is-busy" : ""}${dim ? " is-dim" : ""}`}
                        onClick={() => navigate(`/sale?table=${tb.id}`)}
                        aria-label={o ? t("rf.ariaBusy", { name: tb.name, sum: money(o.total), min })
                                      : t("rf.ariaFree", { name: tb.name })}>
                  <span className="rf-table__name">{tb.name}</span>
                  {o ? (
                    <>
                      <span className="rf-table__sum ek-num">{money(o.total)}</span>
                      <span className="rf-table__meta">
                        <span className="ek-num">{t("tbl.minutes", { n: min })}</span>
                        {o.openedBy ? ` · ${o.openedBy}` : ""}
                      </span>
                    </>
                  ) : (
                    <span className="rf-table__meta">{t("tbl.free")}{tb.seats ? ` · ${t("rf.seats", { n: tb.seats })}` : ""}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
