import{at as y,t,E as S,aF as V,m as p,Z as P,v as F,w as K,aG as W,aH as Z,aI as Y,aJ as te,K as ae}from"./index-CiPXGzyd.js";const L=27,b=29,T=48,M=32,k={init:[L,64],alignLeft:[L,97,0],alignCenter:[L,97,1],alignRight:[L,97,2],boldOn:[L,69,1],boldOff:[L,69,0],doubleOn:[b,33,17],doubleOff:[b,33,0],cut:[b,86,66,3],kick:[L,112,0,25,25]};function fe(e){const a=String(e??"").replace(/[‘’ʻʼ′]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g," ").replace(/[\t\r\n\v\f]/g," "),i=[];for(const n of a){const s=n.codePointAt(0);i.push(s<128?s:63)}return i}class A{constructor(a=T){this.width=a,this.bytes=[...k.init]}raw(a){return this.bytes.push(...a),this}left(){return this.raw(k.alignLeft)}center(){return this.raw(k.alignCenter)}right(){return this.raw(k.alignRight)}bold(a=!0){return this.raw(a?k.boldOn:k.boldOff)}double(a=!0){return this.raw(a?k.doubleOn:k.doubleOff)}line(a=""){return this.raw(fe(a)).raw([10])}feed(a=1){for(let i=0;i<a;i++)this.raw([10]);return this}rule(a="-"){return this.line(a.repeat(this.width))}row(a,i){const n=String(a??""),s=String(i??""),c=this.width-s.length;if(c<1)return this.line(s);const r=n.length>c-1?n.slice(0,c-1):n;return this.line(r+" ".repeat(this.width-r.length-s.length)+s)}wrap(a){const i=String(a??"").split(/\s+/).filter(Boolean);let n="";for(const s of i){if(!n.length){n=s;continue}n.length+1+s.length<=this.width?n+=" "+s:(this.line(n),n=s)}return n.length&&this.line(n),this}qr(a,i=8){const n=[];for(const c of String(a??"")){const r=c.codePointAt(0);r<128&&n.push(r)}this.raw([b,40,107,4,0,49,65,50,0]),this.raw([b,40,107,3,0,49,67,Math.max(1,Math.min(16,i))]),this.raw([b,40,107,3,0,49,69,49]);const s=n.length+3;return this.raw([b,40,107,s&255,s>>8&255,49,80,48]),this.raw(n),this.raw([b,40,107,3,0,49,81,48]),this}barcode128(a,{height:i=60,width:n=2,hri:s=!1}={}){const c=String(a??""),r=[];for(const f of c){const d=f.charCodeAt(0);if(d<32||d>127)return this;r.push(d)}if(!r.length)return this;this.raw([b,104,Math.max(1,Math.min(255,i))]),this.raw([b,119,Math.max(2,Math.min(6,n))]),this.raw([b,72,s?2:0]);const l=[123,66,...r];return this.raw([b,107,73,l.length]),this.raw(l),this}barcodeEan13(a){const i=String(a??"").replace(/\D/g,"");if(i.length!==13)return!1;let n=0;for(let r=0;r<12;r++)n+=Number(i[r])*(r%2===0?1:3);if((10-n%10)%10!==Number(i[12]))return!1;this.raw([b,104,60]),this.raw([b,119,2]),this.raw([b,72,2]);const c=[...i].map(r=>r.charCodeAt(0));return this.raw([b,107,67,c.length]),this.raw(c),!0}cut(){return this.feed(4).raw(k.cut)}kick(){return this.bytes.splice(k.init.length,0,...k.kick),this}build(){return this.bytes}}const he=()=>[...k.init,...k.kick],me=e=>Math.max(0,(Number(e.salePrice)||0)*(Number(e.qty)||0)-(Number(e.discount)||0));function ne(e,a){const i=Number(a)||0,n=e.map(()=>0);if(i<=0||!e.length)return n;const s=e.map(me),c=s.reduce((d,m)=>d+m,0);if(c<=0)return n;let r=0,l=0;for(let d=0;d<e.length;d++){const m=Math.floor(i*s[d]/c*100)/100;n[d]=m,r+=m,s[d]>s[l]&&(l=d)}const f=Math.round((i-r)*100)/100;return f!==0&&(n[l]=Math.round((n[l]+f)*100)/100),n}const U=[1e4,5e3,1e3,500];function se(e){const a=Number(e.salePrice)||0,i=Number(e.qty)||0,n=e.minPrice==null?null:Number(e.minPrice);if(n==null||!Number.isFinite(n))return 0;const s=(a-n)*i-(Number(e.discount)||0);return s>0?Math.floor(s):0}const J=e=>(e||[]).reduce((a,i)=>a+se(i),0);function Se(e,a,i=3){const n=Math.round(Number(a)||0),s=J(e);if(n<=0||s<=0)return[];if(n%U[U.length-1]===0)return[];const c=[],r=new Set;for(const l of[...U].reverse()){const f=Math.floor(n/l)*l,d=n-f;if(!(d<=0||d>s)&&!r.has(f)&&(r.add(f),c.push({target:f,discount:d}),c.length>=i))break}return c}function Ce(e,a,i,n=3){const s=Math.round(Number(a)||0),c=Math.min(Math.round(Number(i)||0),J(e));if(s<=0||c<=0)return[];const r=s-c,l=[],f=new Set;for(const d of U){const m=Math.ceil(r/d)*d;if(m<=0||m>s)continue;const _=s-m;if(!(_<=0||_>c)&&!f.has(m)&&(f.add(m),l.push({target:m,discount:_,step:d}),l.length>=n))break}return l}function we(e){const a=Number(e.salePrice)||0,i=Number(e.qty)||0,n=e.costPrice==null?null:Number(e.costPrice);if(n==null||!Number.isFinite(n))return se(e);const s=(a-n)*i-(Number(e.discount)||0);return s>0?Math.floor(s):0}const be=e=>(e||[]).reduce((a,i)=>a+we(i),0);function De(e,a){const i=Math.round(Number(a)||0);return i<=0?"ok":i>be(e)?"loss":i>J(e)?"over":"ok"}async function ze(){if(!S())return[];try{return await V("list_printers")||[]}catch{return[]}}function ie(e){return S()?e.transport==="tcp"?"tcp":"windows":"browser"}async function q(e){const a=y();if(!S())throw new Error(t("hw.errNoDesktop"));if(ie(a)==="tcp"){if(!a.host)throw new Error(t("hw.errNoHost"));return V("print_tcp",{host:a.host,port:Number(a.port)||9100,data:e})}return V("print_raw",{printer:a.printerName||null,data:e})}function ge({saleId:e,serverSaleId:a,cart:i=[],total:n=0,subtotal:s,discount:c=0,payType:r,payments:l,customer:f,offline:d,shopName:m,cashier:_,fiscal:g,receiptUrl:x,credit:$,toSavings:h}){const D=y(),u=new A(D.width===58?M:T),O=Y(m);u.center().double().line(O.name).double(!1),O.phone&&u.line(O.phone),u.line(t("kassa.receiptSystem")),u.left().rule(),u.row(`${t("kassa.receiptNo")} ${e??"-"}`,new Date().toLocaleString("uz-UZ")),_&&u.row(t("kassa.receiptCashier"),_),u.rule();const Q=ne(i,c);i.forEach((w,C)=>{u.wrap(w.name);const z=`${F(w.qty,w.unitDecimals)}${w.unit?" "+K(w.unit):""}`;u.row(`  ${z} x ${p(w.salePrice)}`,p(w.salePrice*w.qty));const N=(Number(w.discount)||0)+(Q[C]||0);N>0&&u.row(`    ${t("kassa.discount")}`,"-"+p(N))}),u.rule();const R=i.reduce((w,C)=>w+(Number(C.discount)||0),0),I=c+R;if(I>0&&(u.row(t("kassa.receiptSubtotal"),p(s??n+I)),u.row(t("kassa.discount"),"-"+p(I))),u.bold().double().row(t("kassa.receiptTotal"),p(n)).double(!1).bold(!1),u.row(t("kassa.receiptPayment"),P(r)),Array.isArray(l)&&l.length>1)for(const w of l)u.row("  "+P(w.type),p(w.amount));Number(h)>0&&u.row(t("savings.toSavings"),"+"+p(h)),f!=null&&f.fullName&&u.row(t("kassa.receiptCustomer"),f.fullName),$&&Number($.amount)>0&&(u.rule(),u.center().bold().line(t("kassa.receiptCredit")).bold(!1).left(),u.row(t("kassa.receiptCreditThis"),p($.amount)),$.balance!=null&&u.row(t("kassa.receiptCreditTotal"),p($.balance)),$.dueDate&&u.row(t("kassa.receiptCreditDue"),$.dueDate),u.feed().row(t("kassa.receiptCreditSign"),"______________")),d&&u.feed().center().line(t("kassa.receiptOffline")).line(t("kassa.receiptOfflineSub")).left();const E=i.reduce((w,C)=>{const z=Number(C.vatRate);if(!z)return w;const N=Number(C.salePrice)*Number(C.qty);return w+(C.priceIncludesVat===!1?N*z/100:N*z/(100+z))},0);if(E>0&&u.row(t("kassa.receiptVat"),p(E)),g!=null&&g.fiscalSign&&(u.rule(),u.center().line(t("kassa.receiptFiscal")).left(),u.row(t("kassa.receiptFiscalSign"),g.fiscalSign),g.terminalId&&u.row(t("kassa.receiptTerminal"),g.terminalId),g.receiptNo&&u.row(t("kassa.receiptFiscalNo"),g.receiptNo),g.qrUrl&&u.feed().center().qr(g.qrUrl).left()),a){const w=Z(a);u.feed().center().barcode128(w).line(w).left()}return x&&u.feed().center().qr(x,6).line(t("kassa.receiptQrHint")).left(),u.rule(),u.center().line(t("kassa.receiptThanks")).line("e-kassam.uz"),u}async function Pe(e){const a=y();if(!S())return oe(e);const i=ge(e);a.openDrawer&&e.payType==="CASH"&&i.kick(),i.cut(),await q(i.build())}function re(e){const a=String(e||"").startsWith("SAVINGS_");if(!a)return{sav:a,title:t("kassa.receiptDebtPay"),main:t("kassa.receiptPaid"),before:t("credit.wasDebt"),after:t("kassa.receiptDebtLeft")};const i=String(e).slice(8);return{sav:a,title:t("savings.receiptTitle"),main:t(`savings.rcp.${i}`),before:t("savings.wasBalance"),after:t("savings.nowBalance")}}function ve({customer:e,amount:a,balanceAfter:i,balanceBefore:n,method:s,shopName:c,cashier:r,date:l,receiptNo:f,qrUrl:d,toSavings:m,bonusEarned:_,kind:g,linkedNo:x}){const $=y(),h=new A($.width===58?M:T),D=re(g),u=Y(c);return h.center().double().line(u.name).double(!1),u.phone&&h.line(u.phone),h.line(D.title),h.left().rule(),f&&h.row(t("kassa.receiptNo"),f),h.row(t("common.date"),(l||new Date).toLocaleString("uz-UZ")),r&&h.row(t("kassa.receiptCashier"),r),e!=null&&e.fullName&&h.row(t("kassa.receiptCustomer"),e.fullName),h.rule(),h.bold().double().row(D.main,p(Math.abs(Number(a)||0))).double(!1).bold(!1),(s||!D.sav)&&h.row(t("kassa.receiptPayment"),P(s)),x&&h.row(t("savings.linkedSale"),x),n!=null&&h.row(D.before,p(n)),h.row(D.after,p(i??0)),Number(m)>0&&h.row(t("savings.toSavings"),p(m)),Number(_)>0&&h.row(t("kassa.receiptBonusEarned"),"+"+p(_)),d&&(h.rule(),h.center().line(t("kassa.receiptQrHint")),h.qr(d,6)),h.rule(),h.center().line(t("kassa.receiptThanks")).line("e-kassam.uz"),h}async function Te(e){const a=y();if(!S())return oe({...e,__debt:!0});const i=ve(e);a.openDrawer&&e.method==="CASH"&&i.kick(),i.cut(),await q(i.build())}async function qe({fullName:e,username:a,version:i,token:n,shopName:s}){if(!S())throw new Error(t("hw.errNoDesktop"));const c=y(),r=new A(c.width===58?M:T);r.center().double().line(t("badge.printTitle")).double(!1),r.line(s||"E-KASSAM.UZ"),r.left().rule(),r.center().bold().line(e||a||"-").bold(!1),r.line("@"+(a||"-")),r.line(`${t("badge.version")} ${i??1}`),r.feed(),r.qr(n,8),r.feed(),r.line(new Date().toLocaleString("uz-UZ")),r.left().rule(),r.wrap(t("badge.printWarn")),r.cut(),await q(r.build())}async function Me(e,a){var c;if(!S())throw new Error(t("hw.errNoDesktop"));const i=y(),n=new A(i.width===58?M:T),s=r=>r?new Date(r).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"}):"-";n.center().double().line(e.closedAt?"Z-HISOBOT":"X-HISOBOT").double(!1),n.line(a||"E-KASSAM.UZ"),n.left().rule(),n.row(t("sales.colCashier"),e.cashierName||"-"),n.row(t("sec.openedAt"),s(e.openedAt)),e.closedAt&&n.row(t("shift.closedAt"),s(e.closedAt)),n.rule(),n.row(t("rpt.salesCount"),String(e.salesCount)),n.bold().row(t("rpt.salesTotal"),p(e.salesTotal)).bold(!1);for(const[r,l]of Object.entries(e.byPaymentType||{}))n.row("  "+P(r),p(l));if(n.rule(),n.row(t("rpt.cancelled"),`${e.cancelledCount} / ${p(e.cancelledTotal)}`),n.row(t("rpt.confirmations"),String(e.confirmationsCount)),e.suspiciousCount>0&&n.bold().row(t("rpt.suspicious"),String(e.suspiciousCount)).bold(!1),e.cash&&(n.rule(),n.row(t("cash.openingFloat"),p(e.cash.openingFloat)),e.cash.expectedCash!=null&&n.row(t("cash.expected"),p(e.cash.expectedCash)),e.cash.countedCash!=null&&(n.bold().row(t("cash.counted"),p(e.cash.countedCash)).bold(!1),n.bold().row(t("cash.difference"),p(e.cash.difference)).bold(!1))),(c=e.nonCash)!=null&&c.length){n.rule(),n.line(t("noncash.title"));for(const r of e.nonCash)r.counted==null?n.row("  "+P(r.paymentType),r.expected==null?"-":p(r.expected)):(n.row("  "+P(r.paymentType),`${p(r.expected)} / ${p(r.counted)}`),Number(r.difference)!==0&&n.bold().row("  "+t("cash.difference"),p(r.difference)).bold(!1))}n.rule(),n.center().line(new Date().toLocaleString("uz-UZ")).line("e-kassam.uz"),n.cut(),await q(n.build())}async function Ae(){if(!S())throw new Error(t("hw.errNoDesktop"));await q(he())}async function Ee(e=[],a={}){if(!S())throw new Error(t("hw.errNoDesktop"));await q($e(e,a))}function $e(e=[],{copies:a=1,shopName:i,width:n}={}){const s=(e||[]).filter(Boolean);if(!s.length)throw new Error(t("label.nothing"));const c=y(),r=n??(c.width===58?M:T),l=new A(r),f=Math.max(1,Math.min(20,Number(a)||1));for(const d of s)for(let m=0;m<f;m++)l.center(),i&&l.line(i),l.bold().wrap(d.name||"-").bold(!1),l.feed(),l.double().line(p(d.salePrice)).double(!1),d.oldPrice!=null&&Number(d.oldPrice)>Number(d.salePrice)&&l.line(`${t("label.oldPrice")}: ${p(d.oldPrice)}`),l.feed(),d.barcode&&(l.barcodeEan13(d.barcode)||l.barcode128(d.barcode,{hri:!0}),l.feed()),l.line(new Date().toLocaleDateString("uz-UZ")),l.left().line("- ".repeat(Math.floor(l.width/2)).trimEnd()).center();return l.cut(),l.build()}async function Le(e=[],a={}){const i=(e||[]).filter(Boolean);if(!i.length)throw new Error(t("label.nothing"));if(!S())return ke(i,a);await q(xe(i,a))}function xe(e=[],{copies:a=1,shopName:i,width:n}={}){const s=(e||[]).filter(Boolean);if(!s.length)throw new Error(t("label.nothing"));const c=y(),r=n??(c.width===58?M:T),l=new A(r),f=Math.max(1,Math.min(20,Number(a)||1));for(const d of s)for(let m=0;m<f;m++)l.center(),i&&l.line(i),l.bold().line(t("label.expiryTitle")).bold(!1),l.bold().wrap(d.name||"-").bold(!1),l.feed(),l.double().line(ae(d.expiryDate)).double(!1),d.daysLeft!=null&&l.line(d.daysLeft<=0?t("label.expiryToday"):t("inv.nearDays",{n:d.daysLeft})),d.salePrice!=null&&l.line(p(d.salePrice)),l.feed(),d.barcode&&(l.barcodeEan13(d.barcode)||l.barcode128(d.barcode,{hri:!0}),l.feed()),l.left().line("- ".repeat(Math.floor(l.width/2)).trimEnd()).center();return l.cut(),l.build()}function ke(e,{shopName:a}={}){const i=window.open("","_blank","width=820,height=900");if(!i)throw new Error(t("hw.errPopup"));const n=c=>String(c??"").replace(/[&<>"]/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[r]),s=e.map(c=>{const r=c.daysLeft,l=r==null?"":r<=0?t("label.expiryToday"):t("inv.nearDays",{n:r});return`<div class="lbl">
      <div class="hdr">${n(t("label.expiryTitle"))}</div>
      <div class="nm">${n(c.name||"-")}</div>
      <div class="dt">${n(ae(c.expiryDate))}</div>
      ${l?`<div class="lf">${n(l)}</div>`:""}
      ${c.salePrice!=null?`<div class="pr">${n(p(c.salePrice))}</div>`:""}
      ${c.barcode?`<div class="bc">${W(String(c.barcode),{height:22})}</div>`:""}
      ${a?`<div class="sh">${n(a)}</div>`:""}
    </div>`}).join("");return i.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${n(t("label.expiryTitle"))}</title>
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
    </style></head><body>${s}</body></html>`),i.document.close(),i.onload=()=>{i.focus(),i.print()},Promise.resolve()}async function Oe(e,a={}){if(!e)throw new Error(t("label.nothing"));if(!S())return _e(e,a);await q(ye(e,a))}function ye(e,{shopName:a,width:i}={}){const n=y(),s=new A(i??(n.width===58?M:T));s.center().double().line(t("pickup.slipTitle")).double(!1),a&&s.line(a),s.left().rule(),s.row(`${t("kassa.receiptNo")} ${e.saleCode||"-"}`,e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):""),e.cashierName&&s.row(t("kassa.receiptCashier"),e.cashierName),e.customerName&&s.row(t("kassa.receiptCustomer"),e.customerName),e.customerPhone&&s.row(t("common.phone"),e.customerPhone),s.rule();for(const c of e.items||[])s.wrap(c.productName),s.double().line(`  ${F(c.quantity)} ${K(c.unit)}`).double(!1);if(s.rule(),e.saleId){const c=Z(e.saleId);s.feed().center().barcode128(c).line(c).left()}return s.feed(),s.row(t("pickup.signStore"),"______________"),s.feed().row(t("pickup.signCustomer"),"______________"),s.cut(),s.build()}function _e(e,{shopName:a}={}){const i=window.open("","_blank","width=360,height=640");if(!i)throw new Error(t("hw.errPopup"));const n=y().width===58?58:80,s=r=>String(r??"").replace(/[&<>"]/g,l=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[l]),c=(e.items||[]).map(r=>`<div class="it"><div class="nm">${s(r.productName)}</div>
     <div class="qt">${s(F(r.quantity))} ${s(K(r.unit))}</div></div>`).join("");return i.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${s(t("pickup.slipTitle"))} ${s(e.saleCode||"")}</title>
    <style>
      @page { size: ${n}mm auto; margin: 0; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
             font-variant-numeric: tabular-nums; font-size:12px; line-height:1.35;
             color:#000; width:${n}mm; padding:3mm; }
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
      <div class="c"><div class="ttl">${s(t("pickup.slipTitle"))}</div>
        ${a?`<small>${s(a)}</small>`:""}</div>
      <div class="hr"></div>
      <div class="row"><b>${s(t("kassa.receiptNo"))} ${s(e.saleCode||"-")}</b>
        <span>${s(e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):"")}</span></div>
      ${e.cashierName?`<div class="row"><span>${s(t("kassa.receiptCashier"))}</span><span>${s(e.cashierName)}</span></div>`:""}
      ${e.customerName?`<div class="row"><span>${s(t("kassa.receiptCustomer"))}</span><span>${s(e.customerName)}</span></div>`:""}
      ${e.customerPhone?`<div class="row"><span>${s(t("common.phone"))}</span><span>${s(e.customerPhone)}</span></div>`:""}
      <div class="hr"></div>
      ${c}
      <div class="hr"></div>
      ${e.saleId?`<div class="c">${W(Z(e.saleId),{height:14})}
        <div><b>${s(Z(e.saleId))}</b></div></div>`:""}
      <div class="row" style="margin-top:14px"><span>${s(t("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${s(t("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`),i.document.close(),i.onload=()=>{i.focus(),i.print()},Promise.resolve()}async function Ie(){const e=y(),a=new A(e.width===58?M:T);a.center().double().line(t("hw.testTitle")).double(!1),a.line(new Date().toLocaleString("uz-UZ")),a.left().rule();const i=ie(e);a.row(t("hw.transport"),i),a.row(t("hw.printer"),i==="tcp"?`${e.host}:${e.port}`:e.printerName||t("hw.defaultPrinter")),a.row(t("hw.width"),`${e.width} mm`),a.rule(),a.line("1234567890".repeat(6).slice(0,a.width)),a.center().line(t("hw.testOk")),a.cut(),await q(a.build())}function oe({saleId:e,serverSaleId:a,cart:i=[],total:n=0,subtotal:s,discount:c=0,payType:r,payments:l,customer:f,offline:d,shopName:m,cashier:_,receiptUrl:g,credit:x,__debt:$,amount:h,balanceAfter:D,balanceBefore:u,method:O,date:Q,receiptNo:R,qrUrl:I,toSavings:E,bonusEarned:w,kind:C,linkedNo:z}){const N=window.open("","_blank","width=360,height=640,toolbar=no,menubar=no");if(!N)throw new Error(t("hw.errPopup"));const j=re(C),X=y().width===58?58:80,B=Y(m),o=v=>String(v??"").replace(/[&<>"]/g,H=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[H]),le=ne(i,c),ce=i.reduce((v,H)=>v+(Number(H.discount)||0),0),G=c+ce,de=i.map((v,H)=>{const ue=`${F(v.qty,v.unitDecimals)}${v.unit?" "+K(v.unit):""}`,ee=(Number(v.discount)||0)+(le[H]||0);return`<div class="row"><span>${o(v.name)} × ${o(ue)}</span><span>${o(p(v.salePrice*v.qty))}</span></div>`+(ee>0?`<div class="row sub"><span>${o(t("kassa.discount"))}</span><span>-${o(p(ee))}</span></div>`:"")}).join(""),pe=$?`
      <div class="c"><div class="logo">${o(B.name)}</div>
        ${B.phone?`<small>${o(B.phone)}</small><br>`:""}
        <small>${o(j.title)}</small></div>
      <div class="hr"></div>
      ${R?`<div class="row"><span>${o(t("kassa.receiptNo"))}</span><span>${o(R)}</span></div>`:""}
      <div class="row"><span>${o(t("common.date"))}</span><span>${o((Q||new Date).toLocaleString("uz-UZ"))}</span></div>
      ${_?`<div class="row"><span>${o(t("kassa.receiptCashier"))}</span><span>${o(_)}</span></div>`:""}
      ${f!=null&&f.fullName?`<div class="row"><span>${o(t("kassa.receiptCustomer"))}</span><span>${o(f.fullName)}</span></div>`:""}
      <div class="hr"></div>
      <div class="row"><b>${o(j.main)}</b><b>${o(p(Math.abs(Number(h)||0)))}</b></div>
      ${O||!j.sav?`<div class="row"><span>${o(t("kassa.receiptPayment"))}</span><span>${o(P(O))}</span></div>`:""}
      ${z?`<div class="row"><span>${o(t("savings.linkedSale"))}</span><span>${o(z)}</span></div>`:""}
      ${u!=null?`<div class="row"><span>${o(j.before)}</span><span>${o(p(u))}</span></div>`:""}
      <div class="row"><span>${o(j.after)}</span><span>${o(p(D??0))}</span></div>
      ${Number(E)>0?`<div class="row"><span>${o(t("savings.toSavings"))}</span><span>${o(p(E))}</span></div>`:""}
      ${Number(w)>0?`<div class="row"><span>${o(t("kassa.receiptBonusEarned"))}</span><span>+${o(p(w))}</span></div>`:""}
      ${I?`<div class="hr"></div><div class="c">
        ${te(I,{size:96,margin:1})}
        <small>${o(t("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${o(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`:"";N.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${o($?j.title:t("kassa.receiptNo")+" "+e)}</title>
    <style>
      /* CHEK QOG'OZI - A4 EMAS.
         @page bo'lmasa brauzer chekni A4 sahifaga joylashtiradi, chetiga
         o'z sarlavha-izohini (manzil, sana, bet raqami) qo'shadi va matn
         chek printeriga umuman sig'maydi - aynan shu "noto'g'ri format"
         edi. margin:0 esa brauzerning o'sha sarlavhalarini olib tashlaydi.
         Balandlik auto: chek uzunligi tovar soniga qarab o'zgaradi. */
      @page { size: ${X}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${X}mm; padding: 3mm; }
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
      ${pe}
      ${$?"":`
      <div class="c"><div class="logo">${o(B.name)}</div>
        ${B.phone?`<small>${o(B.phone)}</small><br>`:""}
        <small>${o(t("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${o(t("kassa.receiptNo"))} ${o(e)}</span><span>${o(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${de}
      <div class="hr"></div>
      ${G>0?`<div class="row"><span>${o(t("kassa.receiptSubtotal"))}</span><span>${o(p(s??n+G))}</span></div>
      <div class="row"><span>${o(t("kassa.discount"))}</span><span>-${o(p(G))}</span></div>`:""}
      <div class="row"><b>${o(t("kassa.receiptTotal"))}</b><b>${o(p(n))}</b></div>
      <div class="row"><span>${o(t("kassa.receiptPayment"))}</span><span>${o(P(r))}</span></div>
      ${Array.isArray(l)&&l.length>1?l.map(v=>`<div class="row"><span>&nbsp;&nbsp;${o(P(v.type))}</span><span>${o(p(v.amount))}</span></div>`).join(""):""}
      ${Number(E)>0&&!$?`<div class="row"><span>${o(t("savings.toSavings"))}</span><span>+${o(p(E))}</span></div>`:""}
      ${f!=null&&f.fullName?`<div class="row"><span>${o(t("kassa.receiptCustomer"))}</span><span>${o(f.fullName)}</span></div>`:""}
      ${x&&Number(x.amount)>0?`<div class="hr"></div>
      <div class="c"><b>${o(t("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${o(t("kassa.receiptCreditThis"))}</span><b>${o(p(x.amount))}</b></div>
      ${x.balance!=null?`<div class="row"><span>${o(t("kassa.receiptCreditTotal"))}</span><span>${o(p(x.balance))}</span></div>`:""}
      ${x.dueDate?`<div class="row"><span>${o(t("kassa.receiptCreditDue"))}</span><span>${o(x.dueDate)}</span></div>`:""}
      <div class="row" style="margin-top:10px"><span>${o(t("kassa.receiptCreditSign"))}</span><span>______________</span></div>`:""}
      ${d?`<div class="off">${o(t("kassa.receiptOffline"))}<br>${o(t("kassa.receiptOfflineSub"))}</div>`:""}
      ${a?`<div class="c" style="margin-top:6px">
        ${W(Z(a),{height:12})}
        <div class="no">${o(Z(a))}</div>
      </div>`:""}
      ${g?`<div class="c" style="margin-top:8px">
        ${te(g,{size:96,margin:1})}
        <small>${o(t("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${o(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`}
    </body></html>`),N.document.close(),N.onafterprint=()=>N.close(),setTimeout(()=>N.print(),60)}export{Le as a,Oe as b,Te as c,Me as d,Ce as e,J as f,be as g,De as h,Pe as i,qe as j,ze as l,Ae as o,Ee as p,Se as r,ne as s,Ie as t};
