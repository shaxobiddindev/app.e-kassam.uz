import{aq as v,r as d,j as e,aI as y,aU as u,g as q}from"./index-BpJZyEMh.js";const z=`
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
`;function A(t,l){return`<!DOCTYPE html><html lang="uz" data-theme="light"><head><meta charset="utf-8"><title>${(o=>String(o??"").replace(/[&<>"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[s]))(l)}</title><style>${z}</style></head><body>${t}</body></html>`}async function P(t,l){var c,h;if(!t)throw new Error("Chek hali yuklanmadi");const r=l||"Chek",o=A(t.outerHTML,r);if(v()){const n=(h=(c=window.Capacitor)==null?void 0:c.Plugins)==null?void 0:h.ReceiptPrint;if(n){await n.print({html:o,name:r});return}}const s=window.open("","_blank","width=420,height=720");if(!s)throw new Error("Brauzer yangi oynani to'sdi — ruxsat bering va qayta urinib ko'ring");s.document.write(o),s.document.close(),s.onafterprint=()=>s.close(),setTimeout(()=>s.print(),80)}const g=t=>q(t),E={CASH:"Naqd",CARD:"Karta",CLICK:"Click",PAYME:"Payme",TRANSFER:"O'tkazma"},S=t=>new Date(t).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"});function C({data:t,token:l,appToken:r,customerId:o,id:s,signedId:c,signature:h,onClose:n}){const[a,f]=d.useState(t||null),[x,N]=d.useState(""),[j,_]=d.useState(""),b=d.useRef(null);d.useEffect(()=>{if(t){f(t);return}let i,m={};c?i=`${u}/public/portal/payment/${c}?k=${encodeURIComponent(h)}`:r?(i=`${u}/app/payments/${s}?c=${encodeURIComponent(o)}`,m={"X-App-Token":r}):(i=`${u}/public/portal/payments/${s}`,m={"X-Portal-Token":l}),fetch(i,{headers:m}).then(p=>p.json()).then(p=>{if(p.success===!1)throw new Error(p.message);f(p.data)}).catch(p=>N(p.message||"Chekni ochib bo'lmadi"))},[t,s,l,r,o,c,h]),d.useEffect(()=>{const i=m=>{m.key==="Escape"&&(n==null||n())};return addEventListener("keydown",i),()=>removeEventListener("keydown",i)},[n]);const w=async()=>{_("");try{await P(b.current,a?`Chek ${a.receiptNo}`:"Chek")}catch(i){_(i.message||"Saqlab bo'lmadi")}},k=a&&Number(a.balanceAfter)===0;return e.jsx("div",{className:"pt-modal",onClick:n,role:"dialog","aria-modal":"true",children:e.jsxs("div",{className:"pt-modal__inner",onClick:i=>i.stopPropagation(),children:[e.jsx("button",{className:"pt-close",onClick:n,"aria-label":"Yopish",children:e.jsx("i",{className:"fa-solid fa-xmark","aria-hidden":"true"})}),x&&e.jsx("div",{className:"pt-tape pt-center",children:x}),!a&&!x&&e.jsx("div",{className:"pt-tape pt-center",children:"Yuklanmoqda…"}),a&&e.jsxs("div",{className:"pt-tape ek-tear",ref:b,children:[e.jsxs("div",{className:"pt-tape__head",children:[e.jsx("div",{className:"pt-tape__shop",children:a.shopName}),a.shopAddress&&e.jsx("div",{children:a.shopAddress}),a.shopPhone&&e.jsx("div",{children:a.shopPhone}),e.jsx("div",{className:"pt-tape__kind",children:"QARZ TO'LOVI"})]}),e.jsx("div",{className:"pt-hr"}),e.jsxs("div",{className:"pt-tape__row",children:[e.jsx("span",{children:"Chek"}),e.jsx("span",{children:a.receiptNo})]}),e.jsxs("div",{className:"pt-tape__row",children:[e.jsx("span",{children:"Sana"}),e.jsx("span",{children:S(a.date)})]}),a.customerName&&e.jsxs("div",{className:"pt-tape__row",children:[e.jsx("span",{children:"Mijoz"}),e.jsx("span",{children:a.customerName})]}),a.cashierName&&e.jsxs("div",{className:"pt-tape__row",children:[e.jsx("span",{children:"Qabul qildi"}),e.jsx("span",{children:a.cashierName})]}),e.jsx("div",{className:"pt-hr"}),e.jsxs("div",{className:"pt-tape__row pt-total",children:[e.jsx("span",{children:"TO'LANDI"}),e.jsx("span",{children:g(a.amount)})]}),a.method&&e.jsxs("div",{className:"pt-tape__row",children:[e.jsx("span",{children:"To'lov turi"}),e.jsx("span",{children:E[a.method]||a.method})]}),e.jsx("div",{className:"pt-hr"}),a.balanceBefore!=null&&e.jsxs("div",{className:"pt-tape__row",children:[e.jsx("span",{children:"Qarz edi"}),e.jsx("span",{children:g(a.balanceBefore)})]}),a.balanceAfter!=null&&e.jsxs("div",{className:`pt-tape__row pt-total ${k?"pt-earn":""}`,children:[e.jsx("span",{children:k?"QARZ YOPILDI":"QOLDI"}),e.jsx("span",{children:g(a.balanceAfter)})]}),a.reason&&e.jsxs("div",{className:"pt-tape__row",children:[e.jsx("span",{children:"Izoh"}),e.jsx("span",{children:a.reason})]}),a.qrUrl&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"pt-hr"}),e.jsx("div",{className:"pt-center",dangerouslySetInnerHTML:{__html:y(a.qrUrl,{size:110,margin:1})}}),e.jsx("div",{className:"pt-center pt-tape__no",children:"Chekni telefonda ochish"})]}),e.jsx("div",{className:"pt-hr"}),e.jsx("div",{className:"pt-center pt-tape__no",children:a.receiptNo}),e.jsx("div",{className:"pt-center pt-thanks",children:"Rahmat!"}),e.jsx("div",{className:"pt-center pt-tape__site",children:"e-kassam.uz"})]}),a&&e.jsxs("div",{className:"pt-actions",children:[e.jsxs("button",{type:"button",className:"btn btn-primary",onClick:w,children:[e.jsx("i",{className:"fa-solid fa-file-pdf","aria-hidden":"true"})," PDF qilib saqlash"]}),j&&e.jsx("div",{className:"pt-actions__err",children:j})]})]})})}const I=Object.freeze(Object.defineProperty({__proto__:null,default:C},Symbol.toStringTag,{value:"Module"}));export{C as P,I as a,P as s};
