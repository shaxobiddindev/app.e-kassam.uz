/* ══════════════════════════════════════════════════════════════════════════
   SSE O'QUVCHI (2-bosqich T2) — `src/lib/ek-sse.js`

   ⚠ ENG MUHIMI: bo'lak qator o'rtasida uzilsa ham hodisa butun keladi va
   yurak urishi (izoh) hodisa bo'lib chiqmaydi — aks holda stollar oynasi har
   20 soniyada bekorga qayta o'qirdi.

   Ishga tushirish:  node test/sse.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { createSseParser, backoffMs } = await import("../src/lib/ek-sse.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

const run = (chunks) => {
  const got = [];
  const push = createSseParser((e) => got.push(e));
  for (const c of chunks) push(c);
  return got;
};

console.log("\n── SSE o'quvchi ──");
{
  const one = run(['event: hello\ndata: {}\n\n']);
  ok(one.length === 1 && one[0].event === "hello" && one[0].data === "{}", "oddiy hodisa");

  const split = run(['event:tab', 'le\ndata:{"orderId"', ':5}\n', '\n']);
  ok(split.length === 1 && split[0].event === "table" && JSON.parse(split[0].data).orderId === 5,
     "⚠ bo'lak qator o'rtasida uzildi — hodisa butun keldi");

  const ping = run([':ping\n\n', ': ping\n\n']);
  ok(ping.length === 0, "⚠ yurak urishi (izoh) hodisa emas");

  const crlf = run(['event: table\r\ndata: {"a":1}\r\n\r\nevent: table\rdata: {"a":2}\r\r']);
  ok(crlf.length === 2 && crlf[1].data === '{"a":2}', "CRLF va CR qator oxirlari");

  const multi = run(['data: a\ndata: b\n\n']);
  ok(multi.length === 1 && multi[0].event === "message" && multi[0].data === "a\nb", "ko'p qatorli data, nomsiz — «message»");

  const two = run(['event: table\ndata: 1\n\nevent: table\ndata: 2\n\n']);
  ok(two.map((e) => e.data).join() === "1,2", "bir bo'lakda ikki hodisa");

  const tail = run(['event: table\ndata: 1\n']);
  ok(tail.length === 0, "yakunlanmagan hodisa (bo'sh qatorsiz) chiqmaydi");
}

console.log("\n── Qayta ulanish kutishi ──");
ok(backoffMs(0) === 1000 && backoffMs(1) === 2000 && backoffMs(3) === 8000, "1, 2, 4, 8 soniya");
ok(backoffMs(10) === 30000, "30 soniyadan oshmaydi");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
