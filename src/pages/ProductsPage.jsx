import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { t } from "../lib/ek-i18n";
import { productApi, mediaApi, shopApi, catalogApi, downloadScaleExport } from "../api";
import { BranchSelector, Modal } from "../components";
import CatalogWizard from "../components/CatalogWizard";
import GlobalCatalogImport from "../components/GlobalCatalogImport";
import LabelPrintModal from "../components/ek/LabelPrintModal";
import GlobalCatalogUpdates from "../components/GlobalCatalogUpdates";
import { Empty, Field, SearchBar, FormGroup } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { useAuth } from "../hooks/useAuth";
import { useBadge } from "../context/BadgeProvider";
import { money, quantity as fmtQty, fmtDateTime } from "../utils";
import Select from "../components/ek/Select";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { FISCAL_UI } from "../config";
import {
  UNIT, PRODUCT_TYPE, MARKING_GROUP, options, unitLabel, unitDecimals,
} from "../lib/ek-labels";
import { isWeighUnit } from "../lib/ek-scale";
import { productCode } from "../lib/ek-code";
import { NumField, BarcodeField } from "../components/ek/EkFields";
import { useSearchParams } from "react-router-dom";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";
import { checkPrices, marginPercent, VIOLATION } from "../lib/ek-prices";
import { isCodeQuery, normalizeCodeQuery } from "../lib/ek-code-search";
import { useInfinite } from "../hooks/useInfinite";
import { useDebounced } from "../hooks/useDebounced";
import InfiniteList from "../components/ek/InfiniteList";
import { asArray } from "../lib/ek-array";
import { barcodeSuspicious } from "../lib/ek-barcode-check";
import { isStoreCode, prettyStoreCode, storeCodeShort } from "../lib/ek-store-code";

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
  /* Arxivdagi tovar bilan to'qnashuv — ikkita yo'l taklif qilinadi (B). */
  const [archivedConflict, setArchivedConflict] = useState(null);
  const [categories, setCategories] = useState([]);
  /* ⚠ RO'YXAT HOLATI `useInfinite` DA (pastda): `rows`, `total`,
     «yana bormi» — hammasi u yerda. Ilgari bu yerda butun katalog
     bitta `useState` da turardi. O'lchandi: bazada 12 493 tovar. */
  const [search, setSearch]         = useState("");
  /* Saqlash/o'chirishdan keyin ro'yxatni qaytadan so'rash uchun. */
  const [version, setVersion]       = useState(0);
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
  const [gcat,   setGcat]           = useState(false);
  /* Umumiy bazadagi o'xshash yozuvlar — YANGI tovar kiritilayotganda. */
  const [gcatHint, setGcatHint]     = useState([]);
  const [gupd,   setGupd]           = useState(false);
  /* Umumiy bazada nechta tovarda yangilanish bor — tugmadagi son. */
  /* Kod yaratish — server javobini kutish. Ikki marta bosilsa ikkita
     raqam sarflanardi (hisoblagich orqaga qaytmaydi). */
  const [codeBusy, setCodeBusy] = useState(false);

  const makeStoreCode = async () => {
    /* ⚠ TAHRIRLASH HOLATI `modal` DA: `null | "add" | { type, product }`.
       Bu yerda boshida `editing` deb yozilgan edi — bunday o'zgaruvchi
       umuman yo'q va sahifa OCHILISHIDA yiqilardi («editing is not
       defined»), ya'ni tovar qo'shish ham, tahrirlash ham ishlamay
       qolgan edi. */
    const id = modal?.product?.id;
    if (!id || codeBusy) return;
    setCodeBusy(true);
    try {
      const r = await productApi.generateCode(id);
      const code = r?.data?.barcode;
      if (code) {
        setForm((p) => ({ ...p, barcode: code }));
        toast.success(t("products.codeMade", { code: prettyStoreCode(code) }));
        /* ⚠ RO'YXAT NOMI `loadData`. Bu yerda ham `load()` deb
           yozilgan edi: muvaffaqiyatli kod berilganidan KEYIN
           «load is not defined» xatosi `catch` ga tushib, kassirga
           yashil xabardan so'ng darhol qizil xato ko'rsatardi. */
        loadData();
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCodeBusy(false);
    }
  };

  const [gupdCount, setGupdCount]   = useState(0);
  const [fiscal, setFiscal]         = useState(null);
  /* Do'kon yo'nalishi — kiyim maydonlari shu asosda ko'rsatiladi. */
  const [bizType, setBizType]       = useState("");
  const fileRef = useRef(null);

  const isHeadUser = user?.role === "OWNER" || user?.role === "SHOP_ADMIN" || user?.role === "ADMIN";

  // ── Yuklash ────────────────────────────────────────────────
  /**
   * ⚠ TOVARLAR ENDI BU YERDA YUKLANMAYDI. Ilgari `productApi.getAll`
   * butun katalogni bitta so'rovda olardi va har qatorga qoldiq,
   * barkodlar, chegirma chegarasi hisoblanardi. Endi `useInfinite`
   * sahifa-sahifa so'raydi (pastda).
   *
   * Kategoriyalar esa QOLDI: ular tovar formasidagi ro'yxat uchun
   * kerak va soni o'nlab (o'lchandi: 48).
   */
  const loadData = useCallback(async () => {
    /* ⚠ `version` OSHADI VA SHU YETARLI: u `fetchPage` ga kiradi,
       `useInfinite` esa `fetcher` o'zgarganini «boshqa ro'yxat» deb
       tushunib, o'zi boshidan yuklaydi. Alohida `reload()` yozish
       kerak emas — va u ikkinchi yo'l bo'lib, biri unutilardi. */
    setVersion((v) => v + 1);
    try {
      const catRes = await productApi.getCategories();
      setCategories(asArray(catRes.data));
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

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
    /* ⚠ Umumiy bazadagi yangilanishlar SONI. Tugma soni bilan
       ko'rinmasa, do'kon bu bo'lim borligini ham bilmasdi va umumiy
       baza tuzatilgani unga hech qachon yetib bormasdi.

       ⚠ Xatosi JIM yutiladi va son 0 bo'lib qoladi: bu yordamchi
       xususiyat, tovarlar ro'yxatiga hech qanday aloqasi yo'q. */
    catalogApi.globalUpdates()
      .then((r) => setGupdCount(asArray(r.data).length))
      .catch(() => setGupdCount(0));

  /* ⚠ BOG'LIQLIK `version`, RO'YXAT UZUNLIGI EMAS. Ilgari
     `products.length` turardi va u to'g'ri ishlardi: katalog bir
     marta yuklanib, uzunlik bir marta o'zgarardi. Sahifalashda esa
     uzunlik HAR SAHIFADA o'zgaradi — ya'ni bu uchta yordamchi
     so'rov har scrollda qaytadan ketardi. */
  }, [branchId, version]);

  /* ══ UMUMIY BAZADA O'XSHASHI BORMI (V91) ═══════════════════════════
     ⚠ MAQSAD — DUBLIKATNI KIRISHDAN OLDIN TO'XTATISH. Umumiy bazada
     yagonalik faqat aniq shtrix-kod bo'yicha, ya'ni «Coca-Cola 0.5»
     va «Кока-Кола 0,5 л» bir raqami xato terilgan barkod bilan
     bemalol yonma-yon yashaydi. Do'kon tovarni qo'lda terishdan
     oldin bazadagini ko'rsa, ikkinchi nusxa umuman yaralmaydi.

     ⚠ FAQAT YANGI TOVARDA. Mavjud tovarni tahrirlayotgan odam uni
     allaqachon o'ziniki deb biladi va «o'xshashi bor» degan gap
     unga xalaqit berardi.

     ⚠ KUTISH (500 ms) SHART: usiz har bosilgan harf serverga
     so'rov yuborardi. Forma yopilganda taymer ham bekor qilinadi.

     ⚠ Xatosi JIM yutiladi: bu yordamchi, tovar saqlashga hech
     qanday aloqasi yo'q. */
  useEffect(() => {
    if (modal !== "add") { setGcatHint([]); return undefined; }
    const name = (form.name || "").trim();
    const code = (form.barcode || "").trim();
    if (name.length < 3 && code.length < 6) { setGcatHint([]); return undefined; }
    const timer = setTimeout(() => {
      catalogApi.globalSimilar(name, code)
        .then((r) => setGcatHint(asArray(r.data)))
        .catch(() => setGcatHint([]));
    }, 500);
    return () => clearTimeout(timer);
  }, [modal, form.name, form.barcode]);

  // ── Modal ochish ───────────────────────────────────────────
  /* Kategoriya qulfi — SERVERDAN.
     `null` «hali bilmayman» degani. Ro'yxat javobida bu bayroq
     hisoblanmaydi (kassa qidiruvining issiq yo'li), shuning uchun
     tahrirlash oynasi ochilganda bitta tovar alohida so'raladi. */
  const [catLocked, setCatLocked] = useState(null);
  /* Tez ketma-ket ikkita tovar ochilsa, birinchisining kechikkan
     javobi ikkinchisiniki ustiga yozilmasin. */
  const catSeq = useRef(0);

  const openAdd = () => { setForm(EMPTY_FORM); setCatLocked(false); setModal("add"); };

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

    /* ⚠ XAVFSIZ STANDART — QULFLANGAN. Javob kelguncha maydon ochiq
       tursa, odam kategoriyani almashtirib saqlashga urinardi va
       server uni rad etardi: bosilgan tugma bekorga ketardi. */
    setCatLocked(p.categoryId ? true : false);
    if (p.categoryId) {
      const mine = ++catSeq.current;
      productApi.getById(p.id)
        .then((r) => {
          if (mine !== catSeq.current) return;
          /* `!== false` — `null` (hisoblanmagan) ham QULF deb
             o'qiladi. Noaniqlikda ochib yuborishdan ko'ra yopiq
             qoldirish xavfsizroq. */
          setCatLocked(r?.data?.categoryLocked !== false);
        })
        .catch(() => { if (mine === catSeq.current) setCatLocked(true); });
    }
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

  /* ⚠ KATEGORIYA BIR MARTA QO'YILADI — keyin ALMASHTIRILMAYDI.
     Sabab hisobotda: kategoriya sotuv tarixiga ham tegadi. Tovar
     bugun «Ichimliklar» dan «Oziq-ovqat» ga ko'chirilsa, MARTDAGI
     hisobot ham o'zgarib ketadi — o'tgan oy yopilgan, raqamlar
     egasiga aytilgan, endi esa ular boshqacha. Bu jimgina bo'ladi:
     xato chiqmaydi, shunchaki tarix qayta yoziladi.

     ⚠ BO'SH BO'LSA — OCHIQ QOLADI. Eski tovarlarning bir qismi
     kategoriyasiz va maydon butunlay qulflansa ular ABADIY shunday
     qolardi — ya'ni «har bir tovar kategoriyada bo'lsin» talabining
     o'zi bajarilmay qolardi. Qulf «tanlanganini o'zgartirib
     bo'lmaydi» degani, «tanlab bo'lmaydi» degani emas. */
  /* ⚠ SHART «TARIXI BOR», «KATEGORIYASI BOR» EMAS — server ham shu
     qoidada (`ProductDeletionPolicy.hasHistory`). Ilgari bu yerda
     ikkinchisi turardi va oqibati kutilmagan edi: kategoriyani
     almashtirish yagona yo'l bo'lgani uchun, bir marta tovar tushgan
     kategoriyani keyin bo'shatib ham, o'chirib ham bo'lmasdi. */
  const categoryLocked = Boolean(modal?.product?.categoryId) && catLocked !== false;

  // ── Saqlash ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name) { toast.error(t("products.requiredFields")); return; }
    /* ⚠ KATEGORIYA MAJBURIY. Kategoriyasiz tovar kassa ekranida
       kategoriya tugmasi ostida CHIQMAYDI va hisobotda «boshqalar»
       ustuniga tushadi — ya'ni u kiritilgan, lekin amalda ko'rinmas
       bo'lib qoladi. Aynan shu sababli tekshiruv saqlashdan OLDIN:
       serverdan qaytgan xato formani yopib ulgurgan bo'lardi. */
    if (!form.categoryId) { toast.error(t("products.needCategory")); return; }
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
        /* ⚠ Qulflangan kategoriya ASL yozuvdan olinadi, formadan
           emas. Forma holati ishonchli manba emas va server hozircha
           bu qoidani tekshirmaydi — ya'ni yagona to'siq shu yerda. */
        categoryId: categoryLocked ? modal.product.categoryId : (form.categoryId || null),
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
        /* ⚠ ARXIV ZIDDIYATI — XATO EMAS, SAVOL (B, 3-band). Server
           409 o'rniga 200 va IKKITA yo'l qaytaradi: barkod arxivdagi
           tovarniki bo'lsa, ega ehtimol o'sha tovarni qaytadan
           qo'shyapti. Ilgari bu qizil xato edi va chiqish yo'li
           ko'rsatilmasdi — ega barkodni ko'ra olmasdi ham, chunki
           arxivlangan tovar ro'yxatda chiqmaydi. */
        const first = await productApi.create(body);
        const conflict = first?.conflict;

        if (conflict?.conflict === "ARCHIVED_PRODUCT") {
          /* ⚠ `confirm` ISHLATILMAYDI — U IKKI HOLATLI. Unda ESC
             «yo'q» degani bo'lardi va «yo'q» bu yerda «yangisini
             yarat» ma'nosini olardi: ega oynani yopmoqchi bo'lib
             ESC bosgani uchun jimgina tovar yaratilardi. Uchinchi
             holat — «hech narsa qilma» — shart. */
          setArchivedConflict({ ...conflict.archived, body });
          return;                      // oyna javobini kutadi
        }
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
      /* Bajik oynasi bekor qilingani xato emas — `check-cancel.mjs`. */
      if (!err?.cancelled) toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ══ O'CHIRISH — AVVAL SO'RAYMIZ, KEYIN SO'RAYMIZ (V90) ═══════════════

     ⚠ ILGARI QANDAY EDI. Ekran «o'chirishni tasdiqlaysizmi?» deb
     so'rardi, odam «ha» bosardi, server esa rad etardi va javob
     qizil «toast» bo'lib chiqardi. Ya'ni foydalanuvchi HAR SAFAR
     bir xil yo'ldan o'tardi: tasdiqla → xato → nima qilishni o'yla.

     ⚠ TOVARNI O'CHIRISH BITTA AMAL EMAS, UCHTASI. Server qaysi biri
     ekanini oldindan aytadi (`delete-preview`):

       · BLOCKED      — omborda qoldiq bor. O'chirish mumkin emas:
                        qoldiqni yo'q qilish tannarxni ham, hisobotni
                        ham buzadi. Avval sotiladi yoki hisobdan
                        chiqariladi. Bu yerda TUSHUNTIRISH oynasi
                        chiqadi, savol emas.
       · ARCHIVE_ONLY — tovar sotilgan yoki hujjatlarda bor. Yozuv
                        qoladi, faqat ro'yxatdan chiqadi: uni
                        o'chirish eski cheklarni nomsiz qoldirardi.
       · HARD_DELETE  — hech qayerda ishlatilmagan, haqiqatan
                        o'chiriladi.

     ⚠ MATN SERVERDAN KELADI (`message`) va u foydalanuvchi tilida.
     Uni bu yerda takrorlash — ikkita manba, ya'ni ertami-kechmi
     ikki xil javob demakdir. */
  const handleDelete = async (product) => {
    let verdict;
    try {
      verdict = (await productApi.deletePreview(product.id)).data || {};
    } catch (err) {
      toast.error(err.message);
      return;
    }

    if (verdict.action === "BLOCKED") {
      await confirm({
        title: t("products.deleteBlockedTitle"),
        message: `${product.name}\n\n${verdict.message || ""}`,
        type: "warning",
        acknowledge: true,
      });
      return;
    }

    const archive = verdict.action === "ARCHIVE_ONLY";
    const ok = await confirm({
      title: t(archive ? "products.archiveTitle" : "products.deleteTitle"),
      /* ⚠ Sotuv va hujjat SONI ko'rsatiladi. «Tarixda bor» degan gap
         mavhum; «7 marta sotilgan» esa qaror qabul qilish uchun
         yetarli ma'lumot. */
      message: archive
        ? `${product.name}\n\n${verdict.message || ""}\n\n${
            t("products.archiveCounts", {
              sales: verdict.saleCount || 0, docs: verdict.documentCount || 0 })}`
        : `${product.name}\n\n${verdict.message || ""}`,
      type: archive ? "warning" : "danger",
      confirmText: t(archive ? "products.archive" : "common.delete"),
    });
    if (!ok) return;

    try {
      await productApi.delete(product.id);
      toast.success(t(archive ? "products.archived" : "common.deleted"));
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  /* ── Qidiruv ────────────────────────────────────────────────
     ⚠ QIDIRUV ENDI SERVERDA (`?q=`), lekin QOIDA O'ZGARMADI:
     bosqichlar `ProductSearchRank` da frontdagi `RANK` dan
     ko'chirilgan — kod aynan mos → nom aynan mos → kod tugaydi →
     nom boshlanadi → so'z boshi → nom ichida → kod ichida →
     o'xshash (trigramm).

     Talab o'zgarmagani uchun saqlanadi: kassada topilgan tovar
     Katalogda ham topilishi SHART, aks holda do'kon egasi «tovar
     yo'qolib qoldi» deb o'ylardi. */
  /* ══ USTUNLAR BO'YICHA FILTR (V68) ═══════════════════════════════════
     Jadvaldagi olti ustunning hammasi. «Holat» — hisoblanadigan ustun:
     ekranda ko'rinadigan yorliqning AYNAN o'zi (nofaol → tugagan →
     faol tartibida), aks holda «tugagan» deb filtrlagan odam nofaol
     tovarlarni ham olardi va sababini tushunmasdi. */
  const COLS = useMemo(() => [
    { key: "name",  label: t("products.col"),       type: "text",   get: (p) => p.name },
    { key: "code",  label: t("products.barcode"),   type: "text",   get: (p) => p.barcode || p.sku },
    /* ⚠ QISQA RAQAM FILTRDA HAM (V107): «raqami 50 dan kichik» degan
       so'rov do'kon egasiga eng eski (ya'ni asosiy) tovarlarni
       beradi. Jadvalda alohida USTUN emas — u kod katagining ichida
       turadi va yana bitta ustun jadvalni bekorga kengaytirardi. */
    /* ⚠ TUR «matn», «son» EMAS: «001» son sifatida 1 ga aylanardi va
       filtr «01» bilan ham topib qo'yardi (V115). */
    { key: "short", label: t("products.shortCode"),  type: "text",   get: (p) => productCode(p) },
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

  /* ── NARXI TAN NARXDAN PAST TOVARLAR (V99) ────────────────────────
     Bosh sahifadagi «zarariga sotilyapti» signali shu yerga
     `?below=1` bilan olib keladi. Manzilsiz signal egasini filtrsiz
     ro'yxatga tashlab ketardi va u kerakli qatorni yuzta boshqasi
     orasidan qidirishga majbur bo'lardi.

     ⚠ MANZILDA, holatda EMAS: sahifa yangilanganda ham, havola
     ulashilganda ham bir xil ro'yxat ochiladi. */
  const [params, setParams] = useSearchParams();
  const belowOnly = params.get("below") === "1";

  /* ══ RO'YXAT — SERVERDAN, SAHIFA-SAHIFA ═══════════════════════════

     ⚠ FILTR, QIDIRUV VA TARTIB SERVERDA. Ilgari uchalasi ham
     brauzerda, butun katalog ustida bajarilardi. Sahifalash bilan u
     JIMGINA buzilardi:

         do'konchi «Coca» deb yozadi  →  birinchi 50 qatorda yo'q
                                      →  «tovar yo'q» degan XATO xulosa
                                      →  tovarni QAYTA yaratadi

     Ekranda hech qanday xato ko'rinmaydi — shuning uchun bu yo'l
     tanlanmadi. */

  /* ⚠ TERISH KECHIKTIRILADI: har harfda so'rov ketsa «shokolad»
     so'zi 8 ta so'rov yuborardi va ularning 7 tasi darhol keraksiz
     bo'lib qolardi. */
  const slowSearch = useDebounced(search, 300);
  const codeMode = isCodeQuery(slowSearch);
  const fltJson = colFlt.serialize();

  /**
   * ⚠ RAQAM REJIMI (`*425`) ALOHIDA YO'L VA BU ATAYLAB.
   *
   * Kassadagi bilan AYNAN BIR XIL javob kerak: eski kod (alias)
   * bog'lanishi faqat bazada va oddiy qidiruv uni ko'rmaydi —
   * javondagi eski yorliq kassada topilib, shu yerda «yo'q»
   * bo'lardi.
   *
   * ⚠ SAHIFA KERAK EMAS: server kod bo'yicha ko'pi bilan 200 qator
   * beradi, ya'ni javob TO'LIQ. Shuning uchun `readPage` uni massiv
   * deb o'qiydi va «yana bor» bo'lmaydi — va aynan shu sababdan bu
   * rejimda ustun filtrini BRAUZERDA qo'llash TO'G'RI: kesiladigan
   * ro'yxat to'liq, sahifa emas.
   */
  const fetchPage = useCallback((page, size) => {
    if (codeMode) {
      return productApi.search(normalizeCodeQuery(slowSearch), 0, 200, branchId);
    }
    return productApi.getPage(page, size, {
      shopId: branchId, flt: fltJson, q: slowSearch, below: belowOnly,
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [codeMode, slowSearch, fltJson, branchId, belowOnly, version]);

  const { rows, loading, error, hasNext, total, loadMore, retry } =
    useInfinite(fetchPage, { size: 50 });

  /* ⚠ BU QATOR `useInfinite` DAN KEYIN: `loading` va `rows` — shu
     chaqiruvning natijasi. Oldin o'qilsa `ReferenceError` va React
     sahifani UMUMAN chizmaydi (`scripts/check-tdz.mjs` qo'riqlaydi).

     Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN
     chizilmaydi (180ms kechikish), chizilgan bo'lsa esa kamida
     400ms turadi — miltillamaydi. */
  const busy = useLoading(loading && !rows.length);

  useEffect(() => { if (error) toast?.error(error); }, [error, toast]);

  /* Kod rejimida ustun filtri brauzerda (yuqoridagi izoh), qolgan
     hamma holatda server allaqachon filtrlab bergan. */
  const filtered = codeMode ? colFlt.apply(rows) : rows;

  /* ⚠ JAMI SON SERVERDAN: ekranda «nechta tovar bor» degan javob
     yuklangan qatorlar soni EMAS. `total` bo'lmasa (kod rejimi)
     ro'yxat uzunligi to'g'ri javob, chunki u to'liq. */
  const shownTotal = codeMode || total == null ? filtered.length : total;

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setValue = (key) => (v) => setForm((prev) => ({ ...prev, [key]: v }));

  const divisible = unitDecimals(form.unit) > 0;
  /* ⚠ PLU «bo'linadigan» emas, TAROZIDA TORTILADIGAN birlikka qo'yiladi.
     Ikkalasi bir narsa emas: gramm bo'linmaydi (butun son), lekin
     tortiladi; metr bo'linadi, lekin tarozi uni o'lchay olmaydi. Ilgari
     maydon `divisible` ga qarardi va shu sababli ziravor uchun yopiq,
     mato uchun esa ochiq edi — ochig'i yomonrog'i, chunki o'sha yerda
     0.488 kg lik yorliq «0.488 metr» bo'lib chekka tushardi. */
  const weighable = isWeighUnit(form.unit);
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

  /* ⚠ TUGMA ENDI HAMMA JOYDA (V108). Ilgari u `isDesktop()` bilan
     yashiringan edi, chunki yorliq faqat chek printeriga —
     ya'ni faqat `.exe` dan — chiqarilardi. Brauzerdan yoki
     telefondan ishlaydigan do'kon javoniga yorliq QO'YA OLMASDI va
     buning sababini ham ko'rmasdi: tugma shunchaki yo'q edi.

     Endi ikkita yo'l bor va tanlov oynada: A4 varaq (har joyda
     ishlaydi) yoki chek printeri (faqat `.exe`). */
  /* ══ ARXIV ZIDDIYATINING IKKI YO'LI (B, 3-band) ══════════════════
     ⚠ Oyna O'ZI hech narsa qilmaydi — u faqat so'raydi. Ish shu
     yerda, chunki ikkala yo'l ham serverga boradi va ikkalasidan
     keyin ham ro'yxat yangilanishi kerak. */
  const restoreArchived = async () => {
    const a = archivedConflict;
    setArchivedConflict(null);
    try {
      const res = await productApi.restore(a.productId);
      /* ⚠ SERVER XABARI USTUN: barkodsiz tiklangan bo'lsa aynan
         shuni aytadi. */
      toast.success(res?.message || t("products.restored"));
      closeModal();
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const createAnyway = async () => {
    const a = archivedConflict;
    setArchivedConflict(null);
    try {
      /* ⚠ AYNAN O'SHA TANA, faqat «baribir yarat» bayrog'i bilan —
         forma qaytadan to'ldirilmaydi. */
      await productApi.create({ ...a.body, createNew: true });
      toast.success(t("products.added"));
      closeModal();
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const [labelItems, setLabelItems] = useState(null);
  const [labelBusy, setLabelBusy] = useState(false);

  /**
   * ══ ⚠ FILTRLANGANLARGA YORLIQ — HAMMASI, YUKLANGANI EMAS ══════════
   *
   * Bu sahifalashning ENG QIMMAT jim buzilishi bo'lardi. Tugma
   * «filtrlangan tovarlarga yorliq chiqar» deydi va ilgari
   * `filtered` butun (filtrlangan) katalog edi. Sahifalashdan keyin
   * esa u faqat EKRANGA YUKLANGAN qatorlar — ya'ni:
   *
   *     do'konchi narxni 300 tovarga o'zgartirdi
   *       → «filtrlanganlarga yorliq» bosdi
   *       → 50 ta yorliq chiqdi
   *       → 250 tovar javonda ESKI NARX bilan qoldi
   *
   * Va buni u faqat javonda, mijoz oldida bilib qolardi.
   *
   * ⚠ SHUNING UCHUN BOSILGANDA QOLGAN SAHIFALAR SO'RALADI. Server
   * bir so'rovda ko'pi bilan 200 qator beradi (`Paging.MAX_SIZE`),
   * shuning uchun tugadi degancha aylanadi.
   *
   * ⚠ CHEGARA BOR (5000): yorliq lentasi cheksiz emas va xato
   * bosilgan tugma bir rulonni yeb qo'yardi. Chegaradan oshsa
   * ogohlantiriladi va HECH NARSA chiqarilmaydi — yarmini chiqarish
   * eng yomon natija bo'lardi (qaysi yarmi ekani ko'rinmaydi).
   */
  const LABEL_CAP = 5000;
  const collectAll = async () => {
    /* Kod rejimida ro'yxat allaqachon to'liq (server ≤200 beradi). */
    if (codeMode || total == null || filtered.length >= total) return filtered;
    if (total > LABEL_CAP) {
      toast?.error(t("label.tooMany", { n: total, cap: LABEL_CAP }));
      return null;
    }
    const size = 200;
    const out = [];
    for (let page = 0; page * size < total; page++) {
      const r = await productApi.getPage(page, size, {
        shopId: branchId, flt: fltJson, q: slowSearch, below: belowOnly,
      });
      const got = asArray(r?.data?.content ?? r?.data);
      if (!got.length) break;
      out.push(...got);
      /* ⚠ HIMOYA: server «yana bor» deb turib, bir xil sahifani
         qaytarsa (tartib noyob emas), sikl abadiy aylanardi. */
      if (out.length >= total) break;
    }
    return out;
  };

  const printFiltered = async () => {
    setLabelBusy(true);
    try {
      const all = await collectAll();
      if (all) openLabels(all);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLabelBusy(false);
    }
  };

  const openLabels = (items) => {
    /* Xizmatda javon yorliq ham bo'lmaydi: «soch olish» ni javonga
       qo'yib bo'lmaydi va barkodi ham yo'q. */
    const printable = items.filter((p) => p.type !== "SERVICE");
    if (!printable.length) { toast?.error(t("lbl.nothing")); return; }
    /* ⚠ FAQAT ID YUBORILADI (F5). Ilgari bu yerda yorliq maydonlari
       (nom, narx, qisqa raqam) QO'LDA yig'ilardi va shu bilan
       «yorliqda nima yozilishi» qoidasi ikkinchi nusxaga ega
       bo'lardi. Endi yorliqni faqat renderer chizadi va u tovarning
       O'ZIDAN o'qiydi: bitta qoida, bitta joy. */
    setLabelItems(printable.map((p) => p.id).filter(Boolean));
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 className="page-title">{t("products.title")}</h2>
        </div>
        {/* ⚠ SINF ORQALI (V84): oltita tugma 980px da bitta qatorga
            sig'masdi va sahifa YON TOMONGA surilardi. Kassa
            monoblokida bu eng yomon nosozlik — sichqoncha g'ildiragi
            uni surmaydi va tugma bor bo'lsa ham unga yetib
            bo'lmaydi. */}
        <div className="page-actions">
          <button className="btn btn-outline btn-sm" onClick={loadData} title={t("products.refreshTitle")}>
            <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
          </button>
          {/* ⚠ FILTRLANGANLAR chiqadi, hammasi emas. Narx o'zgargandan
              keyin yorliq kerak bo'ladi va bu odatda bitta kategoriya
              yoki qidiruv natijasi — 800 ta tovarni lenta qilib chiqarish
              hech kimga kerak emas va bir rulon qog'ozni yeydi. */}
          {filtered.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={printFiltered}
                    disabled={labelBusy} title={t("label.printFilteredHint")}>
              {labelBusy ? <Spinner /> : <i className="fa-solid fa-tags" />}{" "}
              {/* ⚠ SON `shownTotal` DAN, `filtered.length` DAN EMAS:
                  ekranda 50 qator turgan bo'lsa ham tugma 300 ta
                  yorliq chiqaradi va do'konchi shuni oldindan
                  bilishi kerak. */}
              {t("label.printFiltered", { n: shownTotal })}
            </button>
          )}
          <BranchSelector selectedId={branchId} onSelect={setBranchId} />
          {!branchId && isHeadUser && (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setWizard(true)}>
                <i className="fa-solid fa-wand-magic-sparkles" /> {t("products.fromCatalog")}
              </button>
              {/* ⚠ TAYYOR KATALOG BILAN BIR XIL EMAS. Yuqoridagi tugma —
                  bo'sh do'kon uchun tipik tovarlar shabloni (bir marta,
                  boshlanishida). Bu esa UMUMIY BAZA: unda haqiqiy
                  shtrix-kodlar bor va u kundan kunga o'sib boradi —
                  yangi tovar kelganda shu yerdan qidiriladi. */}
              <button className="btn btn-outline btn-sm" onClick={() => setGcat(true)}>
                <i className="fa-solid fa-cloud-arrow-down" /> {t("gcat.button")}
              </button>
              {/* ⚠ TUGMA FAQAT YANGILANISH BOR BO'LSA. Doim ko'rinsa,
                  do'kon uni bosib har safar bo'sh ro'yxat ko'rardi va
                  bir haftadan keyin unga umuman qaramay qo'yardi. */}
              {gupdCount > 0 && (
                <button className="btn btn-outline btn-sm" onClick={() => setGupd(true)}>
                  <i className="fa-solid fa-rotate" /> {t("gcat.updButton")}
                  <span className="ek-num"> ({gupdCount})</span>
                </button>
              )}
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
          <SearchBar code value={search} onChange={setSearch} codeLabel={t("kassa.codeMode")}
            placeholder={t("products.search")} style={{ width: 320 }} />
          <DataFilter cols={COLS} flt={colFlt} />
        </div>

        {/* ⚠ FILTR YOQILGANI KO'RINIB TURSIN. Usiz ro'yxat sababsiz
            qisqargandek ko'rinardi va do'kon egasi «tovarlarim
            qayoqqa ketdi?» deb o'ylardi — signaldan kelgan odam
            filtr qo'yilganini bilmaydi. Tozalash ham shu yerda:
            manzilni qo'lda tahrirlash yechim emas. */}
        {belowOnly && (
          <div className="ek-note ek-note--warn prod-below-note">
            <i className="fa-solid fa-arrow-trend-down" aria-hidden="true" />
            <div>{t("products.belowFilter")}</div>
            <button type="button" className="btn btn-outline btn-sm"
                    onClick={() => setParams({}, { replace: true })}>
              {t("products.belowFilterClear")}
            </button>
          </div>
        )}

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
                          {/* ⚠ RASM O'RNI HAR DOIM QOLADI (V108, do'kon
                              egasi so'radi). Ilgari rasm shartli edi va
                              rasmsiz tovarning nomi 39px chapga surilib
                              ketardi: ro'yxat zinapoyaga o'xshab qolar,
                              ko'z esa nomlarni ustma-ust taqqoslay
                              olmasdi — jadvalning butun ma'nosi shu.

                              ⚠ O'rin BO'SH qoldiriladi, «rasm yo'q»
                              belgisi qo'yilmaydi: ko'p do'konda tovarlar
                              rasmsiz va har qatordagi kulrang katakcha
                              jadvalni shovqinga ko'mardi. Bo'sh joy
                              tekislaydi, lekin ko'zga ko'rinmaydi.

                              ⚠ Balandlik BERILMAYDI (`inline-flex`,
                              bo'sh): aks holda rasmsiz do'konda har
                              qator 30px ga cho'zilib, ro'yxat sababsiz
                              uzayib ketardi. */}
                          <span className="prod-thumb">
                            {p.thumbUrl && (
                              <img src={mediaApi.url(p.thumbUrl)} alt="" width={30} height={30} loading="lazy" />
                            )}
                          </span>
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
                        {/* ⚠ QISQA RAQAM TEPADA VA QALIN (V107), barkod
                            esa mayda yozuvda. Sabab oddiy: kassir
                            yodida AYNAN shu raqam qoladi va u
                            ko'rinmasa, eslab ham qolmaydi. Barkod
                            skaner uchun — uni odam o'qimaydi. */}
                        {productCode(p) != null && (
                          <div className="ek-num fw-800" title={t("products.shortCodeHint")}>
                            №{productCode(p)}
                          </div>
                        )}
                        <span className="ek-num text-muted" style={{ fontSize: 12 }}>
                          {p.barcode || p.sku || "—"}
                        </span>
                      </td>
                      <td>{p.categoryName || "—"}</td>
                      <td>
                        {p.salePrice == null
                          ? <span className="badge badge-amber">{t("products.noPrice")}</span>
                          : <span className="ek-num fw-700 text-blue">{money(p.salePrice)}</span>}
                        {/* ⚠ NARX YONIDA, alohida ustunda emas: xato
                            aynan NARXDA va belgi undan uzoqda tursa,
                            ko'z ikkisini bog'lamasdi.

                            ⚠ IKKI XIL IZOH. Tan narx optom narxdan
                            oshib, chakana narxdan oshmasligi mumkin —
                            o'shanda chakana savdo hamon foydali.
                            Bitta umumiy matn do'kon egasiga qaysi
                            narxni tuzatishni aytmasdi. */}
                        {(p.belowCost || p.belowWholesale) && (
                          <span className="badge badge-red prod-below"
                                title={p.belowCost
                                  ? t("products.belowCostTitle")
                                  : t("products.belowWholesaleTitle")}>
                            <i className="fa-solid fa-arrow-trend-down" aria-hidden="true" />
                            {t("products.belowBadge")}
                          </span>
                        )}
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
                          {/* Yorliq — endi brauzerda ham: A4 varaqqa
                              chiqadi (V108). */}
                          <button className="btn-icon" onClick={() => openLabels([p])}
                                  aria-label={t("label.print")} title={t("label.print")}>
                            <i className="fa-solid fa-tag" />
                          </button>
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

        {/* ⚠ SCROLLDA YUKLASH — RAQAMLI SAHIFA EMAS. Raqamli
            tugmalar har bosishda ro'yxatni BUTUNLAY almashtirardi:
            do'konchi 4-sahifadagi tovarni ko'rib, 5-ga o'tib, keyin
            qaytsa — o'sha qatorni yana qidirishi kerak edi.

            ⚠ KOD REJIMIDA KO'RINMAYDI: u yerda javob to'liq (server
            ≤200 qator beradi) va «yana yukla» degan tugma yolg'on
            bo'lardi. */}
        {!codeMode && (
          <InfiniteList
            loading={loading} error={error} hasNext={hasNext}
            total={total} count={filtered.length}
            onMore={loadMore} onRetry={retry} />
        )}
      </div>

      {/* ── Tayyor katalog ustasi ── */}
      {wizard && (
        <CatalogWizard
          toast={toast}
          onClose={() => setWizard(false)}
          onDone={() => { setWizard(false); loadData(); }}
        />
      )}

      {/* ── Umumiy bazadagi yangilanishlar (V93) ── */}
      {gupd && (
        <GlobalCatalogUpdates
          toast={toast}
          onClose={() => setGupd(false)}
          onDone={() => { setGupd(false); loadData(); }}
        />
      )}

      {/* ── Umumiy katalogdan olish (V90) ── */}
      {gcat && (
        <GlobalCatalogImport
          toast={toast}
          onClose={() => setGcat(false)}
          onDone={() => { setGcat(false); loadData(); }}
        />
      )}

      {/* ── Arxivdagi tovar bilan to'qnashuv (B) ── */}
      {archivedConflict && (
        <Modal
          title={t("products.archivedTitle")}
          onClose={() => setArchivedConflict(null)}
          maxWidth={480}
          footer={
            <>
              {/* ⚠ IKKALASI HAM ISH BAJARADI — biri «bekor» emas.
                  Shuning uchun ikkalasi ham to'la tugma. Oynani
                  yopish uchun ✕ yoki ESC bor. */}
              <button className="btn btn-outline" onClick={createAnyway}>
                <i className="fa-solid fa-plus" aria-hidden="true" />
                {" "}{t("products.archivedCreateNew")}
              </button>
              <button className="btn btn-primary" onClick={restoreArchived}>
                <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                {" "}{t("products.archivedRestore")}
              </button>
            </>
          }
        >
          <p>{t("products.archivedAsk", {
            product: archivedConflict.searchCode
              ? `«${archivedConflict.name}» (${archivedConflict.searchCode})`
              : `«${archivedConflict.name}»`,
          })}</p>
          {archivedConflict.lastSoldAt && (
            <p className="set-row__hint">
              {t("products.archivedLastSold")}: {fmtDateTime(archivedConflict.lastSoldAt)}
            </p>
          )}
        </Modal>
      )}

      {/* ── Javon yorlig'i (V108) ── */}
      {labelItems && (
        <LabelPrintModal productIds={labelItems} toast={toast}
                         onClose={() => setLabelItems(null)} />
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
                {/* ══ NAZORAT RAQAMI — OGOHLANTIRISH, TO'SIQ EMAS ══════
                    Shtrix-kodning oxirgi raqami qolganlaridan
                    hisoblanadi. Bitta raqamni noto'g'ri tergan odamning
                    kodi bu tekshiruvdan o'tmaydi.

                    ⚠ NEGA AYNAN SHU YERDA MUHIM: bu tovar umumiy
                    bazaga ham taklif qilinadi. Xato kod tasdiqlansa,
                    u yuzlab do'konga tarqaladi va ularning hech
                    birida skaner uni topa olmaydi.

                    ⚠ SAQLASHNI TO'SMAYDI: ichki kod, artikul va
                    ITF-14 nazorat raqamiga bo'ysunmaydi va ular
                    qonuniy. `barcodeSuspicious` ularni belgilamaydi
                    ham — faqat standart uzunlikdagi RAQAMLI kodning
                    nazorat raqami noto'g'ri bo'lsa ogohlantiradi. */}
                {barcodeSuspicious(form.barcode) && (
                  <div className="form-hint form-hint--warn">
                    <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
                    {t("products.barcodeCheckWarn")}
                  </div>
                )}

                {/* ⚠ BARKODSIZ TOVAR UCHUN O'Z KODI (V98).
                    Bozordan olingan ko'ylakda, tikuv sexidan kelgan
                    pardada barkod YO'Q — do'kon o'zi kod yaratib
                    stikerga chiqaradi.

                    ⚠ Tugma FAQAT maydon bo'sh bo'lganda ko'rinadi:
                    qadoqdagi haqiqiy barkod ustidan yozib yuborish
                    tovarni skanerdan «yo'qotardi». Server ham buni
                    rad etadi — bu yerdagisi shunchaki tugmani
                    ko'rsatmaslik.

                    ⚠ Kod SERVERDA yaraladi: u do'kon hisoblagichiga
                    tayanadi va ikki kassir bir vaqtda bosganda bitta
                    raqam ikki marta berilmasligi kerak. */}
                {!form.barcode && modal?.product?.id && (
                  <button type="button" className="btn btn-sm btn-outline"
                          style={{ marginTop: 6 }}
                          disabled={codeBusy}
                          onClick={makeStoreCode}>
                    <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />{" "}
                    {t("products.makeCode")}
                  </button>
                )}

                {/* Yaratilgan kod odam o'qiydigan ko'rinishda: kassir
                    yodida O'RTADAGI son qoladi — «yuz qirq ikki». */}
                {isStoreCode(form.barcode) && (
                  <div className="form-hint">
                    <i className="fa-solid fa-tag" aria-hidden="true" />{" "}
                    {t("products.storeCodeHint", { code: prettyStoreCode(form.barcode),
                                                   n: storeCodeShort(form.barcode) })}
                  </div>
                )}
              </FormGroup>
              <FormGroup label={t("products.sku")}>
                <Field kind="sku" className="form-input mono" value={form.sku} onChange={setField("sku")} placeholder="ART-001" />
              </FormGroup>
            </div>

            {/* ══ UMUMIY BAZADA O'XSHASHI BOR ═══════════════════════════
                ⚠ TAKLIF, TO'SIQ EMAS. «Boshqa hajmdagi shu tovar» bilan
                «o'sha tovarning xato yozilgani» ni faqat odam ajrata
                oladi. Ro'yxat faqat savolni qo'yadi.

                ⚠ Bu yerdan TO'G'RIDAN-TO'G'RI olib bo'lmaydi va bu
                ataylab: import o'z qoidalariga ega (kategoriya
                tanlash, takrorni to'sish, barkod to'qnashuvi). Ularni
                shu kichik panelda takrorlash — ikkinchi nusxa yozish
                va ertami-kechmi ikki xil natija demakdir. Shuning
                uchun odam «Umumiy bazadan» oynasiga yuboriladi. */}
            {gcatHint.length > 0 && (() => {
              /* ⚠ AYNAN SHU BARKOD topilgan bo'lsa — bu «o'xshash» emas,
                 «shu tovarning o'zi». Unda taklif ham boshqacha:
                 ro'yxat emas, bitta tugma. Do'kon nomni qo'lda terib
                 o'tirmaydi va butun tizimda bir xil nom bo'ladi. */
              const exact = gcatHint.find(
                (r) => (r.barcode || "").trim() === (form.barcode || "").trim());
              if (exact) {
                return (
                  <div className="ek-note" style={{ marginBottom: 12 }}>
                    <i className="fa-solid fa-cloud-arrow-down" aria-hidden="true" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{t("gcat.exactTitle")}</div>
                      <div style={{ fontSize: 12.5 }}>{exact.name}</div>
                    </div>
                    {/* ⚠ FAQAT NOM VA BREND. Narx, qoldiq va soliq
                        maydonlari ko'chirilmaydi: ular do'konning o'z
                        ishi va «taxminan» to'ldirish eng xavfli yechim
                        bo'lardi. */}
                    <button type="button" className="btn btn-sm btn-outline"
                            onClick={() => setForm((f) => ({
                              ...f, name: exact.name, brand: exact.brand || f.brand,
                            }))}>
                      <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />{" "}
                      {t("gcat.exactFill")}
                    </button>
                  </div>
                );
              }
              return (
                <div className="ek-note ek-note--warn" style={{ marginBottom: 12 }}>
                  <i className="fa-solid fa-clone" aria-hidden="true" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{t("gcat.similarTitle")}</div>
                    <ul className="gcat-hint">
                      {gcatHint.slice(0, 3).map((r) => (
                        <li key={r.id}>
                          <span className="ek-num">{r.barcode}</span> — {r.name}
                        </li>
                      ))}
                    </ul>
                    <div style={{ fontSize: 11.5 }}>{t("gcat.similarHint")}</div>
                  </div>
                </div>
              );
            })()}

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
                     disabled={!weighable} aria-label={t("products.plu")} />
              <div className="set-row__hint" style={{ marginTop: 4 }}>
                {weighable ? t("products.pluHint") : t("products.pluUnitHint")}
              </div>
            </FormGroup>

            <FormGroup label={`${t("products.category")} *`}>
              <Select
                block variant="field" ariaLabel={t("products.category")} placeholder={t("products.pickCategory")}
                /* ⚠ QIDIRUV MAJBURIY, avtomatik emas. Avtomatik qoida
                   bandlar soni 8 dan oshganda ishlaydi, kategoriyalar
                   esa MA'LUMOT ro'yxati: bugun beshta bo'lsa ham
                   ertaga o'ttizta bo'ladi va o'sha kuni do'kon egasi
                   ro'yxatni aylantirib qidirishga majbur qolardi.
                   Farq shunda: qat'iy ro'yxatda (to'lov turi, o'lchov
                   birligi) qidiruv ortiqcha bosqich — u hech qachon
                   o'smaydi va joylashuvi yodda qoladi. */
                searchable searchPlaceholder={t("common.searchShort")}
                disabled={categoryLocked}
                value={form.categoryId ? String(form.categoryId) : ""}
                onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
                options={[
                  /* ⚠ «Kategoriyasiz» BANDI OLIB TASHLANDI. U turgan ekan,
                     kategoriya majburiy deyish ma'nosiz edi: eng tez yo'l
                     ro'yxatning birinchi bandi bo'lib turardi va tovarlar
                     o'sha yerga oqib ketardi. */
                  /* Guruh raqami kassadagi bilan bir xil joyda — omborchi
                     tovar qo'shayotganda kod qaysi guruhdan chiqishini
                     oldindan ko'radi. */
                  ...categories.map((c) => ({ value: String(c.id), label: c.name,
                                              hint: c.code || undefined,
                                              icon: c.icon || "fa-tags" })),
                ]}
              />
              {/* ⚠ BOSHI BERK KO'CHAGA TUSHIB QOLMASIN. Yangi do'konda
                  kategoriya hali yo'q va majburiy maydon uni tovar
                  qo'sha olmaydigan holatga tushirardi — xato chiqadi,
                  lekin nima qilish kerakligi aytilmasdi. */}
              {categoryLocked && (
                <div className="set-row__hint" style={{ marginTop: 4 }}>
                  <i className="fa-solid fa-lock" aria-hidden="true" /> {t("products.categoryLocked")}
                </div>
              )}
              {!categoryLocked && categories.length === 0 && (
                <div className="set-row__hint" style={{ marginTop: 4 }}>
                  {t("products.noCategoriesYet")}
                </div>
              )}
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
