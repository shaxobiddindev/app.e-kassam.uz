import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { catalogApi, productApi } from "../api";
import Modal from "./Modal";
import Select from "./ek/Select";
import { Spinner } from "./ek/Loading";
import { Empty } from "./ui";
import { asArray } from "../lib/ek-array";
import { unitLabel } from "../lib/ek-labels";

/* ══════════════════════════════════════════════════════════════════════════
   UMUMIY KATALOGDAN OLISH (V90)

   ═══ NIMA UCHUN ══════════════════════════════════════════════════════

   Bir xil «Coca-Cola 0.5 l» ni O'zbekistondagi har bir do'kon qo'lda
   kiritadi: nom, shtrix-kod, birlik. Umumiy katalog buni bir marta
   saqlaydi, do'kon esa uni o'ziga ko'chirib olib, faqat O'ZINIKI bo'lgan
   narsani — narx va qoldiqni — qo'shadi.

   ═══ TO'RTTA QOIDA ═══════════════════════════════════════════════════

   1. FAQAT BELGILANGANLAR olinadi. «Hammasini olib, keraksizini
      keyin o'chirish» degan yo'l yo'q: o'chirish tarixga tegadi.
   2. IKKI MARTA OLINMAYDI. Allaqachon olingan tovar ro'yxatda
      «olingan» deb turadi va belgilab bo'lmaydi. Bu qatorning butun
      ma'nosi: usiz do'kon katalogida ikki nusxa paydo bo'lardi.
   3. NARX VA QOLDIQ KO'CHIRILMAYDI. Ular do'konning o'z ishi va
      umumiy bazada umuman yo'q.
   4. Shtrix-kod do'konda allaqachon bo'lsa — YANGI TOVAR YARATILMAYDI,
      mavjudi umumiy bazaga BOG'LANADI. Aks holda kassada bitta
      shtrix-kodga ikki tovar chiqardi.

   ⚠ Bu qoidalarning hammasi SERVERDA ham bor. Bu yerdagisi — qulaylik:
   foydalanuvchi rad javobini kutmasdan ko'radi.
   ══════════════════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 50;

export default function GlobalCatalogImport({ onClose, onDone, toast }) {
  const [cats,   setCats]   = useState([]);
  const [rows,   setRows]   = useState([]);
  const [total,  setTotal]  = useState(0);
  const [pages,  setPages]  = useState(0);
  const [page,   setPage]   = useState(0);
  const [cat,    setCat]    = useState("");
  const [search, setSearch] = useState("");
  /* ⚠ Standart — «faqat men olmaganlari». Do'kon ikkinchi marta
     kirganda ro'yxatning yarmi allaqachon olingan bo'ladi va ular
     orasidan yangisini qidirish og'ir ish. Kerak bo'lsa belgini
     olib tashlaydi va hammasini ko'radi. */
  const [onlyNew, setOnlyNew] = useState(true);

  const [selected, setSelected] = useState(new Set());
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [result,   setResult]   = useState(null);

  /* Do'kon kategoriyalari — import qilingan tovar qayerga tushishini
     tanlash uchun. Bo'sh qoldirilsa server umumiy kategoriya nomi
     bo'yicha topadi yoki yaratadi. */
  const [shopCats, setShopCats] = useState([]);
  const [target,   setTarget]   = useState("");

  useEffect(() => {
    catalogApi.globalCategories()
      .then((r) => setCats(asArray(r.data)))
      .catch(() => { /* Kategoriya filtri — qulaylik. U kelmasa ham ro'yxat ishlaydi. */ });
    productApi.getCategories()
      .then((r) => setShopCats(asArray(r.data)))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await catalogApi.globalBrowse({
        search: search.trim() || undefined,
        categoryId: cat || undefined,
        onlyNew,
        page,
        size: PAGE_SIZE,
      });
      setRows(asArray(res.data));
      setTotal(Number(res.data?.totalElements) || 0);
      setPages(Number(res.data?.totalPages) || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, cat, onlyNew, page]);

  useEffect(() => { load(); }, [load]);

  /* Olinadigan qatorlar — olinganlari hech qachon tanlanmaydi. */
  const takeable = rows.filter((r) => !r.imported);
  const allOn = takeable.length > 0 && takeable.every((r) => selected.has(r.id));

  const toggle = (row) => {
    if (row.imported) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
      return next;
    });
  };

  /* ⚠ «Hammasi» — FAQAT SHU SAHIFADAGI. Ko'rinmagan mingta tovarni
     belgilash — odam ko'rmagan narsasini o'z katalogiga olishi
     demakdir. */
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      takeable.forEach((r) => (allOn ? next.delete(r.id) : next.add(r.id)));
      return next;
    });
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const res = await catalogApi.globalImport([...selected], target || null);
      setResult(res.data || {});
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  /* ── Natija ekrani ── */
  if (result) {
    return (
      <Modal title={t("gcat.resultTitle")} onClose={() => { setResult(null); onDone(); }}
             maxWidth={560}
             footer={
               <button className="btn btn-primary btn-sm" onClick={() => { setResult(null); onDone(); }}>
                 <i className="fa-solid fa-check" aria-hidden="true" /> {t("common.close")}
               </button>
             }>
        <div className="gcat-result">
          <div className="gcat-result__row">
            <i className="fa-solid fa-circle-check" style={{ color: "var(--fg-success)" }} aria-hidden="true" />
            <span>{t("gcat.resImported", { n: result.imported || 0 })}</span>
          </div>
          {/* ⚠ Har bir raqam ATAYLAB alohida. «5 tadan 3 tasi qo'shildi»
              deb qoldirilsa, do'kon qolgan ikkitasiga nima bo'lganini
              bilmasdi va ularni yana qidirardi. */}
          {result.linked > 0 && (
            <div className="gcat-result__row">
              <i className="fa-solid fa-link" aria-hidden="true" />
              <span>{t("gcat.resLinked", { n: result.linked })}</span>
            </div>
          )}
          {result.already > 0 && (
            <div className="gcat-result__row">
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
              <span>{t("gcat.resAlready", { n: result.already })}</span>
            </div>
          )}
          {result.skipped > 0 && (
            <div className="gcat-result__row">
              <i className="fa-solid fa-triangle-exclamation" style={{ color: "var(--fg-warning)" }} aria-hidden="true" />
              <span>{t("gcat.resSkipped", { n: result.skipped })}</span>
            </div>
          )}
        </div>
        <div className="ek-note" style={{ marginTop: 12 }}>
          <i className="fa-solid fa-tag" aria-hidden="true" /> {t("gcat.priceNote")}
        </div>
      </Modal>
    );
  }

  /* ── Ro'yxat ── */
  return (
    <Modal
      title={t("gcat.title")}
      onClose={onClose}
      maxWidth={760}
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={doImport}
                  disabled={busy || selected.size === 0}>
            {busy ? <Spinner /> : <i className="fa-solid fa-download" aria-hidden="true" />}
            {busy ? t("gcat.importing") : `${t("gcat.import")} (${selected.size})`}
          </button>
        </>
      }
    >
      <div className="ek-note" style={{ marginBottom: 12 }}>
        <i className="fa-solid fa-circle-info" aria-hidden="true" /> {t("gcat.hint")}
      </div>

      <div className="gcat-bar">
        <input className="form-input" style={{ flex: "1 1 180px" }}
               placeholder={t("gcat.searchPlaceholder")}
               value={search}
               onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        <Select variant="compact" searchable ariaLabel={t("gcat.category")}
                value={cat} onChange={(v) => { setCat(v); setPage(0); }}
                options={[
                  { value: "", label: t("gcat.allCategories"), icon: "fa-layer-group" },
                  ...cats.map((c) => ({ value: String(c.id), label: c.name, icon: "fa-tag" })),
                ]} />
        <label className="gcat-only">
          <input type="checkbox" checked={onlyNew}
                 onChange={(e) => { setOnlyNew(e.target.checked); setPage(0); }} />
          {t("gcat.onlyNew")}
        </label>
      </div>

      <div className="gcat-head">
        <label className="gcat-all">
          <input type="checkbox" checked={allOn} disabled={takeable.length === 0}
                 onChange={toggleAll} />
          {t("gcat.selectPage")}
        </label>
        <span className="ek-num gcat-count">{t("gcat.found", { n: total })}</span>
      </div>

      <div className="gcat-list">
        {loading ? <Spinner /> : rows.length === 0 ? (
          <Empty icon="fa-boxes-stacked" text={t(onlyNew ? "gcat.emptyNew" : "gcat.empty")} />
        ) : rows.map((r) => {
          const checked = selected.has(r.id);
          return (
            <label key={r.id}
                   className={`gcat-row ${checked ? "on" : ""} ${r.imported ? "taken" : ""}`}>
              <input type="checkbox" checked={checked} disabled={r.imported}
                     onChange={() => toggle(r)} />
              <div className="gcat-row__main">
                <div className="gcat-row__name">{r.name}</div>
                <div className="gcat-row__meta">
                  <span className="ek-num">{r.barcode}</span>
                  {r.brand && <> · {r.brand}</>}
                  {r.unit && <> · {unitLabel(r.unit)}</>}
                  {r.categoryName && <> · {r.categoryName}</>}
                </div>
              </div>
              {/* ⚠ «Olingan» — TAQIQ EMAS, TUSHUNTIRISH. Katakcha
                  o'chirilgan, lekin qator ro'yxatda qoladi: do'kon
                  «bu tovar bazada yo'q ekan» deb o'ylab, uni qo'lda
                  qayta kiritmasligi kerak. */}
              {r.imported && (
                <span className="gcat-badge gcat-badge--taken">
                  <i className="fa-solid fa-check" aria-hidden="true" /> {t("gcat.taken")}
                </span>
              )}
              {/* O'zi taklif qilgan, hali tasdiqlanmagan yozuv. */}
              {!r.imported && r.mine && r.status === "PENDING" && (
                <span className="gcat-badge gcat-badge--mine">
                  <i className="fa-solid fa-hourglass-half" aria-hidden="true" /> {t("gcat.pending")}
                </span>
              )}
              {r.mine && r.status === "REJECTED" && (
                <span className="gcat-badge gcat-badge--no"
                      title={r.rejectedReason || ""}>
                  <i className="fa-solid fa-circle-xmark" aria-hidden="true" /> {t("gcat.rejected")}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="gcat-pager">
          <button className="btn btn-outline btn-sm" disabled={page === 0 || loading}
                  onClick={() => setPage((p) => p - 1)}>
            <i className="fa-solid fa-chevron-left" aria-hidden="true" /> {t("common.back")}
          </button>
          <span className="ek-num">{page + 1} / {pages}</span>
          <button className="btn btn-outline btn-sm" disabled={page + 1 >= pages || loading}
                  onClick={() => setPage((p) => p + 1)}>
            {t("common.next")} <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ⚠ Tanlov SAHIFA ALMASHGANDA ham saqlanadi (`selected` — Set,
          ro'yxat emas). Do'kon ikkinchi sahifadan ham belgilab, bir
          bosishda hammasini olishi mumkin. */}
      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">{t("gcat.target")}</label>
        <Select block variant="field" searchable ariaLabel={t("gcat.target")}
                value={target} onChange={setTarget}
                options={[
                  { value: "", label: t("gcat.targetAuto"), icon: "fa-wand-magic-sparkles" },
                  ...shopCats.map((c) => ({ value: String(c.id), label: c.name, icon: "fa-folder" })),
                ]} />
        <div className="form-hint">{t("gcat.targetHint")}</div>
      </div>
    </Modal>
  );
}
