import{ao as v,r as d,j as a,aM as w,aN as S,aO as C,aP as j}from"./index-DZdjAaah.js";const E=`
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
`;function A(i,l){return`<!DOCTYPE html><html lang="uz" data-theme="light"><head><meta charset="utf-8"><title>${(n=>String(n??"").replace(/[&<>"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[s]))(l)}</title><style>${E}</style></head><body>${i}</body></html>`}async function q(i,l){var m,o;if(!i)throw new Error("Chek hali yuklanmadi");const h=l||"Chek",n=A(i.outerHTML,h);if(v()){const e=(o=(m=window.Capacitor)==null?void 0:m.Plugins)==null?void 0:o.ReceiptPrint;if(e){await e.print({html:n,name:h});return}}const s=window.open("","_blank","width=420,height=720");if(!s)throw new Error("Brauzer yangi oynani to'sdi — ruxsat bering va qayta urinib ko'ring");s.document.write(n),s.document.close(),s.onafterprint=()=>s.close(),setTimeout(()=>s.print(),80)}const r=i=>new Intl.NumberFormat("uz-UZ",{maximumFractionDigits:2}).format(Number(i||0)),z={CASH:"Naqd",CARD:"Karta",MIXED:"Aralash",CREDIT:"Nasiya",CLICK:"Click",PAYME:"Payme",TRANSFER:"O'tkazma"},F={DONA:"dona",KG:"kg",GRAM:"g",LITR:"l",METR:"m",QUTI:"quti",UPAK:"upak"};function P({token:i,appToken:l,customerId:h,id:n,signedId:s,signature:m,onClose:o}){const[e,_]=d.useState(null),[u,k]=d.useState(""),[x,g]=d.useState(null),b=d.useRef(null),[f,N]=d.useState("");d.useEffect(()=>{let t,p={};s?t=`${j}/public/portal/receipt/${s}?k=${encodeURIComponent(m)}`:l?(t=`${j}/app/receipts/${n}?c=${encodeURIComponent(h)}`,p={"X-App-Token":l}):(t=`${j}/public/portal/receipts/${n}`,p={"X-Portal-Token":i}),fetch(t,{headers:p}).then(c=>c.json()).then(c=>{if(c.success===!1)throw new Error(c.message);_(c.data)}).catch(c=>k(c.message||"Chekni ochib bo'lmadi"))},[n,i,l,h,s,m]);const y=async()=>{N("");try{await q(b.current,e?`Chek ${e.receiptNo}`:"Chek")}catch(t){N(t.message||"Saqlab bo'lmadi")}};return d.useEffect(()=>{const t=p=>{p.key==="Escape"&&o()};return addEventListener("keydown",t),()=>removeEventListener("keydown",t)},[o]),a.jsx("div",{className:"pt-modal",onClick:o,role:"dialog","aria-modal":"true",children:a.jsxs("div",{className:"pt-modal__inner",onClick:t=>t.stopPropagation(),children:[a.jsx("button",{className:"pt-close",onClick:o,"aria-label":"Yopish",children:a.jsx("i",{className:"fa-solid fa-xmark","aria-hidden":"true"})}),u&&a.jsx("div",{className:"pt-tape pt-center",children:u}),!e&&!u&&a.jsx("div",{className:"pt-tape pt-center",children:"Yuklanmoqda…"}),e&&a.jsxs("div",{className:"pt-tape ek-tear",ref:b,children:[a.jsxs("div",{className:"pt-tape__head",children:[a.jsx("div",{className:"pt-tape__shop",children:e.shopName}),e.shopAddress&&a.jsx("div",{children:e.shopAddress}),e.shopPhone&&a.jsx("div",{children:e.shopPhone})]}),a.jsx("div",{className:"pt-hr"}),a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Chek"}),a.jsx("span",{children:e.receiptNo})]}),a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Sana"}),a.jsx("span",{children:new Date(e.date).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"})})]}),e.cashierName&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Kassir"}),a.jsx("span",{children:e.cashierName})]}),a.jsx("div",{className:"pt-hr"}),e.lines.map((t,p)=>a.jsxs("div",{className:"pt-line",children:[a.jsx("div",{className:"pt-line__name",children:t.name}),a.jsxs("div",{className:"pt-tape__row",children:[a.jsxs("span",{children:[r(t.quantity)," ",F[t.unit]||""," × ",r(t.price)]}),a.jsx("span",{children:r(t.sum)})]})]},p)),a.jsx("div",{className:"pt-hr"}),Number(e.discount)>0&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Chegirma"}),a.jsxs("span",{children:["−",r(e.discount)]})]}),Number(e.loyaltyDiscount)>0&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:e.loyaltyTierName||"Sodiqlik"}),a.jsxs("span",{children:["−",r(e.loyaltyDiscount)]})]}),Number(e.bonusUsed)>0&&a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Ball ishlatildi"}),a.jsxs("span",{children:["−",r(e.bonusUsed)]})]}),a.jsxs("div",{className:"pt-tape__row pt-total",children:[a.jsx("span",{children:"JAMI"}),a.jsx("span",{children:r(e.total)})]}),a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"To'lov"}),a.jsx("span",{children:z[e.paymentType]||e.paymentType||"—"})]}),Number(e.bonusEarned)>0&&a.jsxs(a.Fragment,{children:[a.jsx("div",{className:"pt-hr"}),a.jsxs("div",{className:"pt-tape__row pt-earn",children:[a.jsx("span",{children:"Ball yig'ildi"}),a.jsxs("span",{children:["+",r(e.bonusEarned)]})]})]}),e.returned&&a.jsx("div",{className:"pt-returned",children:"QAYTARILGAN"}),e.fiscalSign&&a.jsxs(a.Fragment,{children:[a.jsx("div",{className:"pt-hr"}),a.jsxs("div",{className:"pt-tape__row",children:[a.jsx("span",{children:"Fiskal belgi"}),a.jsx("span",{children:e.fiscalSign})]}),e.fiscalQrUrl&&a.jsx("button",{type:"button",className:"pt-fiscalqr ek-code-btn",onClick:()=>g("qr"),"aria-label":"Fiskal QR ni kattalashtirish",dangerouslySetInnerHTML:{__html:w(e.fiscalQrUrl,{size:110,margin:1})}})]}),a.jsx("div",{className:"pt-hr"}),a.jsx("button",{type:"button",className:"pt-center pt-barcode ek-code-btn",onClick:()=>g("bar"),"aria-label":"Shtrix kodni kattalashtirish",dangerouslySetInnerHTML:{__html:S(`S-${String(e.id).padStart(6,"0")}`)}}),a.jsxs("div",{className:"pt-center pt-tape__no",children:["S-",String(e.id).padStart(6,"0")]}),a.jsx("div",{className:"pt-center pt-thanks",children:"Xarid uchun rahmat!"}),a.jsx("div",{className:"pt-center pt-tape__site",children:"e-kassam.uz"})]}),e&&a.jsxs("div",{className:"pt-actions",children:[a.jsxs("button",{type:"button",className:"btn btn-primary",onClick:y,children:[a.jsx("i",{className:"fa-solid fa-file-pdf","aria-hidden":"true"})," PDF qilib saqlash"]}),f&&a.jsx("div",{className:"pt-actions__err",children:f})]}),x&&e&&a.jsx(C,{kind:x,value:x==="qr"?e.fiscalQrUrl:`S-${String(e.id).padStart(6,"0")}`,caption:x==="bar"?`S-${String(e.id).padStart(6,"0")}`:null,onClose:()=>g(null)})]})})}export{P as R};
