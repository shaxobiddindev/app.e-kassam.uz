/* ══════════════════════════════════════════════════════════════════════════
   SSE O'QUVCHI — sof funksiya (2-bosqich T2)

   ⚠ NEGA `EventSource` EMAS. U sarlavha yubora olmaydi, bizning sessiya esa
   `Authorization: Bearer` da (cookie'da emas). Tokenni URL ga qo'yish uni
   nginx logiga va brauzer tarixiga yozardi. Shuning uchun oqim `fetch` bilan
   o'qiladi va matn shu yerda hodisalarga bo'linadi.

   Spetsifikatsiyadan kerakli qismi: `event:`, `data:` (bir necha qator —
   `\n` bilan qo'shiladi), `:` bilan boshlangan izoh (yurak urishi) tashlanadi,
   bo'sh qator hodisani yakunlaydi. Bo'lak qator o'rtasida uzilishi mumkin —
   qoldiq keyingi bo'lakka ulanadi.
   ══════════════════════════════════════════════════════════════════════════ */

/** @returns {(chunk: string) => void} */
export function createSseParser(onEvent) {
  let buf = "";
  let name = "";
  let data = [];
  const flush = () => {
    if (data.length) onEvent({ event: name || "message", data: data.join("\n") });
    name = "";
    data = [];
  };
  return (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.search(/\r\n|\r|\n/)) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + (buf[i] === "\r" && buf[i + 1] === "\n" ? 2 : 1));
      if (line === "") { flush(); continue; }
      if (line[0] === ":") continue;
      const c = line.indexOf(":");
      const field = c < 0 ? line : line.slice(0, c);
      const value = c < 0 ? "" : line.slice(c + 1).replace(/^ /, "");
      if (field === "event") name = value;
      else if (field === "data") data.push(value);
    }
  };
}

/** Qayta ulanish kutishi: 1, 2, 4 … 30 soniya. */
export const backoffMs = (attempt) => Math.min(30000, 1000 * 2 ** Math.max(0, attempt));
