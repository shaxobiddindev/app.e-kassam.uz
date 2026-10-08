/* ══════════════════════════════════════════════════════════════════════════
   TAROZI PORTI QAYTA OCHILADI — WEB SERIAL QOIDASI BILAN (2026-10-08)

   Egasi: «brauzerda yana tarozi bilan ulanishda muammo». Sabab: yopishda
   o'quvchi qulfi bo'shatilmasdi, Web Serial esa qulflangan oqim bilan portni
   yopmaydi — port ochiq qolib, keyingi `open()` «allaqachon ochiq» bo'lardi.

   ⚠ Soxta port HAQIQIY qoidalarni bajaradi (oldingi sinovlardagi port hech
   narsani tekshirmasdi va xato shuning uchun ko'rinmay qolgan):
     · ochiq portni qayta ochish — InvalidStateError;
     · qulflangan `readable` bilan `close()` — TypeError.

   Ishga tushirish:  node test/serial-reopen.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { open } = await import("../src/lib/ek-serial.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

function strictPort(frame) {
  const enc = new TextEncoder();
  const port = {
    readable: null, writable: null, opens: 0,
    async open() {
      if (this.readable) { const e = new Error("The port is already open."); e.name = "InvalidStateError"; throw e; }
      this.opens++;
      let id = null;
      this.readable = new ReadableStream({
        start(c) { port._c = c; id = setInterval(() => { try { c.enqueue(enc.encode(frame)); } catch (_) { clearInterval(id); } }, 30); },
        cancel() { clearInterval(id); },
      });
      this.writable = new WritableStream({ write() {} });
    },
    async close() {
      if (this.readable?.locked || this.writable?.locked) throw new TypeError("Cannot close a port with a locked stream.");
      this.readable = null;
      this.writable = null;
    },
    async setSignals() {},
  };
  return port;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("\n── Yopib, qayta ochish ──");
{
  const port = strictPort("ST,GS,+  0.350kg\r\n");
  let kg = null;
  const stop1 = await open(port, { baudRate: 9600 }, (st) => { kg = st?.kg ?? kg; });
  await wait(150);
  ok(kg != null, "birinchi ulanish: og'irlik keldi (" + kg + ")");
  await stop1();
  ok(port.readable === null, "⚠ port HAQIQATAN yopildi (qulf bo'shatildi)");

  kg = null;
  let err = null;
  let stop2 = null;
  try { stop2 = await open(port, { baudRate: 9600 }, (st) => { kg = st?.kg ?? kg; }); } catch (e) { err = e; }
  await wait(150);
  ok(!err && kg != null, "⚠ qayta ulanish ishladi (ilgari «allaqachon ochiq» bo'lardi)" + (err ? ": " + err.message : ""));
  await stop2?.();
  ok(port.opens === 2 && port.readable === null, "ikki marta ochildi, ikkalasida yopildi");
}

console.log("\n── Ochiq qolgan port ──");
{
  const port = strictPort("ST,GS,+  1.000kg\r\n");
  await port.open();             // boshqa ulanishdan qolgan, qulfsiz
  let err = null;
  let stop = null;
  try { stop = await open(port, {}, () => {}); } catch (e) { err = e; }
  ok(!err, "ochiq qolgan port avval yopiladi va qayta ochiladi" + (err ? ": " + err.message : ""));
  await stop?.();
}

console.log("\n── Oqim o'zi tugadi (USB sug'urildi) ──");
{
  const port = strictPort("x");
  let ended = 0;
  const stop = await open(port, { onEnd: () => { ended++; } }, () => {});
  await wait(60);
  /* Qurilma yo'qoldi: oqim xato bilan tugaydi. */
  port._c.error(new Error("device lost"));
  await wait(50);
  ok(ended === 1, "oqim o'ldi — chaqiruvchiga aytildi (onEnd)");
  await stop();
  ok(port.readable === null, "uzilgandan keyin ham port yopiladi");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
