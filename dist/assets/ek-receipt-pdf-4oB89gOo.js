import{b4 as g,al as u}from"./index-BfNM6Z_n.js";const m=`
/* Çek qoğozi — A4 EMAS. @page bölmasa brauzer çekni A4 varaqning
   burçagiga qöyib, çetiga öz sarlavha-izohini qöşadi. */
@page { size: 58mm auto; margin: 0; }

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 58mm; padding: 4mm 3mm 6mm;
  background: #FFFFFF; color: #111111;
  /* Shrift TIZIMNIKI: yangi oynaga tashqi shrift yuklanmaydi (chek
     printeriga chop etishda ham shu qoida — ek-hardware.js). */
  font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
  font-variant-numeric: tabular-nums;
  font-size: 11px; line-height: 1.45;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* Ekrandagi qoğoz effektlari bosmada keraksiz */
.pt-tape { background: #FFFFFF; color: #111111; padding: 0; border-radius: 0; box-shadow: none; }
.ek-tear::after { display: none; }

.pt-tape__head { text-align: center; }
.pt-tape__shop { font-size: 14px; font-weight: 800; letter-spacing: .5px; }
.pt-hr { border-top: 1px dashed #999999; margin: 7px 0; }
.pt-tape__row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
.pt-tape__row > span:last-child { white-space: nowrap; }
.pt-line { padding: 3px 0; }
.pt-line__name { font-weight: 700; }
/* Qator çegirmasi — qoğoz çekdagi bilan bir xil, içkariroq va
   sönikroq: u qatorning IZOHI, alohida qator emas. */
.pt-line__cut { padding-left: 10px; opacity: .75; }
/* ⚠ ÇEK TURI (V61) — «QARZ TÖLOVI». Bu qator EKRANDA bor edi, PDF
   da esa yöq: saqlangan nusxada u oddiy mayda matnga aylanib,
   xarid çekidan ajralib turmay qolardi — holbuki uni ajratib
   turadigan YAGONA narsa şu (V109 da topildi). */
.pt-tape__kind {
  margin-top: 6px; padding-top: 5px; border-top: 1px solid #111111;
  font-size: 11px; font-weight: 800; letter-spacing: .18em;
}
.pt-total { font-size: 14px; font-weight: 800; padding: 6px 0; border-top: 1px solid #111111; margin-top: 4px; }
.pt-earn { font-weight: 700; }
.pt-returned {
  margin: 10px 0; padding: 6px; text-align: center; font-weight: 800; letter-spacing: .2em;
  border: 2px solid #111111; border-radius: 4px;
}
/* ⚠ BEKOR QILINGAN TÖLOV (V109) — «pt-returned» bilan bir oilada:
   ikkalasi ham «bu hujjat endi boşqa narsani anglatadi» deydi va
   mijoz ularni bir xil tanişi kerak. Farqi — bu yerda uç qator
   (nima · qaçon · nega), çunki «nega?» savoli darhol tuğiladi. */
.pt-void {
  margin: 10px 0; padding: 6px; text-align: center;
  border: 2px solid #111111; border-radius: 4px;
}
.pt-void__title { font-weight: 800; letter-spacing: .2em; }
.pt-void__when  { font-size: 11px; margin-top: 2px; }
.pt-void__why   { font-size: 11px; margin-top: 2px; }
.pt-center { text-align: center; }
.pt-tape__no { font-size: 12px; font-weight: 800; margin-top: 2px; }
.pt-thanks { margin-top: 10px; font-weight: 700; }
.pt-tape__site { font-size: 10px; color: #555555; }

/* Ekranda fiskal QR va ştrix — bosiladigan tugma (kattalaştiriş uçun).
   Qoğozda ular oddiy rasm: tugma bezaklari olib taşlanadi. */
.pt-tape button { all: unset; display: block; width: 100%; }
.pt-fiscalqr { margin: 8px 0; }
.pt-fiscalqr svg, .pt-barcode svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
`;function c(e,o,p=m){return`<!DOCTYPE html><html lang="uz" data-theme="light"><head><meta charset="utf-8"><title>${(i=>String(i??"").replace(/[&<>"]/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[n]))(o)}</title><style>${p}</style></head><body>${e}</body></html>`}async function h(e,o,p,t="width=420,height=720",i=null){var d,s;const n=o||"Hujjat",a=c(e,n,p);if(g()){const l=(s=(d=window.Capacitor)==null?void 0:d.Plugins)==null?void 0:s.ReceiptPrint;if(l){await l.print(i?{html:a,name:n,widthMm:i.widthMm,heightMm:i.heightMm}:{html:a,name:n});return}}if(u()){await x(a);return}const r=window.open("","_blank",t);if(!r)throw new Error("Brauzer yangi oynani tösdi — ruxsat bering va qayta urinib köring");r.document.write(a),r.document.close(),r.onafterprint=()=>r.close(),setTimeout(()=>r.print(),80)}async function f(e,o){if(!e)throw new Error("Çek hali yuklanmadi");return h(e.outerHTML,o||"Çek")}function x(e){return new Promise((o,p)=>{const t=document.createElement("iframe");t.setAttribute("aria-hidden","true"),t.setAttribute("title",""),t.style.cssText="position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0",document.body.appendChild(t);let i=!1;const n=()=>{if(!i){i=!0;try{t.remove()}catch{}o()}};t.onload=()=>{try{const a=t.contentWindow;if(!a)throw new Error("Çop etiş oynasi oçilmadi");a.onafterprint=n,a.focus(),a.print(),setTimeout(n,6e4)}catch(a){try{t.remove()}catch{}i=!0,p(a)}},t.srcdoc=e})}export{h as p,f as s};
