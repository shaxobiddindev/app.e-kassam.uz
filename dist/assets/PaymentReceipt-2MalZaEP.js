import{aq as M,r as u,j as a,O as q,aJ as z,aV as A,g as C}from"./index-C5cXU8jO.js";const E=`
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
`;function P(s,p){return`<!DOCTYPE html><html lang="uz" data-theme="light"><head><meta charset="utf-8"><title>${(o=>String(o??"").replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t]))(p)}</title><style>${E}</style></head><body>${s}</body></html>`}async function D(s,p){var l,d;if(!s)throw new Error("Chek hali yuklanmadi");const r=p||"Chek",o=P(s.outerHTML,r);if(M()){const h=(d=(l=window.Capacitor)==null?void 0:l.Plugins)==null?void 0:d.ReceiptPrint;if(h){await h.print({html:o,name:r});return}}const t=window.open("","_blank","width=420,height=720");if(!t)throw new Error("Brauzer yangi oynani to'sdi — ruxsat bering va qayta urinib ko'ring");t.document.write(o),t.document.close(),t.onafterprint=()=>t.close(),setTimeout(()=>t.print(),80)}const x=s=>C(s),T={CASH:"Naqd",CARD:"Karta",CLICK:"Click",PAYME:"Payme",TRANSFER:"O'tkazma"},y={TOP_UP:{head:"JAMG'ARMAGA QO'YILDI",who:"Qabul qildi",sign:"+"},CHANGE:{head:"QAYTIM JAMG'ARMAGA",who:"Kassir",sign:"+"},OVERPAY:{head:"ORTIQCHA TO'LOV JAMG'ARMAGA",who:"Qabul qildi",sign:"+"},SPEND:{head:"JAMG'ARMADAN XARIDGA",who:"Kassir",sign:"−"},REFUND:{head:"JAMG'ARMADAN QAYTARILDI",who:"Qaytardi",sign:"−"},RETURN:{head:"QAYTARISH — JAMG'ARMAGA",who:"Kassir",sign:"+"},ADJUST:{head:"JAMG'ARMA TO'G'IRLANDI",who:"Xodim",sign:""}},O=s=>new Date(s).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"});function G({data:s,token:p,appToken:r,customerId:o,id:t,signedId:l,signature:d,onClose:h,savings:g=!1}){const[e,_]=u.useState(s||null),[j,R]=u.useState(""),[f,w]=u.useState(""),k=u.useRef(null);u.useEffect(()=>{if(s){_(s);return}let n,N={};l?n=g?`${A}/public/portal/savings-receipt/${l}?k=${encodeURIComponent(d)}`:`${A}/public/portal/payment/${l}?k=${encodeURIComponent(d)}`:r?(n=`${A}/app/${g?"savings":"payments"}/${t}?c=${encodeURIComponent(o)}`,N={"X-App-Token":r}):(n=`${A}/public/portal/${g?"savings":"payments"}/${t}`,N={"X-Portal-Token":p}),fetch(n,{headers:N}).then(c=>c.json()).then(c=>{if(c.success===!1)throw new Error(c.message);_(c.data)}).catch(c=>R(c.message||"Chekni ochib bo'lmadi"))},[s,t,p,r,o,l,d,g]);const I=async()=>{w("");try{await D(k.current,e?`Chek ${e.receiptNo}`:"Chek")}catch(n){w(n.message||"Saqlab bo'lmadi")}},b=(e==null?void 0:e.kind)||"",m=b==="CHARGE",i=b.startsWith("SAVINGS_")?y[b.slice(8)]||y.ADJUST:null,v=e&&!m&&!i&&Number(e.balanceAfter)===0,S=i&&e&&e.balanceBefore!=null&&Number(e.balanceAfter)>Number(e.balanceBefore);return a.jsx(q,{className:"pt-modal",onClick:h,onEscape:h,role:"dialog","aria-modal":"true",children:a.jsxs("div",{className:"pt-modal__inner",onClick:n=>n.stopPropagation(),children:[a.jsx("button",{className:"pt-close",onClick:h,"aria-label":"Yopish",children:a.jsx("i",{className:"fa-solid fa-xmark","aria-hidden":"true"})}),j&&a.jsx("div",{className:"pt-tape pt-center",children:j}),!e&&!j&&a.jsx("div",{className:"pt-tape pt-center",children:"Yuklanmoqda…"}),e&&a.jsxs("div",{className:"pt-tape ek-tear",ref:k,children:[a.jsxs("div",{className:"pt-tape__head",children:[a.jsx("div",{className:"pt-tape__shop",children:e.shopName}),e.shopAddress&&a.jsx("div",{children:e.shopAddress}),e.shopPhone&&a.jsx("div",{children:e.shopPhone}),a.jsx("div",{className:"pt-tape__kind",children:i?"JAMG'ARMA KVITANSIYASI":m?"QARZ OLINDI":"QARZ TO'LOVI"})]}),a.jsx("div",{className:"pt-hr"}),a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Chek"}),a.jsx("span",{children:e.receiptNo})]}),a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Sana"}),a.jsx("span",{children:O(e.date)})]}),e.customerName&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Mijoz"}),a.jsx("span",{children:e.customerName})]}),e.cashierName&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:i?i.who:m?"Berdi":"Qabul qildi"}),a.jsx("span",{children:e.cashierName})]}),a.jsx("div",{className:"pt-hr"}),a.jsxs("div",{className:"pt-tape__row pt-total",children:[a.jsx("span",{children:i?i.head:m?"QARZGA OLINDI":"TO'LANDI"}),a.jsxs("span",{children:[i?i.sign||(Number(e.amount)<0?"−":"+"):"",x(Math.abs(Number(e.amount)||0))]})]}),e.method&&!m&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"To'lov turi"}),a.jsx("span",{children:T[e.method]||e.method})]}),e.linkedNo&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Xarid cheki"}),a.jsx("span",{children:e.linkedNo})]}),a.jsx("div",{className:"pt-hr"}),e.balanceBefore!=null&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:i?"Jamg'armada edi":"Qarz edi"}),a.jsx("span",{children:x(e.balanceBefore)})]}),e.balanceAfter!=null&&a.jsxs("div",{className:`pt-tape__row pt-total ${v||S?"pt-earn":""}`,children:[a.jsx("span",{children:i?"JAMG'ARMADA":v?"QARZ YOPILDI":m?"JAMI QARZ":"QOLDI"}),a.jsx("span",{children:x(e.balanceAfter)})]}),Array.isArray(e.allocations)&&e.allocations.length>0&&a.jsxs(a.Fragment,{children:[a.jsx("div",{className:"pt-hr"}),e.allocations.map(n=>a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:n.chargeNo}),a.jsx("span",{children:x(n.amount)})]},n.chargeId))]}),Number(e.toSavings)>0&&a.jsxs("div",{className:"pt-tape__row pt-earn",children:[a.jsx("span",{children:"Jamg'armaga"}),a.jsxs("span",{children:["+",x(e.toSavings)]})]}),Number(e.bonusEarned)>0&&a.jsxs("div",{className:"pt-tape__row pt-earn",children:[a.jsx("span",{children:"Ball yig'ildi"}),a.jsxs("span",{children:["+",x(e.bonusEarned)]})]}),e.reason&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Izoh"}),a.jsx("span",{children:e.reason})]}),i&&a.jsx("div",{className:"pt-center pt-tape__no",children:"Bu sizning pulingiz — kuymaydi, xaridda to'liq ishlatiladi"}),e.qrUrl&&a.jsxs(a.Fragment,{children:[a.jsx("div",{className:"pt-hr"}),a.jsx("div",{className:"pt-center",dangerouslySetInnerHTML:{__html:z(e.qrUrl,{size:110,margin:1})}}),a.jsx("div",{className:"pt-center pt-tape__no",children:"Chekni telefonda ochish"})]}),a.jsx("div",{className:"pt-hr"}),a.jsx("div",{className:"pt-center pt-tape__no",children:e.receiptNo}),a.jsx("div",{className:"pt-center pt-thanks",children:"Rahmat!"}),a.jsx("div",{className:"pt-center pt-tape__site",children:"e-kassam.uz"})]}),e&&a.jsxs("div",{className:"pt-actions",children:[a.jsxs("button",{type:"button",className:"btn btn-primary",onClick:I,children:[a.jsx("i",{className:"fa-solid fa-file-pdf","aria-hidden":"true"})," PDF qilib saqlash"]}),f&&a.jsx("div",{className:"pt-actions__err",children:f})]})]})})}const $=Object.freeze(Object.defineProperty({__proto__:null,default:G},Symbol.toStringTag,{value:"Module"}));export{G as P,$ as a,D as s};
