import{af as S,t as i,T as C,aK as J,m as h,a4 as D,aL as ne,E as Q,G as V,aM as ue,aN as ae,aO as H,w as he}from"./index-B02xXjyg.js";const R=27,y=29,z=48,A=32,N={init:[R,64],alignLeft:[R,97,0],alignCenter:[R,97,1],alignRight:[R,97,2],boldOn:[R,69,1],boldOff:[R,69,0],doubleOn:[y,33,17],doubleOff:[y,33,0],cut:[y,86,66,3],kick:[R,112,0,25,25]};function Ne(e){const n=String(e??"").replace(/[‘’ʻʼ′]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g," ").replace(/[\t\r\n\v\f]/g," "),t=[];for(const a of n){const s=a.codePointAt(0);t.push(s<128?s:63)}return t}class L{constructor(n=z){this.width=n,this.bytes=[...N.init]}raw(n){return this.bytes.push(...n),this}left(){return this.raw(N.alignLeft)}center(){return this.raw(N.alignCenter)}right(){return this.raw(N.alignRight)}bold(n=!0){return this.raw(n?N.boldOn:N.boldOff)}double(n=!0){return this.raw(n?N.doubleOn:N.doubleOff)}line(n=""){return this.raw(Ne(n)).raw([10])}feed(n=1){for(let t=0;t<n;t++)this.raw([10]);return this}rule(n="-"){return this.line(n.repeat(this.width))}row(n,t){const a=String(n??""),s=String(t??""),o=this.width-s.length;if(o<1)return this.line(s);const r=a.length>o-1?a.slice(0,o-1):a;return this.line(r+" ".repeat(this.width-r.length-s.length)+s)}wrap(n){const t=String(n??"").split(/\s+/).filter(Boolean);let a="";for(const s of t){if(!a.length){a=s;continue}a.length+1+s.length<=this.width?a+=" "+s:(this.line(a),a=s)}return a.length&&this.line(a),this}qr(n,t=8){const a=[];for(const o of String(n??"")){const r=o.codePointAt(0);r<128&&a.push(r)}this.raw([y,40,107,4,0,49,65,50,0]),this.raw([y,40,107,3,0,49,67,Math.max(1,Math.min(16,t))]),this.raw([y,40,107,3,0,49,69,49]);const s=a.length+3;return this.raw([y,40,107,s&255,s>>8&255,49,80,48]),this.raw(a),this.raw([y,40,107,3,0,49,81,48]),this}barcode128(n,{height:t=60,width:a=2,hri:s=!1}={}){const o=String(n??""),r=[];for(const p of o){const u=p.charCodeAt(0);if(u<32||u>127)return this;r.push(u)}if(!r.length)return this;this.raw([y,104,Math.max(1,Math.min(255,t))]),this.raw([y,119,Math.max(2,Math.min(6,a))]),this.raw([y,72,s?2:0]);const c=[123,66,...r];return this.raw([y,107,73,c.length]),this.raw(c),this}barcodeEan13(n){const t=String(n??"").replace(/\D/g,"");if(t.length!==13)return!1;let a=0;for(let r=0;r<12;r++)a+=Number(t[r])*(r%2===0?1:3);if((10-a%10)%10!==Number(t[12]))return!1;this.raw([y,104,60]),this.raw([y,119,2]),this.raw([y,72,2]);const o=[...t].map(r=>r.charCodeAt(0));return this.raw([y,107,67,o.length]),this.raw(o),!0}cut(){return this.feed(4).raw(N.cut)}kick(){return this.bytes.splice(N.init.length,0,...N.kick),this}build(){return this.bytes}}const Se=()=>[...N.init,...N.kick],G=[{step:1e3,score:100},{step:500,score:80},{step:100,score:60},{step:50,score:40}],qe=10,se=G[0].score;function Z(e,n=G){const t=Math.round(Number(e)||0);if(t<=0)return se;for(const a of n)if(t%a.step===0)return a.score;return qe}function ie(e,n=G){let t=0,a=0;for(const s of e||[]){const o=Number(s.unitRefund)||0,r=Number(s.qty)||0,c=Math.max(0,o*r);c<=0||(a+=Z(o,n)*c,t+=c)}return t>0?a/t:se}const Te=1e3,Ce=.02;function Ze(e,n={}){const t=Math.round(Number(e)||0);if(t<=0||Z(t)>=se)return null;const a=Math.min(n.maxCut==null?Te:n.maxCut,t*(n.maxShare==null?Ce:n.maxShare));if(a<1)return null;for(const s of G){const o=Math.floor(t/s.step)*s.step;if(o<=0||o>=t)continue;const r=t-o;if(r<=a)return{amount:o,cut:r,score:s.score}}return null}const ee=e=>Math.floor((Number(e)||0)*100)/100;function Me(e,n){const t=Number(e)||0,a=Number(n)||0;return a<=0||t<=0?0:ee(t/a)}function Fe(e,n,t,a){const s=Number(a)||0;if(s<=0)return 0;const o=Number(n)||0,r=Number(t)||0,c=Me(e,o);if(r+s>=o){const p=ee(c*r),u=Math.round(((Number(e)||0)-p)*100)/100;return u>0?u:0}return ee(c*s)}const Pe=e=>Math.max(0,(Number(e.salePrice)||0)*(Number(e.qty)||0)-(Number(e.discount)||0));function me(e,n){const t=Number(n)||0,a=e.map(()=>0);if(t<=0||!e.length)return a;const s=e.map(Pe),o=s.reduce((u,g)=>u+g,0);if(o<=0)return a;let r=0,c=0;for(let u=0;u<e.length;u++){const g=Math.floor(t*s[u]/o*100)/100;a[u]=g,r+=g,s[u]>s[c]&&(c=u)}const p=Math.round((t-r)*100)/100;return p!==0&&(a[c]=Math.round((a[c]+p)*100)/100),a}const Y=[1e4,5e3,1e3,500];function re(e){const n=Number(e.salePrice)||0,t=Number(e.qty)||0,a=e.minPrice==null?null:Number(e.minPrice);if(a==null||!Number.isFinite(a))return 0;const s=(n-a)*t-(Number(e.discount)||0);return s>0?Math.floor(s):0}const oe=e=>(e||[]).reduce((n,t)=>n+re(t),0);function Ge(e,n,t=3){const a=Math.round(Number(n)||0),s=oe(e);if(a<=0||s<=0)return[];if(a%Y[Y.length-1]===0)return[];const o=[],r=new Set;for(const c of[...Y].reverse()){const p=Math.floor(a/c)*c,u=a-p;if(!(u<=0||u>s)&&!r.has(p)&&(r.add(p),o.push({target:p,discount:u}),o.length>=t))break}return o}function De(e){const n=Number(e.salePrice)||0,t=Number(e.qty)||0,a=e.costPrice==null?null:Number(e.costPrice);if(a==null||!Number.isFinite(a))return re(e);const s=(n-a)*t-(Number(e.discount)||0);return s>0?Math.floor(s):0}const ze=e=>(e||[]).reduce((n,t)=>n+De(t),0);function Ke(e,n){const t=Math.round(Number(n)||0);return t<=0?"ok":t>ze(e)?"loss":t>oe(e)?"over":"ok"}const _=e=>Math.round((Number(e)||0)*100)/100,T=.005;function we(e){const n=Number(e.salePrice)||0,t=Number(e.qty)||0,a=_(Math.max(0,n*t-(Number(e.discount)||0))),s=re(e);return{price:n,qty:t,paid:a,room:s,unit:t>0?a/t:0}}function de(e,n,t){const a=e.map(()=>0),s=[];e.forEach((r,c)=>{if(r.qty<=0||r.paid<=0)return;const p=Math.floor(r.unit/n)*n;if(p<=0)return;const u=_(r.paid-p*r.qty);if(u<=T||u>r.room+T)return;const g=(Z(p)-Z(r.unit))*r.paid;g<=0||s.push({i:c,cost:u,gain:g})}),s.sort((r,c)=>c.gain/c.cost-r.gain/r.cost||r.cost-c.cost);let o=0;for(const r of s)o+r.cost>t+T||(a[r.i]=r.cost,o=_(o+r.cost));return a}function pe(e,n,t,a){const s=a.slice(),o=e.map((d,$)=>Math.max(0,d.room-s[$])),r=o.reduce((d,$)=>d+$,0),c=s.reduce((d,$)=>d+$,0),p=Math.min(t-c,r);if(p<=T)return s;const u=_(e.reduce((d,$,f)=>d+$.paid-s[f],0)),g=Math.ceil((u-p)/n)*n,b=_(u-g);if(b<=T||b>p+T)return s;let m=0,w=0;for(let d=0;d<e.length;d++){const $=Math.min(o[d],_(b*o[d]/r));s[d]=_(s[d]+$),m=_(m+$),o[d]>o[w]&&(w=d)}const v=_(b-m);return v>0&&(s[w]=_(Math.min(e[w].room,s[w]+v))),s}function Ee(e,n){const t=e.map((m,w)=>({paid:_(m.paid-n[w]),qty:m.qty})),a=t.map(m=>m.qty>0?m.paid/m.qty:0),s=ie(t.map((m,w)=>({unitRefund:a[w],qty:m.qty})));let o=0,r=0;t.forEach((m,w)=>{m.paid<=0||(o++,Z(a[w])>=60&&r++)});const c=o?r/o:1,p=_(t.reduce((m,w)=>m+w.paid,0));let u=1,g=0;e.forEach((m,w)=>{if(m.paid<=0)return;const v=n[w]/m.paid;v<u&&(u=v),v>g&&(g=v)});const b=o?Math.max(0,Math.min(1,1-(g-u))):1;return{refund:s,roundItems:c,roundTotal:Z(p),even:b,total:p}}function Ae(e,n){const t=a=>Math.round(a*100)/100;return t(n.score.refund)-t(e.score.refund)||t(n.score.roundItems)-t(e.score.roundItems)||n.score.roundTotal-e.score.roundTotal||n.discount-e.discount||t(n.score.even)-t(e.score.even)}function Qe(e,n,t=3){const a=Math.min(Math.round(Number(n)||0),oe(e));if(!(e!=null&&e.length)||a<=0)return[];const s=e.map(we);if(s.every(b=>b.paid<=0))return[];const o=ie(s.map(b=>({unitRefund:b.unit,qty:b.qty}))),r=s.map(()=>0),c=G.map(b=>b.step),p=[];for(const b of c)p.push(de(s,b,a));for(const b of c)p.push(pe(s,b,a,r));for(const b of c){const m=de(s,b,a);if(!m.every(w=>w<=T))for(const w of c)p.push(pe(s,w,a,m))}const u=new Set,g=[];for(const b of p){const m=_(b.reduce((d,$)=>d+$,0));if(m<=T||m>a+T||b.some((d,$)=>d<-T||d>s[$].room+T))continue;const w=b.map(d=>d.toFixed(2)).join("|");if(u.has(w))continue;u.add(w);const v=Ee(s,b);v.refund<o-T||g.push({discount:m,total:v.total,add:b,units:s.map((d,$)=>d.qty>0?_((d.paid-b[$])/d.qty):0),score:v,gain:Math.round(v.refund-o)})}return g.sort(Ae),g.slice(0,t)}function Ve(e){const n=(e||[]).map(we);return ie(n.map(t=>({unitRefund:t.unit,qty:t.qty})))}async function We(){if(!C())return[];try{return await J("list_printers")||[]}catch{return[]}}function be(e){return C()?e.transport==="tcp"?"tcp":"windows":"browser"}let te=null;const Xe=()=>te;function fe(e,n){te={ok:e,at:Date.now(),error:n?String(n.message||n):null};try{window.dispatchEvent(new CustomEvent("ek:printer",{detail:te}))}catch{}}async function E(e){const n=S();if(!C())throw new Error(i("hw.errNoDesktop"));try{let t;if(be(n)==="tcp"){if(!n.host)throw new Error(i("hw.errNoHost"));t=await J("print_tcp",{host:n.host,port:Number(n.port)||9100,data:e})}else t=await J("print_raw",{printer:n.printerName||null,data:e});return fe(!0,null),t}catch(t){throw fe(!1,t),t}}function Le({saleId:e,serverSaleId:n,cart:t=[],total:a=0,subtotal:s,discount:o=0,payType:r,payments:c,customer:p,offline:u,shopName:g,cashier:b,fiscal:m,receiptUrl:w,credit:v,toSavings:d}){const $=S(),f=new L($.width===58?A:z),I=ne(g);f.center().double().line(I.name).double(!1),I.phone&&f.line(I.phone),f.line(i("kassa.receiptSystem")),f.left().rule(),f.row(`${i("kassa.receiptNo")} ${e??"-"}`,new Date().toLocaleString("uz-UZ")),b&&f.row(i("kassa.receiptCashier"),b),f.rule();const W=me(t,o);t.forEach((x,M)=>{f.wrap(x.name);const P=`${Q(x.qty,x.unitDecimals)}${x.unit?" "+V(x.unit):""}`;f.row(`  ${P} x ${h(x.salePrice)}`,h(x.salePrice*x.qty));const q=(Number(x.discount)||0)+(W[M]||0);q>0&&f.row(`    ${i("kassa.discount")}`,"-"+h(q))}),f.rule();const K=t.reduce((x,M)=>x+(Number(M.discount)||0),0),U=o+K;if(U>0&&(f.row(i("kassa.receiptSubtotal"),h(s??a+U)),f.row(i("kassa.discount"),"-"+h(U))),f.bold().double().row(i("kassa.receiptTotal"),h(a)).double(!1).bold(!1),f.row(i("kassa.receiptPayment"),D(r)),Array.isArray(c)&&c.length>1)for(const x of c)f.row("  "+D(x.type),h(x.amount));Number(d)>0&&f.row(i("savings.toSavings"),"+"+h(d)),p!=null&&p.fullName&&f.row(i("kassa.receiptCustomer"),p.fullName),v&&Number(v.amount)>0&&(f.rule(),f.center().bold().line(i("kassa.receiptCredit")).bold(!1).left(),f.row(i("kassa.receiptCreditThis"),h(v.amount)),v.balance!=null&&f.row(i("kassa.receiptCreditTotal"),h(v.balance)),v.dueDate&&f.row(i("kassa.receiptCreditDue"),v.dueDate),f.feed().row(i("kassa.receiptCreditSign"),"______________")),u&&f.feed().center().line(i("kassa.receiptOffline")).line(i("kassa.receiptOfflineSub")).left();const O=t.reduce((x,M)=>{const P=Number(M.vatRate);if(!P)return x;const q=Number(M.salePrice)*Number(M.qty);return x+(M.priceIncludesVat===!1?q*P/100:q*P/(100+P))},0);if(O>0&&f.row(i("kassa.receiptVat"),h(O)),m!=null&&m.fiscalSign&&(f.rule(),f.center().line(i("kassa.receiptFiscal")).left(),f.row(i("kassa.receiptFiscalSign"),m.fiscalSign),m.terminalId&&f.row(i("kassa.receiptTerminal"),m.terminalId),m.receiptNo&&f.row(i("kassa.receiptFiscalNo"),m.receiptNo),m.qrUrl&&f.feed().center().qr(m.qrUrl).left()),n){const x=H(n);f.feed().center().barcode128(x).line(x).left()}return w&&f.feed().center().qr(w,6).line(i("kassa.receiptQrHint")).left(),f.rule(),f.center().line(i("kassa.receiptThanks")).line("e-kassam.uz"),f}async function Ye(e){const n=S();if(!C())return ve(e);const t=Le(e);n.openDrawer&&e.payType==="CASH"&&t.kick(),t.cut(),await E(t.build())}function ge(e){const n=String(e||"").startsWith("SAVINGS_");if(!n)return{sav:n,title:i("kassa.receiptDebtPay"),main:i("kassa.receiptPaid"),before:i("credit.wasDebt"),after:i("kassa.receiptDebtLeft")};const t=String(e).slice(8);return{sav:n,title:i("savings.receiptTitle"),main:i(`savings.rcp.${t}`),before:i("savings.wasBalance"),after:i("savings.nowBalance")}}function Oe({customer:e,amount:n,balanceAfter:t,balanceBefore:a,method:s,shopName:o,cashier:r,date:c,receiptNo:p,qrUrl:u,toSavings:g,bonusEarned:b,kind:m,linkedNo:w}){const v=S(),d=new L(v.width===58?A:z),$=ge(m),f=ne(o);return d.center().double().line(f.name).double(!1),f.phone&&d.line(f.phone),d.line($.title),d.left().rule(),p&&d.row(i("kassa.receiptNo"),p),d.row(i("common.date"),(c||new Date).toLocaleString("uz-UZ")),r&&d.row(i("kassa.receiptCashier"),r),e!=null&&e.fullName&&d.row(i("kassa.receiptCustomer"),e.fullName),d.rule(),d.bold().double().row($.main,h(Math.abs(Number(n)||0))).double(!1).bold(!1),(s||!$.sav)&&d.row(i("kassa.receiptPayment"),D(s)),w&&d.row(i("savings.linkedSale"),w),a!=null&&d.row($.before,h(a)),d.row($.after,h(t??0)),Number(g)>0&&d.row(i("savings.toSavings"),h(g)),Number(b)>0&&d.row(i("kassa.receiptBonusEarned"),"+"+h(b)),u&&(d.rule(),d.center().line(i("kassa.receiptQrHint")),d.qr(u,6)),d.rule(),d.center().line(i("kassa.receiptThanks")).line("e-kassam.uz"),d}async function Je(e){const n=S();if(!C())return ve({...e,__debt:!0});const t=Oe(e);n.openDrawer&&e.method==="CASH"&&t.kick(),t.cut(),await E(t.build())}async function et({fullName:e,username:n,version:t,token:a,shopName:s}){if(!C())throw new Error(i("hw.errNoDesktop"));const o=S(),r=new L(o.width===58?A:z);r.center().double().line(i("badge.printTitle")).double(!1),r.line(s||"E-KASSAM.UZ"),r.left().rule(),r.center().bold().line(e||n||"-").bold(!1),r.line("@"+(n||"-")),r.line(`${i("badge.version")} ${t??1}`),r.feed(),r.qr(a,8),r.feed(),r.line(new Date().toLocaleString("uz-UZ")),r.left().rule(),r.wrap(i("badge.printWarn")),r.cut(),await E(r.build())}async function tt(e,n){var o;if(!C())throw new Error(i("hw.errNoDesktop"));const t=S(),a=new L(t.width===58?A:z),s=r=>r?new Date(r).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"}):"-";a.center().double().line(e.closedAt?"Z-HISOBOT":"X-HISOBOT").double(!1),a.line(n||"E-KASSAM.UZ"),a.left().rule(),a.row(i("sales.colCashier"),e.cashierName||"-"),a.row(i("sec.openedAt"),s(e.openedAt)),e.closedAt&&a.row(i("shift.closedAt"),s(e.closedAt)),a.rule(),a.row(i("rpt.salesCount"),String(e.salesCount)),a.bold().row(i("rpt.salesTotal"),h(e.salesTotal)).bold(!1);for(const[r,c]of Object.entries(e.byPaymentType||{}))a.row("  "+D(r),h(c));if(a.rule(),a.row(i("rpt.cancelled"),`${e.cancelledCount} / ${h(e.cancelledTotal)}`),a.row(i("rpt.confirmations"),String(e.confirmationsCount)),e.suspiciousCount>0&&a.bold().row(i("rpt.suspicious"),String(e.suspiciousCount)).bold(!1),e.cash&&(a.rule(),a.row(i("cash.openingFloat"),h(e.cash.openingFloat)),e.cash.expectedCash!=null&&a.row(i("cash.expected"),h(e.cash.expectedCash)),e.cash.countedCash!=null&&(a.bold().row(i("cash.counted"),h(e.cash.countedCash)).bold(!1),a.bold().row(i("cash.difference"),h(e.cash.difference)).bold(!1))),(o=e.nonCash)!=null&&o.length){a.rule(),a.line(i("noncash.title"));for(const r of e.nonCash)r.counted==null?a.row("  "+D(r.paymentType),r.expected==null?"-":h(r.expected)):(a.row("  "+D(r.paymentType),`${h(r.expected)} / ${h(r.counted)}`),Number(r.difference)!==0&&a.bold().row("  "+i("cash.difference"),h(r.difference)).bold(!1))}a.rule(),a.center().line(new Date().toLocaleString("uz-UZ")).line("e-kassam.uz"),a.cut(),await E(a.build())}async function nt(){if(!C())throw new Error(i("hw.errNoDesktop"));await E(Se())}async function at(e=[],n={}){if(!C())throw new Error(i("hw.errNoDesktop"));await E(Re(e,n))}function Re(e=[],{copies:n=1,shopName:t,width:a}={}){const s=(e||[]).filter(Boolean);if(!s.length)throw new Error(i("label.nothing"));const o=S(),r=a??(o.width===58?A:z),c=new L(r),p=Math.max(1,Math.min(20,Number(n)||1));for(const u of s)for(let g=0;g<p;g++)c.center(),t&&c.line(t),c.bold().wrap(u.name||"-").bold(!1),c.feed(),c.double().line(h(u.salePrice)).double(!1),u.oldPrice!=null&&Number(u.oldPrice)>Number(u.salePrice)&&c.line(`${i("label.oldPrice")}: ${h(u.oldPrice)}`),c.feed(),u.barcode&&(c.barcodeEan13(u.barcode)||c.barcode128(u.barcode,{hri:!0}),c.feed()),c.line(new Date().toLocaleDateString("uz-UZ")),c.left().line("- ".repeat(Math.floor(c.width/2)).trimEnd()).center();return c.cut(),c.build()}async function st(e=[],n={}){const t=(e||[]).filter(Boolean);if(!t.length)throw new Error(i("label.nothing"));if(!C())return Ue(t,n);await E(Ie(t,n))}function Ie(e=[],{copies:n=1,shopName:t,width:a}={}){const s=(e||[]).filter(Boolean);if(!s.length)throw new Error(i("label.nothing"));const o=S(),r=a??(o.width===58?A:z),c=new L(r),p=Math.max(1,Math.min(20,Number(n)||1));for(const u of s)for(let g=0;g<p;g++)c.center(),t&&c.line(t),c.bold().line(i("label.expiryTitle")).bold(!1),c.bold().wrap(u.name||"-").bold(!1),c.feed(),c.double().line(he(u.expiryDate)).double(!1),u.daysLeft!=null&&c.line(u.daysLeft<=0?i("label.expiryToday"):i("inv.nearDays",{n:u.daysLeft})),u.salePrice!=null&&c.line(h(u.salePrice)),c.feed(),u.barcode&&(c.barcodeEan13(u.barcode)||c.barcode128(u.barcode,{hri:!0}),c.feed()),c.left().line("- ".repeat(Math.floor(c.width/2)).trimEnd()).center();return c.cut(),c.build()}function Ue(e,{shopName:n}={}){const t=window.open("","_blank","width=820,height=900");if(!t)throw new Error(i("hw.errPopup"));const a=o=>String(o??"").replace(/[&<>"]/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[r]),s=e.map(o=>{const r=o.daysLeft,c=r==null?"":r<=0?i("label.expiryToday"):i("inv.nearDays",{n:r});return`<div class="lbl">
      <div class="hdr">${a(i("label.expiryTitle"))}</div>
      <div class="nm">${a(o.name||"-")}</div>
      <div class="dt">${a(he(o.expiryDate))}</div>
      ${c?`<div class="lf">${a(c)}</div>`:""}
      ${o.salePrice!=null?`<div class="pr">${a(h(o.salePrice))}</div>`:""}
      ${o.barcode?`<div class="bc">${ae(String(o.barcode),{height:22})}</div>`:""}
      ${n?`<div class="sh">${a(n)}</div>`:""}
    </div>`}).join("");return t.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${a(i("label.expiryTitle"))}</title>
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
    </style></head><body>${s}</body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},Promise.resolve()}async function it(e,n={}){if(!e)throw new Error(i("label.nothing"));if(!C())return Be(e,n);await E(je(e,n))}function je(e,{shopName:n,width:t}={}){const a=S(),s=new L(t??(a.width===58?A:z));s.center().double().line(i("pickup.slipTitle")).double(!1),n&&s.line(n),s.left().rule(),s.row(`${i("kassa.receiptNo")} ${e.saleCode||"-"}`,e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):""),e.cashierName&&s.row(i("kassa.receiptCashier"),e.cashierName),e.customerName&&s.row(i("kassa.receiptCustomer"),e.customerName),e.customerPhone&&s.row(i("common.phone"),e.customerPhone),s.rule();for(const o of e.items||[])s.wrap(o.productName),s.double().line(`  ${Q(o.quantity)} ${V(o.unit)}`).double(!1);if(s.rule(),e.saleId){const o=H(e.saleId);s.feed().center().barcode128(o).line(o).left()}return s.feed(),s.row(i("pickup.signStore"),"______________"),s.feed().row(i("pickup.signCustomer"),"______________"),s.cut(),s.build()}function Be(e,{shopName:n}={}){const t=window.open("","_blank","width=360,height=640");if(!t)throw new Error(i("hw.errPopup"));const a=S().width===58?58:80,s=r=>String(r??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]),o=(e.items||[]).map(r=>`<div class="it"><div class="nm">${s(r.productName)}</div>
     <div class="qt">${s(Q(r.quantity))} ${s(V(r.unit))}</div></div>`).join("");return t.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${s(i("pickup.slipTitle"))} ${s(e.saleCode||"")}</title>
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
      <div class="c"><div class="ttl">${s(i("pickup.slipTitle"))}</div>
        ${n?`<small>${s(n)}</small>`:""}</div>
      <div class="hr"></div>
      <div class="row"><b>${s(i("kassa.receiptNo"))} ${s(e.saleCode||"-")}</b>
        <span>${s(e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):"")}</span></div>
      ${e.cashierName?`<div class="row"><span>${s(i("kassa.receiptCashier"))}</span><span>${s(e.cashierName)}</span></div>`:""}
      ${e.customerName?`<div class="row"><span>${s(i("kassa.receiptCustomer"))}</span><span>${s(e.customerName)}</span></div>`:""}
      ${e.customerPhone?`<div class="row"><span>${s(i("common.phone"))}</span><span>${s(e.customerPhone)}</span></div>`:""}
      <div class="hr"></div>
      ${o}
      <div class="hr"></div>
      ${e.saleId?`<div class="c">${ae(H(e.saleId),{height:14})}
        <div><b>${s(H(e.saleId))}</b></div></div>`:""}
      <div class="row" style="margin-top:14px"><span>${s(i("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${s(i("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},Promise.resolve()}async function rt(){const e=S(),n=new L(e.width===58?A:z);n.center().double().line(i("hw.testTitle")).double(!1),n.line(new Date().toLocaleString("uz-UZ")),n.left().rule();const t=be(e);n.row(i("hw.transport"),t),n.row(i("hw.printer"),t==="tcp"?`${e.host}:${e.port}`:e.printerName||i("hw.defaultPrinter")),n.row(i("hw.width"),`${e.width} mm`),n.rule(),n.line("1234567890".repeat(6).slice(0,n.width)),n.center().line(i("hw.testOk")),n.cut(),await E(n.build())}function ve({saleId:e,serverSaleId:n,cart:t=[],total:a=0,subtotal:s,discount:o=0,payType:r,payments:c,customer:p,offline:u,shopName:g,cashier:b,receiptUrl:m,credit:w,__debt:v,amount:d,balanceAfter:$,balanceBefore:f,method:I,date:W,receiptNo:K,qrUrl:U,toSavings:O,bonusEarned:x,kind:M,linkedNo:P}){const q=window.open("","_blank","width=360,height=640,toolbar=no,menubar=no");if(!q)throw new Error(i("hw.errPopup"));const j=ge(M),ce=S().width===58?58:80,B=ne(g),l=k=>String(k??"").replace(/[&<>"]/g,F=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[F]),$e=me(t,o),xe=t.reduce((k,F)=>k+(Number(F.discount)||0),0),X=o+xe,ye=t.map((k,F)=>{const _e=`${Q(k.qty,k.unitDecimals)}${k.unit?" "+V(k.unit):""}`,le=(Number(k.discount)||0)+($e[F]||0);return`<div class="row"><span>${l(k.name)} × ${l(_e)}</span><span>${l(h(k.salePrice*k.qty))}</span></div>`+(le>0?`<div class="row sub"><span>${l(i("kassa.discount"))}</span><span>-${l(h(le))}</span></div>`:"")}).join(""),ke=v?`
      <div class="c"><div class="logo">${l(B.name)}</div>
        ${B.phone?`<small>${l(B.phone)}</small><br>`:""}
        <small>${l(j.title)}</small></div>
      <div class="hr"></div>
      ${K?`<div class="row"><span>${l(i("kassa.receiptNo"))}</span><span>${l(K)}</span></div>`:""}
      <div class="row"><span>${l(i("common.date"))}</span><span>${l((W||new Date).toLocaleString("uz-UZ"))}</span></div>
      ${b?`<div class="row"><span>${l(i("kassa.receiptCashier"))}</span><span>${l(b)}</span></div>`:""}
      ${p!=null&&p.fullName?`<div class="row"><span>${l(i("kassa.receiptCustomer"))}</span><span>${l(p.fullName)}</span></div>`:""}
      <div class="hr"></div>
      <div class="row"><b>${l(j.main)}</b><b>${l(h(Math.abs(Number(d)||0)))}</b></div>
      ${I||!j.sav?`<div class="row"><span>${l(i("kassa.receiptPayment"))}</span><span>${l(D(I))}</span></div>`:""}
      ${P?`<div class="row"><span>${l(i("savings.linkedSale"))}</span><span>${l(P)}</span></div>`:""}
      ${f!=null?`<div class="row"><span>${l(j.before)}</span><span>${l(h(f))}</span></div>`:""}
      <div class="row"><span>${l(j.after)}</span><span>${l(h($??0))}</span></div>
      ${Number(O)>0?`<div class="row"><span>${l(i("savings.toSavings"))}</span><span>${l(h(O))}</span></div>`:""}
      ${Number(x)>0?`<div class="row"><span>${l(i("kassa.receiptBonusEarned"))}</span><span>+${l(h(x))}</span></div>`:""}
      ${U?`<div class="hr"></div><div class="c">
        ${ue(U,{size:96,margin:1})}
        <small>${l(i("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(i("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`:"";q.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${l(v?j.title:i("kassa.receiptNo")+" "+e)}</title>
    <style>
      /* CHEK QOG'OZI - A4 EMAS.
         @page bo'lmasa brauzer chekni A4 sahifaga joylashtiradi, chetiga
         o'z sarlavha-izohini (manzil, sana, bet raqami) qo'shadi va matn
         chek printeriga umuman sig'maydi - aynan shu "noto'g'ri format"
         edi. margin:0 esa brauzerning o'sha sarlavhalarini olib tashlaydi.
         Balandlik auto: chek uzunligi tovar soniga qarab o'zgaradi. */
      @page { size: ${ce}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${ce}mm; padding: 3mm; }
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
      ${ke}
      ${v?"":`
      <div class="c"><div class="logo">${l(B.name)}</div>
        ${B.phone?`<small>${l(B.phone)}</small><br>`:""}
        <small>${l(i("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${l(i("kassa.receiptNo"))} ${l(e)}</span><span>${l(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${ye}
      <div class="hr"></div>
      ${X>0?`<div class="row"><span>${l(i("kassa.receiptSubtotal"))}</span><span>${l(h(s??a+X))}</span></div>
      <div class="row"><span>${l(i("kassa.discount"))}</span><span>-${l(h(X))}</span></div>`:""}
      <div class="row"><b>${l(i("kassa.receiptTotal"))}</b><b>${l(h(a))}</b></div>
      <div class="row"><span>${l(i("kassa.receiptPayment"))}</span><span>${l(D(r))}</span></div>
      ${Array.isArray(c)&&c.length>1?c.map(k=>`<div class="row"><span>&nbsp;&nbsp;${l(D(k.type))}</span><span>${l(h(k.amount))}</span></div>`).join(""):""}
      ${Number(O)>0&&!v?`<div class="row"><span>${l(i("savings.toSavings"))}</span><span>+${l(h(O))}</span></div>`:""}
      ${p!=null&&p.fullName?`<div class="row"><span>${l(i("kassa.receiptCustomer"))}</span><span>${l(p.fullName)}</span></div>`:""}
      ${w&&Number(w.amount)>0?`<div class="hr"></div>
      <div class="c"><b>${l(i("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${l(i("kassa.receiptCreditThis"))}</span><b>${l(h(w.amount))}</b></div>
      ${w.balance!=null?`<div class="row"><span>${l(i("kassa.receiptCreditTotal"))}</span><span>${l(h(w.balance))}</span></div>`:""}
      ${w.dueDate?`<div class="row"><span>${l(i("kassa.receiptCreditDue"))}</span><span>${l(w.dueDate)}</span></div>`:""}
      <div class="row" style="margin-top:10px"><span>${l(i("kassa.receiptCreditSign"))}</span><span>______________</span></div>`:""}
      ${u?`<div class="off">${l(i("kassa.receiptOffline"))}<br>${l(i("kassa.receiptOfflineSub"))}</div>`:""}
      ${n?`<div class="c" style="margin-top:6px">
        ${ae(H(n),{height:12})}
        <div class="no">${l(H(n))}</div>
      </div>`:""}
      ${m?`<div class="c" style="margin-top:8px">
        ${ue(m,{size:96,margin:1})}
        <small>${l(i("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(i("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`}
    </body></html>`),q.document.close(),q.onafterprint=()=>q.close(),setTimeout(()=>q.print(),60)}export{se as T,st as a,it as b,Je as c,tt as d,Xe as e,Ve as f,oe as g,ze as h,Ke as i,Ye as j,nt as k,Fe as l,Ze as m,We as n,Qe as o,at as p,et as q,Ge as r,me as s,rt as t};
