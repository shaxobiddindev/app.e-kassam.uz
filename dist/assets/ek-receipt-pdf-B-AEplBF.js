import{aI as l}from"./index-BtAPGJ2Z.js";const g=`
/* Chek qog'ozi — A4 EMAS. @page bo'lmasa brauzer chekni A4 varaqning
   burchagiga qo'yib, chetiga o'z sarlavha-izohini qo'shadi. */
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

/* Ekrandagi qog'oz effektlari bosmada keraksiz */
.pt-tape { background: #FFFFFF; color: #111111; padding: 0; border-radius: 0; box-shadow: none; }
.ek-tear::after { display: none; }

.pt-tape__head { text-align: center; }
.pt-tape__shop { font-size: 14px; font-weight: 800; letter-spacing: .5px; }
.pt-hr { border-top: 1px dashed #999999; margin: 7px 0; }
.pt-tape__row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
.pt-tape__row > span:last-child { white-space: nowrap; }
.pt-line { padding: 3px 0; }
.pt-line__name { font-weight: 700; }
/* Qator chegirmasi — qog'oz chekdagi bilan bir xil, ichkariroq va
   so'nikroq: u qatorning IZOHI, alohida qator emas. */
.pt-line__cut { padding-left: 10px; opacity: .75; }
/* ⚠ CHEK TURI (V61) — «QARZ TO'LOVI». Bu qator EKRANDA bor edi, PDF
   da esa yo'q: saqlangan nusxada u oddiy mayda matnga aylanib,
   xarid chekidan ajralib turmay qolardi — holbuki uni ajratib
   turadigan YAGONA narsa shu (V109 da topildi). */
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
/* ⚠ BEKOR QILINGAN TO'LOV (V109) — «pt-returned» bilan bir oilada:
   ikkalasi ham «bu hujjat endi boshqa narsani anglatadi» deydi va
   mijoz ularni bir xil tanishi kerak. Farqi — bu yerda uch qator
   (nima · qachon · nega), chunki «nega?» savoli darhol tug'iladi. */
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

/* Ekranda fiskal QR va shtrix — bosiladigan tugma (kattalashtirish uchun).
   Qog'ozda ular oddiy rasm: tugma bezaklari olib tashlanadi. */
.pt-tape button { all: unset; display: block; width: 100%; }
.pt-fiscalqr { margin: 8px 0; }
.pt-fiscalqr svg, .pt-barcode svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
`;function h(a,i,o=g){return`<!DOCTYPE html><html lang="uz" data-theme="light"><head><meta charset="utf-8"><title>${(n=>String(n??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]))(i)}</title><style>${o}</style></head><body>${a}</body></html>`}async function c(a,i,o,r="width=420,height=720"){var p,d;const n=i||"Hujjat",e=h(a,n,o);if(l()){const s=(d=(p=window.Capacitor)==null?void 0:p.Plugins)==null?void 0:d.ReceiptPrint;if(s){await s.print({html:e,name:n});return}}const t=window.open("","_blank",r);if(!t)throw new Error("Brauzer yangi oynani to'sdi — ruxsat bering va qayta urinib ko'ring");t.document.write(e),t.document.close(),t.onafterprint=()=>t.close(),setTimeout(()=>t.print(),80)}async function m(a,i){if(!a)throw new Error("Chek hali yuklanmadi");return c(a.outerHTML,i||"Chek")}export{c as p,m as s};
