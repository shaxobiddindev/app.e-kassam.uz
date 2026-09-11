/* ══════════════════════════════════════════════════════════════════════════
   E'LON QILINMAGAN NOM — UMUMIY TEKSHIRUV (V99)

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   Do'kon egasi yozdi: «edit va yangi maxsulot qoshishda shu xato
   chiqyapti» — ekranda `editing is not defined`. Ya'ni tovar qo'shish
   ham, tahrirlash ham butunlay ishlamay qolgan edi.

   Sabab: tovar formasiga «Kod yaratish» tugmasi qo'shilganda kod
   `editing?.id` deb yozilgan edi. Bu sahifada bunday o'zgaruvchi
   UMUMAN YO'Q — u `modal` deb ataladi (`{ type, product }`).

   ⚠ NEGA HECH NARSA USHLAMADI. Uchta to'siq bor edi va uchalasi ham
   yonidan o'tib ketdi:

     · `vite build` (esbuild) faqat SINTAKSISNI qaraydi. E'lon
       qilinmagan nom sintaktik jihatdan mutlaqo to'g'ri — u faqat
       ISHLAGANDA yiqiladi;
     · `check-undefined.mjs` ATAYLAB tor: u faqat `setXxx(`
       ko'rinishidagi CHAQIRUVni biladi. `editing?.id` — chaqiruv
       emas, oddiy o'qish;
     · brauzer tekshiruvlari tovar oynasini OCHMAYDI: sahifaning
       o'zi joyida chiziladi, xato faqat oyna ochilganda chiqadi.

   Ya'ni bu bitta xato emas, SINF: har qanday qayta nomlashdan keyin
   qolib ketgan eski nom shu yo'l bilan ishlab chiqarishga tushadi.

   ═══ NIMA TEKSHIRILADI ════════════════════════════════════════════════

   Har bir `.js`/`.jsx` fayl haqiqiy DARAXTGA (AST) aylantiriladi va
   undagi HAR bir nom o'qilishi tekshiriladi: shu faylda e'lon
   qilinganmi (`const/let/var`, funksiya, argument, import,
   destrukturizatsiya, `catch`, sinf) yoki brauzerning o'z nomimi.

   JSX esbuild orqali oddiy JS ga o'giriladi — shuning uchun
   `<Foo/>` dagi import qilinmagan `Foo` ham tutiladi.

   ⚠ QIDIRUV FAYL DARAJASIDA, blok darajasida EMAS — va bu ataylab.
   Blok darajasidagi qidiruv aniqroq bo'lardi, lekin nomni boshqa
   blokda e'lon qilingan deb YOLG'ON ogohlantirish berardi. Bu
   tekshiruvning eng muhim xususiyati — unga ISHONISH mumkinligi:
   yolg'on ogohlantirish bergan qo'riqchini bir haftadan keyin hech
   kim o'qimay qo'yadi. Shuning uchun faylda UMUMAN yo'q nom — ya'ni
   aynan qayta nomlashdan qolgan qoldiq — qat'iy tutiladi, sohasidan
   chiqib ketgan nom esa o'tkazib yuboriladi.

   ⚠ `check-undefined.mjs` O'CHIRILMADI. U esbuild/rollup ichki
   yo'llariga tayanmaydi va ular o'zgarsa ham ishlayveradi.

   Ishga tushirish:  node scripts/check-refs.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
/* ⚠ `esbuild` VA `rollup` — vite ning O'Z bog'liqliklari, alohida
   o'rnatilmagan. Agar ular biror kun yo'qolsa, bu `import` xato
   beradi va skript YIQILADI — ya'ni qo'riqchi jimgina yashil
   bo'lib qolmaydi. Aynan shu kerak. */
import * as esbuild from "esbuild";
import { parseAst } from "rollup/parseAst";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

const walkDir = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return walkDir(full);
  return /\.(js|jsx)$/.test(e.name) ? [full] : [];
});

/* ══ BRAUZER VA JS NING O'Z NOMLARI ════════════════════════════════════
   Ro'yxat qo'lda tuzilgan va ataylab KENG: bu yerdagi kamchilik
   yolg'on ogohlantirish beradi, ortiqchalik esa faqat bitta nomni
   o'tkazib yuboradi. Birinchisi qo'riqchini o'ldiradi, ikkinchisi
   yo'q. */
const GLOBALS = new Set([
  // JS
  "globalThis", "Infinity", "NaN", "undefined", "eval", "isFinite", "isNaN",
  "parseFloat", "parseInt", "decodeURI", "decodeURIComponent", "encodeURI",
  "encodeURIComponent", "escape", "unescape", "Object", "Function", "Boolean",
  "Symbol", "Error", "AggregateError", "EvalError", "RangeError",
  "ReferenceError", "SyntaxError", "TypeError", "URIError", "Number", "BigInt",
  "Math", "Date", "String", "RegExp", "Array", "Int8Array", "Uint8Array",
  "Uint8ClampedArray", "Int16Array", "Uint16Array", "Int32Array", "Uint32Array",
  "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array", "Map",
  "Set", "WeakMap", "WeakSet", "WeakRef", "FinalizationRegistry", "ArrayBuffer",
  "SharedArrayBuffer", "DataView", "JSON", "Promise", "Reflect", "Proxy",
  "Intl", "structuredClone", "queueMicrotask", "arguments",
  // brauzer
  "window", "self", "top", "parent", "frames", "document", "console",
  "navigator", "location", "history", "screen", "localStorage",
  "sessionStorage", "indexedDB", "caches", "fetch", "Headers", "Request",
  "Response", "FormData", "URL", "URLSearchParams", "Blob", "File",
  "FileReader", "FileList", "XMLHttpRequest", "WebSocket", "EventSource",
  "AbortController", "AbortSignal", "setTimeout", "clearTimeout",
  "setInterval", "clearInterval", "requestAnimationFrame",
  "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback",
  "alert", "confirm", "prompt", "atob", "btoa", "crypto", "performance",
  "matchMedia", "getComputedStyle", "scrollTo", "scrollBy", "getSelection",
  "addEventListener", "removeEventListener", "dispatchEvent", "postMessage",
  "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "PointerEvent",
  "TouchEvent", "WheelEvent", "InputEvent", "FocusEvent", "DragEvent",
  "Element", "HTMLElement", "HTMLCanvasElement", "HTMLInputElement", "HTMLTextAreaElement",
  "HTMLSelectElement", "HTMLImageElement", "HTMLFormElement", "Node",
  "NodeList", "NodeFilter", "DocumentFragment", "ShadowRoot", "Image",
  "Audio", "AudioContext", "webkitAudioContext", "MediaRecorder",
  "MediaStream", "Notification", "ResizeObserver", "IntersectionObserver",
  "MutationObserver", "PerformanceObserver", "DOMParser", "XMLSerializer",
  "TextEncoder", "TextDecoder", "Worker", "SharedWorker", "BroadcastChannel",
  "ServiceWorker", "ServiceWorkerRegistration", "CanvasRenderingContext2D",
  "OffscreenCanvas", "createImageBitmap", "ImageData", "Path2D", "DOMRect",
  "DOMMatrix", "CSS", "Range", "Selection", "SVGElement", "print", "open",
  "close", "focus", "blur", "devicePixelRatio", "innerWidth", "innerHeight",
  "isSecureContext", "Uint8ClampedArray", "reportError",
  // qurish vaqti / muhit
  "process", "Buffer", "require", "module", "exports", "__dirname",
  "__filename", "import",
]);

let bad = 0;
let files = 0;

for (const file of walkDir(SRC)) {
  const raw = fs.readFileSync(file, "utf8");

  /* JSX → oddiy JS. `automatic` tanlangan, chunki u `React` ni
     GLOBAL deb emas, IMPORT deb qo'shadi: aks holda `React` ni
     import qilmagan har bir fayl yolg'on ogohlantirish berardi. */
  let js;
  try {
    js = esbuild.transformSync(raw, { loader: "jsx", jsx: "automatic", format: "esm" }).code;
  } catch (e) {
    console.log(`  ❌ ${path.relative(ROOT, file)}\n       o'girib bo'lmadi: ${e.message}`);
    bad++;
    continue;
  }

  let ast;
  try {
    ast = parseAst(js);
  } catch (e) {
    console.log(`  ❌ ${path.relative(ROOT, file)}\n       o'qib bo'lmadi: ${e.message}`);
    bad++;
    continue;
  }
  files++;

  const declared = new Set();
  const used = new Map(); // nom → birinchi o'rin

  /** Namunadagi (`{a, b: [c]}`) barcha nomlar. */
  const bind = (n) => {
    if (!n || typeof n.type !== "string") return;
    switch (n.type) {
      case "Identifier": declared.add(n.name); break;
      case "ObjectPattern": n.properties.forEach(bind); break;
      case "ArrayPattern": n.elements.forEach(bind); break;
      case "Property": bind(n.value); break;
      case "AssignmentPattern": bind(n.left); break;
      case "RestElement": bind(n.argument); break;
      default: break;
    }
  };

  const visit = (node, parent) => {
    switch (node.type) {
      case "VariableDeclarator": bind(node.id); break;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        if (node.id) declared.add(node.id.name);
        node.params.forEach(bind);
        break;
      case "ClassDeclaration":
      case "ClassExpression":
        if (node.id) declared.add(node.id.name);
        break;
      case "CatchClause": if (node.param) bind(node.param); break;
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
      case "ImportSpecifier":
        declared.add(node.local.name);
        break;
      case "Identifier": {
        if (!parent) break;
        /* `a.b` dagi `b` — boshqa obyektning maydoni, nom emas. */
        if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) break;
        if (parent.type === "OptionalMemberExpression" && parent.property === node && !parent.computed) break;
        /* `{ kalit: qiymat }` dagi kalit. Qisqartma (`{x}`) da kalit
           bilan qiymat bir xil bo'ladi — u O'QISH sanaladi. */
        if (parent.type === "Property" && parent.key === node && !parent.computed
            && parent.value !== node) break;
        if ((parent.type === "PropertyDefinition" || parent.type === "MethodDefinition")
            && parent.key === node && !parent.computed) break;
        /* Yorliqlar (`label:`, `break label`). */
        if (parent.type === "LabeledStatement" || parent.type === "BreakStatement"
            || parent.type === "ContinueStatement") break;
        /* `import { a as b }` / `export { a as b }` dagi tashqi nom. */
        if (parent.type === "ImportSpecifier" && parent.imported === node) break;
        if (parent.type === "ExportSpecifier" && parent.exported === node
            && parent.local !== node) break;
        if (parent.type === "MetaProperty") break;
        if (!used.has(node.name)) used.set(node.name, node.start);
        break;
      }
      default: break;
    }
  };

  /* ⚠ `value` VA `raw` BU YERGA QO'SHILMAYDI. Boshida ular ham
     tashlab ketilgan edi va bu jimgina teshik ochardi: HAR qanday
     obyekt maydonining QIYMATI (`{ narx: yoqNarsa }`) va qisqartma
     (`{ yoqNarsa }`) umuman tekshirilmasdan o'tib ketardi. Ibtidoiy
     qiymatlar `typeof v.type === "string"` sharti bilan allaqachon
     chetlab o'tiladi — alohida ro'yxat kerak emas. */
  const SKIP = new Set(["type", "start", "end", "loc", "range", "parent"]);
  const walk = (node, parent) => {
    visit(node, parent);
    for (const k of Object.keys(node)) {
      if (SKIP.has(k)) continue;
      const v = node[k];
      if (Array.isArray(v)) {
        for (const c of v) if (c && typeof c.type === "string") walk(c, node);
      } else if (v && typeof v.type === "string") {
        walk(v, node);
      }
    }
  };
  walk(ast, null);

  const missing = [...used.keys()].filter((n) => !declared.has(n) && !GLOBALS.has(n));
  if (missing.length) {
    bad += missing.length;
    console.log(`  ❌ ${path.relative(ROOT, file)}`);
    for (const n of missing) {
      /* Chiziq raqami ASL fayldan olinadi: o'girilgan kodning
         raqami dasturchiga hech narsa demaydi. */
      const line = raw.split("\n")
        .findIndex((l) => new RegExp(`(?<![.\\w$])${n}(?![\\w$])`).test(l)) + 1;
      console.log(`       ${n} — e'lon qilinmagan   (:${line || "?"})`);
    }
  }
}

console.log(bad
  ? `\n  ${bad} ta e'lon qilinmagan nom. Ular o'qilganda sahifa yiqiladi.\n`
  : `  ✅ ${files} faylda e'lon qilinmagan nom yo'q\n`);
process.exit(bad ? 1 : 0);
