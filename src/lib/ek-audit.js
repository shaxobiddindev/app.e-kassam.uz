/* ══════════════════════════════════════════════════════════════════════════
   AMALLAR JURNALI — DO'KON KO'RADIGAN AMALLAR RO'YXATI (V81)

   ═══ NEGA ALOHIDA FAYL ════════════════════════════════════════════════

   Ro'yxat `AuditPage.jsx` ichida edi va uni sinovdan tekshirib
   bo'lmasdi (React sahifasini Node'dan yuklab bo'lmaydi). Natijada u
   jimgina eskirdi: serverda amal qo'shilardi, bu yerda esa yo'q.

   ⚠ RO'YXAT SERVERDAN OLINMAYDI. Buning uchun alohida endpoint kerak
   bo'lardi va u har sahifa ochilishida so'ralardi — hisobiga esa
   faqat qo'lda yozishdan qutulardik. Shuning uchun ro'yxat shu yerda,
   lekin uning TO'LIQLIGINI sinov qo'riqlaydi.

   ═══ NEGA HAMMA AMAL EMAS ═════════════════════════════════════════════

   Serverda 51 ta amal bor, do'kon esa ularning hammasini KO'RMAYDI:
   `/shop/audit` javobi do'kon raqami bo'yicha kesiladi
   (`ShopService.audit` → `auditQueryService.search(action, shopId, …)`).

   Ya'ni do'kon egasi FAQAT o'z do'koni raqami bilan yozilgan amallarni
   oladi. Admin panelining ichki amallari (`ADMIN_LOGIN`,
   `ADMIN_CREATE`, `CONTACT_HANDLED`, `IMPERSONATE`) do'kon raqamisiz
   yoziladi va bu ro'yxatda ham yo'q — ular hech qachon kelmaydi.

   ⚠ ADMIN YOZGAN, LEKIN DO'KONGA TEGISHLI amallar esa BOR:
   `SHOP_UPDATE`, `SHOP_STATUS_CHANGE`, `PAYMENT_REGISTER`,
   `SUBSCRIPTION_EXPIRED`… Ular do'kon raqami bilan yoziladi, ya'ni
   egasiga KELADI. Ro'yxatda bo'lmasa, ular jurnalda ko'rinib turib,
   filtrda tanlanmasdi — «obunam nega to'xtadi?» degan savolga javob
   beradigan qator aynan shunday yo'qolgan edi.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Do'kon jurnalida uchraydigan amallar — filtr ro'yxati shu.
 *
 * ⚠ TARTIB — MA'NO BO'YICHA (kassa → narx → ombor → pul → mijoz →
 * xodim → do'kon), alifbo bo'yicha emas: egasi «kassada nima bo'ldi?»
 * deb qidiradi, «C harfidan boshlanadiganini» emas.
 */
export const AUDIT_ACTIONS = [
  /* ── Kassa ── */
  "SHIFT_CLOSE", "CASH_MOVEMENT", "SALE_CANCEL", "SALE_RETURN", "SALE_CORRECTION",
  "CART_ABANDONED",

  /* ── Tovar va narx ── */
  "PRODUCT_DELETE", "PRODUCT_CODE_ISSUE", "PRICE_CHANGE", "PRICE_BULK_CHANGE",

  /* ── Ombor ── */
  "STOCK_TAKE_CLOSE", "STOCK_TAKE_CANCEL", "GOODS_RECEIPT",
  "TRANSFER_SEND", "TRANSFER_RECEIVE", "TRANSFER_CANCEL",

  /* ── Pul ── */
  "EXPENSE_CREATE", "EXPENSE_DELETE", "SUPPLIER_PAYMENT",

  /* ── Mijoz ── */
  "CUSTOMER_DEBT_ADJUST", "CREDIT_PAYMENT_REVERSE", "CUSTOMER_ARCHIVE", "LOYALTY_TIER_CHANGE",
  "BONUS_SPEND", "BONUS_ADJUST", "BONUS_EXPIRE",

  /* ── Xodim va qurilma ── */
  "USER_CREATE", "USER_UPDATE", "USER_DELETE", "USER_BLOCK", "USER_UNBLOCK",
  "USER_PASSWORD_CHANGE", "DEVICE_TRUSTED", "DEVICE_CONFIRMED", "STORE_SWITCH",

  /* ── Do'kon sozlamalari ── */
  "SHOP_SETTING_CHANGE", "ANNOUNCEMENT_CHANGE",

  /* ── Admin yozgan, lekin DO'KONGA tegishli (yuqoridagi izoh) ── */
  "SHOP_CREATE", "SHOP_UPDATE", "SHOP_STATUS_CHANGE", "SHOP_DELETE",
  "PAYMENT_REGISTER", "SUBSCRIPTION_EXPIRED", "SHOP_DIRECTIONS_CHANGE",
  "SHOP_FEATURE_CHANGE",
];

/**
 * PULGA TEGADIGAN amallar — jurnalda ajratib ko'rsatiladi.
 *
 * ⚠ Jurnalning asosiy maqsadi aynan shu qatorlarni topish: «bu pulni
 * kim chiqardi?». Ular ro'yxatning qolganidan ajralib turmasa, egasi
 * ularni yuzta qator orasidan qidirishga majbur bo'lardi.
 *
 * ⚠ `BONUS_ADJUST` ham shu yerda: ball — chegirma, ya'ni qo'lda
 * qo'shilgan ball do'konga pul kabi tushadi. `BONUS_SPEND` esa
 * odatiy hodisa (mijoz o'z ballini ishlatdi) va ajratilmaydi.
 */
export const AUDIT_MONEY = new Set([
  "CASH_MOVEMENT", "SALE_CANCEL", "SALE_RETURN", "EXPENSE_DELETE",
  /* ⚠ TUZATUVCHI CHEK (V86) — bu ro'yxatga tegishli eng o'tkir
     amallardan biri. Qaytarish va bekor qilish MAVJUD chekka
     tayanadi, tuzatishda esa summani ODAM yozadi: hisobotdagi tushum
     bir kishi yozgan raqamga o'zgaradi. Egasi buni yuzta qator
     orasidan qidirmasligi kerak. */
  "SALE_CORRECTION",
  "CUSTOMER_DEBT_ADJUST", "SHOP_SETTING_CHANGE", "PRICE_BULK_CHANGE",
  "BONUS_ADJUST",
  /* ⚠ TO'LOVNI BEKOR QILISH (V102) — bu ro'yxatdagi eng o'tkir amal:
     u YASHIKDAN NAQD CHIQARADI. Aynan «bu pulni kim chiqardi?» degan
     savolning javobi va u ko'zga birinchi tashlanishi kerak. */
  "CREDIT_PAYMENT_REVERSE",
]);
