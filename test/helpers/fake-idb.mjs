/* ══════════════════════════════════════════════════════════════════════════
   IndexedDB O'RNIGA — sinov uchun eng kichik almashtiruvchi

   ⚠ NEGA KUTUBXONA EMAS. `fake-indexeddb` ~1 MB bog'liqlik olib
   keladi va u faqat sinovda kerak. Ilova IndexedDB ning juda tor
   qismini ishlatadi: `open`, `createObjectStore`, `transaction`,
   `put`, `get`, `getAll`, `delete`, `clear`. Shuni qoplash yetadi.

   ⚠ TRANZAKSIYA TARTIBI SAQLANADI va bu MUHIM: haqiqiy IndexedDB da
   so'rov avval bajariladi, keyin `oncomplete` chaqiriladi.
   `ek-offline.js` va `ek-catalog.js` ning `tx()` funksiyasi aynan
   shunga tayanadi — natijani `oncomplete` da o'qiydi. Tartib buzilsa
   sinov o'tardi-yu, brauzerda kod ishlamasdi.

   ⚠ BIR NECHTA BAZA VA BIR NECHTA STORE (2026-09-21). Ilgari bu yerda
   bitta `Map` bor edi va u BITTA store ni, `keyPath: "key"` bilan
   qoplardi. Oflayn katalog esa alohida bazada (`ekassam-catalog`) va
   ikkita store ishlatadi — tovarlar `keyPath: "id"` bilan, meta
   `"key"` bilan. Bitta xarita bilan ular bir-birining ustiga yozardi
   va sinov brauzerda bo'lmaydigan nosozlikni ko'rsatardi.
   ══════════════════════════════════════════════════════════════════════════ */

class FakeRequest {
  constructor(result) { this.result = result; }
}

class FakeStore {
  constructor(entry) { this.entry = entry; }
  createIndex() { /* indekslar bu yerda ahamiyatsiz — so'rov ular orqali ketmaydi */ }
  put(value) {
    const key = value[this.entry.keyPath];
    this.entry.map.set(key, JSON.parse(JSON.stringify(value)));
    return new FakeRequest(key);
  }
  get(key) {
    const v = this.entry.map.get(key);
    return new FakeRequest(v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  }
  getAll() {
    return new FakeRequest(
      [...this.entry.map.values()].map((v) => JSON.parse(JSON.stringify(v))));
  }
  delete(key) { this.entry.map.delete(key); return new FakeRequest(undefined); }
  clear() { this.entry.map.clear(); return new FakeRequest(undefined); }
}

class FakeDb {
  constructor(stores) { this.stores = stores; }

  get objectStoreNames() {
    return { contains: (name) => this.stores.has(name) };
  }

  createObjectStore(name, opts = {}) {
    const entry = { keyPath: opts.keyPath || "key", map: new Map() };
    this.stores.set(name, entry);
    return new FakeStore(entry);
  }

  transaction(name) {
    const entry = this.stores.get(name);
    if (!entry) throw new Error(`fake-idb: store yo'q — ${name}`);
    const store = new FakeStore(entry);
    const t = { objectStore: () => store, oncomplete: null, onerror: null, error: null };
    /* ⚠ `oncomplete` KEYINGI mikrovazifada — haqiqiy IndexedDB dagidek:
       chaqiruvchi avval `fn(store)` ni bajaradi, natija esa
       `oncomplete` da o'qiladi. */
    queueMicrotask(() => queueMicrotask(() => t.oncomplete && t.oncomplete()));
    return t;
  }
}

/** Sinov uchun toza baza o'rnatadi va `globalThis.indexedDB` ni beradi. */
export function installFakeIndexedDb() {
  /** bazaNomi → (storeNomi → { keyPath, map }) */
  const dbs = new Map();

  globalThis.indexedDB = {
    open(name) {
      const stores = dbs.get(name) || new Map();
      dbs.set(name, stores);
      const fresh = stores.size === 0;
      const req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        const db = new FakeDb(stores);
        req.result = db;
        /* ⚠ `onupgradeneeded` FAQAT birinchi ochilishda — brauzerdagidek.
           Har safar chaqirilsa, `createObjectStore` mavjud ma'lumotni
           o'chirib yuborardi va qayta ochish keshni yo'qotardi. */
        if (fresh && req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
  };

  const pick = (storeName) => {
    for (const stores of dbs.values()) {
      if (!storeName) {
        const first = [...stores.values()][0];
        if (first) return first;
      } else if (stores.has(storeName)) {
        return stores.get(storeName);
      }
    }
    return null;
  };

  return {
    /** Bazadagi xom yozuvlar — sinov ularni bevosita tekshiradi. */
    rows: (storeName) => {
      const entry = pick(storeName);
      return entry ? [...entry.map.values()] : [];
    },
    clear: (storeName) => {
      if (storeName) { pick(storeName)?.map.clear(); return; }
      for (const stores of dbs.values()) for (const e of stores.values()) e.map.clear();
    },
  };
}

/** `navigator.onLine`, `window` hodisalari va `setInterval` uchun eng kichik muhit. */
export function installBrowserEnv({ online = true } = {}) {
  const handlers = {};
  /* ⚠ Node 22 da `globalThis.navigator` FAQAT O'QISH uchun — oddiy
     tayinlash `TypeError` beradi. Shuning uchun xossa qayta
     e'lon qilinadi. */
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: online }, writable: true, configurable: true,
  });
  globalThis.window = {
    addEventListener: (name, fn) => { (handlers[name] ||= []).push(fn); },
  };
  return {
    setOnline(value) { globalThis.navigator.onLine = value; },
    fire(name) { (handlers[name] || []).forEach((fn) => fn()); },
  };
}
