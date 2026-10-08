/* ══════════════════════════════════════════════════════════════════════════
   STOLLAR — JONLI ULANISH (2-bosqich T2, `GET /tables/events`)

   Ilovada BITTA ulanish: kassa ham, stollar oynasi ham shunga obuna bo'ladi
   (birinchi obunachi ochadi, oxirgisi yopadi). Har qurilma bir nechta oqim
   ochsa, serverdagi do'kon chegarasi (64) tez to'lardi.

   ⚠ HODISA FAQAT «NIMA O'ZGARDI» — buyurtmani obunachi o'zi o'qiydi.
   ⚠ QAYTA ULANISHDA «hello» keladi va obunachilar hammasini bir marta qayta
   o'qiydi: uzilish paytidagi hodisalar yo'qolgan (server ularni saqlamaydi).
   ⚠ O'Z HODISASI tashlanadi (`by` — shu qurilma): aks holda kassa o'zi yozgan
   buyurtmani qayta o'qib, shu orada qo'shilgan taomni ustidan yozardi.
   ⚠ Server oqim bermasa (eski backend, modul o'chiq — 403/404, JSON javob)
   tez-tez urinilmaydi: 5 daqiqadan keyin. Stollar oynasi baribir 15 soniyada
   o'zi yangilanadi.
   ══════════════════════════════════════════════════════════════════════════ */
import { API_BASE, getDeviceId } from "../config";
import { refreshSession } from "../api";
import { createSseParser, backoffMs } from "./ek-sse";

const subs = new Set();
let ctrl = null;
let timer = null;
let attempt = 0;
let live = false;

/** Oqim hozir ulanganmi (stollar oynasi so'rovni siyraklashtiradi). */
export const isLive = () => live;

/**
 * @param fn ({kind, tableId, orderId, version, status} | {kind: "hello"}) => void
 * @returns obunani bekor qilish
 */
export function subscribeTables(fn) {
  subs.add(fn);
  if (subs.size === 1) connect();
  return () => {
    subs.delete(fn);
    if (subs.size === 0) stop();
  };
}

function emit(e) {
  for (const fn of [...subs]) {
    try { fn(e); } catch { /* bitta obunachi xatosi qolganlarini to'xtatmasin */ }
  }
}

function stop() {
  clearTimeout(timer);
  timer = null;
  ctrl?.abort();
  ctrl = null;
  live = false;
  attempt = 0;
}

function retry(ms) {
  live = false;
  if (!subs.size) return;
  clearTimeout(timer);
  timer = setTimeout(connect, ms);
}

async function connect() {
  if (!subs.size) return;
  ctrl?.abort();
  const my = new AbortController();
  ctrl = my;
  const me = getDeviceId();
  try {
    let res = await open(my);
    if (res.status === 401 && await refreshSession()) res = await open(my);
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("text/event-stream") || !res.body) {
      res.body?.cancel?.().catch(() => {});
      return retry(res.status === 401 || res.status >= 500 ? backoffMs(attempt++) : 5 * 60 * 1000);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    /* ⚠ JIM O'LIM: Wi-Fi uzilib qolsa `read()` xato bermay daqiqalab osilib
       turadi. Server har 20 soniyada izoh yuboradi — 50 soniya hech narsa
       kelmasa ulanish o'lik deb olinadi. */
    let last = Date.now();
    const dog = setInterval(() => {
      if (Date.now() - last < 50000 || ctrl !== my) return;
      clearInterval(dog);
      my.abort();
      retry(1000);
    }, 10000);
    const push = createSseParser(({ event, data }) => {
      if (event === "hello") { live = true; attempt = 0; emit({ kind: "hello" }); return; }
      if (event !== "table") return;
      let e;
      try { e = JSON.parse(data); } catch { return; }
      if (e && e.by && e.by === me) return;
      emit(e);
    });
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        last = Date.now();
        push(dec.decode(value, { stream: true }));
      }
    } finally {
      clearInterval(dog);
    }
    /* Server oqimni o'zi yopdi (10 daqiqalik muddat yoki deploy) — darhol qayta. */
    if (ctrl === my) retry(live ? 300 : backoffMs(attempt++));
  } catch {
    if (ctrl === my && !my.signal.aborted) retry(backoffMs(attempt++));
  }
}

function open(my) {
  const token = localStorage.getItem("ek_token");
  return fetch(`${API_BASE}/tables/events`, {
    signal: my.signal,
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "text/event-stream",
      "X-Device-Id": getDeviceId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
