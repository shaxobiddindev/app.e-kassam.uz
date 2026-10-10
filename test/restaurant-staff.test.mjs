/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN XODIMLARI — `src/lib/ek-restaurant-staff.js`

   Ishga tushirish:  node test/restaurant-staff.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const S = await import("../src/lib/ek-restaurant-staff.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

console.log("\n── Rol ──");
ok(S.topRole(["CASHIER", "OWNER"]) === "OWNER", "bir nechta rol — kattasi");
ok(S.topRole(["ROLE_WAITER"]) === "WAITER", "ROLE_ old qo'shimchasi tashlanadi");
ok(S.topRole([]) === null, "rolsiz");
ok(S.GROUPS.MANAGER("SHOP_ADMIN") && S.GROUPS.MANAGER("OWNER") && !S.GROUPS.MANAGER("WAITER"), "menejerlar — ega va admin");
ok(S.needsPin("COOK") && !S.needsPin("OWNER"), "⚠ PIN faqat terminal rollariga kerak");

console.log("\n── Oxirgi smena ──");
const today = "2026-10-10";
ok(S.lastShiftKind(new Date(2026, 9, 10, 9, 0).toISOString(), today).kind === "today", "bugun");
ok(S.lastShiftKind(new Date(2026, 9, 9, 22, 0).toISOString(), today).kind === "yesterday", "kecha");
const old = S.lastShiftKind(new Date(2026, 9, 7, 12, 0).toISOString(), today);
ok(old.kind === "date" && old.date === "07.10", "sana: 07.10");
ok(S.lastShiftKind(null, today).kind === "never", "hech qachon");

console.log("\n── Bosh harflar ──");
ok(S.initials("Dilnoza Karimova") === "DK", "DK");
ok(S.initials("Bekzod") === "BE", "BE");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
