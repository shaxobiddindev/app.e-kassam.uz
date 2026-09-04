import{aq as y,r as m,j as a,O as A,aI as q,aU as g,g as z}from"./index-CWOQueoz.js";const C=`
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
.pt-total { font-size: 14px; font-weight: 800; padding: 6px 0; border-top: 1px solid #111111; margin-top: 4px; }
.pt-earn { font-weight: 700; }
.pt-returned {
  margin: 10px 0; padding: 6px; text-align: center; font-weight: 800; letter-spacing: .2em;
  border: 2px solid #111111; border-radius: 4px;
}
.pt-center { text-align: center; }
.pt-tape__no { font-size: 12px; font-weight: 800; margin-top: 2px; }
.pt-thanks { margin-top: 10px; font-weight: 700; }
.pt-tape__site { font-size: 10px; color: #555555; }

/* Ekranda fiskal QR va shtrix — bosiladigan tugma (kattalashtirish uchun).
   Qog'ozda ular oddiy rasm: tugma bezaklari olib tashlanadi. */
.pt-tape button { all: unset; display: block; width: 100%; }
.pt-fiscalqr { margin: 8px 0; }
.pt-fiscalqr svg, .pt-barcode svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
`;function I(t,l){return`<!DOCTYPE html><html lang="uz" data-theme="light"><head><meta charset="utf-8"><title>${(r=>String(r??"").replace(/[&<>"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[s]))(l)}</title><style>${C}</style></head><body>${t}</body></html>`}async function P(t,l){var p,h;if(!t)throw new Error("Chek hali yuklanmadi");const n=l||"Chek",r=I(t.outerHTML,n);if(y()){const c=(h=(p=window.Capacitor)==null?void 0:p.Plugins)==null?void 0:h.ReceiptPrint;if(c){await c.print({html:r,name:n});return}}const s=window.open("","_blank","width=420,height=720");if(!s)throw new Error("Brauzer yangi oynani to'sdi — ruxsat bering va qayta urinib ko'ring");s.document.write(r),s.document.close(),s.onafterprint=()=>s.close(),setTimeout(()=>s.print(),80)}const f=t=>z(t),R={CASH:"Naqd",CARD:"Karta",CLICK:"Click",PAYME:"Payme",TRANSFER:"O'tkazma"},S=t=>new Date(t).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"});function E({data:t,token:l,appToken:n,customerId:r,id:s,signedId:p,signature:h,onClose:c}){const[e,j]=m.useState(t||null),[x,w]=m.useState(""),[_,b]=m.useState(""),N=m.useRef(null);m.useEffect(()=>{if(t){j(t);return}let i,u={};p?i=`${g}/public/portal/payment/${p}?k=${encodeURIComponent(h)}`:n?(i=`${g}/app/payments/${s}?c=${encodeURIComponent(r)}`,u={"X-App-Token":n}):(i=`${g}/public/portal/payments/${s}`,u={"X-Portal-Token":l}),fetch(i,{headers:u}).then(o=>o.json()).then(o=>{if(o.success===!1)throw new Error(o.message);j(o.data)}).catch(o=>w(o.message||"Chekni ochib bo'lmadi"))},[t,s,l,n,r,p,h]);const v=async()=>{b("");try{await P(N.current,e?`Chek ${e.receiptNo}`:"Chek")}catch(i){b(i.message||"Saqlab bo'lmadi")}},d=(e==null?void 0:e.kind)==="CHARGE",k=e&&!d&&Number(e.balanceAfter)===0;return a.jsx(A,{className:"pt-modal",onClick:c,onEscape:c,role:"dialog","aria-modal":"true",children:a.jsxs("div",{className:"pt-modal__inner",onClick:i=>i.stopPropagation(),children:[a.jsx("button",{className:"pt-close",onClick:c,"aria-label":"Yopish",children:a.jsx("i",{className:"fa-solid fa-xmark","aria-hidden":"true"})}),x&&a.jsx("div",{className:"pt-tape pt-center",children:x}),!e&&!x&&a.jsx("div",{className:"pt-tape pt-center",children:"Yuklanmoqda…"}),e&&a.jsxs("div",{className:"pt-tape ek-tear",ref:N,children:[a.jsxs("div",{className:"pt-tape__head",children:[a.jsx("div",{className:"pt-tape__shop",children:e.shopName}),e.shopAddress&&a.jsx("div",{children:e.shopAddress}),e.shopPhone&&a.jsx("div",{children:e.shopPhone}),a.jsx("div",{className:"pt-tape__kind",children:d?"QARZ OLINDI":"QARZ TO'LOVI"})]}),a.jsx("div",{className:"pt-hr"}),a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Chek"}),a.jsx("span",{children:e.receiptNo})]}),a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Sana"}),a.jsx("span",{children:S(e.date)})]}),e.customerName&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Mijoz"}),a.jsx("span",{children:e.customerName})]}),e.cashierName&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:d?"Berdi":"Qabul qildi"}),a.jsx("span",{children:e.cashierName})]}),a.jsx("div",{className:"pt-hr"}),a.jsxs("div",{className:"pt-tape__row pt-total",children:[a.jsx("span",{children:d?"QARZGA OLINDI":"TO'LANDI"}),a.jsx("span",{children:f(e.amount)})]}),e.method&&!d&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"To'lov turi"}),a.jsx("span",{children:R[e.method]||e.method})]}),a.jsx("div",{className:"pt-hr"}),e.balanceBefore!=null&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Qarz edi"}),a.jsx("span",{children:f(e.balanceBefore)})]}),e.balanceAfter!=null&&a.jsxs("div",{className:`pt-tape__row pt-total ${k?"pt-earn":""}`,children:[a.jsx("span",{children:k?"QARZ YOPILDI":d?"JAMI QARZ":"QOLDI"}),a.jsx("span",{children:f(e.balanceAfter)})]}),e.reason&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Izoh"}),a.jsx("span",{children:e.reason})]}),e.qrUrl&&a.jsxs(a.Fragment,{children:[a.jsx("div",{className:"pt-hr"}),a.jsx("div",{className:"pt-center",dangerouslySetInnerHTML:{__html:q(e.qrUrl,{size:110,margin:1})}}),a.jsx("div",{className:"pt-center pt-tape__no",children:"Chekni telefonda ochish"})]}),a.jsx("div",{className:"pt-hr"}),a.jsx("div",{className:"pt-center pt-tape__no",children:e.receiptNo}),a.jsx("div",{className:"pt-center pt-thanks",children:"Rahmat!"}),a.jsx("div",{className:"pt-center pt-tape__site",children:"e-kassam.uz"})]}),e&&a.jsxs("div",{className:"pt-actions",children:[a.jsxs("button",{type:"button",className:"btn btn-primary",onClick:v,children:[a.jsx("i",{className:"fa-solid fa-file-pdf","aria-hidden":"true"})," PDF qilib saqlash"]}),_&&a.jsx("div",{className:"pt-actions__err",children:_})]})]})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:E},Symbol.toStringTag,{value:"Module"}));export{E as P,O as a,P as s};
