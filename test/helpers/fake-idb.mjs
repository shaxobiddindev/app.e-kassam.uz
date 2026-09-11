/* ══════════════════════════════════════════════════════════════════════════
   IndexedDB O'RNIGA — sinov uchun eng kichik almashtiruvchi

   ⚠ NEGA KUTUBXONA EMAS. `fake-indexeddb` ~1 MB bog'liqlik olib
   keladi va u faqat sinovda kerak. `ek-offline.js` esa IndexedDB
   ning juda tor qismini ishlatadi: `open`, `createObjectStore`,
   `createIndex`, `transaction`, `put`, `getAll`, `delete`. Shuni
   qoplash yetadi.

   ⚠ TRANZAKSIYA TARTIBI SAQLANADI va bu MUHIM: haqiqiy IndexedDB da
   so'rov avval bajariladi, keyin `oncomplete` chaqiriladi.
   `ek-offline.js` ning `tx()` funksiyasi aynan shunga tayanadi —
   natijani `oncomplete` da o'qiydi. Tartib buzilsa sinov o'tardi-yu,
   brauzerda kod ishlamasdi.
   ══════════════════════════════════════════════════════════════════════════ */

class FakeRequest {
  constructor() { this.result = undefined; }
}

class FakeStore {
  constructor(map) { this.map = map; this.indexes = new Set(); }
  createIndex(name) { this.indexes.add(name); }
  put(value) {
    const r = new FakeRequest();
    this.map.set(value.key, JSON.parse(JSON.stringify(value)));
    r.result = value.key;
    return r;
  }
  getAll() {
    const r = new FakeRequest();
    r.result = [...this.map.values()].map((v) => JSON.parse(JSON.stringify(v)));
    return r;
  }
  delete(key) {
    const r = new FakeRequest();
    this.map.delete(key);
    return r;
  }
}

class FakeDb {
  constructor(map) {
    this.map = map;
    this.objectStoreNames = { contains: () => this._created };
    this._created = false;
  }
  createObjectStore() { this._created = true; return new FakeStore(this.map); }
  transaction() {
    const store = new FakeStore(this.map);
    const t = {
      objectStore: () => store,
      oncomplete: null,
      onerror: null,
      error: null,
    };
    /* ⚠ `oncomplete` KEYINGI mikrovazifada — haqiqiy IndexedDB dagidek:
       chaqiruvchi avval `fn(store)` ni bajaradi, natija esa
       `oncomplete` da o'qiladi. */
    queueMicrotask(() => queueMicrotask(() => t.oncomplete && t.oncomplete()));
    return t;
  }
}

/** Sinov uchun toza baza o'rnatadi va `globalThis.indexedDB` ni beradi. */
export function installFakeIndexedDb() {
  const map = new Map();
  globalThis.indexedDB = {
    open() {
      const req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        const db = new FakeDb(map);
        req.result = db;
        if (req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
  };
  return {
    /** Bazadagi xom yozuvlar — sinov ularni bevosita tekshiradi. */
    rows: () => [...map.values()],
    clear: () => map.clear(),
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
