/* ══════════════════════════════════════════════════════════════════════════
   Skaner oynasi — qaysi holat va nima ko'chadi (2026-10-01).

   ⚠ NEGA: egasining talabi ikki qismli. Katalogda tovar bu do'konda yo'q,
   boshqa do'konlarda bor bo'lsa — ko'chirish taklif qilinadi, «narx va
   do'konga tegishli muhim ma'lumot o'tmasin». Omborda esa faqat do'kondagi
   tovar topiladi. Ikkalasi ham shu yerda — brauzersiz — tekshiriladi.

   Ishga tushirish:  node test/scan-result.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { scanOutcome, copyFields } from "../src/lib/ek-scan-result.js";

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (a, e, m) => (a === e ? ok(m) : bad(`${m} (kutilgan: ${JSON.stringify(e)})`, a));

const P = { id: 7, name: "Pepsi 1L" };
const S = (status, extra = {}) => ({ name: "Fanta 1L", unit: "DONA", status, ...extra });

console.log("\n═══ 1. Do'kondagi tovar ═══");
eq(scanOutcome("1", { source: "PRODUCT", product: P }).kind, "found", "oddiy barkod");
const pack = scanOutcome("1", { source: "PACK", product: P, packLabel: "Quti 12" });
eq(pack.kind + "|" + pack.packLabel, "found|Quti 12", "qadoq barkodi — yorlig'i bilan");
eq(scanOutcome("1", { source: "WEIGHT", product: P }).kind, "found", "tarozi barkodi");
eq(scanOutcome("1", { source: "PRODUCT", product: null }).kind, "none", "tovarsiz javob — topilmagan");

console.log("\n═══ 2. Arxiv va boshqa filial ═══");
eq(scanOutcome("1", { source: "ARCHIVED", archivedMatch: { productId: 3, name: "Eski" } }).kind, "archived", "arxivdagi");
const ob = scanOutcome("1", { source: "OTHER_BRANCH", otherShopName: "Chilonzor" });
eq(ob.kind + "|" + ob.shopName, "otherBranch|Chilonzor", "boshqa filialning ichki kodi");

console.log("\n═══ 3. Katalog: ko'chirish taklifi ═══");
const g = scanOutcome("1", { source: "GLOBAL", suggestion: S("VERIFIED") }, null, { allowCopy: true });
eq(g.kind + "|" + g.verified, "suggest|true", "umumiy katalog (tasdiqlangan)");
const pend = scanOutcome("1", { source: "NONE" }, S("PENDING"), { allowCopy: true });
eq(pend.kind + "|" + pend.verified, "suggest|false", "tasdiqlanmagan — taklif, belgisi bilan");
const shop = scanOutcome("1", { source: "NONE" }, S("SHOP"), { allowCopy: true });
eq(shop.kind + "|" + shop.verified, "suggest|false", "faqat boshqa do'konda — taklif, belgisi bilan");
eq(scanOutcome("1", { source: "NONE" }, null, { allowCopy: true }).kind, "none", "hech qayerda yo'q");

console.log("\n═══ 4. ⚠ Omborda ko'chirish YO'Q ═══");
eq(scanOutcome("1", { source: "GLOBAL", suggestion: S("VERIFIED") }, null, { allowCopy: false }).kind, "none",
  "katalogda bor — baribir «bu do'konda yo'q»");
eq(scanOutcome("1", { source: "NONE" }, S("PENDING")).kind, "none", "sukut bo'yicha ko'chirish o'chiq");

console.log("\n═══ 5. ⚠ Ko'chirishda faqat tavsif ═══");
const leaky = S("PENDING", {
  mxikCode: "10202001001000000", packageCode: "123", markingGroup: "WATER",
  salePrice: 9000, costPrice: 7000, wholesalePrice: 8000, categoryId: 5, sku: "A-1", plu: "77",
  vatRate: 12, stockQuantity: 40, shopName: "Raqobatchi",
});
const f = copyFields(leaky, "4780000000011");
eq(Object.keys(f).sort().join(), "barcode,imageId,imageUrl,markingGroup,mxikCode,name,packageCode,unit",
  "faqat oq ro'yxatdagi maydonlar");
eq(f.name + "|" + f.barcode + "|" + f.mxikCode, "Fanta 1L|4780000000011|10202001001000000", "tavsif ko'chdi");
eq(f.imageUrl, null, "imageId yo'q — rasm ham yo'q (do'konning o'z surati emas)");
const withImg = copyFields(S("VERIFIED", { imageId: 9, thumbUrl: "/media/a_t.jpg" }), "1");
eq(withImg.imageId + "|" + withImg.imageUrl, "9|/media/a_t.jpg", "umumiy rasm — biriktiriladi");
eq(copyFields(S("SHOP", { unit: null }), "1").unit, "DONA", "birlik yo'q — sukut «dona»");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
