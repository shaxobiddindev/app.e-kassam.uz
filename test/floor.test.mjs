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
  ok(c.x === 1000 - F.sizeOf("LONG").w && c.y === 0, "uzun stol chetdan chiqmaydi");
  const tables = [{ id: 1, x: 24, y: 24, shape: "SQUARE" }, ...Array.from({ length: 11 }, (_, i) => ({ id: i + 2, shape: i % 3 === 0 ? "LONG" : "SQUARE" }))];
  const out = F.autoPlace(tables);
  ok(out.every(F.placed), "hammasiga joy berildi");
  ok(out[0].x === 24 && !out[0].auto, "joyi bor stol o'z joyida");
  const overlap = out.map(F.boxOf).some((a, i, arr) => arr.some((b, j) => j > i && F.overlaps(a, b)));
  ok(!overlap, "⚠ avtomatik joylar ustma-ust tushmaydi (orada GAP bo'shliq ham bor)");
  ok(out.map(F.boxOf).every((t) => t.x + t.w <= F.PLANE.w && t.y + t.h <= F.PLANE.h), "hammasi tekislik ichida");
}

console.log("\n── Vizual muharrir (V164): shakllar, o'rinlar, bo'shliq ──");
{
  ok(F.PRESETS.length === 4, "⚠ faqat 4 ta tayyor shakl (egasi: «murakkab bo'lib ketmasin»)");
  ok(F.seatsOf("SQUARE", 9) === 4 && F.seatsOf("ROUND", 1) === 2 && F.seatsOf("LONG", 99) === 12, "o'rinlar shakl chegarasida");
  ok(F.seatsOf("LONG", null) === 6, "o'rin yo'q — shaklning odatdagisi");
  ok(F.sizeOf("LONG", 10).w > F.sizeOf("LONG", 6).w, "uzun stol o'rin qo'shilsa uzayadi");
  ok(F.sizeOf("ROUND", 8).w > F.sizeOf("ROUND", 4).w, "dumaloq stol o'rin qo'shilsa kattalashadi");
  const h = F.sizeOf("LONG", 8, false), v = F.sizeOf("LONG", 8, true);
  ok(h.w === v.h && h.h === v.w, "burilgan uzun stol — eni va bo'yi almashadi");
  for (const [sh, n] of [["SQUARE", 2], ["SQUARE", 4], ["ROUND", 6], ["LONG", 7]]) {
    ok(F.chairsOf(sh, n).length === n, `${sh} ${n} — ${n} ta stul chiziladi`);
  }

  const a = { id: 1, x: 100, y: 100, shape: "SQUARE", seats: 4 };
  const near = { id: 2, x: 100 + F.sizeOf("SQUARE", 4).w + 4, y: 100, shape: "SQUARE", seats: 4 };
  ok(!F.fits(near, [a, near]), "⚠ 4 birlik oraliq — sig'maydi (juda yopishib ketmasin)");
  const far = { ...near, x: 100 + F.sizeOf("SQUARE", 4).w + F.GAP };
  ok(F.fits(far, [a, far]), "GAP oraliq — sig'adi");
  const p = F.nearestFree({ id: 3, x: 104, y: 104, shape: "ROUND", seats: 4 }, [a]);
  ok(p && F.fits({ id: 3, ...p, shape: "ROUND", seats: 4 }, [a]), "ustiga tashlangan stol eng yaqin bo'sh joyga suriladi");
  ok(Math.hypot(p.x - 104, p.y - 104) < 200, "…va uzoqqa emas");
  const full = Array.from({ length: 200 }, (_, i) => ({ id: 100 + i, x: (i % 20) * 50, y: Math.floor(i / 20) * 64, shape: "SQUARE", seats: 1 }));
  ok(F.nearestFree({ id: 9, x: 0, y: 0, shape: "LONG", seats: 12 }, full) === null, "joy yo'q — null (stol qo'shilmaydi)");

  ok(F.nextName([{ name: "Stol 3" }, { name: "Oyna yoni" }, { name: "Stol 12" }], "Stol") === "Stol 13", "keyingi nom — eng katta raqamdan keyingisi");
  ok(F.nextName([], "Stol") === "Stol 1", "birinchi stol — 1");
}

console.log("\n── Zal ko'rinishi: bo'sh joy kesiladi (V164) ──");
{
  const tables = [{ id: 1, x: 600, y: 400, shape: "SQUARE", seats: 4 }, { id: 2, x: 800, y: 480, shape: "LONG", seats: 6 }];
  const b = F.fitBox(tables);
  ok(b.x > 0 && b.y > 0, "chap-yuqoridagi bo'sh tekislik chizilmaydi");
  ok(tables.map(F.boxOf).every((t) => t.x >= b.x && t.y >= b.y && t.x + t.w <= b.x + b.w && t.y + t.h <= b.y + b.h), "hamma stol kesim ichida");
  ok(b.w >= 480 && b.h >= 300, "⚠ eng kichik o'lcham: ikki stol ekranni to'ldirib ulkan bo'lmaydi");
  ok(b.x + b.w <= F.PLANE.w && b.y + b.h <= F.PLANE.h, "kesim tekislikdan chiqmaydi");
  const all = F.fitBox([{ id: 1, x: 0, y: 0, shape: "SQUARE" }, { id: 2, x: 840, y: 520, shape: "SQUARE" }]);
  ok(all.w === F.PLANE.w || all.w <= F.PLANE.w, "butun zal band — butun tekislik");
}

console.log("\n── Zal ekrani: bo'sh joy tejaladi (2026-10-13) ──");
{
  /* Egasining skrinshoti: 6 ta stol 3×3 to'rda, muharrir qoidasi bilan zich. */
  const grid = [[0, 0], [138, 0], [276, 0], [0, 138], [138, 138], [0, 276]]
    .map(([x, y], i) => ({ id: i + 1, x: 100 + x, y: 80 + y, shape: "SQUARE", seats: 4 }));
  const same = F.squeeze(grid);
  ok(same.every((t, i) => t.x === grid[i].x && t.y === grid[i].y), "zich reja — siqilmaydi (bo'shliq 18 < MAX_GAP)");

  const far = [{ id: 1, x: 0, y: 0, shape: "SQUARE", seats: 4 }, { id: 2, x: 600, y: 0, shape: "SQUARE", seats: 4 },
               { id: 3, x: 0, y: 400, shape: "ROUND", seats: 4 }, { id: 4, x: 620, y: 420, shape: "LONG", seats: 6 }];
  const sq = F.squeeze(far);
  /* Chap guruhning o'ng cheti — eng keng qutidan (dumaloq stol 122, kvadrat 120). */
  const gapX = sq[1].x - Math.max(sq[0].x + F.boxOf(sq[0]).w, sq[2].x + F.boxOf(sq[2]).w);
  ok(gapX === F.MAX_GAP, `uzoq stollar yaqinlashdi: x bo'shliq ${gapX} = MAX_GAP`);
  ok(sq[0].x < sq[1].x && sq[2].y > sq[0].y && sq[3].x > sq[2].x && sq[3].y > sq[1].y, "tartib saqlandi (chapdagi chapda, pastdagi pastda)");
  const boxes = sq.map(F.boxOf);
  const clash = boxes.some((a, i) => boxes.some((b, j) => i < j && F.overlaps(a, b, 0)));
  ok(!clash, "siqilganda ustma-ust tushmaydi");
  ok(F.squeeze([{ id: 1, x: 300, y: 300 }])[0].x === 300, "bitta stol — joyida");

  const { view, items } = F.floorView(grid);
  const s1 = items[0], s2 = items[1];
  const bodyW = (s1.width / 100) * view.w;
  const between = ((s2.left - s1.left - s1.width) / 100) * view.w;
  ok(bodyW === 120 - F.INSET * 2, `stol stullar zonasiga kirib chiziladi: ${bodyW} birlik (ilgari 84)`);
  ok(between >= 20 && between < 40, `stollar orasi ${between} birlik — yaqin, lekin yopishmagan (ilgari 54)`);
  ok(items.every((it) => it.left >= 0 && it.top >= 0 && it.left + it.width <= 100.0001 && it.top + it.height <= 100.0001), "hamma stol kesim ichida");
}

console.log("\n── O'ng ustun: ochiq stollar va ofitsiantlar (2026-10-13) ──");
{
  const now = Date.parse("2026-10-13T12:00:00Z");
  const ago = (m) => new Date(now - m * 60000).toISOString();
  const halls = [{ id: 1, name: "Zal", tables: [
    { id: 1, name: "Stol 1", seats: 4, order: { openedAt: ago(30), total: 50000, openedByName: "Ali" } },
    { id: 2, name: "Stol 2", seats: 6, order: { openedAt: ago(3565), total: 0, openedByName: "Vali" } },
    { id: 3, name: "Stol 3", seats: 4, order: null },
    { id: 4, name: "Stol 4", seats: 2, order: { openedAt: ago(90), total: 20000, openedByName: "Ali" } },
    { id: 5, name: "Stol 5", seats: 6, order: { openedAt: null, total: 1000 } },
  ] }];
  const o = F.openTables(halls, now);
  ok(o.map((x) => x.table.id).join() === "2,4,1,5", "⚠ eng uzoq ochig'i tepada (2.5 kunlik unutilgan hisob — birinchi), vaqtsizi oxirida");
  ok(o[0].long && !o[1].long, `${F.LONG_OPEN_MIN} daqiqadan uzog'i — «uzoq ochiq»`);
  ok(o[3].min === null && o[3].who === "", "vaqt va ofitsiant yo'q — bo'sh, yiqilmaydi");
  const cap = F.freeCapacity(halls);
  ok(cap.tables === 1 && cap.seats === 4, "bo'sh: 1 stol · 4 o'rin");
  const w = F.waiterLoad(halls);
  ok(w[0].who === "Ali" && w[0].tables === 2 && w[0].total === 70000, "ofitsiant yuki: Ali — 2 stol, 70 000");
  ok(w.some((x) => x.who === "" && x.tables === 1), "ismi yo'q buyurtmalar — bitta «belgilanmagan» guruhi");
  ok(F.openTables(null).length === 0 && F.waiterLoad(undefined).length === 0, "ma'lumot yo'q — bo'sh ro'yxat");
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

console.log("\n── Oshxona holatlari (D5) ──");
{
  const now = Date.parse("2026-10-08T18:00:00Z");
  const ago = (m) => new Date(now - m * 60000).toISOString();
  ok(F.statusOf({ order: { kitchenReady: 1, billAt: ago(1) } }, now) === "ready", "⚠ tayyor taom — hisobdan ham ustun (sovuyapti)");
  ok(F.statusOf({ order: { kitchenWaitingSince: ago(25) } }, now) === "late", "25 daqiqa kutyapti — kechikmoqda");
  ok(F.statusOf({ order: { kitchenWaitingSince: ago(5) } }, now) === "busy", "5 daqiqa — oddiy band");
  ok(F.urgencyOf(ago(3), now) === "new" && F.urgencyOf(ago(14), now) === "hurry" && F.urgencyOf(ago(21), now) === "late",
     "oshxona ekrani: yangi · shoshiling · kechikdi");
  const halls = [{ id: 1, tables: [
    { id: 1, order: { billAt: ago(3) } },
    { id: 2, order: { kitchenWaitingSince: ago(30) } },
    { id: 3, order: { kitchenReady: 2 } },
  ] }];
  ok(F.attention(halls, now).map((x) => x.kind).join() === "ready,late,bill", "diqqat: tayyor → kechikmoqda → hisob");
}

console.log("\n── Telefon tartibi ──");
{
  const out = F.byPlace([{ id: 3, x: 500, y: 300 }, { id: 2, x: 600, y: 20 }, { id: 1, x: 20, y: 40 }]);
  ok(out.map((t) => t.id).join() === "1,2,3", "yuqoridan pastga, bir qatorda chapdan o'ngga");
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
