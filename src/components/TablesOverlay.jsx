import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { tableApi } from "../api";
import { money } from "../lib/ek-format";
import { asArray } from "../lib/ek-array";
import { minutesSince } from "../lib/ek-table-order";
import Overlay from "./ek/Overlay";
import { SkeletonTiles } from "./ek/Loading";
import { useLoading } from "../lib/use-loading";

/* ══════════════════════════════════════════════════════════════════════════
   STOLLAR — kassada (2-bosqich T1, V153)

   Zal bo'yicha stollar: bo'sh (nomi, o'rinlar) yoki band (summa, necha
   daqiqadan beri, mehmonlar). Stol bosilsa kassada savat yorlig'i bo'lib
   ochiladi (`KassaPage.openTable`).

   ⚠ BAND HOLAT RANG BILAN YOLG'IZ BERILMAYDI — summa va vaqt matni ham bor
   (6-qoida). ⚠ Tugmalar ≥ 56px (kassir ekrani).

   Jonli yangilanish T2 da (SSE); hozircha oyna ochiq turganda har 15 soniyada.
   ══════════════════════════════════════════════════════════════════════════ */
export default function TablesOverlay({ onPick, onClose, openHere = [] }) {
  const [halls, setHalls] = useState([]);
  const [hallId, setHallId] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [now, setNow] = useState(Date.now());

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
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const hall = halls.find((h) => h.id === hallId) || null;

  return (
    <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
             aria-label={t("tbl.title")} onEscape={onClose}>
      <div className="ek-dialog tbl-modal">
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <i className="fa-solid fa-chair" aria-hidden="true" /> {t("tbl.title")}
          </div>
          <button className="pay-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        {halls.length > 1 && (
          <div className="tbl-halls" role="tablist" aria-label={t("tbl.halls")}>
            {halls.map((h) => {
              const taken = asArray(h.tables).filter((x) => x.order).length;
              return (
                <button key={h.id} type="button" role="tab" aria-selected={h.id === hallId}
                        className={`tbl-hall${h.id === hallId ? " is-on" : ""}`} onClick={() => setHallId(h.id)}>
                  {h.name} <span className="ek-num">{taken}/{asArray(h.tables).length}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="tbl-body">
          {busy ? (
            <SkeletonTiles count={8} />
          ) : !hall ? (
            <p className="tbl-empty">{t("tbl.none")}</p>
          ) : (
            <div className="tbl-grid">
              {asArray(hall.tables).map((tb) => {
                const o = tb.order;
                const mins = o ? minutesSince(o.openedAt, now) : null;
                const here = openHere.includes(tb.id);
                return (
                  <button key={tb.id} type="button"
                          className={`tbl-tile${o ? " is-busy" : ""}${here ? " is-here" : ""}`}
                          onClick={() => onPick(tb)}>
                    <span className="tbl-tile__name">{tb.name}</span>
                    {o ? (
                      <>
                        <span className="tbl-tile__sum ek-num">{money(o.total)}</span>
                        <span className="tbl-tile__meta">
                          <i className="fa-solid fa-clock" aria-hidden="true" /> {t("tbl.minutes", { n: mins ?? 0 })}
                          {o.guests ? <> · <i className="fa-solid fa-user" aria-hidden="true" /> {o.guests}</> : null}
                        </span>
                      </>
                    ) : (
                      <span className="tbl-tile__meta">
                        {t("tbl.free")}{tb.seats ? <> · <i className="fa-solid fa-user" aria-hidden="true" /> {tb.seats}</> : null}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}
