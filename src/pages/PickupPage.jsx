import { useState, useEffect, useCallback } from "react";
import { t } from "../lib/ek-i18n";
import { pickupApi, shopApi } from "../api";
import { money, quantity as fmtQty } from "../utils";
import { unitLabel } from "../lib/ek-labels";
import { Empty, SearchBar, Badge } from "../components/ui";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { useScanner } from "../hooks/useScanner";
import { parseSaleCode } from "../lib/ek-barcode";
import { printPickupSlip } from "../lib/ek-hardware";
import Modal from "../components/Modal";
import { rankItems } from "../lib/ek-search";

/* ══════════════════════════════════════════════════════════════════════════
   OMBORDAN BERIB YUBORISH (V48)

   ⚠ MUAMMO. Qurilish mollari, mebel, yem-xashak do'konida mijoz kassaga
   to'laydi, tovar esa kassadan uzoqda — omborda yoki hovlida turadi.
   Kassir tovarni bera olmaydi, omborchi esa mijoz to'laganini bilmaydi.
   Bu bo'shliqni qog'oz to'ldirardi va tizimda hech qanday iz qolmasdi:
   «berildimi?» degan savolga javob yo'q edi.

   ⚠ EKRAN — OMBORCHINIKI, kassirniki emas. Shuning uchun u kassa
   ekranining kichraytirilgan nusxasi emas: narx yo'q, chegirma yo'q,
   to'lov turi yo'q. Faqat NIMA, QANCHA va KIMGA.

   ⚠ SKANER — ASOSIY KIRISH USULI. Omborchining qo'li band, u sichqoncha
   bilan ro'yxatdan qidirmaydi: mijoz chekini uzatadi, omborchi
   skanerlaydi va chek darhol ochiladi. Qidiruv maydoni — zaxira yo'l
   (barkod o'chgan yoki mijoz telefonda surat ko'rsatgan holat uchun).

   ⚠ AVTO-CHOP ETISH IXTIYORIY. Ombordagi printer bor bo'lsa, yangi chek
   kelishi bilan varaqa o'zi chiqadi va omborchi qog'ozni olib hovliga
   tushadi. Printeri yo'q do'kon ekranning o'zi bilan ishlaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/* Ekran o'zi yangilanadi: kassa boshqa xonada va omborchi «yangilash»
   tugmasini bosib turmaydi. 20 soniya — yetarlicha tez, lekin serverga
   bosim ham qilmaydi. */
const POLL_MS = 20000;
const AUTO_KEY = "ek_pickupAutoPrint";

const STATUS_COLOR = { PENDING: "yellow", ISSUED: "green", CANCELLED: "gray" };

export default function PickupPage({ toast }) {
  const [orders, setOrders]   = useState([]);
  const [view, setView]       = useState("queue");   // "queue" | "history"
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [open, setOpen]       = useState(null);      // ochilgan chek
  const [note, setNote]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [printing, setPrinting] = useState(false);
  const [enabled, setEnabled] = useState(true);
  /* Avto-chop etish QURILMAGA bog'liq, do'konga emas: printer
     omborchining kompyuterida turadi, kassirnikida esa yo'q. */
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem(AUTO_KEY) === "1");

  const busy = useLoading(loading);
  const shopName = localStorage.getItem("ek_shopName") || "";

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const res = view === "history" ? await pickupApi.history() : await pickupApi.queue();
      setOrders(res.data || []);
      return res.data || [];
    } catch (err) {
      if (!silent) toast.error(err.message);
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }, [view, toast]);

  useEffect(() => { load(); }, [load]);

  /* Do'konda tizim yoqilganmi — o'chiq bo'lsa sahifa buni AYTADI.
     Bo'sh ro'yxat ko'rsatilsa, omborchi «ishlamayapti» deb o'ylardi. */
  useEffect(() => {
    shopApi.getProfile()
      .then((r) => setEnabled(r?.data?.pickupEnabled !== false))
      .catch(() => {});
  }, []);

  /* ── Avto-chop etish ──────────────────────────────────────────────
     ⚠ Belgi SERVERDA qo'yiladi (`markPrinted`): ekran yangilanganda
     yoki ombor ekrani ikkinchi qurilmada ochilganda bir chek
     qayta-qayta bosilib, bir dasta qog'oz behuda ketardi. */
  useEffect(() => {
    if (!autoPrint || view !== "queue") return;
    const fresh = orders.filter((o) => o.status === "PENDING" && !o.printedAt);
    if (!fresh.length) return;
    let stop = false;
    (async () => {
      for (const o of fresh) {
        if (stop) return;
        try {
          await printPickupSlip(o, { shopName });
          await pickupApi.markPrinted(o.id);
        } catch (err) {
          toast.error(`${t("hw.printFailed")}: ${err.message}`);
          return;   // printer ishlamasa, qolganini urinib ovora bo'lmaymiz
        }
      }
      load(true);
    })();
    return () => { stop = true; };
  }, [orders, autoPrint, view]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  /* ── Skaner ───────────────────────────────────────────────────────
     Mijozning chekidagi barkod — `S-000173`. Boshqa kod (tovar barkodi)
     skanerlansa, sahifa jim turadi: omborchi tovarni emas, CHEKNI
     skanerlashi kerak va bu haqda xabar chiqadi. */
  const openBySale = useCallback(async (saleId) => {
    try {
      const r = await pickupApi.bySale(saleId);
      setOpen(r.data);
      setNote("");
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);

  const onScan = useCallback((code) => {
    const saleId = parseSaleCode(code);
    if (!saleId) { toast.info(t("pickup.scanReceipt")); return; }
    openBySale(saleId);
  }, [openBySale, toast]);

  useScanner(onScan, { enabled: !open });

  const submitSearch = () => {
    const raw = search.trim();
    if (!raw) return;
    const saleId = parseSaleCode(raw) ?? (/^\d+$/.test(raw) ? Number(raw) : null);
    if (!saleId) { toast.info(t("pickup.scanReceipt")); return; }
    openBySale(saleId);
    setSearch("");
  };

  const issue = async () => {
    if (!open || saving) return;
    setSaving(true);
    try {
      const r = await pickupApi.issue(open.id, note);
      toast.success(r?.message || t("pickup.issued"));
      setOpen(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const printOne = async (o) => {
    setPrinting(true);
    try {
      await printPickupSlip(o, { shopName });
      await pickupApi.markPrinted(o.id);
      load(true);
    } catch (err) {
      toast.error(`${t("hw.printFailed")}: ${err.message}`);
    } finally {
      setPrinting(false);
    }
  };

  const toggleAuto = (on) => {
    setAutoPrint(on);
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 10, flexWrap: "wrap" }}>
        <h2 className="page-title">{t("pickup.title")}</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* ⚠ Belgi QURILMAGA tegishli — izohi bilan, aks holda omborchi
              uni do'kon sozlamasi deb o'ylardi. */}
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13 }}
                 title={t("pickup.autoPrintHint")}>
            <input type="checkbox" checked={autoPrint} onChange={(e) => toggleAuto(e.target.checked)} />
            <span><i className="fa-solid fa-print" aria-hidden="true" /> {t("pickup.autoPrint")}</span>
          </label>
          <button className="btn btn-outline btn-sm" onClick={() => load()}>
            <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
          </button>
        </div>
      </div>

      {!enabled && (
        <div className="inv-alert" role="status" style={{ marginBottom: 14 }}>
          <div className="inv-alert__head">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <b>{t("pickup.offTitle")}</b>
            <span className="text-muted inv-alert__hint">{t("pickup.offHint")}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Zaxira yo'l: barkod o'chgan yoki mijoz telefonda surat
              ko'rsatgan holat. Asosiy usul — skaner. */}
          <SearchBar
            value={search}
            onChange={setSearch}
            onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
            placeholder={t("pickup.searchHint")}
            style={{ width: 300 }}
          />
          <div className="cat-tabs" role="tablist" aria-label={t("pickup.title")}>
            {[["queue", t("pickup.queue")], ["history", t("pickup.history")]].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k}
                      className={`cat-tab ${view === k ? "active" : ""}`}
                      onClick={() => setView(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {busy ? (
          <SkeletonTable rows={5} cols={["text", "wide", "text", "narrow"]} />
        ) : orders.length === 0 ? (
          <Empty icon="fa-dolly"
                 text={view === "history" ? t("pickup.noHistory") : t("pickup.empty")} />
        ) : (
          <div className="pickup-list">
            {/* ⚠ Chek kodi RAQAMLI maydon sifatida: omborchi «…347» deb
                oxirgi raqamlarni eslaydi, to'liq kodni emas. */}
            {rankItems(orders, search, {
              digits: (o) => [o.saleCode],
              texts:  (o) => [o.customerName, o.saleCode],
            })
              .map((o) => (
              <div key={o.id} className={`pickup-card ${o.status === "PENDING" ? "is-pending" : ""}`}>
                <div className="pickup-card__head">
                  <span className="pickup-card__no mono">{o.saleCode}</span>
                  <Badge color={STATUS_COLOR[o.status] || "blue"}>{t(`pickup.st.${o.status}`)}</Badge>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {o.createdAt ? new Date(o.createdAt).toLocaleString("uz-UZ") : ""}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span className="mono fw-700 text-blue">{money(o.totalAmount)}</span>
                </div>

                {(o.customerName || o.customerPhone) && (
                  <div className="pickup-card__cust">
                    <i className="fa-solid fa-user" aria-hidden="true" /> {o.customerName || "—"}
                    {o.customerPhone && <span className="mono"> · {o.customerPhone}</span>}
                  </div>
                )}

                <ul className="pickup-card__items">
                  {(o.items || []).map((i, k) => (
                    <li key={k}>
                      <span className="pickup-card__name">{i.productName}</span>
                      {/* ⚠ Miqdor kattaroq: omborchi aynan shu raqamga
                          qarab tovar sanaydi. */}
                      <span className="pickup-card__qty mono">
                        {fmtQty(i.quantity)} {unitLabel(i.unit)}
                      </span>
                    </li>
                  ))}
                </ul>

                {o.status === "ISSUED" && (
                  <div className="pickup-card__done">
                    <i className="fa-solid fa-circle-check" aria-hidden="true" />{" "}
                    {t("pickup.issuedBy", { name: o.issuedByName || "—" })}
                    {o.issuedAt && ` · ${new Date(o.issuedAt).toLocaleString("uz-UZ")}`}
                    {o.note && <span className="text-muted"> · {o.note}</span>}
                  </div>
                )}

                <div className="pickup-card__foot">
                  <button className="btn btn-outline btn-sm" disabled={printing}
                          onClick={() => printOne(o)}>
                    <i className="fa-solid fa-print" /> {t("pickup.printSlip")}
                  </button>
                  {o.status === "PENDING" && (
                    <button className="btn btn-primary btn-sm"
                            onClick={() => { setOpen(o); setNote(""); }}>
                      <i className="fa-solid fa-hand-holding-box" /> {t("pickup.issue")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Berish oynasi ────────────────────────────────────────────── */}
      {open && (
        <Modal
          title={`${t("pickup.issue")} · ${open.saleCode}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setOpen(null)}>
                {t("common.cancel")}
              </button>
              {open.status === "PENDING" ? (
                <button className="btn btn-primary btn-sm" onClick={issue} disabled={saving}>
                  {saving ? <Spinner /> : <i className="fa-solid fa-check" />} {t("pickup.confirmIssue")}
                </button>
              ) : null}
            </>
          }
        >
          {/* ⚠ ALLAQACHON BERILGAN chek ham ochiladi va buni AYTADI:
              «topilmadi» deyilsa, omborchi tovarni ikkinchi marta berib
              yuborardi. */}
          {open.status !== "PENDING" && (
            <div className={`pickup-warn ${open.status === "ISSUED" ? "is-done" : "is-cancel"}`}>
              <i className={`fa-solid ${open.status === "ISSUED" ? "fa-circle-check" : "fa-ban"}`} aria-hidden="true" />
              <span>
                {open.status === "ISSUED"
                  ? <>{t("pickup.alreadyIssued")}
                      {open.issuedByName && ` — ${open.issuedByName}`}
                      {open.issuedAt && `, ${new Date(open.issuedAt).toLocaleString("uz-UZ")}`}</>
                  : t("pickup.wasCancelled")}
              </span>
            </div>
          )}

          <div className="pickup-modal__cust">
            <b>{open.customerName || t("kassa.noCustomer")}</b>
            {open.customerPhone && <span className="mono"> · {open.customerPhone}</span>}
          </div>

          <ul className="pickup-card__items pickup-modal__items">
            {(open.items || []).map((i, k) => (
              <li key={k}>
                <span className="pickup-card__name">{i.productName}</span>
                <span className="pickup-card__qty mono">{fmtQty(i.quantity)} {unitLabel(i.unit)}</span>
              </li>
            ))}
          </ul>

          {open.status === "PENDING" && (
            <label className="form-group" style={{ marginTop: 12, display: "block" }}>
              <span className="form-label">{t("pickup.note")}</span>
              <input className="form-input" value={note} onChange={(e) => setNote(e.target.value)}
                     placeholder={t("pickup.noteHint")} maxLength={255} />
            </label>
          )}
        </Modal>
      )}
    </div>
  );
}
