/* ══════════════════════════════════════════════════════════════════════════
   ERTA YUKLASH — lug'at va joriy sahifa bo'lagi HTML o'qilayotganda (2026-10-11)

   ═══ NEGA ═════════════════════════════════════════════════════════════

   Sharsharada (4G, 4× sekin protsessor) bosh sahifa uch narsani KETMA-KET
   kutardi:

     kirish JS  220 → 1290 ms
     uz lug'ati           1460 → 1880   ← faqat kirish JS bajarilgach so'raladi
     sahifa bo'lagi             … → …   ← faqat React chizgach so'raladi

   Brauzer ularning nomini oldindan bilmaydi: ikkalasi ham `import()` orqali
   keladi, nomida esa kontent xeshi bor. Shuning uchun bu plagin build
   paytida haqiqiy fayl nomlarini olib, HTML ga kichik skript yozadi va u
   kerakli bo'laklar uchun `<link rel="modulepreload">` qo'yadi — kirish JS
   bilan PARALLEL.

   ⚠ `modulepreload`, `import()` EMAS. Bo'lak yuklanadi va kompilyatsiya
   qilinadi, lekin BAJARILMAYDI. Sahifani erta bajarish xavfli: modul
   darajasidagi `t("…")` lug'at kelmasidan oldin ishlab, kalitning o'zini
   qaytarardi va u ekranda qolib ketardi.

   ⚠ Skript `/fa/all.css` DAN OLDIN turishi shart (`index.html` dagi
   belgi). Kutilayotgan uslub jadvalidan keyingi inline skript o'sha
   jadval kelguncha bajarilmaydi — ya'ni yuklash ~500 ms kechikardi.

   ⚠ Bosh sahifa (`/`) ROLGA va restoran-do'konga qarab boshqa sahifa
   chizadi; buni server javobisiz bilib bo'lmaydi. O'tgan safar qaysi biri
   chizilgani `ek_home_page` da eslab qolinadi (`App.jsx`, `HomeRoute`).
   Noto'g'ri taxmin arzon: bitta ortiqcha yuklash, xato emas.
   ══════════════════════════════════════════════════════════════════════════ */

import { PAGE_ROUTES as ROUTES, HOME_PAGES as HOME, HOME_KEY } from "../src/lib/ek-page-routes.js";

const MARK = "<!-- ek-early-preload -->";

export default function earlyPreload() {
  let base = "/";
  return {
    name: "ek-early-preload",
    apply: "build",
    configResolved(c) { base = c.base; },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        /* ⚠ Belgi yo'qolsa build YIQILADI. Jimgina o'tkazib yuborilsa
           tezlashtirish izsiz yo'qolardi — buni faqat o'lchov ko'rsatardi. */
        if (!html.includes(MARK)) throw new Error(`index.html da ${MARK} yo'q`);

        const chunks = Object.values(ctx.bundle).filter((c) => c.type === "chunk");
        const byFile = new Map(chunks.map((c) => [c.fileName, c]));
        const entry = chunks.find((c) => c.isEntry);

        /* Kirish JS va uning statik bog'liqliklari HTML da allaqachon bor. */
        const closure = (c, out = new Set()) => {
          for (const f of c.imports) if (!out.has(f)) { out.add(f); closure(byFile.get(f), out); }
          return out;
        };
        const have = closure(entry, new Set([entry.fileName]));
        const files = (c) => [c.fileName, ...closure(c)].filter((f) => !have.has(f)).map((f) => base + f);
        const by = (suffix) => {
          const norm = (m) => String(m || "").replace(/\\/g, "/");
          /* ⚠ Bo'lakda bir nechta dinamik kirish bo'lsa (masalan `KassaPage` va
             boshqa joydan kechiktirilgan `ShiftBar`), Rollup `facadeModuleId`
             ni bo'sh qoldiradi — shunda modul ro'yxatidan qidiriladi (B1). */
          const c = chunks.find((x) => norm(x.facadeModuleId).endsWith(suffix))
            || chunks.find((x) => x.isDynamicEntry && Object.keys(x.modules).some((m) => norm(m).endsWith(suffix)));
          if (!c) throw new Error(`ek-early-preload: ${suffix} bo'lagi topilmadi`);
          return files(c);
        };

        const L = Object.fromEntries(["uz", "ru", "en"].map((l) => [l, by(`/src/lib/locales/${l}.js`)]));
        const names = [...new Set([...Object.values(ROUTES), ...HOME])];
        const P = Object.fromEntries(names.map((n) => [n, by(`/src/pages/${n}Page.jsx`)]));

        /* ES5 — eski WebView ham o'qiy olsin; xato bo'lsa jim (bu faqat tezlik). */
        const js = `(function(){try{var L=${JSON.stringify(L)},P=${JSON.stringify(P)},R=${JSON.stringify(ROUTES)},s=localStorage,`
          + `l=new URLSearchParams(location.search).get("lang");if(!L[l])l=s.getItem("ek_lang");if(!L[l])l="uz";var f=L[l];`
          + `if(s.getItem("ek_token")&&s.getItem("ek_type")==="user"){var n=location.pathname==="/"?s.getItem(${JSON.stringify(HOME_KEY)}):R[location.pathname];if(P[n])f=f.concat(P[n]);}`
          + `for(var i=0;i<f.length;i++){var e=document.createElement("link");e.rel="modulepreload";e.crossOrigin="";e.href=f[i];document.head.appendChild(e);}`
          + `}catch(_){}})();`;
        return html.replace(MARK, `<script>${js}</script>`);
      },
    },
  };
}
