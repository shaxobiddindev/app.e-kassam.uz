const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/ek-kitchen-D5-bNfzK.js","assets/ek-escpos-CNgMtKCW.js"])))=>i.map(i=>d[i]);
import{au as b,t as e,al as k,a$ as A,ap as we,b0 as Y,m as p,x as te,R as j,B as ie,A as Z,b1 as W,as as K}from"./index-DSNTfY4N.js";import{b2 as We,aQ as Qe}from"./index-DSNTfY4N.js";import{R as D,W as C,a as E,d as he}from"./ek-escpos-CNgMtKCW.js";import{s as L,a as G}from"./ek-barcode-QI4C0tjY.js";import{s as ne,g as se}from"./ek-discount-CfQ-QIGD.js";const X=8,be=30,ee={58:48,80:72},V=[{capacity:14,modules:21},{capacity:26,modules:25},{capacity:42,modules:29},{capacity:62,modules:33},{capacity:84,modules:37},{capacity:106,modules:41},{capacity:122,modules:45},{capacity:152,modules:49},{capacity:180,modules:53},{capacity:213,modules:57}];function ve(a){const i=new TextEncoder().encode(String(a??"")).length;for(const t of V)if(i<=t.capacity)return t.modules;return V[V.length-1].modules}function ge(a,i=80){const t=ve(a);let o=Math.ceil(be*X/t);const r=ee[i]??ee[80],c=Math.floor(r*X/t);return c>=1&&(o=Math.min(o,c)),Math.max(1,Math.min(16,o))}const $e=new Set(["SALE","RETURN","CORRECTION"]);function ye(a){return $e.has(a||"SALE")}async function qe(){if(!k())return[];try{return await A("list_printers")||[]}catch{return[]}}function oe(a){return k()?a.transport==="tcp"?"tcp":"windows":"browser"}let Q=null;const Ae=()=>Q;function ae(a,i){Q={ok:a,at:Date.now(),error:i?String(i.message||i):null};try{window.dispatchEvent(new CustomEvent("ek:printer",{detail:Q}))}catch{}}async function T(a){const i=b();if(!k())throw new Error(e("hw.errNoDesktop"));try{let t;if(oe(i)==="tcp"){if(!i.host)throw new Error(e("hw.errNoHost"));t=await A("print_tcp",{host:i.host,port:Number(i.port)||9100,data:a})}else t=await A("print_raw",{printer:i.printerName||null,data:a});return ae(!0,null),t}catch(t){throw ae(!1,t),t}}function ke({saleId:a,serverSaleId:i,cart:t=[],total:o=0,subtotal:r,discount:c=0,customer:n,offline:l,shopName:$,cashier:u,fiscal:f,credit:v,toSavings:z,rounding:q=0,saleType:m="SALE",serviceCharge:x=0,servicePercent:_=0,tip:P=0}){const M=b(),d=new D(M.width===58?C:E),N=Y($);N.name?d.center().double().line(N.name).double(!1):d.center(),N.phone&&d.line(N.phone),d.left().rule(),d.row(`${e("kassa.receiptNo")} ${a??"-"}`,new Date().toLocaleString("uz-UZ")),u&&d.row(e("kassa.receiptCashier"),u),d.rule();const U=ne(t,c);t.forEach((w,g)=>{d.wrap(w.name);for(const s of w.modifiers||[])d.row(`  + ${s.name}`,Number(s.price)>0?p(s.price):"");const S=`${j(w.qty,w.unitDecimals)}${w.unit?" "+Z(w.unit):""}`;d.row(`  ${S} x ${p(w.salePrice)}`,W(se(w.salePrice,w.qty)));const h=(Number(w.discount)||0)+(U[g]||0);h>0&&d.row(`    ${e("kassa.discount")}`,"-"+p(h))}),d.rule();const B=t.reduce((w,g)=>w+(Number(g.discount)||0),0),I=c+B;I>0&&(d.row(e("kassa.receiptSubtotal"),p(r??o+I)),d.row(e("kassa.discount"),"-"+p(I))),Number(x)>0&&d.row(e("svc.line",{pct:_}),"+"+p(x)),Number(q)>0&&d.row(e("kassa.rounding"),"-"+W(q)),d.bold().double().row(e("kassa.receiptTotal"),p(o)).double(!1).bold(!1),Number(P)>0&&d.row(e("tip.receipt"),p(P)),Number(z)>0&&d.row(e("savings.toSavings"),"+"+p(z)),n!=null&&n.fullName&&d.row(e("kassa.receiptCustomer"),n.fullName),v&&Number(v.amount)>0&&(d.rule(),d.center().bold().line(e("kassa.receiptCredit")).bold(!1).left(),d.row(e("kassa.receiptCreditThis"),p(v.amount)),v.balance!=null&&d.row(e("kassa.receiptCreditTotal"),p(v.balance)),v.dueDate&&d.row(e("kassa.receiptCreditDue"),v.dueDate),d.feed().row(e("kassa.receiptCreditSign"),"______________")),l&&d.feed().center().line(e("kassa.receiptOffline")).line(e("kassa.receiptOfflineSub")).left();const O=t.reduce((w,g)=>{const S=Number(g.vatRate);if(!S)return w;const h=Number(g.salePrice)*Number(g.qty);return w+(g.priceIncludesVat===!1?h*S/100:h*S/(100+S))},0);if(O>0&&d.row(e("kassa.receiptVat"),p(O)),f!=null&&f.fiscalSign&&ye(m)&&(d.rule(),d.center().line(e("kassa.receiptFiscal")).left(),d.row(e("kassa.receiptFiscalSign"),f.fiscalSign),f.terminalId&&d.row(e("kassa.receiptTerminal"),f.terminalId),f.receiptNo&&d.row(e("kassa.receiptFiscalNo"),f.receiptNo),f.qrUrl&&d.feed().center().qr(f.qrUrl,ge(f.qrUrl,M.width)).left()),i){const w=L(i);d.feed().center().barcode128(w).line(w).left()}return d.rule(),d.center().line(e("kassa.receiptThanks")),N.footer&&d.wrap(N.footer),d.left(),d}async function Le(a){const i=b();if(!k())return le(a);const t=ke(a);i.openDrawer&&a.payType==="CASH"&&t.kick(),t.cut(),await T(t.build())}function re(a){const i=String(a||"").startsWith("SAVINGS_");if(!i)return{sav:i,title:e("kassa.receiptDebtPay"),main:e("kassa.receiptPaid"),before:e("credit.wasDebt"),after:e("kassa.receiptDebtLeft")};const t=String(a).slice(8);return{sav:i,title:e("savings.receiptTitle"),main:e(`savings.rcp.${t}`),before:e("savings.wasBalance"),after:e("savings.nowBalance")}}function _e({customer:a,amount:i,balanceAfter:t,balanceBefore:o,method:r,shopName:c,cashier:n,date:l,receiptNo:$,toSavings:u,bonusEarned:f,kind:v,linkedNo:z}){const q=b(),m=new D(q.width===58?C:E),x=re(v),_=Y(c);return _.name?m.center().double().line(_.name).double(!1):m.center(),_.phone&&m.line(_.phone),m.line(x.title),m.left().rule(),$&&m.row(e("kassa.receiptNo"),$),m.row(e("common.date"),(l||new Date).toLocaleString("uz-UZ")),n&&m.row(e("kassa.receiptCashier"),n),a!=null&&a.fullName&&m.row(e("kassa.receiptCustomer"),a.fullName),m.rule(),m.bold().double().row(x.main,p(Math.abs(Number(i)||0))).double(!1).bold(!1),z&&m.row(e("savings.linkedSale"),z),o!=null&&m.row(x.before,p(o)),m.row(x.after,p(t??0)),Number(u)>0&&m.row(e("savings.toSavings"),p(u)),Number(f)>0&&m.row(e("kassa.receiptBonusEarned"),"+"+p(f)),m.rule(),m.center().line(e("kassa.receiptThanks")),_.footer&&m.wrap(_.footer),m.left(),m}async function Me(a){const i=b();if(!k())return le({...a,__debt:!0});const t=_e(a);i.openDrawer&&a.method==="CASH"&&t.kick(),t.cut(),await T(t.build())}async function Ie({fullName:a,username:i,version:t,token:o,shopName:r}){if(!k())throw new Error(e("hw.errNoDesktop"));const c=b(),n=new D(c.width===58?C:E);n.center().double().line(e("badge.printTitle")).double(!1),n.line(r||"E-KASSAM.UZ"),n.left().rule(),n.center().bold().line(a||i||"-").bold(!1),n.line("@"+(i||"-")),n.line(`${e("badge.version")} ${t??1}`),n.feed(),n.qr(o,8),n.feed(),n.line(new Date().toLocaleString("uz-UZ")),n.left().rule(),n.wrap(e("badge.printWarn")),n.cut(),await T(n.build())}async function Oe(a,i){var c;if(!k())throw new Error(e("hw.errNoDesktop"));const t=b(),o=new D(t.width===58?C:E),r=n=>n?new Date(n).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"}):"-";o.center().double().line(a.closedAt?"Z-HISOBOT":"X-HISOBOT").double(!1),o.line(i||"E-KASSAM.UZ"),o.left().rule(),o.row(e("sales.colCashier"),a.cashierName||"-"),o.row(e("sec.openedAt"),r(a.openedAt)),a.closedAt&&o.row(e("shift.closedAt"),r(a.closedAt)),o.rule(),o.row(e("rpt.salesCount"),String(a.salesCount)),o.bold().row(e("rpt.salesTotal"),p(a.salesTotal)).bold(!1);for(const[n,l]of Object.entries(a.byPaymentType||{}))o.row("  "+K(n),p(l));if(o.rule(),o.row(e("rpt.cancelled"),`${a.cancelledCount} / ${p(a.cancelledTotal)}`),Number(a.tipsTotal)>0&&o.row(e("tip.receipt"),p(a.tipsTotal)),o.row(e("rpt.confirmations"),String(a.confirmationsCount)),a.suspiciousCount>0&&o.bold().row(e("rpt.suspicious"),String(a.suspiciousCount)).bold(!1),a.cash&&(o.rule(),o.row(e("cash.openingFloat"),p(a.cash.openingFloat)),a.cash.expectedCash!=null&&o.row(e("cash.expected"),p(a.cash.expectedCash)),a.cash.countedCash!=null&&(o.bold().row(e("cash.counted"),p(a.cash.countedCash)).bold(!1),o.bold().row(e("cash.difference"),p(a.cash.difference)).bold(!1))),(c=a.nonCash)!=null&&c.length){o.rule(),o.line(e("noncash.title"));for(const n of a.nonCash)n.counted==null?o.row("  "+K(n.paymentType),n.expected==null?"-":p(n.expected)):(o.row("  "+K(n.paymentType),`${p(n.expected)} / ${p(n.counted)}`),Number(n.difference)!==0&&o.bold().row("  "+e("cash.difference"),p(n.difference)).bold(!1))}o.rule(),o.center().line(new Date().toLocaleString("uz-UZ")),o.cut(),await T(o.build())}async function Re(){if(!k())throw new Error(e("hw.errNoDesktop"));await T(he())}async function Ue(a=[],i={}){if(!k())throw new Error(e("hw.errNoDesktop"));await T(xe(a,i))}async function Be(a,i={}){const t={sent:[],missing:[],failed:[]};if(!(a!=null&&a.length))return t;if(!k())return t.missing=a.map(c=>c.station),t;const{buildTicket:o}=await we(async()=>{const{buildTicket:c}=await import("./ek-kitchen-D5-bNfzK.js");return{buildTicket:c}},__vite__mapDeps([0,1])),r=b().stations||{};for(const c of a){const n=r[c.station],l=(n==null?void 0:n.transport)==="tcp";if(!n||(l?!n.host:!n.printerName)){t.missing.push(c.station);continue}const $=o({...c,...i,width:Number(n.width)===58?58:80});try{l?await A("print_tcp",{host:n.host,port:Number(n.port)||9100,data:$}):await A("print_raw",{printer:n.printerName,data:$}),t.sent.push(c.station)}catch(u){t.failed.push({station:c.station,error:String((u==null?void 0:u.message)||u)})}}return t}async function je(a){if(!k())throw new Error(e("hw.errNoDesktop"));if(!a)throw new Error(e("hw.errNoData"));const i=(b().labelPrinterName||"").trim();if(!i)throw new Error(e("hw.errNoLabelPrinter"));const t=a instanceof Uint8Array?a:new TextEncoder().encode(String(a));await A("print_raw",{printer:i,data:Array.from(t)})}function xe(a=[],{copies:i=1,shopName:t,width:o}={}){const r=(a||[]).filter(Boolean);if(!r.length)throw new Error(e("label.nothing"));const c=b(),n=o??(c.width===58?C:E),l=new D(n),$=Math.max(1,Math.min(20,Number(i)||1));for(const u of r)for(let f=0;f<$;f++)l.center(),t&&l.line(t),l.bold().wrap(u.name||"-").bold(!1),u.shortCode!=null&&u.shortCode!==""&&l.bold().line(`KOD ${u.shortCode}`).bold(!1),l.feed(),l.double().line(p(u.salePrice)).double(!1),u.oldPrice!=null&&Number(u.oldPrice)>Number(u.salePrice)&&l.line(`${e("label.oldPrice")}: ${p(u.oldPrice)}`),l.feed(),u.barcode&&(!l.barcodeEan13(u.barcode)&&!l.barcodeEan8(u.barcode)&&l.barcode128(u.barcode,{hri:!0}),l.feed()),l.line(new Date().toLocaleDateString("uz-UZ")),l.left().line("- ".repeat(Math.floor(l.width/2)).trimEnd()).center();return l.cut(),l.build()}async function Ze(a=[],i={}){const t=(a||[]).filter(Boolean);if(!t.length)throw new Error(e("label.nothing"));if(!k())return Se(t,i);await T(Ne(t,i))}function Ne(a=[],{copies:i=1,shopName:t,width:o}={}){const r=(a||[]).filter(Boolean);if(!r.length)throw new Error(e("label.nothing"));const c=b(),n=o??(c.width===58?C:E),l=new D(n),$=Math.max(1,Math.min(20,Number(i)||1));for(const u of r)for(let f=0;f<$;f++)l.center(),t&&l.line(t),l.bold().line(e("label.expiryTitle")).bold(!1),l.bold().wrap(u.name||"-").bold(!1),l.feed(),l.double().line(te(u.expiryDate)).double(!1),u.daysLeft!=null&&l.line(u.daysLeft<=0?e("label.expiryToday"):e("inv.nearDays",{n:u.daysLeft})),u.salePrice!=null&&l.line(p(u.salePrice)),l.feed(),u.barcode&&(!l.barcodeEan13(u.barcode)&&!l.barcodeEan8(u.barcode)&&l.barcode128(u.barcode,{hri:!0}),l.feed()),l.left().line("- ".repeat(Math.floor(l.width/2)).trimEnd()).center();return l.cut(),l.build()}function Se(a,{shopName:i}={}){const t=window.open("","_blank","width=820,height=900");if(!t)throw new Error(e("hw.errPopup"));const o=c=>String(c??"").replace(/[&<>"]/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[n]),r=a.map(c=>{const n=c.daysLeft,l=n==null?"":n<=0?e("label.expiryToday"):e("inv.nearDays",{n});return`<div class="lbl">
      <div class="hdr">${o(e("label.expiryTitle"))}</div>
      <div class="nm">${o(c.name||"-")}</div>
      <div class="dt">${o(te(c.expiryDate))}</div>
      ${l?`<div class="lf">${o(l)}</div>`:""}
      ${c.salePrice!=null?`<div class="pr">${o(p(c.salePrice))}</div>`:""}
      ${c.barcode?`<div class="bc">${G(String(c.barcode),{height:22})}</div>`:""}
      ${i?`<div class="sh">${o(i)}</div>`:""}
    </div>`}).join("");return t.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${o(e("label.expiryTitle"))}</title>
    <style>
      @page { size: A4; margin: 8mm; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif; color:#000;
             display:flex; flex-wrap:wrap; gap:0; }
      /* Uzuq-uzuq ramka — qirqish chizig'i. Kartochkalar yonma-yon
         tursin deb chetlari birlashtirilmaydi: ikki chiziq orasidan
         qirqish osonroq. */
      .lbl { width:62mm; height:40mm; border:1px dashed #000; padding:2mm;
             display:flex; flex-direction:column; align-items:center; justify-content:center;
             text-align:center; overflow:hidden; }
      .hdr { font-size:8pt; font-weight:800; letter-spacing:.5px; }
      .nm  { font-size:10pt; font-weight:700; line-height:1.15; margin-top:1mm;
             display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      /* SANA — eng katta raqam: stiker aynan shu uchun yopishtiriladi. */
      .dt  { font-size:19pt; font-weight:900; line-height:1.1; margin-top:1mm;
             font-variant-numeric: tabular-nums; }
      .lf  { font-size:9pt; font-weight:700; }
      .pr  { font-size:10pt; font-weight:700; margin-top:.5mm; }
      .bc  { margin-top:1mm; }
      .bc svg { height:22px; }
      .sh  { font-size:7pt; margin-top:auto; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>${r}</body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},Promise.resolve()}async function Fe(a,i={}){if(!a)throw new Error(e("label.nothing"));if(!k())return De(a,i);await T(Te(a,i))}function Te(a,{shopName:i,width:t}={}){const o=b(),r=new D(t??(o.width===58?C:E));r.center().double().line(e("pickup.slipTitle")).double(!1),i&&r.line(i),r.left().rule(),r.row(`${e("kassa.receiptNo")} ${a.saleCode||"-"}`,a.createdAt?new Date(a.createdAt).toLocaleString("uz-UZ"):""),a.cashierName&&r.row(e("kassa.receiptCashier"),a.cashierName),a.customerName&&r.row(e("kassa.receiptCustomer"),a.customerName),a.customerPhone&&r.row(e("common.phone"),a.customerPhone),r.rule();for(const c of a.items||[])r.wrap(c.productName),r.double().line(`  ${j(c.quantity,ie(c.unit))} ${Z(c.unit)}`).double(!1);if(r.rule(),a.saleId){const c=L(a.saleId);r.feed().center().barcode128(c).line(c).left()}return r.feed(),r.row(e("pickup.signStore"),"______________"),r.feed().row(e("pickup.signCustomer"),"______________"),r.cut(),r.build()}function De(a,{shopName:i}={}){const t=window.open("","_blank","width=360,height=640");if(!t)throw new Error(e("hw.errPopup"));const o=b().width===58?58:80,r=n=>String(n??"").replace(/[&<>"]/g,l=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[l]),c=(a.items||[]).map(n=>`<div class="it"><div class="nm">${r(n.productName)}</div>
     <div class="qt">${r(j(n.quantity,ie(n.unit)))} ${r(Z(n.unit))}</div></div>`).join("");return t.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${r(e("pickup.slipTitle"))} ${r(a.saleCode||"")}</title>
    <style>
      @page { size: ${o}mm auto; margin: 0; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
             font-variant-numeric: tabular-nums; font-size:12px; line-height:1.35;
             color:#000; width:${o}mm; padding:3mm; }
      .c { text-align:center; }
      .hr { border:none; border-top:1px dashed #000; margin:6px 0; }
      .row { display:flex; justify-content:space-between; gap:8px; padding:2px 0; }
      .ttl { font-size:16px; font-weight:800; letter-spacing:.5px; }
      .it { padding:4px 0; border-bottom:1px dotted #999; }
      .nm { font-weight:700; }
      /* Miqdor — eng katta raqam: omborchi shunga qarab sanaydi. */
      .qt { font-size:18px; font-weight:900; text-align:right; }
      @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
    </style></head><body>
      <div class="c"><div class="ttl">${r(e("pickup.slipTitle"))}</div>
        ${i?`<small>${r(i)}</small>`:""}</div>
      <div class="hr"></div>
      <div class="row"><b>${r(e("kassa.receiptNo"))} ${r(a.saleCode||"-")}</b>
        <span>${r(a.createdAt?new Date(a.createdAt).toLocaleString("uz-UZ"):"")}</span></div>
      ${a.cashierName?`<div class="row"><span>${r(e("kassa.receiptCashier"))}</span><span>${r(a.cashierName)}</span></div>`:""}
      ${a.customerName?`<div class="row"><span>${r(e("kassa.receiptCustomer"))}</span><span>${r(a.customerName)}</span></div>`:""}
      ${a.customerPhone?`<div class="row"><span>${r(e("common.phone"))}</span><span>${r(a.customerPhone)}</span></div>`:""}
      <div class="hr"></div>
      ${c}
      <div class="hr"></div>
      ${a.saleId?`<div class="c">${G(L(a.saleId),{height:14})}
        <div><b>${r(L(a.saleId))}</b></div></div>`:""}
      <div class="row" style="margin-top:14px"><span>${r(e("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${r(e("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},Promise.resolve()}async function He(){const a=b(),i=new D(a.width===58?C:E);i.center().double().line(e("hw.testTitle")).double(!1),i.line(new Date().toLocaleString("uz-UZ")),i.left().rule();const t=oe(a);i.row(e("hw.transport"),t),i.row(e("hw.printer"),t==="tcp"?`${a.host}:${a.port}`:a.printerName||e("hw.defaultPrinter")),i.row(e("hw.width"),`${a.width} mm`),i.rule(),i.line("1234567890".repeat(6).slice(0,i.width)),i.center().line(e("hw.testOk")),i.cut(),await T(i.build())}function le({saleId:a,serverSaleId:i,cart:t=[],total:o=0,subtotal:r,discount:c=0,customer:n,offline:l,shopName:$,cashier:u,credit:f,__debt:v,amount:z,balanceAfter:q,balanceBefore:m,date:x,receiptNo:_,toSavings:P,bonusEarned:M,kind:d,linkedNo:N,rounding:U=0,serviceCharge:B=0,servicePercent:I=0,tip:O=0}){const w=window.open("","_blank","width=360,height=640,toolbar=no,menubar=no");if(!w)throw new Error(e("hw.errPopup"));const g=re(d),S=b().width===58?58:80,h=Y($),s=y=>String(y??"").replace(/[&<>"]/g,R=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[R]),ce=ne(t,c),pe=t.reduce((y,R)=>y+(Number(R.discount)||0),0),F=c+pe,de=t.map((y,R)=>{const fe=`${j(y.qty,y.unitDecimals)}${y.unit?" "+Z(y.unit):""}`,J=(Number(y.discount)||0)+(ce[R]||0),me=(y.modifiers||[]).map(H=>`<div class="row sub"><span>+ ${s(H.name)}</span><span>${Number(H.price)>0?s(p(H.price)):""}</span></div>`).join("");return`<div class="row"><span>${s(y.name)} × ${s(fe)}</span><span>${s(p(se(y.salePrice,y.qty)))}</span></div>`+me+(J>0?`<div class="row sub"><span>${s(e("kassa.discount"))}</span><span>-${s(p(J))}</span></div>`:"")}).join(""),ue=v?`
      <div class="c"><div class="logo">${s(h.name)}</div>
        ${h.phone?`<small>${s(h.phone)}</small><br>`:""}
        <small>${s(g.title)}</small></div>
      <div class="hr"></div>
      ${_?`<div class="row"><span>${s(e("kassa.receiptNo"))}</span><span>${s(_)}</span></div>`:""}
      <div class="row"><span>${s(e("common.date"))}</span><span>${s((x||new Date).toLocaleString("uz-UZ"))}</span></div>
      ${u?`<div class="row"><span>${s(e("kassa.receiptCashier"))}</span><span>${s(u)}</span></div>`:""}
      ${n!=null&&n.fullName?`<div class="row"><span>${s(e("kassa.receiptCustomer"))}</span><span>${s(n.fullName)}</span></div>`:""}
      <div class="hr"></div>
      <div class="row"><b>${s(g.main)}</b><b>${s(p(Math.abs(Number(z)||0)))}</b></div>
      ${N?`<div class="row"><span>${s(e("savings.linkedSale"))}</span><span>${s(N)}</span></div>`:""}
      ${m!=null?`<div class="row"><span>${s(g.before)}</span><span>${s(p(m))}</span></div>`:""}
      <div class="row"><span>${s(g.after)}</span><span>${s(p(q??0))}</span></div>
      ${Number(P)>0?`<div class="row"><span>${s(e("savings.toSavings"))}</span><span>${s(p(P))}</span></div>`:""}
      ${Number(M)>0?`<div class="row"><span>${s(e("kassa.receiptBonusEarned"))}</span><span>+${s(p(M))}</span></div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${s(e("kassa.receiptThanks"))}</p>${h.footer?`<small>${s(h.footer)}</small>`:""}</div>`:"";w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${s(v?g.title:e("kassa.receiptNo")+" "+a)}</title>
    <style>
      /* CHEK QOG'OZI - A4 EMAS.
         @page bo'lmasa brauzer chekni A4 sahifaga joylashtiradi, chetiga
         o'z sarlavha-izohini (manzil, sana, bet raqami) qo'shadi va matn
         chek printeriga umuman sig'maydi - aynan shu "noto'g'ri format"
         edi. margin:0 esa brauzerning o'sha sarlavhalarini olib tashlaydi.
         Balandlik auto: chek uzunligi tovar soniga qarab o'zgaradi. */
      @page { size: ${S}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${S}mm; padding: 3mm; }
      .c { text-align:center; }
      .hr { border:none; border-top:1px dashed #000; margin:6px 0; }
      .row { display:flex; justify-content:space-between; padding:2px 0; gap:8px; }
      .row span:last-child { white-space: nowrap; }
      /* Qatorga tushgan chegirma — tovar ostida, ichkariroq surilgan. */
      .row.sub { padding-left: 10px; font-size: 11px; }
      .logo { font-size:15px; font-weight:800; letter-spacing:.5px; }
      .off { margin-top:6px; padding:4px; border:1px dashed #000; font-size:10px; text-align:center; }
      .no { font-size:13px; font-weight:800; }
      @media print {
        /* Termal printerda kulrang matn o'qilmaydi — hammasi qora. */
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style></head><body>
      ${ue}
      ${v?"":`
      <div class="c"><div class="logo">${s(h.name)}</div>
        ${h.phone?`<small>${s(h.phone)}</small>`:""}</div>
      <div class="hr"></div>
      <div class="row"><span>${s(e("kassa.receiptNo"))} ${s(a)}</span><span>${s(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${de}
      <div class="hr"></div>
      ${F>0?`<div class="row"><span>${s(e("kassa.receiptSubtotal"))}</span><span>${s(p(r??o+F))}</span></div>
      <div class="row"><span>${s(e("kassa.discount"))}</span><span>-${s(p(F))}</span></div>`:""}
      ${Number(B)>0?`<div class="row"><span>${s(e("svc.line",{pct:I}))}</span><span>+${s(p(B))}</span></div>`:""}
      ${Number(U)>0?`<div class="row"><span>${s(e("kassa.rounding"))}</span><span>-${s(W(U))}</span></div>`:""}
      <div class="row"><b>${s(e("kassa.receiptTotal"))}</b><b>${s(p(o))}</b></div>
      ${Number(O)>0?`<div class="row"><span>${s(e("tip.receipt"))}</span><span>${s(p(O))}</span></div>`:""}
      ${Number(P)>0&&!v?`<div class="row"><span>${s(e("savings.toSavings"))}</span><span>+${s(p(P))}</span></div>`:""}
      ${n!=null&&n.fullName?`<div class="row"><span>${s(e("kassa.receiptCustomer"))}</span><span>${s(n.fullName)}</span></div>`:""}
      ${f&&Number(f.amount)>0?`<div class="hr"></div>
      <div class="c"><b>${s(e("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${s(e("kassa.receiptCreditThis"))}</span><b>${s(p(f.amount))}</b></div>
      ${f.balance!=null?`<div class="row"><span>${s(e("kassa.receiptCreditTotal"))}</span><span>${s(p(f.balance))}</span></div>`:""}
      ${f.dueDate?`<div class="row"><span>${s(e("kassa.receiptCreditDue"))}</span><span>${s(f.dueDate)}</span></div>`:""}
      <div class="row" style="margin-top:10px"><span>${s(e("kassa.receiptCreditSign"))}</span><span>______________</span></div>`:""}
      ${l?`<div class="off">${s(e("kassa.receiptOffline"))}<br>${s(e("kassa.receiptOfflineSub"))}</div>`:""}
      ${i?`<div class="c" style="margin-top:6px">
        ${G(L(i),{height:12})}
        <div class="no">${s(L(i))}</div>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${s(e("kassa.receiptThanks"))}</p>${h.footer?`<small>${s(h.footer)}</small>`:""}</div>`}
    </body></html>`),w.document.close(),w.onafterprint=()=>w.close(),setTimeout(()=>w.print(),60)}export{We as DEFAULTS,_e as buildDebtReceipt,Ne as buildExpiryLabels,Te as buildPickupSlip,xe as buildPriceLabels,ke as buildReceipt,b as getSettings,qe as listPrinters,Re as openDrawer,Ie as printBadge,Me as printDebtReceipt,Ze as printExpiryLabels,Be as printKitchen,Fe as printPickupSlip,Ue as printPriceLabels,je as printRawLabel,Le as printReceipt,Oe as printShiftReport,Ae as printerHealth,Qe as saveSettings,He as testPrint};
