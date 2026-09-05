import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { t } from "../lib/ek-i18n";
import { productApi, mediaApi, shopApi, downloadScaleExport } from "../api";
import { BranchSelector, Modal } from "../components";
import CatalogWizard from "../components/CatalogWizard";
import { Empty, Field, SearchBar, FormGroup } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { useAuth } from "../hooks/useAuth";
import { useBadge } from "../context/BadgeProvider";
import { money, quantity as fmtQty } from "../utils";
import Select from "../components/ek/Select";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { isDesktop } from "../lib/ek-desktop";
import { FISCAL_UI } from "../config";
import { printPriceLabels } from "../lib/ek-hardware";
import {
  UNIT, PRODUCT_TYPE, MARKING_GROUP, options, unitLabel, unitDecimals,
} from "../lib/ek-labels";
import { NumField, BarcodeField } from "../components/ek/EkFields";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";
import { checkPrices, marginPercent, VIOLATION } from "../lib/ek-prices";
import { rankItems, PRODUCT_SPEC } from "../lib/ek-search";

/* ══════════════════════════════════════════════════════════════════════════
   Tovarlar.

   Mahsulotda endi 20 dan ortiq maydon bor (o'lchov, QQS, MXIK, markirovka,
   rasm, qadoq barkodlari). Ular bitta uzun ro'yxatda emas, TO'RT BO'LIMDA:
   Asosiy · Narx va soliq · Ombor · Ko'rinish. Kundalik ish (nom, narx,
   barkod) birinchi bo'limda tugaydi, qolganiga faqat kerak bo'lganda
   kiriladi.
   ══════════════════════════════════════════════════════════════════════════ */

const EMPTY_FORM = {
  name: "", barcode: "", sku: "", plu: "", salePrice: "", costPrice: "",
  wholesalePrice: "", discountAllowed: true, maxDiscountPercent: "", categoryId: "",
  type: "GOODS", unit: "DONA", minQuantity: "",
  mxikCode: "", packageCode: "", vatRate: "", priceIncludesVat: true,
  markingGroup: "", imageId: null, imageUrl: null, color: "", favorite: false,
  pickupRequired: false,
  /* Kiyim atributlari (V57) — faqat kiyim yo'nalishidagi do'konda
     so'raladi, qolganlarida bo'sh qoladi va serverga `null` ketadi. */
  brand: "", targetGroup: "", sizeLabel: "", colorName: "", colorHex: "",
  season: "", material: "",
  barcodes: [],
};

/**
 * KIM UCHUN va MAVSUM ro'yxatlari.
 *
 * ⚠ Qiymatlar SERVERDAGI enum bilan AYNAN bir xil (`TargetGroup`,
 * `Season`). Matnlar esa tarjimadan — server `facets` da ham shu
 * kalitlar bilan tarjima qaytaradi, ya'ni filtr va forma bir xil so'zni
 * ko'rsatadi.
 */
const TARGETS = ["MEN", "WOMEN", "UNISEX", "BOYS", "GIRLS", "KIDS", "BABY"];
const SEASONS = ["ALL_SEASON", "SUMMER", "WINTER", "DEMI"];

export default function ProductsPage({ toast }) {
  const { user } = useAuth();
  const { guard } = useBadge();
  const confirm = useConfirm();
  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [search, setSearch]         = useState("");
  const [modal, setModal]           = useState(null); // null | "add" | { type:"edit", product }
  const [form, setForm]             = useState(EMPTY_FORM);

  /* ── Narx tartibi va marja (V53) ────────────────────────────────────
     ⚠ Bu HIMOYA EMAS — server baribir tekshiradi. Bu yerdagisi
     qulaylik: do'kon egasi xatoni saqlash tugmasini bosishdan OLDIN
     ko'radi. Qoida serverdagining nusxasi (`lib/ek-prices.js`). */
  const priceWarning = (() => {
    const v = checkPrices(form.costPrice, form.wholesalePrice, form.salePrice);
    if (!v) return null;
    return {
      [VIOLATION.WHOLESALE_BELOW_COST]: t("price.wholesaleBelowCost"),
      [VIOLATION.WHOLESALE_ABOVE_SALE]: t("price.wholesaleAboveSale"),
      [VIOLATION.SALE_BELOW_COST]:      t("price.saleBelowCost"),
    }[v];
  })();

  /* ⚠ Eng past narx SHU YERDA ham hisoblanadi — do'kon egasi foizni
     yozayotganda natijani darhol ko'rsin. Kassa esa SERVER bergan
     qiymatni ishlatadi (`ProductResponse.minPrice`): u yerda kassirning
     shaxsiy chegarasi ham qo'shiladi va formula bitta joyda qolishi
     kerak. */
  const minPriceText = (() => {
    const cost = Number(form.costPrice);
    const sale = Number(form.salePrice);
    const pct  = form.maxDiscountPercent === "" ? null : Number(form.maxDiscountPercent);
    if (!Number.isFinite(cost) || !Number.isFinite(sale) || sale <= 0) return "—";
    if (pct == null) return t("products.maxDiscountDefault");
    const profit = sale - cost;
    if (profit <= 0) return money(sale);
    return money(Math.max(cost, Math.round(sale - (profit * pct) / 100)));
  })();

  const marginText = (() => {
    const m = marginPercent(form.costPrice, form.salePrice);
    if (m == null) return "—";
    return `${m.toFixed(1)}%`;
  })();
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [branchId, setBranchId]     = useState(null);
  const [wizard, setWizard]         = useState(false);
  const [fiscal, setFiscal]         = useState(null);
  /* Do'kon yo'nalishi — kiyim maydonlari shu asosda ko'rsatiladi. */
  const [bizType, setBizType]       = useState("");
  const fileRef = useRef(null);

  const isHeadUser = user?.role === "OWNER" || user?.role === "SHOP_ADMIN" || user?.role === "ADMIN";

  // ── Yuklash ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        productApi.getAll(branchId),
        productApi.getCategories(),
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { loadData(); }, [loadData]);

  /* Fiskal tayyorlik — alohida so'rov: u jadvalni kutib turmasin va
     xatosi asosiy ro'yxatni yiqitmasin. */
  useEffect(() => {
    if (branchId) return;
    /* ⚠ MVP da SO'ROV HAM YUBORILMAYDI: banner yashirilgan bo'lsa,
       uni to'ldirish uchun har sahifa ochilishida serverga chiqishning
       ma'nosi yo'q. */
    if (FISCAL_UI) productApi.fiscalReadiness().then((r) => setFiscal(r.data)).catch(() => {});
    /* Do'kon yo'nalishi — kiyim maydonlari ko'rinishini hal qiladi.
       Xatosi JIM yutiladi: yo'nalish noma'lum bo'lsa maydonlar
       ko'rinmaydi, lekin forma baribir ishlaydi. */
    shopApi.getProfile().then((r) => setBizType(r?.data?.businessType || "")).catch(() => {});
  }, [branchId, products.length]);

  // ── Modal ochish ───────────────────────────────────────────
  const openAdd = () => { setForm(EMPTY_FORM); setModal("add"); };

  const openEdit = (p) => {
    setForm({
      name: p.name || "",
      barcode: p.barcode || "",
      sku: p.sku || "",
      plu: p.plu || "",
      salePrice: p.salePrice ?? "",
      costPrice: p.costPrice ?? "",
      wholesalePrice: p.wholesalePrice ?? "",
      discountAllowed: p.discountAllowed !== false,
      maxDiscountPercent: p.maxDiscountPercent ?? "",
      brand: p.brand ?? "", targetGroup: p.targetGroup ?? "",
      sizeLabel: p.sizeLabel ?? "", colorName: p.colorName ?? "",
      colorHex: p.colorHex ?? "", season: p.season ?? "",
      material: p.material ?? "",
      // ⚠ `categoryId` javobda ILGARI YO'Q EDI va bu yerda doim `undefined`
      // bo'lardi: tahrirlash oynasi kategoriyani har safar bo'sh ko'rsatib,
      // saqlanganda uni jimgina yo'qotardi.
      categoryId: p.categoryId ?? "",
      type: p.type || "GOODS",
      unit: p.unit || "DONA",
      minQuantity: p.minQuantity ?? "",
      mxikCode: p.mxikCode || "",
      packageCode: p.packageCode || "",
      vatRate: p.vatRate ?? "",
      priceIncludesVat: p.priceIncludesVat !== false,
      markingGroup: p.markingGroup || "",
      imageId: p.imageId ?? null,
      imageUrl: p.thumbUrl || null,
      color: p.color || "",
      favorite: !!p.favorite,
      pickupRequired: !!p.pickupRequired,
      barcodes: p.barcodes || [],
    });
    setModal({ type: "edit", product: p });
  };

  const closeModal = () => setModal(null);

  // ── Rasm ───────────────────────────────────────────────────
  const pickImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await mediaApi.upload(file);
      setForm((f) => ({ ...f, imageId: res.data.id, imageUrl: res.data.thumbUrl }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ⚠ Rasmni olib tashlash uchun `imageId: 0` yuboriladi, `null` emas:
     `null` backendda "tegilmasin" degani (barcha maydonlar ixtiyoriy). */
  const clearImage = () => setForm((f) => ({ ...f, imageId: 0, imageUrl: null }));

  // ── Qadoq barkodlari ───────────────────────────────────────
  const addPackBarcode = () =>
    setForm((f) => ({ ...f, barcodes: [...f.barcodes, { barcode: "", packQty: "", label: "" }] }));

  const setPackBarcode = (idx, field, value) =>
    setForm((f) => ({
      ...f,
      barcodes: f.barcodes.map((b, i) => (i === idx ? { ...b, [field]: value } : b)),
    }));

  const removePackBarcode = (idx) =>
    setForm((f) => ({ ...f, barcodes: f.barcodes.filter((_, i) => i !== idx) }));

  // ── Saqlash ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name) { toast.error(t("products.requiredFields")); return; }
    setSaving(true);
    try {
      const num = (v) => (v === "" || v == null ? null : Number(v));
      const body = {
        name: form.name,
        barcode: form.barcode || null,
        sku: form.sku || null,
        /* ⚠ Bo'sh satr — «PLU ni OLIB TASHLA», `null` emas. Serverda
           `null` «tegilmasin» degani, ya'ni maydonni bo'shatgan odam
           PLU o'chmaganini keyin bilib qolardi. */
        plu: form.plu || "",
        salePrice: num(form.salePrice),
        costPrice: num(form.costPrice),
        /* ⚠ Bo'sh optom narx `0` emas, `null` bo'lib ketishi kerak:
           `0` tannarxdan past bo'lib qolar va har saqlashda «optom
           tannarxdan past» xatosi chiqaverardi. Server ham shuni
           qiladi (`zeroToNull`), lekin xatoni SO'RAMASDAN OLDIN
           to'xtatgan yaxshi. */
        wholesalePrice: num(form.wholesalePrice) || null,
        discountAllowed: form.discountAllowed,
        /* ⚠ Bo'sh maydon `-1` bo'lib ketadi — serverda bu «do'kon
           standartiga qaytar» degani. `null` yuborilsa «tegilmasin»
           bo'lardi va qo'yilgan foizni olib tashlashning yo'li
           qolmasdi. */
        maxDiscountPercent: form.maxDiscountPercent === "" ? -1 : num(form.maxDiscountPercent),
        /* ⚠ BO'SH SATR YUBORILADI, `null` EMAS. Serverda `null` —
           «tegilmasin», bo'sh satr esa «olib tashlansin». `null`
           yuborilganda qo'yilgan brendni yoki o'lchamni O'CHIRISHNING
           yo'li qolmasdi. */
        brand: form.brand.trim(),
        targetGroup: form.targetGroup || null,
        sizeLabel: form.sizeLabel.trim(),
        colorName: form.colorName.trim(),
        colorHex: form.colorHex.trim(),
        season: form.season || null,
        material: form.material.trim(),
        categoryId: form.categoryId || null,
        type: form.type,
        unit: form.unit,
        minQuantity: num(form.minQuantity),
        mxikCode: form.mxikCode || null,
        packageCode: form.packageCode || null,
        vatRate: num(form.vatRate),
        priceIncludesVat: form.priceIncludesVat,
        markingGroup: form.markingGroup || null,
        imageId: form.imageId,
        color: form.color || null,
        favorite: form.favorite,
        pickupRequired: form.pickupRequired,
        barcodes: form.barcodes
          .filter((b) => b.barcode)
          .map((b) => ({ ...b, packQty: num(b.packQty) || 1 })),
      };
      if (modal === "add") {
        await productApi.create(body);
        toast.success(t("products.added"));
      } else {
        /* ⚠ `guard` — NARX O'ZGARSA server bajik so'raydi (428).
           Usiz saqlash «Bajikni skanerlang» degan xato bilan tugardi,
           lekin skanerlash OYNASI ochilmasdi: xabar bor, yo'l yo'q edi.
           Narx o'zgarmagan tahrirda server bajik so'ramaydi, ya'ni bu
           o'ram oddiy tahrirni sekinlashtirmaydi. */
        await guard(() => productApi.update(modal.product.id, body));
        toast.success(t("products.updated"));
      }
      closeModal();
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── O'chirish ──────────────────────────────────────────────
  const handleDelete = async (product) => {
    const ok = await confirm({
      title: t("products.deleteTitle"),
      message: `"${product.name}" mahsulotini o'chirishni tasdiqlaysizmi?`,
      type: "danger",
    });
    if (!ok) return;
    try {
      await productApi.delete(product.id);
      toast.success(t("common.deleted"));
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  /* ── Qidiruv ────────────────────────────────────────────────
     ⚠ KASSADAGI BILAN AYNAN BIR XIL (`PRODUCT_SPEC`). Ilgari bu yerda
     oddiy `includes` turardi va Katalog kassadan boshqacha javob
     berardi: kassada topilgan tovar Katalogda topilmasdi va do'kon
     egasi «tovar yo'qolib qoldi» deb o'ylardi. */
  /* ══ USTUNLAR BO'YICHA FILTR (V68) ═══════════════════════════════════
     Jadvaldagi olti ustunning hammasi. «Holat» — hisoblanadigan ustun:
     ekranda ko'rinadigan yorliqning AYNAN o'zi (nofaol → tugagan →
     faol tartibida), aks holda «tugagan» deb filtrlagan odam nofaol
     tovarlarni ham olardi va sababini tushunmasdi. */
  const COLS = useMemo(() => [
    { key: "name",  label: t("products.col"),       type: "text",   get: (p) => p.name },
    { key: "code",  label: t("products.barcode"),   type: "text",   get: (p) => p.barcode || p.sku },
    { key: "cat",   label: t("products.category"),  type: "text",   get: (p) => p.categoryName },
    { key: "price", label: t("products.salePrice"), type: "number", get: (p) => p.salePrice },
    { key: "qty",   label: t("inv.currentQty"),     type: "number", get: (p) => p.stockQuantity },
    { key: "st",    label: t("common.status"),      type: "enum",
      options: [
        { value: "off", label: t("products.inactive") },
        { value: "out", label: t("products.outOfStock") },
        { value: "on",  label: t("common.active") },
      ],
      get: (p) => (!p.active ? "off"
                 : p.stockQuantity != null && Number(p.stockQuantity) <= 0 ? "out" : "on") },
  ], []);
  const colFlt = useDataFilter(COLS, "products");

  const filtered = rankItems(colFlt.apply(products), search, PRODUCT_SPEC);

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setValue = (key) => (v) => setForm((prev) => ({ ...prev, [key]: v }));

  const divisible = unitDecimals(form.unit) > 0;
  const isService = form.type === "SERVICE";

  /* ── Narx yorliqlari ────────────────────────────────────────────────
     Faqat `.exe` da ko'rinadi: chek printeriga bayt yuborish Tauri
     tomonida bo'ladi, brauzerda esa umuman imkoni yo'q. Tugmani
     ko'rsatib qo'yib, bosilganda «desktop kerak» deyish — foydasiz. */
  const exportForScale = async () => {
    try {
      await downloadScaleExport();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const labelsOn = isDesktop();
  const printLabels = async (items) => {
    /* Xizmatda javon yorliq ham bo'lmaydi: «soch olish» ni javonga
       qo'yib bo'lmaydi va barkodi ham yo'q. */
    const printable = items.filter((p) => p.type !== "SERVICE");
    if (!printable.length) { toast?.error(t("label.nothing")); return; }
    try {
      await printPriceLabels(
        printable.map((p) => ({ name: p.name, salePrice: p.salePrice, barcode: p.barcode })),
        { copies: 1, shopName: localStorage.getItem("ek_shopName") || "" });
      toast?.success(t("label.sent", { n: printable.length }));
    } catch (err) {
      toast?.error(err.message);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 className="page-title">{t("products.title")}</h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-outline btn-sm" onClick={loadData} title={t("products.refreshTitle")}>
            <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
          </button>
          {/* ⚠ FILTRLANGANLAR chiqadi, hammasi emas. Narx o'zgargandan
              keyin yorliq kerak bo'ladi va bu odatda bitta kategoriya
              yoki qidiruv natijasi — 800 ta tovarni lenta qilib chiqarish
              hech kimga kerak emas va bir rulon qog'ozni yeydi. */}
          {labelsOn && filtered.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => printLabels(filtered)}
                    title={t("label.printFilteredHint")}>
              <i className="fa-solid fa-tags" /> {t("label.printFiltered", { n: filtered.length })}
            </button>
          )}
          <BranchSelector selectedId={branchId} onSelect={setBranchId} />
          {!branchId && isHeadUser && (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setWizard(true)}>
                <i className="fa-solid fa-wand-magic-sparkles" /> {t("products.fromCatalog")}
              </button>
              {/* Taroziga eksport (V42) — faqat PLU biriktirilgan tovarlar
                  chiqadi. Tugma HAR DOIM ko'rinadi: PLU'li tovar yo'q bo'lsa
                  ham odam qayerdan boshlashni bilishi kerak, bo'sh fayl esa
                  o'zi tushuntiradi. */}
              <button className="btn btn-outline btn-sm" onClick={exportForScale}
                      title={t("products.scaleExportHint")}>
                <i className="fa-solid fa-scale-balanced" /> {t("products.scaleExport")}
              </button>
              <button className="btn btn-primary" onClick={openAdd}>
                <i className="fa-solid fa-plus" /> {t("products.new")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Fiskal tayyorlik ────────────────────────────────────
          Fiskal chekda har satr uchun MXIK va QQS majburiy. 800 ta tovarni
          ulanish kunida to'ldirishga urinish — bir haftalik ish; ro'yxat
          hoziroq ko'rinib tursa, egasi uni asta-sekin to'ldiradi. */}
      {FISCAL_UI && fiscal && fiscal.totalProducts > 0 && (
        <div className={`ek-note ${fiscal.incompleteProducts ? "ek-note--warn" : ""}`} style={{ marginBottom: 14 }}>
          <i className={`fa-solid ${fiscal.incompleteProducts ? "fa-triangle-exclamation" : "fa-circle-check"}`} />
          <div>
            <div>
              {fiscal.incompleteProducts
                ? t("products.fiscalIncomplete", { n: fiscal.incompleteProducts })
                : t("products.fiscalReady")}
            </div>
            {!!fiscal.incompleteProducts && <div className="form-hint">{t("products.fiscalHint")}</div>}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder={t("products.search")} style={{ width: 320 }} />
          <DataFilter cols={COLS} flt={colFlt} />
        </div>

        <div className="table-wrap">
          {busy ? (
            <SkeletonTable rows={8} cols={["wide", "text", "num", "num", "narrow"]} />
          ) : (
            <table>
              <thead>
                <tr>
                  <SortTh flt={colFlt} col="name">{t("products.col")}</SortTh>
                  <SortTh flt={colFlt} col="code">{t("products.barcode")}</SortTh>
                  <SortTh flt={colFlt} col="cat">{t("products.category")}</SortTh>
                  <SortTh flt={colFlt} col="price">{t("products.salePrice")}</SortTh>
                  <SortTh flt={colFlt} col="qty">{t("inv.currentQty")}</SortTh>
                  <SortTh flt={colFlt} col="st">{t("common.status")}</SortTh>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="fw-700">
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          {p.thumbUrl && (
                            <img src={mediaApi.url(p.thumbUrl)} alt="" width={30} height={30} loading="lazy"
                                 style={{ borderRadius: 6, objectFit: "cover", flex: "0 0 auto" }} />
                          )}
                          <span>
                            {p.name}
                            {p.markingGroup && (
                              <i className="fa-solid fa-barcode" title={t("products.markingGroup")}
                                 style={{ marginLeft: 6, color: "var(--fg-warning)" }} />
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="ek-num text-muted" style={{ fontSize: 12 }}>
                          {p.barcode || p.sku || "—"}
                        </span>
                      </td>
                      <td>{p.categoryName || "—"}</td>
                      <td>
                        {p.salePrice == null
                          ? <span className="badge badge-amber">{t("products.noPrice")}</span>
                          : <span className="ek-num fw-700 text-blue">{money(p.salePrice)}</span>}
                      </td>
                      <td>
                        {p.stockQuantity == null
                          ? <span className="text-muted">—</span>
                          : <span className="ek-num">
                              {fmtQty(p.stockQuantity, p.unitDecimals)} {unitLabel(p.unit)}
                            </span>}
                      </td>
                      <td>
                        {/* ⚠ UCH HOLAT, IKKITA EMAS. Ilgari bu yerda faqat
                            `p.active` o'qilardi va qoldig'i NOL tovar ham
                            yashil «Faol» bo'lib turardi — ro'yxatga qaragan
                            odam uni sotuvga tayyor deb o'ylardi, kassada esa
                            tovar yo'q chiqardi. Endi:
                              Nofaol  — sotuvchi ataylab o'chirgan (eng ustun);
                              Tugagan — sotuvda, lekin qoldig'i nol;
                              Faol    — sotuvda va qoldig'i bor.
                            `stockQuantity == null` — ombor yuritilmaydigan
                            tovar (xizmat): unda qoldiq tushunchasi yo'q,
                            shuning uchun u doim «Faol». */}
                        {!p.active ? (
                          <span className="badge badge-red">{t("products.inactive")}</span>
                        ) : p.stockQuantity != null && Number(p.stockQuantity) <= 0 ? (
                          <span className="badge badge-amber">{t("products.outOfStock")}</span>
                        ) : (
                          <span className="badge badge-green">{t("common.active")}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {/* Yorliq — faqat `.exe` da: chek printeriga
                              brauzerdan bayt yuborib bo'lmaydi. */}
                          {labelsOn && (
                            <button className="btn-icon" onClick={() => printLabels([p])}
                                    aria-label={t("label.print")} title={t("label.print")}>
                              <i className="fa-solid fa-tag" />
                            </button>
                          )}
                          <button className="btn-icon" onClick={() => openEdit(p)} aria-label={t("common.edit")}>
                            <i className="fa-solid fa-pen" />
                          </button>
                          <button className="btn-icon danger" onClick={() => handleDelete(p)} aria-label={t("common.delete")}>
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <Empty icon="fa-box-open" text={t("products.notFound")} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Tayyor katalog ustasi ── */}
      {wizard && (
        <CatalogWizard
          toast={toast}
          onClose={() => setWizard(false)}
          onDone={() => { setWizard(false); loadData(); }}
        />
      )}

      {/* ── Mahsulot formasi ── */}
      {modal && (
        <Modal
          title={modal === "add" ? t("products.new") : t("products.edit")}
          onClose={closeModal}
          maxWidth={620}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={closeModal}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </>
          }
        >
          {/* ═══ Asosiy ═══ */}
          <div className="form-section">
            <div className="form-section__title"><i className="fa-solid fa-circle-info" /> {t("products.section.main")}</div>

            <FormGroup label={`${t("common.name")} *`}>
              <Field className="form-input" value={form.name} onChange={setField("name")} placeholder={t("products.name")} />
            </FormGroup>

            <div className="grid-2">
              <FormGroup label={t("products.type")}>
                <Select block variant="field" ariaLabel={t("products.type")}
                        value={form.type} onChange={setValue("type")}
                        options={options(PRODUCT_TYPE).map((o) => ({ ...o, icon: PRODUCT_TYPE[o.value]?.icon }))} />
              </FormGroup>

              <FormGroup label={t("products.unit")}>
                <Select block variant="field" ariaLabel={t("products.unit")}
                        value={form.unit} onChange={setValue("unit")}
                        options={options(UNIT).map((o) => ({ ...o, icon: UNIT[o.value]?.icon }))} />
              </FormGroup>
            </div>

            {divisible && (
              <div className="form-hint" style={{ marginTop: -8, marginBottom: 12 }}>
                <i className="fa-solid fa-scale-balanced" /> {t("kassa.enterQuantity")} — {unitLabel(form.unit)}
              </div>
            )}

            <div className="grid-2">
              <FormGroup label={t("products.barcode")}>
                <Field className="form-input ek-num" kind="barcode" value={form.barcode} onChange={setField("barcode")} placeholder="4780001111111" />
              </FormGroup>
              <FormGroup label={t("products.sku")}>
                <Field kind="sku" className="form-input mono" value={form.sku} onChange={setField("sku")} placeholder="ART-001" />
              </FormGroup>
            </div>

            {/* PLU — TAROZIdagi tovar kodi (V42).

                ⚠ Faqat BO'LINADIGAN birlikda yoqiladi: tarozi barkodi
                0.350 kg keltiradi, DONA tovarda esa u nolga yaxlitlanib
                sotuvni to'sardi. Server ham shu qoidani qo'llaydi.

                ⚠ Maydon YASHIRILMAYDI, o'chiriladi va sababi yoziladi.
                Yashirilsa, foydalanuvchi «PLU sozlamasi qayerda?» deb
                qidirib qolardi. */}
            <FormGroup label={t("products.plu")}>
              {/* ⚠ `Field kind="int"` YARAMAYDI: u sonni formatlab, boshidagi
                  NOLLARNI yeb qo'yadi — «00012» «12» ga aylanardi va tarozi
                  barkodiga tushmasdi. Shuning uchun oddiy input, raqam
                  filtri qo'lda. Uzunlik chegarasi 8 — ustun kengligi;
                  formatdagi aniq xona sonini server tekshiradi. */}
              <input className="form-input mono" style={{ width: 160 }}
                     value={form.plu}
                     onChange={(e) => setField("plu")({
                       target: { value: e.target.value.replace(/\D/g, "").slice(0, 8) },
                     })}
                     placeholder="00012" inputMode="numeric"
                     disabled={!divisible} aria-label={t("products.plu")} />
              <div className="set-row__hint" style={{ marginTop: 4 }}>
                {divisible ? t("products.pluHint") : t("products.pluUnitHint")}
              </div>
            </FormGroup>

            <FormGroup label={t("products.category")}>
              <Select
                block variant="field" ariaLabel={t("products.category")} placeholder={t("products.noCategory")}
                /* ⚠ QIDIRUV MAJBURIY, avtomatik emas. Avtomatik qoida
                   bandlar soni 8 dan oshganda ishlaydi, kategoriyalar
                   esa MA'LUMOT ro'yxati: bugun beshta bo'lsa ham
                   ertaga o'ttizta bo'ladi va o'sha kuni do'kon egasi
                   ro'yxatni aylantirib qidirishga majbur qolardi.
                   Farq shunda: qat'iy ro'yxatda (to'lov turi, o'lchov
                   birligi) qidiruv ortiqcha bosqich — u hech qachon
                   o'smaydi va joylashuvi yodda qoladi. */
                searchable searchPlaceholder={t("common.searchShort")}
                value={form.categoryId ? String(form.categoryId) : ""}
                onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
                options={[
                  { value: "", label: t("products.noCategory"), icon: "fa-tag" },
                  ...categories.map((c) => ({ value: String(c.id), label: c.name, icon: c.icon || "fa-tags" })),
                ]}
              />
            </FormGroup>
          </div>

          {/* ═══ Narx va soliq ═══ */}
          <div className="form-section">
            <div className="form-section__title"><i className="fa-solid fa-receipt" /> {t("products.section.price")}</div>

            <div className="grid-2">
              <FormGroup label={t("products.salePrice")}>
                <Field className="form-input ek-num" kind="money" value={form.salePrice} onChange={setField("salePrice")} placeholder="0" />
              </FormGroup>
              <FormGroup label={t("products.costPrice")}>
                <Field className="form-input ek-num" kind="money" value={form.costPrice} onChange={setField("costPrice")} placeholder="0" />
              </FormGroup>
            </div>

            {/* ⚠ OPTOM NARX (V53) — uchinchi narx. Tartib QAT'IY:
                tan ≤ optom ≤ sotuv. Server ham tekshiradi; bu yerdagi
                ogohlantirish faqat QULAYLIK — xatoni saqlashdan oldin
                ko'rsatadi, himoya emas. */}
            <div className="grid-2">
              <FormGroup label={t("products.wholesalePrice")}>
                <Field className="form-input ek-num" kind="money" value={form.wholesalePrice}
                       onChange={setField("wholesalePrice")} placeholder="0" />
                <div className="form-hint">{t("products.wholesaleHint")}</div>
              </FormGroup>
              <FormGroup label={t("products.margin")}>
                <div className="ek-margin">{marginText}</div>
              </FormGroup>
            </div>
            {priceWarning && (
              <div className="ek-note ek-note--warn" style={{ marginTop: 4 }}>
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                <div>{priceWarning}</div>
              </div>
            )}

            {/* ══ KIYIM ATRIBUTLARI (V57) ═══════════════════════════════
                ⚠ FAQAT KERAK BO'LGANDA. Oziq-ovqat do'konida «o'lcham»
                va «mavsum» maydonlari har tovar kiritilganda ekranni
                egallab, ularni har safar o'qib o'tishga majbur qilardi
                — `BusinessType` izohidagi qoida aynan shu.

                ⚠ LEKIN TO'LDIRILGAN BO'LSA — DOIM KO'RINADI. Do'kon
                yo'nalishini keyin o'zgartirsa yoki aralash savdo qilsa,
                yashirilgan maydonlar bazada QOLIB, hech qayerdan
                ko'rinmasdi va tuzatib ham bo'lmasdi. */}
            {(bizType === "CLOTHING" || form.brand || form.sizeLabel
              || form.colorName || form.targetGroup || form.season) && (
              <>
                <div className="grid-2">
                  <FormGroup label={t("clothing.brand")}>
                    <Field className="form-input" value={form.brand}
                           onChange={setField("brand")} maxLength={80} />
                  </FormGroup>
                  <FormGroup label={t("clothing.target")}>
                    <Select
                      block clearable
                      ariaLabel={t("clothing.target")}
                      placeholder="—"
                      value={form.targetGroup}
                      onChange={(v) => setForm((f) => ({ ...f, targetGroup: v }))}
                      options={TARGETS.map((v) => ({ value: v, label: t(`target.${v.toLowerCase()}`) }))}
                    />
                  </FormGroup>
                </div>

                <div className="grid-2">
                  <FormGroup label={t("clothing.size")}>
                    {/* ⚠ Erkin matn: o'lchamlar tizimi do'konga qarab
                        boshqa («M», «42», «104») va ro'yxatga sig'maydi.
                        Server uni normallashtiradi va tartibini o'zi
                        hisoblaydi. */}
                    <Field className="form-input" value={form.sizeLabel}
                           onChange={setField("sizeLabel")} maxLength={24}
                           placeholder="M · 42 · 104" />
                  </FormGroup>
                  <FormGroup label={t("clothing.season")}>
                    <Select
                      block clearable
                      ariaLabel={t("clothing.season")}
                      placeholder="—"
                      value={form.season}
                      onChange={(v) => setForm((f) => ({ ...f, season: v }))}
                      options={SEASONS.map((v) => ({ value: v, label: t(`season.${v.toLowerCase()}`) }))}
                    />
                  </FormGroup>
                </div>

                <div className="grid-2">
                  <FormGroup label={t("clothing.color")}>
                    {/* ⚠ Nom va rangning O'ZI yonma-yon: «ko'k» va
                        «moviy» mijoz uchun boshqa rang, kassir uchun
                        ikkalasi ham «ko'k». Filtrdagi doiracha savolni
                        bir qarashda yopadi. */}
                    <div className="color-pair">
                      <Field className="form-input" value={form.colorName}
                             onChange={setField("colorName")} maxLength={40}
                             placeholder={t("clothing.colorName")} />
                      <input type="color" className="color-pair__dot"
                             aria-label={t("clothing.color")}
                             value={form.colorHex || "#888888"}
                             onChange={(e) => setForm((f) => ({ ...f, colorHex: e.target.value }))} />
                    </div>
                  </FormGroup>
                  <FormGroup label={t("clothing.material")}>
                    <Field className="form-input" value={form.material}
                           onChange={setField("material")} maxLength={120}
                           placeholder="100% paxta" />
                  </FormGroup>
                </div>
              </>
            )}

            {/* ⚠ SOLIQ MAYDONLARI MVP DA YASHIRIN (`FISCAL_UI`). Ular
                do'kon egasini fiskal modul hali ulanmagan turib ham
                to'ldirishga majburlar va formani ikki barobar
                uzaytirardi. Qiymatlar SAQLANADI — izohi `config.js` da. */}
            {FISCAL_UI && (
              <>
                <div className="grid-2">
                  <FormGroup label={t("products.vatRate")}>
                    <Field className="form-input ek-num" kind="percent" value={form.vatRate} onChange={setField("vatRate")} placeholder="12" />
                  </FormGroup>
                  <FormGroup label={t("products.packageCode")}>
                    <Field kind="barcode" className="form-input ek-num" value={form.packageCode} onChange={setField("packageCode")} placeholder="1234567" />
                  </FormGroup>
                </div>

                <FormGroup label={t("products.mxik")}>
                  <Field className="form-input ek-num" kind="mxik" value={form.mxikCode} onChange={setField("mxikCode")} placeholder="00000000000000000" maxLength={17} />
                  <div className="form-hint">
                    {t("products.mxikHint")}{" "}
                    <a href="https://tasnif.soliq.uz/classifier" target="_blank" rel="noreferrer">tasnif.soliq.uz</a>
                  </div>
                </FormGroup>

                <label className="cat-chip" style={{ marginBottom: 12 }}>
                  <input type="checkbox" checked={form.priceIncludesVat}
                         onChange={(e) => setForm((f) => ({ ...f, priceIncludesVat: e.target.checked }))} />
                  {t("products.priceIncludesVat")}
                </label>
              </>
            )}

            <FormGroup label={t("products.markingGroup")}>
              <Select block variant="field" ariaLabel={t("products.markingGroup")}
                      value={form.markingGroup} onChange={setValue("markingGroup")}
                      options={[
                        { value: "", label: t("products.markingNone"), icon: "fa-minus" },
                        ...options(MARKING_GROUP).map((o) => ({ ...o, icon: MARKING_GROUP[o.value]?.icon })),
                      ]} />
            </FormGroup>
          </div>

          {/* ═══ Ombor ═══ (xizmatga ko'rsatilmaydi — unga qoldiq yuritilmaydi) */}
          {!isService && (
            <div className="form-section">
              <div className="form-section__title"><i className="fa-solid fa-boxes-stacked" /> {t("products.section.stock")}</div>

              <FormGroup label={t("products.minQuantity")}>
                <Field className="form-input ek-num" kind="qty" unit={form.unit}
                       value={form.minQuantity} onChange={setField("minQuantity")} placeholder="5" />
              </FormGroup>

              <div className="form-label">{t("products.packBarcodes")}</div>
              <div className="form-hint" style={{ marginBottom: 8 }}>
                {t("products.packQty")} — {t("products.packLabel")}
              </div>
              {form.barcodes.map((b, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <BarcodeField className="form-input ek-num" style={{ flex: 2 }} placeholder="4780001111128"
                         value={b.barcode} onChange={(e) => setPackBarcode(idx, "barcode", e.target.value)} />
                  {/* ⚠ Bu MIQDOR emas, SANOQ: «quti ichida nechta dona».
                      Kasr bo'lishi mumkin emas, tovarning birligidan ham
                      qat'i nazar — yarim dona quti ichiga solinmaydi. */}
                  <NumField className="form-input ek-num" style={{ flex: 1 }} kind="int" placeholder="12"
                         value={b.packQty} onChange={(e) => setPackBarcode(idx, "packQty", e.target.value)} />
                  <input className="form-input" style={{ flex: 1 }} placeholder={t("products.packLabel")}
                         value={b.label || ""} onChange={(e) => setPackBarcode(idx, "label", e.target.value)} />
                  <button className="btn-icon danger" onClick={() => removePackBarcode(idx)} aria-label={t("common.delete")}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ))}
              <button className="btn btn-outline btn-sm" onClick={addPackBarcode}>
                <i className="fa-solid fa-plus" /> {t("products.packBarcodeAdd")}
              </button>
            </div>
          )}

          {/* ═══ Ko'rinish ═══ */}
          <div className="form-section">
            <div className="form-section__title"><i className="fa-solid fa-image" /> {t("products.section.look")}</div>

            <div className="img-picker">
              <div className="img-picker__box">
                {form.imageUrl
                  ? <img src={mediaApi.url(form.imageUrl)} alt="" />
                  : <i className="fa-solid fa-image" />}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                       onChange={(e) => pickImage(e.target.files?.[0])} />
                <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Spinner /> : <i className="fa-solid fa-upload" />} {t("products.imageUpload")}
                </button>
                {form.imageUrl && (
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={clearImage}>
                    <i className="fa-solid fa-xmark" /> {t("products.imageRemove")}
                  </button>
                )}
                <div className="form-hint">{t("products.imageHint")}</div>
              </div>
            </div>

            <label className="cat-chip" style={{ marginTop: 14 }}>
              <input type="checkbox" checked={form.favorite}
                     onChange={(e) => setForm((f) => ({ ...f, favorite: e.target.checked }))} />
              <i className="fa-solid fa-star" /> {t("products.favorite")}
            </label>
            {/* ⚠ CHEGIRMA BERILADIMI (V53). Bu CHEGARA emas, TAQIQ:
                o'chirilgan tovarga chegirma umuman berilmaydi va uni
                rahbar bajigi ham ochmaydi. Shartnoma yoki davlat
                narxidagi tovarlar uchun (dori, sigaret, kommunal
                karta) — chegirma u yerda hujjatni buzardi. */}
            <label className="cat-chip" style={{ marginTop: 10 }} title={t("products.discountHint")}>
              <input type="checkbox" checked={form.discountAllowed}
                     onChange={(e) => setForm((f) => ({ ...f, discountAllowed: e.target.checked }))} />
              <i className="fa-solid fa-percent" /> {t("products.discountAllowed")}
            </label>

            {/* ⚠ SHU TOVARNING chegirma chegarasi (V56). Do'kon foizini
                ALMASHTIRADI, `min` olinmaydi: «bu tovarni tezroq
                tozala, 100% gacha ruxsat» degan buyruq do'kon
                foizidan oshib ketishi kerak. Kassirning shaxsiy
                chegarasi baribir cheklaydi. */}
            {form.discountAllowed && (
              <div className="grid-2" style={{ marginTop: 10 }}>
                <FormGroup label={t("products.maxDiscount")}>
                  <Field className="form-input ek-num" kind="percent"
                         value={form.maxDiscountPercent}
                         onChange={setField("maxDiscountPercent")}
                         placeholder={t("products.maxDiscountDefault")} />
                  <div className="form-hint">{t("products.maxDiscountHint")}</div>
                </FormGroup>
                <FormGroup label={t("products.minPrice")}>
                  <div className="ek-margin">{minPriceText}</div>
                  <div className="form-hint">{t("products.minPriceHint")}</div>
                </FormGroup>
              </div>
            )}
            {/* ⚠ OMBORDAN BERILADI (V48). Belgi TOVARDA, do'konda emas:
                bitta do'konda ham javondagi mayda-chuyda (kassir o'zi
                beradi), ham hovlidagi sement (omborchi beradi) bo'ladi. */}
            <label className="cat-chip" style={{ marginTop: 10 }} title={t("products.pickupHint")}>
              <input type="checkbox" checked={form.pickupRequired}
                     onChange={(e) => setForm((f) => ({ ...f, pickupRequired: e.target.checked }))} />
              <i className="fa-solid fa-dolly" /> {t("products.pickup")}
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
