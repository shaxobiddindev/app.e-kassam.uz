/* ==========================================================================
   e-Kassam — service worker (06-APP-KASSIR.md → PWA)

   Strategiya:
     · app shell (HTML/CSS/JS/ikonka) → cache-first, fon rejimida yangilanadi
     · API so'rovlari                 → network-first, KESHLANMAYDI

   API javobini keshlash MUMKIN EMAS: kassir eskirgan narx yoki qoldiqni
   ko'rsa noto'g'ri sotadi. Oflayn ishlash sotuv navbati (IndexedDB) orqali
   ta'minlanadi, keshlangan javob orqali emas.
   ========================================================================== */

const VERSION = "ek-v1";
const SHELL = `${VERSION}-shell`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(["/", "/index.html", "/logo.png", "/manifest.webmanifest"]))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isApi = url.pathname.startsWith("/api") || /\/api\//.test(url.href);

  // API — faqat tarmoq. Oflaynda xato qaytadi va navbat mexanizmi ishlaydi.
  if (isApi) return;

  // Navigatsiya — SPA uchun har doim index.html
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("/index.html").then((r) => r || Response.error()))
    );
    return;
  }

  // Statik resurslar — cache-first + fon yangilanishi
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
