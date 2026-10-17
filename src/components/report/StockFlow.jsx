import { useEffect, useMemo, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { reportApi } from "../../api";
import { money, quantity, dateTime } from "../../lib/ek-format";
import { asArray } from "../../lib/ek-array";
import { WRITE_OFF_REASON } from "../../lib/ek-labels";
import { Panel } from "./RptUi";
import { useLoading } from "../../lib/use-loading";
import { SkeletonTable } from "../ek/Loading";
import ExcelButton from "../ek/ExcelButton";

/* ══════════════════════════════════════════════════════════════════════════
   OMBOR HARAKATI (V167, 2026-10-17)

   Egasi: «kunlik oylik qancha tovar keldi ketdi, qayerga ketdi, qayerdan
   keldi — ipidan ignasigacha bila olishi kerak».

   ⚠ NEGA MAVJUD JADVALGA USTUN QO'SHILMADI. «Tovar hisoboti» dagi jadval
   har tovarning kirim-chiqimini ko'rsatardi, lekin «+25 keldi» kimdan
   kelganini AYTMASDI — ta'minotchi nomi faqat erkin matnda, hisobot esa
   uni o'qiy olmasdi. Ustun qo'shish ham yetmasdi: bitta tovar bir oyda
   uch ta'minotchidan kelishi mumkin, ya'ni javob qatorga sig'maydi.
   Shuning uchun savol boshqa ko'rinishda — manba bo'yicha — javob oladi.

   ⚠ O'ZAGI BITTA TENGLAMA: boshida + kirdi − chiqdi = oxirida. Egasi
   «juda sodda bo'lsin» dedi; to'rt raqam va ikki ro'yxatdan soddaroq
   shakl topilmadi.

   ⚠ TENGLAMA PULDA: do'konda dona, kilogramm va litr aralash turadi va
   ularni qo'shib «450 ta keldi» deyish yolg'on bo'lardi. Miqdor —
   tovar qatorida, o'z o'lchovida.
   ══════════════════════════════════════════════════════════════════════════ */

/** Turkum belgisi — rang yolg'iz signal bo'lmasligi uchun matn bilan birga. */
const ICON = {
  SUPPLIER: "fa-truck-ramp-box", BRANCH: "fa-shop", MANUAL_IN: "fa-pen",
  MANUAL_OUT: "fa-pen", STOCKTAKE: "fa-clipboard-list", SALE: "fa-cart-shopping",
  EXPIRED: "fa-hourglass-end", SUPPLIER_RETURN: "fa-rotate-left", WRITE_OFF: "fa-trash-can",
};
const DOC_ICON = {
  RECEIPT: "fa-truck-ramp-box", TRANSFER: "fa-right-left",
  SUPPLIER_RETURN: "fa-rotate-left", STOCKTAKE: "fa-clipboard-list",
};

const num = (v) => Number(v || 0);

/** Guruh sarlavhasi: ta'minotchi/filial nomi bo'lsa — o'sha, bo'lmasa turkum. */
function groupLabel(g) {
  if (g.kind === "WRITE_OFF" && g.reason) return WRITE_OFF_REASON[g.reason]?.label || g.reason;
  if (g.name) return g.name;
  return t(`flow.k.${g.kind}`);
}

/** Nom ko'rsatilganda turkum pastda kichik yozuv bo'lib qoladi. */
function groupSub(g) {
  if (g.kind === "WRITE_OFF" && g.reason) return t("flow.k.WRITE_OFF");
  return g.name ? t(`flow.k.${g.kind}`) : null;
}

function Side({ title, icon, rows, total }) {
  return (
    <Panel title={title} icon={icon}>
      <div className="card-body">
        {rows.length === 0 ? (
          <div className="pln__none">{t("flow.none")}</div>
        ) : rows.map((g, i) => {
          const share = total > 0 ? (num(g.amount) / total) * 100 : 0;
          return (
            <div key={`${g.kind}-${g.name || ""}-${g.reason || ""}-${i}`} className="flw__row">
              <i className={`fa-solid ${ICON[g.kind] || "fa-box"} flw__icon`} aria-hidden="true" />
              <span className="flw__name">
                {groupLabel(g)}
                {groupSub(g) && <small>{groupSub(g)}</small>}
              </span>
              <b className="flw__sum ek-num">{money(g.amount)}</b>
              <span className="flw__share ek-num">{share.toFixed(0)}%</span>
              <span className="flw__bar" aria-hidden="true"><i style={{ width: `${Math.min(100, share)}%` }} /></span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export default function StockFlow({ from, to, branchId, toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    reportApi.stockFlow(from, to, branchId)
      .then((r) => { if (alive) setD(r?.data || null); })
      .catch((e) => toast?.error(e.message))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [from, to, branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const b = d?.balance || {};
  const sources = asArray(d?.sources);
  const destinations = asArray(d?.destinations);
  const docs = asArray(d?.docs);
  const rows = asArray(d?.products);

  /* Excel — «ipidan ignasigacha»: har tovar bo'yicha kirim va chiqim
     miqdorda ham, tannarxda ham. Ekranda 500 qator ko'rsatilmaydi. */
  const COLS = useMemo(() => [
    { key: "name", label: t("day.col.name"), type: "text", get: (r) => r.name },
    { key: "cat", label: t("day.col.cat"), type: "text", get: (r) => r.category },
    { key: "unit", label: t("products.unit"), type: "text", get: (r) => r.unit },
    { key: "open", label: t("flow.opening"), type: "number", get: (r) => r.opening },
    { key: "in", label: t("flow.in"), type: "number", get: (r) => r.in },
    { key: "out", label: t("flow.out"), type: "number", get: (r) => r.out },
    { key: "sold", label: t("day.col.sold"), type: "number", get: (r) => r.sold },
    { key: "close", label: t("flow.closing"), type: "number", get: (r) => r.closing },
    { key: "inVal", label: `${t("flow.in")} · ${t("flow.amount")}`, type: "number", get: (r) => r.inValue },
    { key: "outVal", label: `${t("flow.out")} · ${t("flow.amount")}`, type: "number", get: (r) => r.outValue },
    { key: "closeVal", label: `${t("flow.closing")} · ${t("flow.amount")}`, type: "number", get: (r) => r.closingValue },
  ], []);

  if (busy) return <SkeletonTable rows={6} cols={["wide", "num", "num", "num"]} />;
  if (!d) return null;

  const empty = sources.length === 0 && destinations.length === 0;

  return (
    <>
      <Panel title={t("flow.title")} icon="fa-right-left" wide
             right={rows.length > 0
               ? <ExcelButton name={t("flow.excel")} toast={toast} cols={COLS} rows={rows} />
               : null}>
        <div className="card-body">
          <p className="flw__hint">{t("flow.hint")}</p>

          {/* Tenglama: to'rt raqam, chapdan o'ngga o'qiladi. */}
          <div className="flw__eq">
            <div className="flw__cell">
              <small>{t("flow.opening")}</small>
              <b className="ek-num">{money(b.opening)}</b>
            </div>
            <span className="flw__op" aria-hidden="true">+</span>
            <div className="flw__cell flw__cell--in">
              <small>{t("flow.in")}</small>
              <b className="ek-num">{money(b.in)}</b>
            </div>
            <span className="flw__op" aria-hidden="true">−</span>
            <div className="flw__cell flw__cell--out">
              <small>{t("flow.out")}</small>
              <b className="ek-num">{money(b.out)}</b>
            </div>
            <span className="flw__op" aria-hidden="true">=</span>
            <div className="flw__cell flw__cell--end">
              <small>{t("flow.closing")}</small>
              <b className="ek-num">{money(b.closing)}</b>
            </div>
          </div>
          {rows.length > 0 && (
            <p className="flw__base">
              {t("flow.moved", { n: d.productsTotal })}
              {d.productsTotal > rows.length ? ` · ${t("flow.rowsMore", { n: d.productsTotal - rows.length })}` : ""}
            </p>
          )}
        </div>
      </Panel>

      {!empty && (
        <div className="rpt-cols">
          <Side title={t("flow.from")} icon="fa-arrow-right-to-bracket"
                rows={sources} total={num(b.in)} />
          <Side title={t("flow.to")} icon="fa-right-from-bracket"
                rows={destinations} total={num(b.out)} />
        </div>
      )}

      {docs.length > 0 && (
        <Panel title={t("flow.docs")} icon="fa-file-lines" wide>
          <div className="card-body"><p className="flw__hint">{t("flow.docsHint")}</p></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th>{t("prep.col.time")}</th>
                <th>{t("flow.doc")}</th>
                <th>{t("flow.party")}</th>
                <th>{t("flow.by")}</th>
                <th>{t("flow.products")}</th>
                <th>{t("flow.in")}</th>
                <th>{t("flow.out")}</th>
              </tr></thead>
              <tbody>
                {docs.map((x) => (
                  <tr key={`${x.docType}-${x.docId}`}>
                    <td className="mono text-muted">{dateTime(x.at)}</td>
                    <td className="fw-700">
                      <i className={`fa-solid ${DOC_ICON[x.docType] || "fa-file-lines"} text-blue`} aria-hidden="true" />{" "}
                      {t(`flow.d.${x.docType}`)} <span className="ek-num">#{x.docId}</span>
                    </td>
                    <td>{x.party || <span className="text-muted">{t("flow.noParty")}</span>}</td>
                    <td className="text-muted">{x.by || "—"}</td>
                    <td className="mono">{quantity(x.products)}</td>
                    <td className="mono text-success">{num(x.in) ? money(x.in) : "—"}</td>
                    <td className="mono">{num(x.out) ? money(x.out) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.docsTotal > docs.length && (
            <div className="card-body"><p className="flw__hint">{t("flow.docsMore", { n: d.docsTotal - docs.length })}</p></div>
          )}
        </Panel>
      )}
    </>
  );
}
