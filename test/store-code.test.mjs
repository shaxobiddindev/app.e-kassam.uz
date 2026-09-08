/* Do'konning o'z kodi — ko'rsatish va tanib olish (V98). */
import test from "node:test";
import assert from "node:assert/strict";
import { isStoreCode, prettyStoreCode, storeCodeShort } from "../src/lib/ek-store-code.js";

test("do'kon kodi tanilади", () => {
  assert.equal(isStoreCode("20001421"), true);
  assert.equal(isStoreCode("20000011"), true);
});

test("⚠ nazorat raqami xato bo'lsa tanilmaydi", () => {
  assert.equal(isStoreCode("20001427"), false, "xato nazorat raqami o'tib ketdi");
  assert.equal(isStoreCode("20001420"), false);
});

test("boshqa kodlar do'kon kodi emas", () => {
  for (const v of ["96385074", "5449000000996", "2000142", "200014211", "", null, "abc"]) {
    assert.equal(isStoreCode(v), false, `«${v}» do'kon kodi deb tanildi`);
  }
});

test("o'qishga qulay ko'rinish", () => {
  assert.equal(prettyStoreCode("20001421"), "2 000142 1");
  // ⚠ Bo'shliqli ko'rinish KOD EMAS — u qidiruvga tushmasligi kerak
  assert.equal(isStoreCode(prettyStoreCode("20001421")), false);
});

test("kassir aytadigan qisqa raqam", () => {
  assert.equal(storeCodeShort("20001421"), "142");
  assert.equal(storeCodeShort("20000011"), "1");
  assert.equal(storeCodeShort("5449000000996"), null);
});

test("do'kon kodi bo'lmagan qiymat o'zgarmaydi", () => {
  assert.equal(prettyStoreCode("5449000000996"), "5449000000996");
});

/* ── Stikerdagi barkod ────────────────────────────────────────────────
   ⚠ Do'kon kodi yorliqda EAN-8 bo'lib chiqishi kerak, Code 128 emas:
   kichik stikerda kenglik muhim va ekrandagi ko'rinishga mos kelsin. */
import { Receipt } from "../src/lib/ek-escpos.js";

test("do'kon kodi EAN-8 sifatida chiqadi", () => {
  const r = new Receipt(48);
  assert.equal(r.barcodeEan8("20001421"), true, "do'kon kodi EAN-8 bo'lib chiqmadi");
});

test("⚠ nazorat raqami xato bo'lsa yorliq BARKODSIZ chiqmasin — false qaytadi", () => {
  const r = new Receipt(48);
  assert.equal(r.barcodeEan8("20001427"), false);
  assert.equal(r.barcodeEan8("2000142"), false, "yetti xonali kod qabul qilindi");
  assert.equal(r.barcodeEan8("5449000000996"), false, "EAN-13 EAN-8 deb qabul qilindi");
});

test("haqiqiy EAN-8 ham chiqadi", () => {
  const r = new Receipt(48);
  assert.equal(r.barcodeEan8("96385074"), true);
});
