import{at as k,t,E as _,aF as H,m as p,Z as C,v as I,w as U,aG as K,aH as A,aI as G,K as V}from"./index-CWOQueoz.js";const q=27,b=29,D=48,z=32,$={init:[q,64],alignLeft:[q,97,0],alignCenter:[q,97,1],alignRight:[q,97,2],boldOn:[q,69,1],boldOff:[q,69,0],doubleOn:[b,33,17],doubleOff:[b,33,0],cut:[b,86,66,3],kick:[q,112,0,25,25]};function se(e){const i=String(e??"").replace(/[‘’ʻʼ′]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g," ").replace(/[\t\r\n\v\f]/g," "),s=[];for(const a of i){const n=a.codePointAt(0);s.push(n<128?n:63)}return s}class T{constructor(i=D){this.width=i,this.bytes=[...$.init]}raw(i){return this.bytes.push(...i),this}left(){return this.raw($.alignLeft)}center(){return this.raw($.alignCenter)}right(){return this.raw($.alignRight)}bold(i=!0){return this.raw(i?$.boldOn:$.boldOff)}double(i=!0){return this.raw(i?$.doubleOn:$.doubleOff)}line(i=""){return this.raw(se(i)).raw([10])}feed(i=1){for(let s=0;s<i;s++)this.raw([10]);return this}rule(i="-"){return this.line(i.repeat(this.width))}row(i,s){const a=String(i??""),n=String(s??""),c=this.width-n.length;if(c<1)return this.line(n);const r=a.length>c-1?a.slice(0,c-1):a;return this.line(r+" ".repeat(this.width-r.length-n.length)+n)}wrap(i){const s=String(i??"").split(/\s+/).filter(Boolean);let a="";for(const n of s){if(!a.length){a=n;continue}a.length+1+n.length<=this.width?a+=" "+n:(this.line(a),a=n)}return a.length&&this.line(a),this}qr(i,s=8){const a=[];for(const c of String(i??"")){const r=c.codePointAt(0);r<128&&a.push(r)}this.raw([b,40,107,4,0,49,65,50,0]),this.raw([b,40,107,3,0,49,67,Math.max(1,Math.min(16,s))]),this.raw([b,40,107,3,0,49,69,49]);const n=a.length+3;return this.raw([b,40,107,n&255,n>>8&255,49,80,48]),this.raw(a),this.raw([b,40,107,3,0,49,81,48]),this}barcode128(i,{height:s=60,width:a=2,hri:n=!1}={}){const c=String(i??""),r=[];for(const f of c){const d=f.charCodeAt(0);if(d<32||d>127)return this;r.push(d)}if(!r.length)return this;this.raw([b,104,Math.max(1,Math.min(255,s))]),this.raw([b,119,Math.max(2,Math.min(6,a))]),this.raw([b,72,n?2:0]);const o=[123,66,...r];return this.raw([b,107,73,o.length]),this.raw(o),this}barcodeEan13(i){const s=String(i??"").replace(/\D/g,"");if(s.length!==13)return!1;let a=0;for(let r=0;r<12;r++)a+=Number(s[r])*(r%2===0?1:3);if((10-a%10)%10!==Number(s[12]))return!1;this.raw([b,104,60]),this.raw([b,119,2]),this.raw([b,72,2]);const c=[...s].map(r=>r.charCodeAt(0));return this.raw([b,107,67,c.length]),this.raw(c),!0}cut(){return this.feed(4).raw($.cut)}kick(){return this.bytes.splice($.init.length,0,...$.kick),this}build(){return this.bytes}}const re=()=>[...$.init,...$.kick],oe=e=>Math.max(0,(Number(e.salePrice)||0)*(Number(e.qty)||0)-(Number(e.discount)||0));function W(e,i){const s=Number(i)||0,a=e.map(()=>0);if(s<=0||!e.length)return a;const n=e.map(oe),c=n.reduce((d,w)=>d+w,0);if(c<=0)return a;let r=0,o=0;for(let d=0;d<e.length;d++){const w=Math.floor(s*n[d]/c*100)/100;a[d]=w,r+=w,n[d]>n[o]&&(o=d)}const f=Math.round((s-r)*100)/100;return f!==0&&(a[o]=Math.round((a[o]+f)*100)/100),a}const Z=[1e4,5e3,1e3,500];function Y(e){const i=Number(e.salePrice)||0,s=Number(e.qty)||0,a=e.minPrice==null?null:Number(e.minPrice);if(a==null||!Number.isFinite(a))return 0;const n=(i-a)*s-(Number(e.discount)||0);return n>0?Math.floor(n):0}const F=e=>(e||[]).reduce((i,s)=>i+Y(s),0);function ge(e,i,s=3){const a=Math.round(Number(i)||0),n=F(e);if(a<=0||n<=0)return[];if(a%Z[Z.length-1]===0)return[];const c=[],r=new Set;for(const o of[...Z].reverse()){const f=Math.floor(a/o)*o,d=a-f;if(!(d<=0||d>n)&&!r.has(f)&&(r.add(f),c.push({target:f,discount:d}),c.length>=s))break}return c}function ve(e,i,s,a=3){const n=Math.round(Number(i)||0),c=Math.min(Math.round(Number(s)||0),F(e));if(n<=0||c<=0)return[];const r=n-c,o=[],f=new Set;for(const d of Z){const w=Math.ceil(r/d)*d;if(w<=0||w>n)continue;const h=n-w;if(!(h<=0||h>c)&&!f.has(w)&&(f.add(w),o.push({target:w,discount:h,step:d}),o.length>=a))break}return o}function le(e){const i=Number(e.salePrice)||0,s=Number(e.qty)||0,a=e.costPrice==null?null:Number(e.costPrice);if(a==null||!Number.isFinite(a))return Y(e);const n=(i-a)*s-(Number(e.discount)||0);return n>0?Math.floor(n):0}const ce=e=>(e||[]).reduce((i,s)=>i+le(s),0);function xe(e,i){const s=Math.round(Number(i)||0);return s<=0?"ok":s>ce(e)?"loss":s>F(e)?"over":"ok"}async function $e(){if(!_())return[];try{return await H("list_printers")||[]}catch{return[]}}function J(e){return _()?e.transport==="tcp"?"tcp":"windows":"browser"}async function P(e){const i=k();if(!_())throw new Error(t("hw.errNoDesktop"));if(J(i)==="tcp"){if(!i.host)throw new Error(t("hw.errNoHost"));return H("print_tcp",{host:i.host,port:Number(i.port)||9100,data:e})}return H("print_raw",{printer:i.printerName||null,data:e})}function de({saleId:e,serverSaleId:i,cart:s=[],total:a=0,subtotal:n,discount:c=0,payType:r,payments:o,customer:f,offline:d,shopName:w,cashier:h,fiscal:x,receiptUrl:S,credit:y}){const j=k(),u=new T(j.width===58?z:D);u.center().double().line(w||"E-KASSAM.UZ").double(!1),u.line(t("kassa.receiptSystem")),u.left().rule(),u.row(`${t("kassa.receiptNo")} ${e??"-"}`,new Date().toLocaleString("uz-UZ")),h&&u.row(t("kassa.receiptCashier"),h),u.rule();const O=W(s,c);s.forEach((m,g)=>{u.wrap(m.name);const N=`${I(m.qty,m.unitDecimals)}${m.unit?" "+U(m.unit):""}`;u.row(`  ${N} x ${p(m.salePrice)}`,p(m.salePrice*m.qty));const l=(Number(m.discount)||0)+(O[g]||0);l>0&&u.row(`    ${t("kassa.discount")}`,"-"+p(l))}),u.rule();const R=s.reduce((m,g)=>m+(Number(g.discount)||0),0),M=c+R;if(M>0&&(u.row(t("kassa.receiptSubtotal"),p(n??a+M)),u.row(t("kassa.discount"),"-"+p(M))),u.bold().double().row(t("kassa.receiptTotal"),p(a)).double(!1).bold(!1),u.row(t("kassa.receiptPayment"),C(r)),Array.isArray(o)&&o.length>1)for(const m of o)u.row("  "+C(m.type),p(m.amount));f!=null&&f.fullName&&u.row(t("kassa.receiptCustomer"),f.fullName),y&&Number(y.amount)>0&&(u.rule(),u.center().bold().line(t("kassa.receiptCredit")).bold(!1).left(),u.row(t("kassa.receiptCreditThis"),p(y.amount)),y.balance!=null&&u.row(t("kassa.receiptCreditTotal"),p(y.balance)),y.dueDate&&u.row(t("kassa.receiptCreditDue"),y.dueDate),u.feed().row(t("kassa.receiptCreditSign"),"______________")),d&&u.feed().center().line(t("kassa.receiptOffline")).line(t("kassa.receiptOfflineSub")).left();const E=s.reduce((m,g)=>{const N=Number(g.vatRate);if(!N)return m;const l=Number(g.salePrice)*Number(g.qty);return m+(g.priceIncludesVat===!1?l*N/100:l*N/(100+N))},0);if(E>0&&u.row(t("kassa.receiptVat"),p(E)),x!=null&&x.fiscalSign&&(u.rule(),u.center().line(t("kassa.receiptFiscal")).left(),u.row(t("kassa.receiptFiscalSign"),x.fiscalSign),x.terminalId&&u.row(t("kassa.receiptTerminal"),x.terminalId),x.receiptNo&&u.row(t("kassa.receiptFiscalNo"),x.receiptNo),x.qrUrl&&u.feed().center().qr(x.qrUrl).left()),i){const m=A(i);u.feed().center().barcode128(m).line(m).left()}return S&&u.feed().center().qr(S,6).line(t("kassa.receiptQrHint")).left(),u.rule(),u.center().line(t("kassa.receiptThanks")).line("e-kassam.uz"),u}async function ke(e){const i=k();if(!_())return X(e);const s=de(e);i.openDrawer&&e.payType==="CASH"&&s.kick(),s.cut(),await P(s.build())}function pe({customer:e,amount:i,balanceAfter:s,balanceBefore:a,method:n,shopName:c,cashier:r,date:o,receiptNo:f,qrUrl:d}){const w=k(),h=new T(w.width===58?z:D);return h.center().double().line(c||"E-KASSAM.UZ").double(!1),h.line(t("kassa.receiptDebtPay")),h.left().rule(),f&&h.row(t("kassa.receiptNo"),f),h.row(t("common.date"),(o||new Date).toLocaleString("uz-UZ")),r&&h.row(t("kassa.receiptCashier"),r),e!=null&&e.fullName&&h.row(t("kassa.receiptCustomer"),e.fullName),h.rule(),h.bold().double().row(t("kassa.receiptPaid"),p(i)).double(!1).bold(!1),h.row(t("kassa.receiptPayment"),C(n)),a!=null&&h.row(t("credit.wasDebt"),p(a)),h.row(t("kassa.receiptDebtLeft"),p(s??0)),d&&(h.rule(),h.center().line(t("kassa.receiptQrHint")),h.qr(d,6)),h.rule(),h.center().line(t("kassa.receiptThanks")).line("e-kassam.uz"),h}async function ye(e){const i=k();if(!_())return X({...e,__debt:!0});const s=pe(e);i.openDrawer&&e.method==="CASH"&&s.kick(),s.cut(),await P(s.build())}async function _e({fullName:e,username:i,version:s,token:a,shopName:n}){if(!_())throw new Error(t("hw.errNoDesktop"));const c=k(),r=new T(c.width===58?z:D);r.center().double().line(t("badge.printTitle")).double(!1),r.line(n||"E-KASSAM.UZ"),r.left().rule(),r.center().bold().line(e||i||"-").bold(!1),r.line("@"+(i||"-")),r.line(`${t("badge.version")} ${s??1}`),r.feed(),r.qr(a,8),r.feed(),r.line(new Date().toLocaleString("uz-UZ")),r.left().rule(),r.wrap(t("badge.printWarn")),r.cut(),await P(r.build())}async function Se(e,i){var c;if(!_())throw new Error(t("hw.errNoDesktop"));const s=k(),a=new T(s.width===58?z:D),n=r=>r?new Date(r).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"}):"-";a.center().double().line(e.closedAt?"Z-HISOBOT":"X-HISOBOT").double(!1),a.line(i||"E-KASSAM.UZ"),a.left().rule(),a.row(t("sales.colCashier"),e.cashierName||"-"),a.row(t("sec.openedAt"),n(e.openedAt)),e.closedAt&&a.row(t("shift.closedAt"),n(e.closedAt)),a.rule(),a.row(t("rpt.salesCount"),String(e.salesCount)),a.bold().row(t("rpt.salesTotal"),p(e.salesTotal)).bold(!1);for(const[r,o]of Object.entries(e.byPaymentType||{}))a.row("  "+C(r),p(o));if(a.rule(),a.row(t("rpt.cancelled"),`${e.cancelledCount} / ${p(e.cancelledTotal)}`),a.row(t("rpt.confirmations"),String(e.confirmationsCount)),e.suspiciousCount>0&&a.bold().row(t("rpt.suspicious"),String(e.suspiciousCount)).bold(!1),e.cash&&(a.rule(),a.row(t("cash.openingFloat"),p(e.cash.openingFloat)),e.cash.expectedCash!=null&&a.row(t("cash.expected"),p(e.cash.expectedCash)),e.cash.countedCash!=null&&(a.bold().row(t("cash.counted"),p(e.cash.countedCash)).bold(!1),a.bold().row(t("cash.difference"),p(e.cash.difference)).bold(!1))),(c=e.nonCash)!=null&&c.length){a.rule(),a.line(t("noncash.title"));for(const r of e.nonCash)r.counted==null?a.row("  "+C(r.paymentType),r.expected==null?"-":p(r.expected)):(a.row("  "+C(r.paymentType),`${p(r.expected)} / ${p(r.counted)}`),Number(r.difference)!==0&&a.bold().row("  "+t("cash.difference"),p(r.difference)).bold(!1))}a.rule(),a.center().line(new Date().toLocaleString("uz-UZ")).line("e-kassam.uz"),a.cut(),await P(a.build())}async function Ne(){if(!_())throw new Error(t("hw.errNoDesktop"));await P(re())}async function Ce(e=[],i={}){if(!_())throw new Error(t("hw.errNoDesktop"));await P(ue(e,i))}function ue(e=[],{copies:i=1,shopName:s,width:a}={}){const n=(e||[]).filter(Boolean);if(!n.length)throw new Error(t("label.nothing"));const c=k(),r=a??(c.width===58?z:D),o=new T(r),f=Math.max(1,Math.min(20,Number(i)||1));for(const d of n)for(let w=0;w<f;w++)o.center(),s&&o.line(s),o.bold().wrap(d.name||"-").bold(!1),o.feed(),o.double().line(p(d.salePrice)).double(!1),d.oldPrice!=null&&Number(d.oldPrice)>Number(d.salePrice)&&o.line(`${t("label.oldPrice")}: ${p(d.oldPrice)}`),o.feed(),d.barcode&&(o.barcodeEan13(d.barcode)||o.barcode128(d.barcode,{hri:!0}),o.feed()),o.line(new Date().toLocaleDateString("uz-UZ")),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}async function De(e=[],i={}){const s=(e||[]).filter(Boolean);if(!s.length)throw new Error(t("label.nothing"));if(!_())return he(s,i);await P(fe(s,i))}function fe(e=[],{copies:i=1,shopName:s,width:a}={}){const n=(e||[]).filter(Boolean);if(!n.length)throw new Error(t("label.nothing"));const c=k(),r=a??(c.width===58?z:D),o=new T(r),f=Math.max(1,Math.min(20,Number(i)||1));for(const d of n)for(let w=0;w<f;w++)o.center(),s&&o.line(s),o.bold().line(t("label.expiryTitle")).bold(!1),o.bold().wrap(d.name||"-").bold(!1),o.feed(),o.double().line(V(d.expiryDate)).double(!1),d.daysLeft!=null&&o.line(d.daysLeft<=0?t("label.expiryToday"):t("inv.nearDays",{n:d.daysLeft})),d.salePrice!=null&&o.line(p(d.salePrice)),o.feed(),d.barcode&&(o.barcodeEan13(d.barcode)||o.barcode128(d.barcode,{hri:!0}),o.feed()),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}function he(e,{shopName:i}={}){const s=window.open("","_blank","width=820,height=900");if(!s)throw new Error(t("hw.errPopup"));const a=c=>String(c??"").replace(/[&<>"]/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[r]),n=e.map(c=>{const r=c.daysLeft,o=r==null?"":r<=0?t("label.expiryToday"):t("inv.nearDays",{n:r});return`<div class="lbl">
      <div class="hdr">${a(t("label.expiryTitle"))}</div>
      <div class="nm">${a(c.name||"-")}</div>
      <div class="dt">${a(V(c.expiryDate))}</div>
      ${o?`<div class="lf">${a(o)}</div>`:""}
      ${c.salePrice!=null?`<div class="pr">${a(p(c.salePrice))}</div>`:""}
      ${c.barcode?`<div class="bc">${K(String(c.barcode),{height:22})}</div>`:""}
      ${i?`<div class="sh">${a(i)}</div>`:""}
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
    </style></head><body>${n}</body></html>`),s.document.close(),s.onload=()=>{s.focus(),s.print()},Promise.resolve()}async function Pe(e,i={}){if(!e)throw new Error(t("label.nothing"));if(!_())return me(e,i);await P(we(e,i))}function we(e,{shopName:i,width:s}={}){const a=k(),n=new T(s??(a.width===58?z:D));n.center().double().line(t("pickup.slipTitle")).double(!1),i&&n.line(i),n.left().rule(),n.row(`${t("kassa.receiptNo")} ${e.saleCode||"-"}`,e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):""),e.cashierName&&n.row(t("kassa.receiptCashier"),e.cashierName),e.customerName&&n.row(t("kassa.receiptCustomer"),e.customerName),e.customerPhone&&n.row(t("common.phone"),e.customerPhone),n.rule();for(const c of e.items||[])n.wrap(c.productName),n.double().line(`  ${I(c.quantity)} ${U(c.unit)}`).double(!1);if(n.rule(),e.saleId){const c=A(e.saleId);n.feed().center().barcode128(c).line(c).left()}return n.feed(),n.row(t("pickup.signStore"),"______________"),n.feed().row(t("pickup.signCustomer"),"______________"),n.cut(),n.build()}function me(e,{shopName:i}={}){const s=window.open("","_blank","width=360,height=640");if(!s)throw new Error(t("hw.errPopup"));const a=k().width===58?58:80,n=r=>String(r??"").replace(/[&<>"]/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[o]),c=(e.items||[]).map(r=>`<div class="it"><div class="nm">${n(r.productName)}</div>
     <div class="qt">${n(I(r.quantity))} ${n(U(r.unit))}</div></div>`).join("");return s.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${n(t("pickup.slipTitle"))} ${n(e.saleCode||"")}</title>
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
      <div class="c"><div class="ttl">${n(t("pickup.slipTitle"))}</div>
        ${i?`<small>${n(i)}</small>`:""}</div>
      <div class="hr"></div>
      <div class="row"><b>${n(t("kassa.receiptNo"))} ${n(e.saleCode||"-")}</b>
        <span>${n(e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):"")}</span></div>
      ${e.cashierName?`<div class="row"><span>${n(t("kassa.receiptCashier"))}</span><span>${n(e.cashierName)}</span></div>`:""}
      ${e.customerName?`<div class="row"><span>${n(t("kassa.receiptCustomer"))}</span><span>${n(e.customerName)}</span></div>`:""}
      ${e.customerPhone?`<div class="row"><span>${n(t("common.phone"))}</span><span>${n(e.customerPhone)}</span></div>`:""}
      <div class="hr"></div>
      ${c}
      <div class="hr"></div>
      ${e.saleId?`<div class="c">${K(A(e.saleId),{height:14})}
        <div><b>${n(A(e.saleId))}</b></div></div>`:""}
      <div class="row" style="margin-top:14px"><span>${n(t("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${n(t("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`),s.document.close(),s.onload=()=>{s.focus(),s.print()},Promise.resolve()}async function ze(){const e=k(),i=new T(e.width===58?z:D);i.center().double().line(t("hw.testTitle")).double(!1),i.line(new Date().toLocaleString("uz-UZ")),i.left().rule();const s=J(e);i.row(t("hw.transport"),s),i.row(t("hw.printer"),s==="tcp"?`${e.host}:${e.port}`:e.printerName||t("hw.defaultPrinter")),i.row(t("hw.width"),`${e.width} mm`),i.rule(),i.line("1234567890".repeat(6).slice(0,i.width)),i.center().line(t("hw.testOk")),i.cut(),await P(i.build())}function X({saleId:e,serverSaleId:i,cart:s=[],total:a=0,subtotal:n,discount:c=0,payType:r,payments:o,customer:f,offline:d,shopName:w,cashier:h,receiptUrl:x,credit:S,__debt:y,amount:j,balanceAfter:u,balanceBefore:O,method:R,date:M,receiptNo:E,qrUrl:m}){const g=window.open("","_blank","width=360,height=640,toolbar=no,menubar=no");if(!g)throw new Error(t("hw.errPopup"));const N=k().width===58?58:80,l=v=>String(v??"").replace(/[&<>"]/g,L=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[L]),ee=W(s,c),te=s.reduce((v,L)=>v+(Number(L.discount)||0),0),B=c+te,ae=s.map((v,L)=>{const ne=`${I(v.qty,v.unitDecimals)}${v.unit?" "+U(v.unit):""}`,Q=(Number(v.discount)||0)+(ee[L]||0);return`<div class="row"><span>${l(v.name)} × ${l(ne)}</span><span>${l(p(v.salePrice*v.qty))}</span></div>`+(Q>0?`<div class="row sub"><span>${l(t("kassa.discount"))}</span><span>-${l(p(Q))}</span></div>`:"")}).join(""),ie=y?`
      <div class="c"><div class="logo">${l(w||"E-KASSAM.UZ")}</div>
        <small>${l(t("kassa.receiptDebtPay"))}</small></div>
      <div class="hr"></div>
      ${E?`<div class="row"><span>${l(t("kassa.receiptNo"))}</span><span>${l(E)}</span></div>`:""}
      <div class="row"><span>${l(t("common.date"))}</span><span>${l((M||new Date).toLocaleString("uz-UZ"))}</span></div>
      ${h?`<div class="row"><span>${l(t("kassa.receiptCashier"))}</span><span>${l(h)}</span></div>`:""}
      ${f!=null&&f.fullName?`<div class="row"><span>${l(t("kassa.receiptCustomer"))}</span><span>${l(f.fullName)}</span></div>`:""}
      <div class="hr"></div>
      <div class="row"><b>${l(t("kassa.receiptPaid"))}</b><b>${l(p(j))}</b></div>
      <div class="row"><span>${l(t("kassa.receiptPayment"))}</span><span>${l(C(R))}</span></div>
      ${O!=null?`<div class="row"><span>${l(t("credit.wasDebt"))}</span><span>${l(p(O))}</span></div>`:""}
      <div class="row"><span>${l(t("kassa.receiptDebtLeft"))}</span><span>${l(p(u??0))}</span></div>
      ${m?`<div class="hr"></div><div class="c">
        ${G(m,{size:96,margin:1})}
        <small>${l(t("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`:"";g.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${l(y?t("kassa.receiptDebtPay"):t("kassa.receiptNo")+" "+e)}</title>
    <style>
      /* CHEK QOG'OZI - A4 EMAS.
         @page bo'lmasa brauzer chekni A4 sahifaga joylashtiradi, chetiga
         o'z sarlavha-izohini (manzil, sana, bet raqami) qo'shadi va matn
         chek printeriga umuman sig'maydi - aynan shu "noto'g'ri format"
         edi. margin:0 esa brauzerning o'sha sarlavhalarini olib tashlaydi.
         Balandlik auto: chek uzunligi tovar soniga qarab o'zgaradi. */
      @page { size: ${N}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${N}mm; padding: 3mm; }
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
      ${ie}
      ${y?"":`
      <div class="c"><div class="logo">${l(w||"E-KASSAM.UZ")}</div>
        <small>${l(t("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${l(t("kassa.receiptNo"))} ${l(e)}</span><span>${l(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${ae}
      <div class="hr"></div>
      ${B>0?`<div class="row"><span>${l(t("kassa.receiptSubtotal"))}</span><span>${l(p(n??a+B))}</span></div>
      <div class="row"><span>${l(t("kassa.discount"))}</span><span>-${l(p(B))}</span></div>`:""}
      <div class="row"><b>${l(t("kassa.receiptTotal"))}</b><b>${l(p(a))}</b></div>
      <div class="row"><span>${l(t("kassa.receiptPayment"))}</span><span>${l(C(r))}</span></div>
      ${Array.isArray(o)&&o.length>1?o.map(v=>`<div class="row"><span>&nbsp;&nbsp;${l(C(v.type))}</span><span>${l(p(v.amount))}</span></div>`).join(""):""}
      ${f!=null&&f.fullName?`<div class="row"><span>${l(t("kassa.receiptCustomer"))}</span><span>${l(f.fullName)}</span></div>`:""}
      ${S&&Number(S.amount)>0?`<div class="hr"></div>
      <div class="c"><b>${l(t("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${l(t("kassa.receiptCreditThis"))}</span><b>${l(p(S.amount))}</b></div>
      ${S.balance!=null?`<div class="row"><span>${l(t("kassa.receiptCreditTotal"))}</span><span>${l(p(S.balance))}</span></div>`:""}
      ${S.dueDate?`<div class="row"><span>${l(t("kassa.receiptCreditDue"))}</span><span>${l(S.dueDate)}</span></div>`:""}
      <div class="row" style="margin-top:10px"><span>${l(t("kassa.receiptCreditSign"))}</span><span>______________</span></div>`:""}
      ${d?`<div class="off">${l(t("kassa.receiptOffline"))}<br>${l(t("kassa.receiptOfflineSub"))}</div>`:""}
      ${i?`<div class="c" style="margin-top:6px">
        ${K(A(i),{height:12})}
        <div class="no">${l(A(i))}</div>
      </div>`:""}
      ${x?`<div class="c" style="margin-top:8px">
        ${G(x,{size:96,margin:1})}
        <small>${l(t("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`}
    </body></html>`),g.document.close(),g.onafterprint=()=>g.close(),setTimeout(()=>g.print(),60)}export{De as a,Pe as b,ye as c,Se as d,ve as e,F as f,ce as g,xe as h,ke as i,_e as j,$e as l,Ne as o,Ce as p,ge as r,W as s,ze as t};
