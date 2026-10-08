/* ══════════════════════════════════════════════════════════════════════════
   ZAL REJASI (3-bosqich D2) — `src/lib/ek-floor.js`

   ⚠ ENG MUHIMI: joyi yo'q stollar bir-birining ustiga tushmaydi va rejadan
   chiqmaydi; holat «hisob berildi» band stoldan ustun; diqqat ro'yxatida
   hisob birinchi.

   Ishga tushirish:  node test/floor.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const F = await import("../src/lib/ek-floor.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

console.log("\n── Joy ──");
{
  const c = F.clampPos(2000, -10, "LONG");
  ok(c.x === 1000 - 220 && c.y === 0, "uzun stol chetdan chiqmaydi");
  const tables = [{ id: 1, x: 24, y: 24, shape: "SQUARE" }, ...Array.from({ length: 11 }, (_, i) => ({ id: i + 2, shape: i % 3 === 0 ? "LONG" : "SQUARE" }))];
  const out = F.autoPlace(tables);
  ok(out.every(F.placed), "hammasiga joy berildi");
  ok(out[0].x === 24 && !out[0].auto, "joyi bor stol o'z joyida");
  const box = (t) => ({ ...t, ...F.sizeOf(t.shape) });
  const overlap = out.map(box).some((a, i, arr) => arr.some((b, j) => j > i
    && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
  ok(!overlap, "⚠ avtomatik joylar ustma-ust tushmaydi");
  ok(out.map(box).every((t) => t.x + t.w <= F.PLANE.w && t.y + t.h <= F.PLANE.h), "hammasi tekislik ichida");
}

console.log("\n── Holat ──");
ok(F.statusOf({}) === "free", "bo'sh");
ok(F.statusOf({ order: { id: 1 } }) === "busy", "band");
ok(F.statusOf({ order: { id: 1, billAt: "2026-10-08T19:00:00Z" }, reservation: { at: "x" } }) === "bill", "hisob berildi — band va brondan ustun");
ok(F.statusOf({ reservation: { at: "2026-10-08T19:00:00Z" } }) === "resv", "bron");

console.log("\n── Diqqat ro'yxati ──");
{
  const now = Date.parse("2026-10-08T18:00:00Z");
  const halls = [{ id: 1, tables: [
    { id: 1, reservation: { at: "2026-10-08T18:30:00Z" } },
    { id: 2, reservation: { at: "2026-10-08T21:00:00Z" } },
    { id: 3, order: { billAt: "2026-10-08T17:55:00Z" } },
    { id: 4, order: { billAt: "2026-10-08T17:40:00Z" } },
    { id: 5, order: {} },
  ] }];
  const a = F.attention(halls, now);
  ok(a.map((x) => x.table.id).join() === "4,3,1", "hisob (eskisi birinchi), keyin bir soatlik bron; uzoq bron va oddiy band yo'q");
}

console.log("\n── Vaqt ──");
{
  const now = new Date(2026, 9, 8, 18, 0);
  const iso = F.atToday("20:30", now);
  ok(new Date(iso).getHours() === 20 && new Date(iso).getDate() === 8, "«20:30» — bugun");
  const night = F.atToday("01:00", now);
  ok(new Date(night).getDate() === 9, "«01:00» kechqurun — ertaga tunda");
  ok(F.atToday("25:00", now) === null && F.atToday("abc", now) === null, "noto'g'ri vaqt — null");
  ok(F.hhmm(iso) === "20:30", "hhmm");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
