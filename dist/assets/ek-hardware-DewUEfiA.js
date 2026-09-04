import{at as y,t,E as S,aF as Q,m as p,Z as C,v as B,w as H,aG as G,aH as O,aI as V,aJ as J,K as X}from"./index-Br7HQ81s.js";const M=27,b=29,D=48,T=32,k={init:[M,64],alignLeft:[M,97,0],alignCenter:[M,97,1],alignRight:[M,97,2],boldOn:[M,69,1],boldOff:[M,69,0],doubleOn:[b,33,17],doubleOff:[b,33,0],cut:[b,86,66,3],kick:[M,112,0,25,25]};function ce(e){const n=String(e??"").replace(/[‘’ʻʼ′]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g," ").replace(/[\t\r\n\v\f]/g," "),s=[];for(const a of n){const i=a.codePointAt(0);s.push(i<128?i:63)}return s}class q{constructor(n=D){this.width=n,this.bytes=[...k.init]}raw(n){return this.bytes.push(...n),this}left(){return this.raw(k.alignLeft)}center(){return this.raw(k.alignCenter)}right(){return this.raw(k.alignRight)}bold(n=!0){return this.raw(n?k.boldOn:k.boldOff)}double(n=!0){return this.raw(n?k.doubleOn:k.doubleOff)}line(n=""){return this.raw(ce(n)).raw([10])}feed(n=1){for(let s=0;s<n;s++)this.raw([10]);return this}rule(n="-"){return this.line(n.repeat(this.width))}row(n,s){const a=String(n??""),i=String(s??""),c=this.width-i.length;if(c<1)return this.line(i);const r=a.length>c-1?a.slice(0,c-1):a;return this.line(r+" ".repeat(this.width-r.length-i.length)+i)}wrap(n){const s=String(n??"").split(/\s+/).filter(Boolean);let a="";for(const i of s){if(!a.length){a=i;continue}a.length+1+i.length<=this.width?a+=" "+i:(this.line(a),a=i)}return a.length&&this.line(a),this}qr(n,s=8){const a=[];for(const c of String(n??"")){const r=c.codePointAt(0);r<128&&a.push(r)}this.raw([b,40,107,4,0,49,65,50,0]),this.raw([b,40,107,3,0,49,67,Math.max(1,Math.min(16,s))]),this.raw([b,40,107,3,0,49,69,49]);const i=a.length+3;return this.raw([b,40,107,i&255,i>>8&255,49,80,48]),this.raw(a),this.raw([b,40,107,3,0,49,81,48]),this}barcode128(n,{height:s=60,width:a=2,hri:i=!1}={}){const c=String(n??""),r=[];for(const h of c){const d=h.charCodeAt(0);if(d<32||d>127)return this;r.push(d)}if(!r.length)return this;this.raw([b,104,Math.max(1,Math.min(255,s))]),this.raw([b,119,Math.max(2,Math.min(6,a))]),this.raw([b,72,i?2:0]);const o=[123,66,...r];return this.raw([b,107,73,o.length]),this.raw(o),this}barcodeEan13(n){const s=String(n??"").replace(/\D/g,"");if(s.length!==13)return!1;let a=0;for(let r=0;r<12;r++)a+=Number(s[r])*(r%2===0?1:3);if((10-a%10)%10!==Number(s[12]))return!1;this.raw([b,104,60]),this.raw([b,119,2]),this.raw([b,72,2]);const c=[...s].map(r=>r.charCodeAt(0));return this.raw([b,107,67,c.length]),this.raw(c),!0}cut(){return this.feed(4).raw(k.cut)}kick(){return this.bytes.splice(k.init.length,0,...k.kick),this}build(){return this.bytes}}const de=()=>[...k.init,...k.kick],pe=e=>Math.max(0,(Number(e.salePrice)||0)*(Number(e.qty)||0)-(Number(e.discount)||0));function ee(e,n){const s=Number(n)||0,a=e.map(()=>0);if(s<=0||!e.length)return a;const i=e.map(pe),c=i.reduce((d,m)=>d+m,0);if(c<=0)return a;let r=0,o=0;for(let d=0;d<e.length;d++){const m=Math.floor(s*i[d]/c*100)/100;a[d]=m,r+=m,i[d]>i[o]&&(o=d)}const h=Math.round((s-r)*100)/100;return h!==0&&(a[o]=Math.round((a[o]+h)*100)/100),a}const Z=[1e4,5e3,1e3,500];function te(e){const n=Number(e.salePrice)||0,s=Number(e.qty)||0,a=e.minPrice==null?null:Number(e.minPrice);if(a==null||!Number.isFinite(a))return 0;const i=(n-a)*s-(Number(e.discount)||0);return i>0?Math.floor(i):0}const W=e=>(e||[]).reduce((n,s)=>n+te(s),0);function ke(e,n,s=3){const a=Math.round(Number(n)||0),i=W(e);if(a<=0||i<=0)return[];if(a%Z[Z.length-1]===0)return[];const c=[],r=new Set;for(const o of[...Z].reverse()){const h=Math.floor(a/o)*o,d=a-h;if(!(d<=0||d>i)&&!r.has(h)&&(r.add(h),c.push({target:h,discount:d}),c.length>=s))break}return c}function ye(e,n,s,a=3){const i=Math.round(Number(n)||0),c=Math.min(Math.round(Number(s)||0),W(e));if(i<=0||c<=0)return[];const r=i-c,o=[],h=new Set;for(const d of Z){const m=Math.ceil(r/d)*d;if(m<=0||m>i)continue;const _=i-m;if(!(_<=0||_>c)&&!h.has(m)&&(h.add(m),o.push({target:m,discount:_,step:d}),o.length>=a))break}return o}function ue(e){const n=Number(e.salePrice)||0,s=Number(e.qty)||0,a=e.costPrice==null?null:Number(e.costPrice);if(a==null||!Number.isFinite(a))return te(e);const i=(n-a)*s-(Number(e.discount)||0);return i>0?Math.floor(i):0}const he=e=>(e||[]).reduce((n,s)=>n+ue(s),0);function _e(e,n){const s=Math.round(Number(n)||0);return s<=0?"ok":s>he(e)?"loss":s>W(e)?"over":"ok"}async function Ne(){if(!S())return[];try{return await Q("list_printers")||[]}catch{return[]}}function ae(e){return S()?e.transport==="tcp"?"tcp":"windows":"browser"}async function P(e){const n=y();if(!S())throw new Error(t("hw.errNoDesktop"));if(ae(n)==="tcp"){if(!n.host)throw new Error(t("hw.errNoHost"));return Q("print_tcp",{host:n.host,port:Number(n.port)||9100,data:e})}return Q("print_raw",{printer:n.printerName||null,data:e})}function fe({saleId:e,serverSaleId:n,cart:s=[],total:a=0,subtotal:i,discount:c=0,payType:r,payments:o,customer:h,offline:d,shopName:m,cashier:_,fiscal:g,receiptUrl:f,credit:v}){const R=y(),u=new q(R.width===58?T:D),A=V(m);u.center().double().line(A.name).double(!1),A.phone&&u.line(A.phone),u.line(t("kassa.receiptSystem")),u.left().rule(),u.row(`${t("kassa.receiptNo")} ${e??"-"}`,new Date().toLocaleString("uz-UZ")),_&&u.row(t("kassa.receiptCashier"),_),u.rule();const U=ee(s,c);s.forEach((w,N)=>{u.wrap(w.name);const x=`${B(w.qty,w.unitDecimals)}${w.unit?" "+H(w.unit):""}`;u.row(`  ${x} x ${p(w.salePrice)}`,p(w.salePrice*w.qty));const z=(Number(w.discount)||0)+(U[N]||0);z>0&&u.row(`    ${t("kassa.discount")}`,"-"+p(z))}),u.rule();const F=s.reduce((w,N)=>w+(Number(N.discount)||0),0),E=c+F;if(E>0&&(u.row(t("kassa.receiptSubtotal"),p(i??a+E)),u.row(t("kassa.discount"),"-"+p(E))),u.bold().double().row(t("kassa.receiptTotal"),p(a)).double(!1).bold(!1),u.row(t("kassa.receiptPayment"),C(r)),Array.isArray(o)&&o.length>1)for(const w of o)u.row("  "+C(w.type),p(w.amount));h!=null&&h.fullName&&u.row(t("kassa.receiptCustomer"),h.fullName),v&&Number(v.amount)>0&&(u.rule(),u.center().bold().line(t("kassa.receiptCredit")).bold(!1).left(),u.row(t("kassa.receiptCreditThis"),p(v.amount)),v.balance!=null&&u.row(t("kassa.receiptCreditTotal"),p(v.balance)),v.dueDate&&u.row(t("kassa.receiptCreditDue"),v.dueDate),u.feed().row(t("kassa.receiptCreditSign"),"______________")),d&&u.feed().center().line(t("kassa.receiptOffline")).line(t("kassa.receiptOfflineSub")).left();const I=s.reduce((w,N)=>{const x=Number(N.vatRate);if(!x)return w;const z=Number(N.salePrice)*Number(N.qty);return w+(N.priceIncludesVat===!1?z*x/100:z*x/(100+x))},0);if(I>0&&u.row(t("kassa.receiptVat"),p(I)),g!=null&&g.fiscalSign&&(u.rule(),u.center().line(t("kassa.receiptFiscal")).left(),u.row(t("kassa.receiptFiscalSign"),g.fiscalSign),g.terminalId&&u.row(t("kassa.receiptTerminal"),g.terminalId),g.receiptNo&&u.row(t("kassa.receiptFiscalNo"),g.receiptNo),g.qrUrl&&u.feed().center().qr(g.qrUrl).left()),n){const w=O(n);u.feed().center().barcode128(w).line(w).left()}return f&&u.feed().center().qr(f,6).line(t("kassa.receiptQrHint")).left(),u.rule(),u.center().line(t("kassa.receiptThanks")).line("e-kassam.uz"),u}async function Se(e){const n=y();if(!S())return ne(e);const s=fe(e);n.openDrawer&&e.payType==="CASH"&&s.kick(),s.cut(),await P(s.build())}function me({customer:e,amount:n,balanceAfter:s,balanceBefore:a,method:i,shopName:c,cashier:r,date:o,receiptNo:h,qrUrl:d,toSavings:m,bonusEarned:_}){const g=y(),f=new q(g.width===58?T:D),v=V(c);return f.center().double().line(v.name).double(!1),v.phone&&f.line(v.phone),f.line(t("kassa.receiptDebtPay")),f.left().rule(),h&&f.row(t("kassa.receiptNo"),h),f.row(t("common.date"),(o||new Date).toLocaleString("uz-UZ")),r&&f.row(t("kassa.receiptCashier"),r),e!=null&&e.fullName&&f.row(t("kassa.receiptCustomer"),e.fullName),f.rule(),f.bold().double().row(t("kassa.receiptPaid"),p(n)).double(!1).bold(!1),f.row(t("kassa.receiptPayment"),C(i)),a!=null&&f.row(t("credit.wasDebt"),p(a)),f.row(t("kassa.receiptDebtLeft"),p(s??0)),Number(m)>0&&f.row(t("savings.toSavings"),p(m)),Number(_)>0&&f.row(t("kassa.receiptBonusEarned"),"+"+p(_)),d&&(f.rule(),f.center().line(t("kassa.receiptQrHint")),f.qr(d,6)),f.rule(),f.center().line(t("kassa.receiptThanks")).line("e-kassam.uz"),f}async function Ce(e){const n=y();if(!S())return ne({...e,__debt:!0});const s=me(e);n.openDrawer&&e.method==="CASH"&&s.kick(),s.cut(),await P(s.build())}async function De({fullName:e,username:n,version:s,token:a,shopName:i}){if(!S())throw new Error(t("hw.errNoDesktop"));const c=y(),r=new q(c.width===58?T:D);r.center().double().line(t("badge.printTitle")).double(!1),r.line(i||"E-KASSAM.UZ"),r.left().rule(),r.center().bold().line(e||n||"-").bold(!1),r.line("@"+(n||"-")),r.line(`${t("badge.version")} ${s??1}`),r.feed(),r.qr(a,8),r.feed(),r.line(new Date().toLocaleString("uz-UZ")),r.left().rule(),r.wrap(t("badge.printWarn")),r.cut(),await P(r.build())}async function Pe(e,n){var c;if(!S())throw new Error(t("hw.errNoDesktop"));const s=y(),a=new q(s.width===58?T:D),i=r=>r?new Date(r).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"}):"-";a.center().double().line(e.closedAt?"Z-HISOBOT":"X-HISOBOT").double(!1),a.line(n||"E-KASSAM.UZ"),a.left().rule(),a.row(t("sales.colCashier"),e.cashierName||"-"),a.row(t("sec.openedAt"),i(e.openedAt)),e.closedAt&&a.row(t("shift.closedAt"),i(e.closedAt)),a.rule(),a.row(t("rpt.salesCount"),String(e.salesCount)),a.bold().row(t("rpt.salesTotal"),p(e.salesTotal)).bold(!1);for(const[r,o]of Object.entries(e.byPaymentType||{}))a.row("  "+C(r),p(o));if(a.rule(),a.row(t("rpt.cancelled"),`${e.cancelledCount} / ${p(e.cancelledTotal)}`),a.row(t("rpt.confirmations"),String(e.confirmationsCount)),e.suspiciousCount>0&&a.bold().row(t("rpt.suspicious"),String(e.suspiciousCount)).bold(!1),e.cash&&(a.rule(),a.row(t("cash.openingFloat"),p(e.cash.openingFloat)),e.cash.expectedCash!=null&&a.row(t("cash.expected"),p(e.cash.expectedCash)),e.cash.countedCash!=null&&(a.bold().row(t("cash.counted"),p(e.cash.countedCash)).bold(!1),a.bold().row(t("cash.difference"),p(e.cash.difference)).bold(!1))),(c=e.nonCash)!=null&&c.length){a.rule(),a.line(t("noncash.title"));for(const r of e.nonCash)r.counted==null?a.row("  "+C(r.paymentType),r.expected==null?"-":p(r.expected)):(a.row("  "+C(r.paymentType),`${p(r.expected)} / ${p(r.counted)}`),Number(r.difference)!==0&&a.bold().row("  "+t("cash.difference"),p(r.difference)).bold(!1))}a.rule(),a.center().line(new Date().toLocaleString("uz-UZ")).line("e-kassam.uz"),a.cut(),await P(a.build())}async function ze(){if(!S())throw new Error(t("hw.errNoDesktop"));await P(de())}async function Te(e=[],n={}){if(!S())throw new Error(t("hw.errNoDesktop"));await P(we(e,n))}function we(e=[],{copies:n=1,shopName:s,width:a}={}){const i=(e||[]).filter(Boolean);if(!i.length)throw new Error(t("label.nothing"));const c=y(),r=a??(c.width===58?T:D),o=new q(r),h=Math.max(1,Math.min(20,Number(n)||1));for(const d of i)for(let m=0;m<h;m++)o.center(),s&&o.line(s),o.bold().wrap(d.name||"-").bold(!1),o.feed(),o.double().line(p(d.salePrice)).double(!1),d.oldPrice!=null&&Number(d.oldPrice)>Number(d.salePrice)&&o.line(`${t("label.oldPrice")}: ${p(d.oldPrice)}`),o.feed(),d.barcode&&(o.barcodeEan13(d.barcode)||o.barcode128(d.barcode,{hri:!0}),o.feed()),o.line(new Date().toLocaleDateString("uz-UZ")),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}async function qe(e=[],n={}){const s=(e||[]).filter(Boolean);if(!s.length)throw new Error(t("label.nothing"));if(!S())return ge(s,n);await P(be(s,n))}function be(e=[],{copies:n=1,shopName:s,width:a}={}){const i=(e||[]).filter(Boolean);if(!i.length)throw new Error(t("label.nothing"));const c=y(),r=a??(c.width===58?T:D),o=new q(r),h=Math.max(1,Math.min(20,Number(n)||1));for(const d of i)for(let m=0;m<h;m++)o.center(),s&&o.line(s),o.bold().line(t("label.expiryTitle")).bold(!1),o.bold().wrap(d.name||"-").bold(!1),o.feed(),o.double().line(X(d.expiryDate)).double(!1),d.daysLeft!=null&&o.line(d.daysLeft<=0?t("label.expiryToday"):t("inv.nearDays",{n:d.daysLeft})),d.salePrice!=null&&o.line(p(d.salePrice)),o.feed(),d.barcode&&(o.barcodeEan13(d.barcode)||o.barcode128(d.barcode,{hri:!0}),o.feed()),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}function ge(e,{shopName:n}={}){const s=window.open("","_blank","width=820,height=900");if(!s)throw new Error(t("hw.errPopup"));const a=c=>String(c??"").replace(/[&<>"]/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[r]),i=e.map(c=>{const r=c.daysLeft,o=r==null?"":r<=0?t("label.expiryToday"):t("inv.nearDays",{n:r});return`<div class="lbl">
      <div class="hdr">${a(t("label.expiryTitle"))}</div>
      <div class="nm">${a(c.name||"-")}</div>
      <div class="dt">${a(X(c.expiryDate))}</div>
      ${o?`<div class="lf">${a(o)}</div>`:""}
      ${c.salePrice!=null?`<div class="pr">${a(p(c.salePrice))}</div>`:""}
      ${c.barcode?`<div class="bc">${G(String(c.barcode),{height:22})}</div>`:""}
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
    </style></head><body>${i}</body></html>`),s.document.close(),s.onload=()=>{s.focus(),s.print()},Promise.resolve()}async function Me(e,n={}){if(!e)throw new Error(t("label.nothing"));if(!S())return $e(e,n);await P(ve(e,n))}function ve(e,{shopName:n,width:s}={}){const a=y(),i=new q(s??(a.width===58?T:D));i.center().double().line(t("pickup.slipTitle")).double(!1),n&&i.line(n),i.left().rule(),i.row(`${t("kassa.receiptNo")} ${e.saleCode||"-"}`,e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):""),e.cashierName&&i.row(t("kassa.receiptCashier"),e.cashierName),e.customerName&&i.row(t("kassa.receiptCustomer"),e.customerName),e.customerPhone&&i.row(t("common.phone"),e.customerPhone),i.rule();for(const c of e.items||[])i.wrap(c.productName),i.double().line(`  ${B(c.quantity)} ${H(c.unit)}`).double(!1);if(i.rule(),e.saleId){const c=O(e.saleId);i.feed().center().barcode128(c).line(c).left()}return i.feed(),i.row(t("pickup.signStore"),"______________"),i.feed().row(t("pickup.signCustomer"),"______________"),i.cut(),i.build()}function $e(e,{shopName:n}={}){const s=window.open("","_blank","width=360,height=640");if(!s)throw new Error(t("hw.errPopup"));const a=y().width===58?58:80,i=r=>String(r??"").replace(/[&<>"]/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[o]),c=(e.items||[]).map(r=>`<div class="it"><div class="nm">${i(r.productName)}</div>
     <div class="qt">${i(B(r.quantity))} ${i(H(r.unit))}</div></div>`).join("");return s.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
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
      ${e.saleId?`<div class="c">${G(O(e.saleId),{height:14})}
        <div><b>${i(O(e.saleId))}</b></div></div>`:""}
      <div class="row" style="margin-top:14px"><span>${i(t("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${i(t("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`),s.document.close(),s.onload=()=>{s.focus(),s.print()},Promise.resolve()}async function Ae(){const e=y(),n=new q(e.width===58?T:D);n.center().double().line(t("hw.testTitle")).double(!1),n.line(new Date().toLocaleString("uz-UZ")),n.left().rule();const s=ae(e);n.row(t("hw.transport"),s),n.row(t("hw.printer"),s==="tcp"?`${e.host}:${e.port}`:e.printerName||t("hw.defaultPrinter")),n.row(t("hw.width"),`${e.width} mm`),n.rule(),n.line("1234567890".repeat(6).slice(0,n.width)),n.center().line(t("hw.testOk")),n.cut(),await P(n.build())}function ne({saleId:e,serverSaleId:n,cart:s=[],total:a=0,subtotal:i,discount:c=0,payType:r,payments:o,customer:h,offline:d,shopName:m,cashier:_,receiptUrl:g,credit:f,__debt:v,amount:R,balanceAfter:u,balanceBefore:A,method:U,date:F,receiptNo:E,qrUrl:I,toSavings:w,bonusEarned:N}){const x=window.open("","_blank","width=360,height=640,toolbar=no,menubar=no");if(!x)throw new Error(t("hw.errPopup"));const z=y().width===58?58:80,L=V(m),l=$=>String($??"").replace(/[&<>"]/g,j=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[j]),ie=ee(s,c),se=s.reduce(($,j)=>$+(Number(j.discount)||0),0),K=c+se,re=s.map(($,j)=>{const le=`${B($.qty,$.unitDecimals)}${$.unit?" "+H($.unit):""}`,Y=(Number($.discount)||0)+(ie[j]||0);return`<div class="row"><span>${l($.name)} × ${l(le)}</span><span>${l(p($.salePrice*$.qty))}</span></div>`+(Y>0?`<div class="row sub"><span>${l(t("kassa.discount"))}</span><span>-${l(p(Y))}</span></div>`:"")}).join(""),oe=v?`
      <div class="c"><div class="logo">${l(L.name)}</div>
        ${L.phone?`<small>${l(L.phone)}</small><br>`:""}
        <small>${l(t("kassa.receiptDebtPay"))}</small></div>
      <div class="hr"></div>
      ${E?`<div class="row"><span>${l(t("kassa.receiptNo"))}</span><span>${l(E)}</span></div>`:""}
      <div class="row"><span>${l(t("common.date"))}</span><span>${l((F||new Date).toLocaleString("uz-UZ"))}</span></div>
      ${_?`<div class="row"><span>${l(t("kassa.receiptCashier"))}</span><span>${l(_)}</span></div>`:""}
      ${h!=null&&h.fullName?`<div class="row"><span>${l(t("kassa.receiptCustomer"))}</span><span>${l(h.fullName)}</span></div>`:""}
      <div class="hr"></div>
      <div class="row"><b>${l(t("kassa.receiptPaid"))}</b><b>${l(p(R))}</b></div>
      <div class="row"><span>${l(t("kassa.receiptPayment"))}</span><span>${l(C(U))}</span></div>
      ${A!=null?`<div class="row"><span>${l(t("credit.wasDebt"))}</span><span>${l(p(A))}</span></div>`:""}
      <div class="row"><span>${l(t("kassa.receiptDebtLeft"))}</span><span>${l(p(u??0))}</span></div>
      ${Number(w)>0?`<div class="row"><span>${l(t("savings.toSavings"))}</span><span>${l(p(w))}</span></div>`:""}
      ${Number(N)>0?`<div class="row"><span>${l(t("kassa.receiptBonusEarned"))}</span><span>+${l(p(N))}</span></div>`:""}
      ${I?`<div class="hr"></div><div class="c">
        ${J(I,{size:96,margin:1})}
        <small>${l(t("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`:"";x.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${l(v?t("kassa.receiptDebtPay"):t("kassa.receiptNo")+" "+e)}</title>
    <style>
      /* CHEK QOG'OZI - A4 EMAS.
         @page bo'lmasa brauzer chekni A4 sahifaga joylashtiradi, chetiga
         o'z sarlavha-izohini (manzil, sana, bet raqami) qo'shadi va matn
         chek printeriga umuman sig'maydi - aynan shu "noto'g'ri format"
         edi. margin:0 esa brauzerning o'sha sarlavhalarini olib tashlaydi.
         Balandlik auto: chek uzunligi tovar soniga qarab o'zgaradi. */
      @page { size: ${z}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${z}mm; padding: 3mm; }
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
      ${oe}
      ${v?"":`
      <div class="c"><div class="logo">${l(L.name)}</div>
        ${L.phone?`<small>${l(L.phone)}</small><br>`:""}
        <small>${l(t("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${l(t("kassa.receiptNo"))} ${l(e)}</span><span>${l(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${re}
      <div class="hr"></div>
      ${K>0?`<div class="row"><span>${l(t("kassa.receiptSubtotal"))}</span><span>${l(p(i??a+K))}</span></div>
      <div class="row"><span>${l(t("kassa.discount"))}</span><span>-${l(p(K))}</span></div>`:""}
      <div class="row"><b>${l(t("kassa.receiptTotal"))}</b><b>${l(p(a))}</b></div>
      <div class="row"><span>${l(t("kassa.receiptPayment"))}</span><span>${l(C(r))}</span></div>
      ${Array.isArray(o)&&o.length>1?o.map($=>`<div class="row"><span>&nbsp;&nbsp;${l(C($.type))}</span><span>${l(p($.amount))}</span></div>`).join(""):""}
      ${h!=null&&h.fullName?`<div class="row"><span>${l(t("kassa.receiptCustomer"))}</span><span>${l(h.fullName)}</span></div>`:""}
      ${f&&Number(f.amount)>0?`<div class="hr"></div>
      <div class="c"><b>${l(t("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${l(t("kassa.receiptCreditThis"))}</span><b>${l(p(f.amount))}</b></div>
      ${f.balance!=null?`<div class="row"><span>${l(t("kassa.receiptCreditTotal"))}</span><span>${l(p(f.balance))}</span></div>`:""}
      ${f.dueDate?`<div class="row"><span>${l(t("kassa.receiptCreditDue"))}</span><span>${l(f.dueDate)}</span></div>`:""}
      <div class="row" style="margin-top:10px"><span>${l(t("kassa.receiptCreditSign"))}</span><span>______________</span></div>`:""}
      ${d?`<div class="off">${l(t("kassa.receiptOffline"))}<br>${l(t("kassa.receiptOfflineSub"))}</div>`:""}
      ${n?`<div class="c" style="margin-top:6px">
        ${G(O(n),{height:12})}
        <div class="no">${l(O(n))}</div>
      </div>`:""}
      ${g?`<div class="c" style="margin-top:8px">
        ${J(g,{size:96,margin:1})}
        <small>${l(t("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`}
    </body></html>`),x.document.close(),x.onafterprint=()=>x.close(),setTimeout(()=>x.print(),60)}export{qe as a,Me as b,Ce as c,Pe as d,ye as e,W as f,he as g,_e as h,Se as i,De as j,Ne as l,ze as o,Te as p,ke as r,ee as s,Ae as t};
