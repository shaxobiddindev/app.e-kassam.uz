import{as as v,t,E as $,aE as R,m as f,Z as C,v as Z,w as U,aF as H,aG as M,aH as te,K as Q}from"./index-ZfYqvLH_.js";const A=27,w=29,D=48,T=32,g={init:[A,64],alignLeft:[A,97,0],alignCenter:[A,97,1],alignRight:[A,97,2],boldOn:[A,69,1],boldOff:[A,69,0],doubleOn:[w,33,17],doubleOff:[w,33,0],cut:[w,86,66,3],kick:[A,112,0,25,25]};function ae(e){const n=String(e??"").replace(/[‘’ʻʼ′]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g," ").replace(/[\t\r\n\v\f]/g," "),s=[];for(const a of n){const i=a.codePointAt(0);s.push(i<128?i:63)}return s}class q{constructor(n=D){this.width=n,this.bytes=[...g.init]}raw(n){return this.bytes.push(...n),this}left(){return this.raw(g.alignLeft)}center(){return this.raw(g.alignCenter)}right(){return this.raw(g.alignRight)}bold(n=!0){return this.raw(n?g.boldOn:g.boldOff)}double(n=!0){return this.raw(n?g.doubleOn:g.doubleOff)}line(n=""){return this.raw(ae(n)).raw([10])}feed(n=1){for(let s=0;s<n;s++)this.raw([10]);return this}rule(n="-"){return this.line(n.repeat(this.width))}row(n,s){const a=String(n??""),i=String(s??""),c=this.width-i.length;if(c<1)return this.line(i);const r=a.length>c-1?a.slice(0,c-1):a;return this.line(r+" ".repeat(this.width-r.length-i.length)+i)}wrap(n){const s=String(n??"").split(/\s+/).filter(Boolean);let a="";for(const i of s){if(!a.length){a=i;continue}a.length+1+i.length<=this.width?a+=" "+i:(this.line(a),a=i)}return a.length&&this.line(a),this}qr(n,s=8){const a=[];for(const c of String(n??"")){const r=c.codePointAt(0);r<128&&a.push(r)}this.raw([w,40,107,4,0,49,65,50,0]),this.raw([w,40,107,3,0,49,67,Math.max(1,Math.min(16,s))]),this.raw([w,40,107,3,0,49,69,49]);const i=a.length+3;return this.raw([w,40,107,i&255,i>>8&255,49,80,48]),this.raw(a),this.raw([w,40,107,3,0,49,81,48]),this}barcode128(n,{height:s=60,width:a=2,hri:i=!1}={}){const c=String(n??""),r=[];for(const u of c){const d=u.charCodeAt(0);if(d<32||d>127)return this;r.push(d)}if(!r.length)return this;this.raw([w,104,Math.max(1,Math.min(255,s))]),this.raw([w,119,Math.max(2,Math.min(6,a))]),this.raw([w,72,i?2:0]);const l=[123,66,...r];return this.raw([w,107,73,l.length]),this.raw(l),this}barcodeEan13(n){const s=String(n??"").replace(/\D/g,"");if(s.length!==13)return!1;let a=0;for(let r=0;r<12;r++)a+=Number(s[r])*(r%2===0?1:3);if((10-a%10)%10!==Number(s[12]))return!1;this.raw([w,104,60]),this.raw([w,119,2]),this.raw([w,72,2]);const c=[...s].map(r=>r.charCodeAt(0));return this.raw([w,107,67,c.length]),this.raw(c),!0}cut(){return this.feed(4).raw(g.cut)}kick(){return this.bytes.splice(g.init.length,0,...g.kick),this}build(){return this.bytes}}const ne=()=>[...g.init,...g.kick],ie=e=>Math.max(0,(Number(e.salePrice)||0)*(Number(e.qty)||0)-(Number(e.discount)||0));function G(e,n){const s=Number(n)||0,a=e.map(()=>0);if(s<=0||!e.length)return a;const i=e.map(ie),c=i.reduce((d,h)=>d+h,0);if(c<=0)return a;let r=0,l=0;for(let d=0;d<e.length;d++){const h=Math.floor(s*i[d]/c*100)/100;a[d]=h,r+=h,i[d]>i[l]&&(l=d)}const u=Math.round((s-r)*100)/100;return u!==0&&(a[l]=Math.round((a[l]+u)*100)/100),a}const O=[1e4,5e3,1e3,500];function V(e){const n=Number(e.salePrice)||0,s=Number(e.qty)||0,a=e.minPrice==null?null:Number(e.minPrice);if(a==null||!Number.isFinite(a))return 0;const i=(n-a)*s-(Number(e.discount)||0);return i>0?Math.floor(i):0}const K=e=>(e||[]).reduce((n,s)=>n+V(s),0);function we(e,n,s=3){const a=Math.round(Number(n)||0),i=K(e);if(a<=0||i<=0)return[];if(a%O[O.length-1]===0)return[];const c=[],r=new Set;for(const l of[...O].reverse()){const u=Math.floor(a/l)*l,d=a-u;if(!(d<=0||d>i)&&!r.has(u)&&(r.add(u),c.push({target:u,discount:d}),c.length>=s))break}return c}function be(e,n,s,a=3){const i=Math.round(Number(n)||0),c=Math.min(Math.round(Number(s)||0),K(e));if(i<=0||c<=0)return[];const r=i-c,l=[],u=new Set;for(const d of O){const h=Math.ceil(r/d)*d;if(h<=0||h>i)continue;const S=i-h;if(!(S<=0||S>c)&&!u.has(h)&&(u.add(h),l.push({target:h,discount:S,step:d}),l.length>=a))break}return l}function se(e){const n=Number(e.salePrice)||0,s=Number(e.qty)||0,a=e.costPrice==null?null:Number(e.costPrice);if(a==null||!Number.isFinite(a))return V(e);const i=(n-a)*s-(Number(e.discount)||0);return i>0?Math.floor(i):0}const re=e=>(e||[]).reduce((n,s)=>n+se(s),0);function me(e,n){const s=Math.round(Number(n)||0);return s<=0?"ok":s>re(e)?"loss":s>K(e)?"over":"ok"}async function ge(){if(!$())return[];try{return await R("list_printers")||[]}catch{return[]}}function W(e){return $()?e.transport==="tcp"?"tcp":"windows":"browser"}async function P(e){const n=v();if(!$())throw new Error(t("hw.errNoDesktop"));if(W(n)==="tcp"){if(!n.host)throw new Error(t("hw.errNoHost"));return R("print_tcp",{host:n.host,port:Number(n.port)||9100,data:e})}return R("print_raw",{printer:n.printerName||null,data:e})}function oe({saleId:e,serverSaleId:n,cart:s=[],total:a=0,subtotal:i,discount:c=0,payType:r,payments:l,customer:u,offline:d,shopName:h,cashier:S,fiscal:m,receiptUrl:k,credit:x}){const j=v(),p=new q(j.width===58?T:D);p.center().double().line(h||"E-KASSAM.UZ").double(!1),p.line(t("kassa.receiptSystem")),p.left().rule(),p.row(`${t("kassa.receiptNo")} ${e??"-"}`,new Date().toLocaleString("uz-UZ")),S&&p.row(t("kassa.receiptCashier"),S),p.rule();const I=G(s,c);s.forEach((o,_)=>{p.wrap(o.name);const z=`${Z(o.qty,o.unitDecimals)}${o.unit?" "+U(o.unit):""}`;p.row(`  ${z} x ${f(o.salePrice)}`,f(o.salePrice*o.qty));const N=(Number(o.discount)||0)+(I[_]||0);N>0&&p.row(`    ${t("kassa.discount")}`,"-"+f(N))}),p.rule();const B=s.reduce((o,_)=>o+(Number(_.discount)||0),0),y=c+B;if(y>0&&(p.row(t("kassa.receiptSubtotal"),f(i??a+y)),p.row(t("kassa.discount"),"-"+f(y))),p.bold().double().row(t("kassa.receiptTotal"),f(a)).double(!1).bold(!1),p.row(t("kassa.receiptPayment"),C(r)),Array.isArray(l)&&l.length>1)for(const o of l)p.row("  "+C(o.type),f(o.amount));u!=null&&u.fullName&&p.row(t("kassa.receiptCustomer"),u.fullName),x&&Number(x.amount)>0&&(p.rule(),p.center().bold().line(t("kassa.receiptCredit")).bold(!1).left(),p.row(t("kassa.receiptCreditThis"),f(x.amount)),x.balance!=null&&p.row(t("kassa.receiptCreditTotal"),f(x.balance)),x.dueDate&&p.row(t("kassa.receiptCreditDue"),x.dueDate),p.feed().row(t("kassa.receiptCreditSign"),"______________")),d&&p.feed().center().line(t("kassa.receiptOffline")).line(t("kassa.receiptOfflineSub")).left();const E=s.reduce((o,_)=>{const z=Number(_.vatRate);if(!z)return o;const N=Number(_.salePrice)*Number(_.qty);return o+(_.priceIncludesVat===!1?N*z/100:N*z/(100+z))},0);if(E>0&&p.row(t("kassa.receiptVat"),f(E)),m!=null&&m.fiscalSign&&(p.rule(),p.center().line(t("kassa.receiptFiscal")).left(),p.row(t("kassa.receiptFiscalSign"),m.fiscalSign),m.terminalId&&p.row(t("kassa.receiptTerminal"),m.terminalId),m.receiptNo&&p.row(t("kassa.receiptFiscalNo"),m.receiptNo),m.qrUrl&&p.feed().center().qr(m.qrUrl).left()),n){const o=M(n);p.feed().center().barcode128(o).line(o).left()}return k&&p.feed().center().qr(k,6).line(t("kassa.receiptQrHint")).left(),p.rule(),p.center().line(t("kassa.receiptThanks")).line("e-kassam.uz"),p}async function ve(e){const n=v();if(!$())return Y(e);const s=oe(e);n.openDrawer&&e.payType==="CASH"&&s.kick(),s.cut(),await P(s.build())}function le({customer:e,amount:n,balanceAfter:s,method:a,shopName:i,cashier:c,date:r}){const l=v(),u=new q(l.width===58?T:D);return u.center().double().line(i||"E-KASSAM.UZ").double(!1),u.line(t("kassa.receiptDebtPay")),u.left().rule(),u.row(t("common.date"),(r||new Date).toLocaleString("uz-UZ")),c&&u.row(t("kassa.receiptCashier"),c),e!=null&&e.fullName&&u.row(t("kassa.receiptCustomer"),e.fullName),u.rule(),u.bold().double().row(t("kassa.receiptPaid"),f(n)).double(!1).bold(!1),u.row(t("kassa.receiptPayment"),C(a)),u.row(t("kassa.receiptDebtLeft"),f(s??0)),u.rule(),u.center().line(t("kassa.receiptThanks")).line("e-kassam.uz"),u}async function xe(e){const n=v();if(!$())return Y({...e,__debt:!0});const s=le(e);n.openDrawer&&e.method==="CASH"&&s.kick(),s.cut(),await P(s.build())}async function $e({fullName:e,username:n,version:s,token:a,shopName:i}){if(!$())throw new Error(t("hw.errNoDesktop"));const c=v(),r=new q(c.width===58?T:D);r.center().double().line(t("badge.printTitle")).double(!1),r.line(i||"E-KASSAM.UZ"),r.left().rule(),r.center().bold().line(e||n||"-").bold(!1),r.line("@"+(n||"-")),r.line(`${t("badge.version")} ${s??1}`),r.feed(),r.qr(a,8),r.feed(),r.line(new Date().toLocaleString("uz-UZ")),r.left().rule(),r.wrap(t("badge.printWarn")),r.cut(),await P(r.build())}async function ke(e,n){var c;if(!$())throw new Error(t("hw.errNoDesktop"));const s=v(),a=new q(s.width===58?T:D),i=r=>r?new Date(r).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"}):"-";a.center().double().line(e.closedAt?"Z-HISOBOT":"X-HISOBOT").double(!1),a.line(n||"E-KASSAM.UZ"),a.left().rule(),a.row(t("sales.colCashier"),e.cashierName||"-"),a.row(t("sec.openedAt"),i(e.openedAt)),e.closedAt&&a.row(t("shift.closedAt"),i(e.closedAt)),a.rule(),a.row(t("rpt.salesCount"),String(e.salesCount)),a.bold().row(t("rpt.salesTotal"),f(e.salesTotal)).bold(!1);for(const[r,l]of Object.entries(e.byPaymentType||{}))a.row("  "+C(r),f(l));if(a.rule(),a.row(t("rpt.cancelled"),`${e.cancelledCount} / ${f(e.cancelledTotal)}`),a.row(t("rpt.confirmations"),String(e.confirmationsCount)),e.suspiciousCount>0&&a.bold().row(t("rpt.suspicious"),String(e.suspiciousCount)).bold(!1),e.cash&&(a.rule(),a.row(t("cash.openingFloat"),f(e.cash.openingFloat)),e.cash.expectedCash!=null&&a.row(t("cash.expected"),f(e.cash.expectedCash)),e.cash.countedCash!=null&&(a.bold().row(t("cash.counted"),f(e.cash.countedCash)).bold(!1),a.bold().row(t("cash.difference"),f(e.cash.difference)).bold(!1))),(c=e.nonCash)!=null&&c.length){a.rule(),a.line(t("noncash.title"));for(const r of e.nonCash)r.counted==null?a.row("  "+C(r.paymentType),r.expected==null?"-":f(r.expected)):(a.row("  "+C(r.paymentType),`${f(r.expected)} / ${f(r.counted)}`),Number(r.difference)!==0&&a.bold().row("  "+t("cash.difference"),f(r.difference)).bold(!1))}a.rule(),a.center().line(new Date().toLocaleString("uz-UZ")).line("e-kassam.uz"),a.cut(),await P(a.build())}async function ye(){if(!$())throw new Error(t("hw.errNoDesktop"));await P(ne())}async function _e(e=[],n={}){if(!$())throw new Error(t("hw.errNoDesktop"));await P(ce(e,n))}function ce(e=[],{copies:n=1,shopName:s,width:a}={}){const i=(e||[]).filter(Boolean);if(!i.length)throw new Error(t("label.nothing"));const c=v(),r=a??(c.width===58?T:D),l=new q(r),u=Math.max(1,Math.min(20,Number(n)||1));for(const d of i)for(let h=0;h<u;h++)l.center(),s&&l.line(s),l.bold().wrap(d.name||"-").bold(!1),l.feed(),l.double().line(f(d.salePrice)).double(!1),d.oldPrice!=null&&Number(d.oldPrice)>Number(d.salePrice)&&l.line(`${t("label.oldPrice")}: ${f(d.oldPrice)}`),l.feed(),d.barcode&&(l.barcodeEan13(d.barcode)||l.barcode128(d.barcode,{hri:!0}),l.feed()),l.line(new Date().toLocaleDateString("uz-UZ")),l.left().line("- ".repeat(Math.floor(l.width/2)).trimEnd()).center();return l.cut(),l.build()}async function Se(e=[],n={}){const s=(e||[]).filter(Boolean);if(!s.length)throw new Error(t("label.nothing"));if(!$())return ue(s,n);await P(de(s,n))}function de(e=[],{copies:n=1,shopName:s,width:a}={}){const i=(e||[]).filter(Boolean);if(!i.length)throw new Error(t("label.nothing"));const c=v(),r=a??(c.width===58?T:D),l=new q(r),u=Math.max(1,Math.min(20,Number(n)||1));for(const d of i)for(let h=0;h<u;h++)l.center(),s&&l.line(s),l.bold().line(t("label.expiryTitle")).bold(!1),l.bold().wrap(d.name||"-").bold(!1),l.feed(),l.double().line(Q(d.expiryDate)).double(!1),d.daysLeft!=null&&l.line(d.daysLeft<=0?t("label.expiryToday"):t("inv.nearDays",{n:d.daysLeft})),d.salePrice!=null&&l.line(f(d.salePrice)),l.feed(),d.barcode&&(l.barcodeEan13(d.barcode)||l.barcode128(d.barcode,{hri:!0}),l.feed()),l.left().line("- ".repeat(Math.floor(l.width/2)).trimEnd()).center();return l.cut(),l.build()}function ue(e,{shopName:n}={}){const s=window.open("","_blank","width=820,height=900");if(!s)throw new Error(t("hw.errPopup"));const a=c=>String(c??"").replace(/[&<>"]/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[r]),i=e.map(c=>{const r=c.daysLeft,l=r==null?"":r<=0?t("label.expiryToday"):t("inv.nearDays",{n:r});return`<div class="lbl">
      <div class="hdr">${a(t("label.expiryTitle"))}</div>
      <div class="nm">${a(c.name||"-")}</div>
      <div class="dt">${a(Q(c.expiryDate))}</div>
      ${l?`<div class="lf">${a(l)}</div>`:""}
      ${c.salePrice!=null?`<div class="pr">${a(f(c.salePrice))}</div>`:""}
      ${c.barcode?`<div class="bc">${H(String(c.barcode),{height:22})}</div>`:""}
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
    </style></head><body>${i}</body></html>`),s.document.close(),s.onload=()=>{s.focus(),s.print()},Promise.resolve()}async function Ne(e,n={}){if(!e)throw new Error(t("label.nothing"));if(!$())return fe(e,n);await P(pe(e,n))}function pe(e,{shopName:n,width:s}={}){const a=v(),i=new q(s??(a.width===58?T:D));i.center().double().line(t("pickup.slipTitle")).double(!1),n&&i.line(n),i.left().rule(),i.row(`${t("kassa.receiptNo")} ${e.saleCode||"-"}`,e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):""),e.cashierName&&i.row(t("kassa.receiptCashier"),e.cashierName),e.customerName&&i.row(t("kassa.receiptCustomer"),e.customerName),e.customerPhone&&i.row(t("common.phone"),e.customerPhone),i.rule();for(const c of e.items||[])i.wrap(c.productName),i.double().line(`  ${Z(c.quantity)} ${U(c.unit)}`).double(!1);if(i.rule(),e.saleId){const c=M(e.saleId);i.feed().center().barcode128(c).line(c).left()}return i.feed(),i.row(t("pickup.signStore"),"______________"),i.feed().row(t("pickup.signCustomer"),"______________"),i.cut(),i.build()}function fe(e,{shopName:n}={}){const s=window.open("","_blank","width=360,height=640");if(!s)throw new Error(t("hw.errPopup"));const a=v().width===58?58:80,i=r=>String(r??"").replace(/[&<>"]/g,l=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[l]),c=(e.items||[]).map(r=>`<div class="it"><div class="nm">${i(r.productName)}</div>
     <div class="qt">${i(Z(r.quantity))} ${i(U(r.unit))}</div></div>`).join("");return s.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
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
      ${e.saleId?`<div class="c">${H(M(e.saleId),{height:14})}
        <div><b>${i(M(e.saleId))}</b></div></div>`:""}
      <div class="row" style="margin-top:14px"><span>${i(t("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${i(t("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`),s.document.close(),s.onload=()=>{s.focus(),s.print()},Promise.resolve()}async function Ce(){const e=v(),n=new q(e.width===58?T:D);n.center().double().line(t("hw.testTitle")).double(!1),n.line(new Date().toLocaleString("uz-UZ")),n.left().rule();const s=W(e);n.row(t("hw.transport"),s),n.row(t("hw.printer"),s==="tcp"?`${e.host}:${e.port}`:e.printerName||t("hw.defaultPrinter")),n.row(t("hw.width"),`${e.width} mm`),n.rule(),n.line("1234567890".repeat(6).slice(0,n.width)),n.center().line(t("hw.testOk")),n.cut(),await P(n.build())}function Y({saleId:e,serverSaleId:n,cart:s=[],total:a=0,subtotal:i,discount:c=0,payType:r,payments:l,customer:u,offline:d,shopName:h,cashier:S,receiptUrl:m,credit:k,__debt:x,amount:j,balanceAfter:p,method:I,date:B}){const y=window.open("","_blank","width=360,height=640,toolbar=no,menubar=no");if(!y)throw new Error(t("hw.errPopup"));const E=v().width===58?58:80,o=b=>String(b??"").replace(/[&<>"]/g,L=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[L]),_=G(s,c),z=s.reduce((b,L)=>b+(Number(L.discount)||0),0),N=c+z,J=s.map((b,L)=>{const ee=`${Z(b.qty,b.unitDecimals)}${b.unit?" "+U(b.unit):""}`,F=(Number(b.discount)||0)+(_[L]||0);return`<div class="row"><span>${o(b.name)} × ${o(ee)}</span><span>${o(f(b.salePrice*b.qty))}</span></div>`+(F>0?`<div class="row sub"><span>${o(t("kassa.discount"))}</span><span>-${o(f(F))}</span></div>`:"")}).join(""),X=x?`
      <div class="c"><div class="logo">${o(h||"E-KASSAM.UZ")}</div>
        <small>${o(t("kassa.receiptDebtPay"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${o(t("common.date"))}</span><span>${o((B||new Date).toLocaleString("uz-UZ"))}</span></div>
      ${S?`<div class="row"><span>${o(t("kassa.receiptCashier"))}</span><span>${o(S)}</span></div>`:""}
      ${u!=null&&u.fullName?`<div class="row"><span>${o(t("kassa.receiptCustomer"))}</span><span>${o(u.fullName)}</span></div>`:""}
      <div class="hr"></div>
      <div class="row"><b>${o(t("kassa.receiptPaid"))}</b><b>${o(f(j))}</b></div>
      <div class="row"><span>${o(t("kassa.receiptPayment"))}</span><span>${o(C(I))}</span></div>
      <div class="row"><span>${o(t("kassa.receiptDebtLeft"))}</span><span>${o(f(p??0))}</span></div>
      <div class="hr"></div>
      <div class="c"><p>${o(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`:"";y.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${o(x?t("kassa.receiptDebtPay"):t("kassa.receiptNo")+" "+e)}</title>
    <style>
      /* CHEK QOG'OZI - A4 EMAS.
         @page bo'lmasa brauzer chekni A4 sahifaga joylashtiradi, chetiga
         o'z sarlavha-izohini (manzil, sana, bet raqami) qo'shadi va matn
         chek printeriga umuman sig'maydi - aynan shu "noto'g'ri format"
         edi. margin:0 esa brauzerning o'sha sarlavhalarini olib tashlaydi.
         Balandlik auto: chek uzunligi tovar soniga qarab o'zgaradi. */
      @page { size: ${E}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${E}mm; padding: 3mm; }
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
      ${X}
      ${x?"":`
      <div class="c"><div class="logo">${o(h||"E-KASSAM.UZ")}</div>
        <small>${o(t("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${o(t("kassa.receiptNo"))} ${o(e)}</span><span>${o(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${J}
      <div class="hr"></div>
      ${N>0?`<div class="row"><span>${o(t("kassa.receiptSubtotal"))}</span><span>${o(f(i??a+N))}</span></div>
      <div class="row"><span>${o(t("kassa.discount"))}</span><span>-${o(f(N))}</span></div>`:""}
      <div class="row"><b>${o(t("kassa.receiptTotal"))}</b><b>${o(f(a))}</b></div>
      <div class="row"><span>${o(t("kassa.receiptPayment"))}</span><span>${o(C(r))}</span></div>
      ${Array.isArray(l)&&l.length>1?l.map(b=>`<div class="row"><span>&nbsp;&nbsp;${o(C(b.type))}</span><span>${o(f(b.amount))}</span></div>`).join(""):""}
      ${u!=null&&u.fullName?`<div class="row"><span>${o(t("kassa.receiptCustomer"))}</span><span>${o(u.fullName)}</span></div>`:""}
      ${k&&Number(k.amount)>0?`<div class="hr"></div>
      <div class="c"><b>${o(t("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${o(t("kassa.receiptCreditThis"))}</span><b>${o(f(k.amount))}</b></div>
      ${k.balance!=null?`<div class="row"><span>${o(t("kassa.receiptCreditTotal"))}</span><span>${o(f(k.balance))}</span></div>`:""}
      ${k.dueDate?`<div class="row"><span>${o(t("kassa.receiptCreditDue"))}</span><span>${o(k.dueDate)}</span></div>`:""}
      <div class="row" style="margin-top:10px"><span>${o(t("kassa.receiptCreditSign"))}</span><span>______________</span></div>`:""}
      ${d?`<div class="off">${o(t("kassa.receiptOffline"))}<br>${o(t("kassa.receiptOfflineSub"))}</div>`:""}
      ${n?`<div class="c" style="margin-top:6px">
        ${H(M(n),{height:12})}
        <div class="no">${o(M(n))}</div>
      </div>`:""}
      ${m?`<div class="c" style="margin-top:8px">
        ${te(m,{size:96,margin:1})}
        <small>${o(t("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${o(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`}
    </body></html>`),y.document.close(),y.onafterprint=()=>y.close(),setTimeout(()=>y.print(),60)}export{Se as a,Ne as b,xe as c,ke as d,be as e,K as f,re as g,me as h,ve as i,$e as j,ge as l,ye as o,_e as p,we as r,G as s,Ce as t};
