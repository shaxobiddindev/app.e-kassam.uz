import{at as k,t,E as N,aF as F,m as p,Z as C,v as j,w as Z,aG as K,aH as E,aI as Q,aJ as W,K as Y}from"./index-E9ScyaDM.js";const q=27,g=29,D=48,z=32,$={init:[q,64],alignLeft:[q,97,0],alignCenter:[q,97,1],alignRight:[q,97,2],boldOn:[q,69,1],boldOff:[q,69,0],doubleOn:[g,33,17],doubleOff:[g,33,0],cut:[g,86,66,3],kick:[q,112,0,25,25]};function oe(e){const n=String(e??"").replace(/[‘’ʻʼ′]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g," ").replace(/[\t\r\n\v\f]/g," "),s=[];for(const a of n){const i=a.codePointAt(0);s.push(i<128?i:63)}return s}class T{constructor(n=D){this.width=n,this.bytes=[...$.init]}raw(n){return this.bytes.push(...n),this}left(){return this.raw($.alignLeft)}center(){return this.raw($.alignCenter)}right(){return this.raw($.alignRight)}bold(n=!0){return this.raw(n?$.boldOn:$.boldOff)}double(n=!0){return this.raw(n?$.doubleOn:$.doubleOff)}line(n=""){return this.raw(oe(n)).raw([10])}feed(n=1){for(let s=0;s<n;s++)this.raw([10]);return this}rule(n="-"){return this.line(n.repeat(this.width))}row(n,s){const a=String(n??""),i=String(s??""),c=this.width-i.length;if(c<1)return this.line(i);const r=a.length>c-1?a.slice(0,c-1):a;return this.line(r+" ".repeat(this.width-r.length-i.length)+i)}wrap(n){const s=String(n??"").split(/\s+/).filter(Boolean);let a="";for(const i of s){if(!a.length){a=i;continue}a.length+1+i.length<=this.width?a+=" "+i:(this.line(a),a=i)}return a.length&&this.line(a),this}qr(n,s=8){const a=[];for(const c of String(n??"")){const r=c.codePointAt(0);r<128&&a.push(r)}this.raw([g,40,107,4,0,49,65,50,0]),this.raw([g,40,107,3,0,49,67,Math.max(1,Math.min(16,s))]),this.raw([g,40,107,3,0,49,69,49]);const i=a.length+3;return this.raw([g,40,107,i&255,i>>8&255,49,80,48]),this.raw(a),this.raw([g,40,107,3,0,49,81,48]),this}barcode128(n,{height:s=60,width:a=2,hri:i=!1}={}){const c=String(n??""),r=[];for(const h of c){const d=h.charCodeAt(0);if(d<32||d>127)return this;r.push(d)}if(!r.length)return this;this.raw([g,104,Math.max(1,Math.min(255,s))]),this.raw([g,119,Math.max(2,Math.min(6,a))]),this.raw([g,72,i?2:0]);const o=[123,66,...r];return this.raw([g,107,73,o.length]),this.raw(o),this}barcodeEan13(n){const s=String(n??"").replace(/\D/g,"");if(s.length!==13)return!1;let a=0;for(let r=0;r<12;r++)a+=Number(s[r])*(r%2===0?1:3);if((10-a%10)%10!==Number(s[12]))return!1;this.raw([g,104,60]),this.raw([g,119,2]),this.raw([g,72,2]);const c=[...s].map(r=>r.charCodeAt(0));return this.raw([g,107,67,c.length]),this.raw(c),!0}cut(){return this.feed(4).raw($.cut)}kick(){return this.bytes.splice($.init.length,0,...$.kick),this}build(){return this.bytes}}const le=()=>[...$.init,...$.kick],ce=e=>Math.max(0,(Number(e.salePrice)||0)*(Number(e.qty)||0)-(Number(e.discount)||0));function J(e,n){const s=Number(n)||0,a=e.map(()=>0);if(s<=0||!e.length)return a;const i=e.map(ce),c=i.reduce((d,w)=>d+w,0);if(c<=0)return a;let r=0,o=0;for(let d=0;d<e.length;d++){const w=Math.floor(s*i[d]/c*100)/100;a[d]=w,r+=w,i[d]>i[o]&&(o=d)}const h=Math.round((s-r)*100)/100;return h!==0&&(a[o]=Math.round((a[o]+h)*100)/100),a}const I=[1e4,5e3,1e3,500];function X(e){const n=Number(e.salePrice)||0,s=Number(e.qty)||0,a=e.minPrice==null?null:Number(e.minPrice);if(a==null||!Number.isFinite(a))return 0;const i=(n-a)*s-(Number(e.discount)||0);return i>0?Math.floor(i):0}const G=e=>(e||[]).reduce((n,s)=>n+X(s),0);function xe(e,n,s=3){const a=Math.round(Number(n)||0),i=G(e);if(a<=0||i<=0)return[];if(a%I[I.length-1]===0)return[];const c=[],r=new Set;for(const o of[...I].reverse()){const h=Math.floor(a/o)*o,d=a-h;if(!(d<=0||d>i)&&!r.has(h)&&(r.add(h),c.push({target:h,discount:d}),c.length>=s))break}return c}function $e(e,n,s,a=3){const i=Math.round(Number(n)||0),c=Math.min(Math.round(Number(s)||0),G(e));if(i<=0||c<=0)return[];const r=i-c,o=[],h=new Set;for(const d of I){const w=Math.ceil(r/d)*d;if(w<=0||w>i)continue;const f=i-w;if(!(f<=0||f>c)&&!h.has(w)&&(h.add(w),o.push({target:w,discount:f,step:d}),o.length>=a))break}return o}function de(e){const n=Number(e.salePrice)||0,s=Number(e.qty)||0,a=e.costPrice==null?null:Number(e.costPrice);if(a==null||!Number.isFinite(a))return X(e);const i=(n-a)*s-(Number(e.discount)||0);return i>0?Math.floor(i):0}const pe=e=>(e||[]).reduce((n,s)=>n+de(s),0);function ke(e,n){const s=Math.round(Number(n)||0);return s<=0?"ok":s>pe(e)?"loss":s>G(e)?"over":"ok"}async function ye(){if(!N())return[];try{return await F("list_printers")||[]}catch{return[]}}function ee(e){return N()?e.transport==="tcp"?"tcp":"windows":"browser"}async function P(e){const n=k();if(!N())throw new Error(t("hw.errNoDesktop"));if(ee(n)==="tcp"){if(!n.host)throw new Error(t("hw.errNoHost"));return F("print_tcp",{host:n.host,port:Number(n.port)||9100,data:e})}return F("print_raw",{printer:n.printerName||null,data:e})}function ue({saleId:e,serverSaleId:n,cart:s=[],total:a=0,subtotal:i,discount:c=0,payType:r,payments:o,customer:h,offline:d,shopName:w,cashier:f,fiscal:b,receiptUrl:S,credit:y}){const H=k(),u=new T(H.width===58?z:D),M=Q(w);u.center().double().line(M.name).double(!1),M.phone&&u.line(M.phone),u.line(t("kassa.receiptSystem")),u.left().rule(),u.row(`${t("kassa.receiptNo")} ${e??"-"}`,new Date().toLocaleString("uz-UZ")),f&&u.row(t("kassa.receiptCashier"),f),u.rule();const R=J(s,c);s.forEach((m,_)=>{u.wrap(m.name);const x=`${j(m.qty,m.unitDecimals)}${m.unit?" "+Z(m.unit):""}`;u.row(`  ${x} x ${p(m.salePrice)}`,p(m.salePrice*m.qty));const l=(Number(m.discount)||0)+(R[_]||0);l>0&&u.row(`    ${t("kassa.discount")}`,"-"+p(l))}),u.rule();const U=s.reduce((m,_)=>m+(Number(_.discount)||0),0),A=c+U;if(A>0&&(u.row(t("kassa.receiptSubtotal"),p(i??a+A)),u.row(t("kassa.discount"),"-"+p(A))),u.bold().double().row(t("kassa.receiptTotal"),p(a)).double(!1).bold(!1),u.row(t("kassa.receiptPayment"),C(r)),Array.isArray(o)&&o.length>1)for(const m of o)u.row("  "+C(m.type),p(m.amount));h!=null&&h.fullName&&u.row(t("kassa.receiptCustomer"),h.fullName),y&&Number(y.amount)>0&&(u.rule(),u.center().bold().line(t("kassa.receiptCredit")).bold(!1).left(),u.row(t("kassa.receiptCreditThis"),p(y.amount)),y.balance!=null&&u.row(t("kassa.receiptCreditTotal"),p(y.balance)),y.dueDate&&u.row(t("kassa.receiptCreditDue"),y.dueDate),u.feed().row(t("kassa.receiptCreditSign"),"______________")),d&&u.feed().center().line(t("kassa.receiptOffline")).line(t("kassa.receiptOfflineSub")).left();const L=s.reduce((m,_)=>{const x=Number(_.vatRate);if(!x)return m;const l=Number(_.salePrice)*Number(_.qty);return m+(_.priceIncludesVat===!1?l*x/100:l*x/(100+x))},0);if(L>0&&u.row(t("kassa.receiptVat"),p(L)),b!=null&&b.fiscalSign&&(u.rule(),u.center().line(t("kassa.receiptFiscal")).left(),u.row(t("kassa.receiptFiscalSign"),b.fiscalSign),b.terminalId&&u.row(t("kassa.receiptTerminal"),b.terminalId),b.receiptNo&&u.row(t("kassa.receiptFiscalNo"),b.receiptNo),b.qrUrl&&u.feed().center().qr(b.qrUrl).left()),n){const m=E(n);u.feed().center().barcode128(m).line(m).left()}return S&&u.feed().center().qr(S,6).line(t("kassa.receiptQrHint")).left(),u.rule(),u.center().line(t("kassa.receiptThanks")).line("e-kassam.uz"),u}async function _e(e){const n=k();if(!N())return te(e);const s=ue(e);n.openDrawer&&e.payType==="CASH"&&s.kick(),s.cut(),await P(s.build())}function he({customer:e,amount:n,balanceAfter:s,balanceBefore:a,method:i,shopName:c,cashier:r,date:o,receiptNo:h,qrUrl:d}){const w=k(),f=new T(w.width===58?z:D),b=Q(c);return f.center().double().line(b.name).double(!1),b.phone&&f.line(b.phone),f.line(t("kassa.receiptDebtPay")),f.left().rule(),h&&f.row(t("kassa.receiptNo"),h),f.row(t("common.date"),(o||new Date).toLocaleString("uz-UZ")),r&&f.row(t("kassa.receiptCashier"),r),e!=null&&e.fullName&&f.row(t("kassa.receiptCustomer"),e.fullName),f.rule(),f.bold().double().row(t("kassa.receiptPaid"),p(n)).double(!1).bold(!1),f.row(t("kassa.receiptPayment"),C(i)),a!=null&&f.row(t("credit.wasDebt"),p(a)),f.row(t("kassa.receiptDebtLeft"),p(s??0)),d&&(f.rule(),f.center().line(t("kassa.receiptQrHint")),f.qr(d,6)),f.rule(),f.center().line(t("kassa.receiptThanks")).line("e-kassam.uz"),f}async function Ne(e){const n=k();if(!N())return te({...e,__debt:!0});const s=he(e);n.openDrawer&&e.method==="CASH"&&s.kick(),s.cut(),await P(s.build())}async function Se({fullName:e,username:n,version:s,token:a,shopName:i}){if(!N())throw new Error(t("hw.errNoDesktop"));const c=k(),r=new T(c.width===58?z:D);r.center().double().line(t("badge.printTitle")).double(!1),r.line(i||"E-KASSAM.UZ"),r.left().rule(),r.center().bold().line(e||n||"-").bold(!1),r.line("@"+(n||"-")),r.line(`${t("badge.version")} ${s??1}`),r.feed(),r.qr(a,8),r.feed(),r.line(new Date().toLocaleString("uz-UZ")),r.left().rule(),r.wrap(t("badge.printWarn")),r.cut(),await P(r.build())}async function Ce(e,n){var c;if(!N())throw new Error(t("hw.errNoDesktop"));const s=k(),a=new T(s.width===58?z:D),i=r=>r?new Date(r).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"}):"-";a.center().double().line(e.closedAt?"Z-HISOBOT":"X-HISOBOT").double(!1),a.line(n||"E-KASSAM.UZ"),a.left().rule(),a.row(t("sales.colCashier"),e.cashierName||"-"),a.row(t("sec.openedAt"),i(e.openedAt)),e.closedAt&&a.row(t("shift.closedAt"),i(e.closedAt)),a.rule(),a.row(t("rpt.salesCount"),String(e.salesCount)),a.bold().row(t("rpt.salesTotal"),p(e.salesTotal)).bold(!1);for(const[r,o]of Object.entries(e.byPaymentType||{}))a.row("  "+C(r),p(o));if(a.rule(),a.row(t("rpt.cancelled"),`${e.cancelledCount} / ${p(e.cancelledTotal)}`),a.row(t("rpt.confirmations"),String(e.confirmationsCount)),e.suspiciousCount>0&&a.bold().row(t("rpt.suspicious"),String(e.suspiciousCount)).bold(!1),e.cash&&(a.rule(),a.row(t("cash.openingFloat"),p(e.cash.openingFloat)),e.cash.expectedCash!=null&&a.row(t("cash.expected"),p(e.cash.expectedCash)),e.cash.countedCash!=null&&(a.bold().row(t("cash.counted"),p(e.cash.countedCash)).bold(!1),a.bold().row(t("cash.difference"),p(e.cash.difference)).bold(!1))),(c=e.nonCash)!=null&&c.length){a.rule(),a.line(t("noncash.title"));for(const r of e.nonCash)r.counted==null?a.row("  "+C(r.paymentType),r.expected==null?"-":p(r.expected)):(a.row("  "+C(r.paymentType),`${p(r.expected)} / ${p(r.counted)}`),Number(r.difference)!==0&&a.bold().row("  "+t("cash.difference"),p(r.difference)).bold(!1))}a.rule(),a.center().line(new Date().toLocaleString("uz-UZ")).line("e-kassam.uz"),a.cut(),await P(a.build())}async function De(){if(!N())throw new Error(t("hw.errNoDesktop"));await P(le())}async function Pe(e=[],n={}){if(!N())throw new Error(t("hw.errNoDesktop"));await P(fe(e,n))}function fe(e=[],{copies:n=1,shopName:s,width:a}={}){const i=(e||[]).filter(Boolean);if(!i.length)throw new Error(t("label.nothing"));const c=k(),r=a??(c.width===58?z:D),o=new T(r),h=Math.max(1,Math.min(20,Number(n)||1));for(const d of i)for(let w=0;w<h;w++)o.center(),s&&o.line(s),o.bold().wrap(d.name||"-").bold(!1),o.feed(),o.double().line(p(d.salePrice)).double(!1),d.oldPrice!=null&&Number(d.oldPrice)>Number(d.salePrice)&&o.line(`${t("label.oldPrice")}: ${p(d.oldPrice)}`),o.feed(),d.barcode&&(o.barcodeEan13(d.barcode)||o.barcode128(d.barcode,{hri:!0}),o.feed()),o.line(new Date().toLocaleDateString("uz-UZ")),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}async function ze(e=[],n={}){const s=(e||[]).filter(Boolean);if(!s.length)throw new Error(t("label.nothing"));if(!N())return we(s,n);await P(me(s,n))}function me(e=[],{copies:n=1,shopName:s,width:a}={}){const i=(e||[]).filter(Boolean);if(!i.length)throw new Error(t("label.nothing"));const c=k(),r=a??(c.width===58?z:D),o=new T(r),h=Math.max(1,Math.min(20,Number(n)||1));for(const d of i)for(let w=0;w<h;w++)o.center(),s&&o.line(s),o.bold().line(t("label.expiryTitle")).bold(!1),o.bold().wrap(d.name||"-").bold(!1),o.feed(),o.double().line(Y(d.expiryDate)).double(!1),d.daysLeft!=null&&o.line(d.daysLeft<=0?t("label.expiryToday"):t("inv.nearDays",{n:d.daysLeft})),d.salePrice!=null&&o.line(p(d.salePrice)),o.feed(),d.barcode&&(o.barcodeEan13(d.barcode)||o.barcode128(d.barcode,{hri:!0}),o.feed()),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}function we(e,{shopName:n}={}){const s=window.open("","_blank","width=820,height=900");if(!s)throw new Error(t("hw.errPopup"));const a=c=>String(c??"").replace(/[&<>"]/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[r]),i=e.map(c=>{const r=c.daysLeft,o=r==null?"":r<=0?t("label.expiryToday"):t("inv.nearDays",{n:r});return`<div class="lbl">
      <div class="hdr">${a(t("label.expiryTitle"))}</div>
      <div class="nm">${a(c.name||"-")}</div>
      <div class="dt">${a(Y(c.expiryDate))}</div>
      ${o?`<div class="lf">${a(o)}</div>`:""}
      ${c.salePrice!=null?`<div class="pr">${a(p(c.salePrice))}</div>`:""}
      ${c.barcode?`<div class="bc">${K(String(c.barcode),{height:22})}</div>`:""}
      ${n?`<div class="sh">${a(n)}</div>`:""}
    </div>`}).join("");return s.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${a(t("label.expiryTitle"))}</title>
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
    </style></head><body>${i}</body></html>`),s.document.close(),s.onload=()=>{s.focus(),s.print()},Promise.resolve()}async function Te(e,n={}){if(!e)throw new Error(t("label.nothing"));if(!N())return ge(e,n);await P(be(e,n))}function be(e,{shopName:n,width:s}={}){const a=k(),i=new T(s??(a.width===58?z:D));i.center().double().line(t("pickup.slipTitle")).double(!1),n&&i.line(n),i.left().rule(),i.row(`${t("kassa.receiptNo")} ${e.saleCode||"-"}`,e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):""),e.cashierName&&i.row(t("kassa.receiptCashier"),e.cashierName),e.customerName&&i.row(t("kassa.receiptCustomer"),e.customerName),e.customerPhone&&i.row(t("common.phone"),e.customerPhone),i.rule();for(const c of e.items||[])i.wrap(c.productName),i.double().line(`  ${j(c.quantity)} ${Z(c.unit)}`).double(!1);if(i.rule(),e.saleId){const c=E(e.saleId);i.feed().center().barcode128(c).line(c).left()}return i.feed(),i.row(t("pickup.signStore"),"______________"),i.feed().row(t("pickup.signCustomer"),"______________"),i.cut(),i.build()}function ge(e,{shopName:n}={}){const s=window.open("","_blank","width=360,height=640");if(!s)throw new Error(t("hw.errPopup"));const a=k().width===58?58:80,i=r=>String(r??"").replace(/[&<>"]/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[o]),c=(e.items||[]).map(r=>`<div class="it"><div class="nm">${i(r.productName)}</div>
     <div class="qt">${i(j(r.quantity))} ${i(Z(r.unit))}</div></div>`).join("");return s.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${i(t("pickup.slipTitle"))} ${i(e.saleCode||"")}</title>
    <style>
      @page { size: ${a}mm auto; margin: 0; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
             font-variant-numeric: tabular-nums; font-size:12px; line-height:1.35;
             color:#000; width:${a}mm; padding:3mm; }
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
      <div class="c"><div class="ttl">${i(t("pickup.slipTitle"))}</div>
        ${n?`<small>${i(n)}</small>`:""}</div>
      <div class="hr"></div>
      <div class="row"><b>${i(t("kassa.receiptNo"))} ${i(e.saleCode||"-")}</b>
        <span>${i(e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):"")}</span></div>
      ${e.cashierName?`<div class="row"><span>${i(t("kassa.receiptCashier"))}</span><span>${i(e.cashierName)}</span></div>`:""}
      ${e.customerName?`<div class="row"><span>${i(t("kassa.receiptCustomer"))}</span><span>${i(e.customerName)}</span></div>`:""}
      ${e.customerPhone?`<div class="row"><span>${i(t("common.phone"))}</span><span>${i(e.customerPhone)}</span></div>`:""}
      <div class="hr"></div>
      ${c}
      <div class="hr"></div>
      ${e.saleId?`<div class="c">${K(E(e.saleId),{height:14})}
        <div><b>${i(E(e.saleId))}</b></div></div>`:""}
      <div class="row" style="margin-top:14px"><span>${i(t("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${i(t("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`),s.document.close(),s.onload=()=>{s.focus(),s.print()},Promise.resolve()}async function qe(){const e=k(),n=new T(e.width===58?z:D);n.center().double().line(t("hw.testTitle")).double(!1),n.line(new Date().toLocaleString("uz-UZ")),n.left().rule();const s=ee(e);n.row(t("hw.transport"),s),n.row(t("hw.printer"),s==="tcp"?`${e.host}:${e.port}`:e.printerName||t("hw.defaultPrinter")),n.row(t("hw.width"),`${e.width} mm`),n.rule(),n.line("1234567890".repeat(6).slice(0,n.width)),n.center().line(t("hw.testOk")),n.cut(),await P(n.build())}function te({saleId:e,serverSaleId:n,cart:s=[],total:a=0,subtotal:i,discount:c=0,payType:r,payments:o,customer:h,offline:d,shopName:w,cashier:f,receiptUrl:b,credit:S,__debt:y,amount:H,balanceAfter:u,balanceBefore:M,method:R,date:U,receiptNo:A,qrUrl:L}){const m=window.open("","_blank","width=360,height=640,toolbar=no,menubar=no");if(!m)throw new Error(t("hw.errPopup"));const _=k().width===58?58:80,x=Q(w),l=v=>String(v??"").replace(/[&<>"]/g,O=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[O]),ae=J(s,c),ne=s.reduce((v,O)=>v+(Number(O.discount)||0),0),B=c+ne,ie=s.map((v,O)=>{const re=`${j(v.qty,v.unitDecimals)}${v.unit?" "+Z(v.unit):""}`,V=(Number(v.discount)||0)+(ae[O]||0);return`<div class="row"><span>${l(v.name)} × ${l(re)}</span><span>${l(p(v.salePrice*v.qty))}</span></div>`+(V>0?`<div class="row sub"><span>${l(t("kassa.discount"))}</span><span>-${l(p(V))}</span></div>`:"")}).join(""),se=y?`
      <div class="c"><div class="logo">${l(x.name)}</div>
        ${x.phone?`<small>${l(x.phone)}</small><br>`:""}
        <small>${l(t("kassa.receiptDebtPay"))}</small></div>
      <div class="hr"></div>
      ${A?`<div class="row"><span>${l(t("kassa.receiptNo"))}</span><span>${l(A)}</span></div>`:""}
      <div class="row"><span>${l(t("common.date"))}</span><span>${l((U||new Date).toLocaleString("uz-UZ"))}</span></div>
      ${f?`<div class="row"><span>${l(t("kassa.receiptCashier"))}</span><span>${l(f)}</span></div>`:""}
      ${h!=null&&h.fullName?`<div class="row"><span>${l(t("kassa.receiptCustomer"))}</span><span>${l(h.fullName)}</span></div>`:""}
      <div class="hr"></div>
      <div class="row"><b>${l(t("kassa.receiptPaid"))}</b><b>${l(p(H))}</b></div>
      <div class="row"><span>${l(t("kassa.receiptPayment"))}</span><span>${l(C(R))}</span></div>
      ${M!=null?`<div class="row"><span>${l(t("credit.wasDebt"))}</span><span>${l(p(M))}</span></div>`:""}
      <div class="row"><span>${l(t("kassa.receiptDebtLeft"))}</span><span>${l(p(u??0))}</span></div>
      ${L?`<div class="hr"></div><div class="c">
        ${W(L,{size:96,margin:1})}
        <small>${l(t("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`:"";m.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${l(y?t("kassa.receiptDebtPay"):t("kassa.receiptNo")+" "+e)}</title>
    <style>
      /* CHEK QOG'OZI - A4 EMAS.
         @page bo'lmasa brauzer chekni A4 sahifaga joylashtiradi, chetiga
         o'z sarlavha-izohini (manzil, sana, bet raqami) qo'shadi va matn
         chek printeriga umuman sig'maydi - aynan shu "noto'g'ri format"
         edi. margin:0 esa brauzerning o'sha sarlavhalarini olib tashlaydi.
         Balandlik auto: chek uzunligi tovar soniga qarab o'zgaradi. */
      @page { size: ${_}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${_}mm; padding: 3mm; }
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
      ${se}
      ${y?"":`
      <div class="c"><div class="logo">${l(x.name)}</div>
        ${x.phone?`<small>${l(x.phone)}</small><br>`:""}
        <small>${l(t("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${l(t("kassa.receiptNo"))} ${l(e)}</span><span>${l(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${ie}
      <div class="hr"></div>
      ${B>0?`<div class="row"><span>${l(t("kassa.receiptSubtotal"))}</span><span>${l(p(i??a+B))}</span></div>
      <div class="row"><span>${l(t("kassa.discount"))}</span><span>-${l(p(B))}</span></div>`:""}
      <div class="row"><b>${l(t("kassa.receiptTotal"))}</b><b>${l(p(a))}</b></div>
      <div class="row"><span>${l(t("kassa.receiptPayment"))}</span><span>${l(C(r))}</span></div>
      ${Array.isArray(o)&&o.length>1?o.map(v=>`<div class="row"><span>&nbsp;&nbsp;${l(C(v.type))}</span><span>${l(p(v.amount))}</span></div>`).join(""):""}
      ${h!=null&&h.fullName?`<div class="row"><span>${l(t("kassa.receiptCustomer"))}</span><span>${l(h.fullName)}</span></div>`:""}
      ${S&&Number(S.amount)>0?`<div class="hr"></div>
      <div class="c"><b>${l(t("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${l(t("kassa.receiptCreditThis"))}</span><b>${l(p(S.amount))}</b></div>
      ${S.balance!=null?`<div class="row"><span>${l(t("kassa.receiptCreditTotal"))}</span><span>${l(p(S.balance))}</span></div>`:""}
      ${S.dueDate?`<div class="row"><span>${l(t("kassa.receiptCreditDue"))}</span><span>${l(S.dueDate)}</span></div>`:""}
      <div class="row" style="margin-top:10px"><span>${l(t("kassa.receiptCreditSign"))}</span><span>______________</span></div>`:""}
      ${d?`<div class="off">${l(t("kassa.receiptOffline"))}<br>${l(t("kassa.receiptOfflineSub"))}</div>`:""}
      ${n?`<div class="c" style="margin-top:6px">
        ${K(E(n),{height:12})}
        <div class="no">${l(E(n))}</div>
      </div>`:""}
      ${b?`<div class="c" style="margin-top:8px">
        ${W(b,{size:96,margin:1})}
        <small>${l(t("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`}
    </body></html>`),m.document.close(),m.onafterprint=()=>m.close(),setTimeout(()=>m.print(),60)}export{ze as a,Te as b,Ne as c,Ce as d,$e as e,G as f,pe as g,ke as h,_e as i,Se as j,ye as l,De as o,Pe as p,xe as r,J as s,qe as t};
