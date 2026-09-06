import{af as q,t as i,T as C,aK as ee,m as w,a4 as D,aL as se,E as Q,G as V,aM as de,aN as ae,aO as H,w as me}from"./index-FByHrMPt.js";const R=27,k=29,z=48,A=32,S={init:[R,64],alignLeft:[R,97,0],alignCenter:[R,97,1],alignRight:[R,97,2],boldOn:[R,69,1],boldOff:[R,69,0],doubleOn:[k,33,17],doubleOff:[k,33,0],cut:[k,86,66,3],kick:[R,112,0,25,25]};function Se(e){const s=String(e??"").replace(/[‘’ʻʼ′]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g," ").replace(/[\t\r\n\v\f]/g," "),n=[];for(const t of s){const a=t.codePointAt(0);n.push(a<128?a:63)}return n}class L{constructor(s=z){this.width=s,this.bytes=[...S.init]}raw(s){return this.bytes.push(...s),this}left(){return this.raw(S.alignLeft)}center(){return this.raw(S.alignCenter)}right(){return this.raw(S.alignRight)}bold(s=!0){return this.raw(s?S.boldOn:S.boldOff)}double(s=!0){return this.raw(s?S.doubleOn:S.doubleOff)}line(s=""){return this.raw(Se(s)).raw([10])}feed(s=1){for(let n=0;n<s;n++)this.raw([10]);return this}rule(s="-"){return this.line(s.repeat(this.width))}row(s,n){const t=String(s??""),a=String(n??""),c=this.width-a.length;if(c<1)return this.line(a);const r=t.length>c-1?t.slice(0,c-1):t;return this.line(r+" ".repeat(this.width-r.length-a.length)+a)}wrap(s){const n=String(s??"").split(/\s+/).filter(Boolean);let t="";for(const a of n){if(!t.length){t=a;continue}t.length+1+a.length<=this.width?t+=" "+a:(this.line(t),t=a)}return t.length&&this.line(t),this}qr(s,n=8){const t=[];for(const c of String(s??"")){const r=c.codePointAt(0);r<128&&t.push(r)}this.raw([k,40,107,4,0,49,65,50,0]),this.raw([k,40,107,3,0,49,67,Math.max(1,Math.min(16,n))]),this.raw([k,40,107,3,0,49,69,49]);const a=t.length+3;return this.raw([k,40,107,a&255,a>>8&255,49,80,48]),this.raw(t),this.raw([k,40,107,3,0,49,81,48]),this}barcode128(s,{height:n=60,width:t=2,hri:a=!1}={}){const c=String(s??""),r=[];for(const d of c){const u=d.charCodeAt(0);if(u<32||u>127)return this;r.push(u)}if(!r.length)return this;this.raw([k,104,Math.max(1,Math.min(255,n))]),this.raw([k,119,Math.max(2,Math.min(6,t))]),this.raw([k,72,a?2:0]);const o=[123,66,...r];return this.raw([k,107,73,o.length]),this.raw(o),this}barcodeEan13(s){const n=String(s??"").replace(/\D/g,"");if(n.length!==13)return!1;let t=0;for(let r=0;r<12;r++)t+=Number(n[r])*(r%2===0?1:3);if((10-t%10)%10!==Number(n[12]))return!1;this.raw([k,104,60]),this.raw([k,119,2]),this.raw([k,72,2]);const c=[...n].map(r=>r.charCodeAt(0));return this.raw([k,107,67,c.length]),this.raw(c),!0}cut(){return this.feed(4).raw(S.cut)}kick(){return this.bytes.splice(S.init.length,0,...S.kick),this}build(){return this.bytes}}const qe=()=>[...S.init,...S.kick],G=[{step:1e3,score:100},{step:500,score:80},{step:100,score:60},{step:50,score:40}],Te=10,ie=G[0].score;function Z(e,s=G){const n=Math.round(Number(e)||0);if(n<=0)return ie;for(const t of s)if(n%t.step===0)return t.score;return Te}function re(e,s=G){let n=0,t=0;for(const a of e||[]){const c=Number(a.unitRefund)||0,r=Number(a.qty)||0,o=Math.max(0,c*r);o<=0||(t+=Z(c,s)*o,n+=o)}return n>0?t/n:ie}const Ce=1e3,Me=.02;function Fe(e,s={}){const n=Math.round(Number(e)||0);if(n<=0||Z(n)>=ie)return null;const t=Math.min(s.maxCut==null?Ce:s.maxCut,n*(s.maxShare==null?Me:s.maxShare));if(t<1)return null;for(const a of G){const c=Math.floor(n/a.step)*a.step;if(c<=0||c>=n)continue;const r=n-c;if(r<=t)return{amount:c,cut:r,score:a.score}}return null}const te=e=>Math.floor((Number(e)||0)*100)/100;function Pe(e,s){const n=Number(e)||0,t=Number(s)||0;return t<=0||n<=0?0:te(n/t)}function Ge(e,s,n,t){const a=Number(t)||0;if(a<=0)return 0;const c=Number(s)||0,r=Number(n)||0,o=Pe(e,c);if(r+a>=c){const d=te(o*r),u=Math.round(((Number(e)||0)-d)*100)/100;return u>0?u:0}return te(o*a)}const De=e=>Math.max(0,(Number(e.salePrice)||0)*(Number(e.qty)||0)-(Number(e.discount)||0));function be(e,s){const n=Number(s)||0,t=e.map(()=>0);if(n<=0||!e.length)return t;const a=e.map(De),c=a.reduce((u,b)=>u+b,0);if(c<=0)return t;let r=0,o=0;for(let u=0;u<e.length;u++){const b=Math.floor(n*a[u]/c*100)/100;t[u]=b,r+=b,a[u]>a[o]&&(o=u)}const d=Math.round((n-r)*100)/100;return d!==0&&(t[o]=Math.round((t[o]+d)*100)/100),t}const Y=[1e4,5e3,1e3,500];function oe(e){const s=Number(e.salePrice)||0,n=Number(e.qty)||0,t=e.minPrice==null?null:Number(e.minPrice);if(t==null||!Number.isFinite(t))return 0;const a=(s-t)*n-(Number(e.discount)||0);return a>0?Math.floor(a):0}const ce=e=>(e||[]).reduce((s,n)=>s+oe(n),0);function Ke(e,s,n=3){const t=Math.round(Number(s)||0),a=ce(e);if(t<=0||a<=0)return[];if(t%Y[Y.length-1]===0)return[];const c=[],r=new Set;for(const o of[...Y].reverse()){const d=Math.floor(t/o)*o,u=t-d;if(!(u<=0||u>a)&&!r.has(d)&&(r.add(d),c.push({target:d,discount:u}),c.length>=n))break}return c}function ze(e){const s=Number(e.salePrice)||0,n=Number(e.qty)||0,t=e.costPrice==null?null:Number(e.costPrice);if(t==null||!Number.isFinite(t))return oe(e);const a=(s-t)*n-(Number(e.discount)||0);return a>0?Math.floor(a):0}const Ee=e=>(e||[]).reduce((s,n)=>s+ze(n),0);function Qe(e,s){const n=Math.round(Number(s)||0);return n<=0?"ok":n>Ee(e)?"loss":n>ce(e)?"over":"ok"}const y=e=>Math.round((Number(e)||0)*100)/100,_=.005;function we(e){const s=Number(e.salePrice)||0,n=Number(e.qty)||0,t=y(Math.max(0,s*n-(Number(e.discount)||0))),a=oe(e);return{price:s,qty:n,paid:t,room:a,unit:n>0?t/n:0}}function J(e,s,n){const t=e.map(()=>0),a=[];e.forEach((r,o)=>{if(r.qty<=0||r.paid<=0)return;const d=Math.floor(r.unit/s)*s;if(d<=0)return;const u=y(r.paid-d*r.qty);if(u<=_||u>r.room+_)return;const b=(Z(d)-Z(r.unit))*r.paid;b<=0||a.push({i:o,cost:u,gain:b})}),a.sort((r,o)=>o.gain/o.cost-r.gain/r.cost||r.cost-o.cost);let c=0;for(const r of a)c+r.cost>n+_||(t[r.i]=r.cost,c=y(c+r.cost));return t}function pe(e,s,n,t){const a=t.slice(),c=e.map((p,x)=>Math.max(0,p.room-a[x])),r=c.reduce((p,x)=>p+x,0),o=a.reduce((p,x)=>p+x,0),d=Math.min(n-o,r);if(d<=_)return a;const u=y(e.reduce((p,x,m)=>p+x.paid-a[m],0)),b=Math.ceil((u-d)/s)*s,f=y(u-b);if(f<=_||f>d+_)return a;let h=0,g=0;for(let p=0;p<e.length;p++){const x=Math.min(c[p],y(f*c[p]/r));a[p]=y(a[p]+x),h=y(h+x),c[p]>c[g]&&(g=p)}const v=y(f-h);return v>0&&(a[g]=y(Math.min(e[g].room,a[g]+v))),a}function fe(e,s,n){const t=n.slice(),a=e.map((b,f)=>Math.max(0,b.room-t[f])),c=a.reduce((b,f)=>b+f,0),r=y(s-t.reduce((b,f)=>b+f,0));if(r<=_||c<=_)return t;let o=0,d=0;for(let b=0;b<e.length;b++){const f=Math.min(a[b],y(r*a[b]/c));t[b]=y(t[b]+f),o=y(o+f),a[b]>a[d]&&(d=b)}const u=y(r-o);return u>0&&(t[d]=y(Math.min(e[d].room,t[d]+u))),t}function Ae(e,s){const n=e.map((h,g)=>({paid:y(h.paid-s[g]),qty:h.qty})),t=n.map(h=>h.qty>0?h.paid/h.qty:0),a=re(n.map((h,g)=>({unitRefund:t[g],qty:h.qty})));let c=0,r=0;n.forEach((h,g)=>{h.paid<=0||(c++,Z(t[g])>=60&&r++)});const o=c?r/c:1,d=y(n.reduce((h,g)=>h+g.paid,0));let u=1,b=0;e.forEach((h,g)=>{if(h.paid<=0)return;const v=s[g]/h.paid;v<u&&(u=v),v>b&&(b=v)});const f=c?Math.max(0,Math.min(1,1-(b-u))):1;return{refund:a,roundItems:o,roundTotal:Z(d),even:f,total:d}}function Le(e,s){const n=t=>Math.round(t*100)/100;return n(s.score.refund)-n(e.score.refund)||n(s.score.roundItems)-n(e.score.roundItems)||s.score.roundTotal-e.score.roundTotal||s.discount-e.discount||n(s.score.even)-n(e.score.even)}function Ve(e,s,n=3){const t=Math.min(Math.round(Number(s)||0),ce(e));if(!(e!=null&&e.length)||t<=0)return[];const a=e.map(we);if(a.every(f=>f.paid<=0))return[];const c=re(a.map(f=>({unitRefund:f.unit,qty:f.qty}))),r=a.map(()=>0),o=G.map(f=>f.step),d=[];for(const f of o)d.push(J(a,f,t));for(const f of o)d.push(pe(a,f,t,r));for(const f of o){const h=J(a,f,t);if(!h.every(g=>g<=_))for(const g of o)d.push(pe(a,g,t,h))}d.push(fe(a,t,r));for(const f of o){const h=J(a,f,t);h.every(g=>g<=_)||d.push(fe(a,t,h))}const u=new Set,b=[];for(const f of d){const h=y(f.reduce((p,x)=>p+x,0));if(h<=_||h>t+_||f.some((p,x)=>p<-_||p>a[x].room+_))continue;const g=f.map(p=>p.toFixed(2)).join("|");if(u.has(g))continue;u.add(g);const v=Ae(a,f);v.refund<c-_||b.push({discount:h,total:v.total,add:f,units:a.map((p,x)=>p.qty>0?y((p.paid-f[x])/p.qty):0),score:v,gain:Math.round(v.refund-c),exact:h>=t-_})}return b.sort(Le),b.slice(0,n)}function We(e){const s=(e||[]).map(we);return re(s.map(n=>({unitRefund:n.unit,qty:n.qty})))}async function Xe(){if(!C())return[];try{return await ee("list_printers")||[]}catch{return[]}}function ge(e){return C()?e.transport==="tcp"?"tcp":"windows":"browser"}let ne=null;const Ye=()=>ne;function he(e,s){ne={ok:e,at:Date.now(),error:s?String(s.message||s):null};try{window.dispatchEvent(new CustomEvent("ek:printer",{detail:ne}))}catch{}}async function E(e){const s=q();if(!C())throw new Error(i("hw.errNoDesktop"));try{let n;if(ge(s)==="tcp"){if(!s.host)throw new Error(i("hw.errNoHost"));n=await ee("print_tcp",{host:s.host,port:Number(s.port)||9100,data:e})}else n=await ee("print_raw",{printer:s.printerName||null,data:e});return he(!0,null),n}catch(n){throw he(!1,n),n}}function Oe({saleId:e,serverSaleId:s,cart:n=[],total:t=0,subtotal:a,discount:c=0,payType:r,payments:o,customer:d,offline:u,shopName:b,cashier:f,fiscal:h,receiptUrl:g,credit:v,toSavings:p}){const x=q(),m=new L(x.width===58?A:z),I=se(b);m.center().double().line(I.name).double(!1),I.phone&&m.line(I.phone),m.line(i("kassa.receiptSystem")),m.left().rule(),m.row(`${i("kassa.receiptNo")} ${e??"-"}`,new Date().toLocaleString("uz-UZ")),f&&m.row(i("kassa.receiptCashier"),f),m.rule();const W=be(n,c);n.forEach(($,M)=>{m.wrap($.name);const P=`${Q($.qty,$.unitDecimals)}${$.unit?" "+V($.unit):""}`;m.row(`  ${P} x ${w($.salePrice)}`,w($.salePrice*$.qty));const T=(Number($.discount)||0)+(W[M]||0);T>0&&m.row(`    ${i("kassa.discount")}`,"-"+w(T))}),m.rule();const K=n.reduce(($,M)=>$+(Number(M.discount)||0),0),U=c+K;if(U>0&&(m.row(i("kassa.receiptSubtotal"),w(a??t+U)),m.row(i("kassa.discount"),"-"+w(U))),m.bold().double().row(i("kassa.receiptTotal"),w(t)).double(!1).bold(!1),m.row(i("kassa.receiptPayment"),D(r)),Array.isArray(o)&&o.length>1)for(const $ of o)m.row("  "+D($.type),w($.amount));Number(p)>0&&m.row(i("savings.toSavings"),"+"+w(p)),d!=null&&d.fullName&&m.row(i("kassa.receiptCustomer"),d.fullName),v&&Number(v.amount)>0&&(m.rule(),m.center().bold().line(i("kassa.receiptCredit")).bold(!1).left(),m.row(i("kassa.receiptCreditThis"),w(v.amount)),v.balance!=null&&m.row(i("kassa.receiptCreditTotal"),w(v.balance)),v.dueDate&&m.row(i("kassa.receiptCreditDue"),v.dueDate),m.feed().row(i("kassa.receiptCreditSign"),"______________")),u&&m.feed().center().line(i("kassa.receiptOffline")).line(i("kassa.receiptOfflineSub")).left();const O=n.reduce(($,M)=>{const P=Number(M.vatRate);if(!P)return $;const T=Number(M.salePrice)*Number(M.qty);return $+(M.priceIncludesVat===!1?T*P/100:T*P/(100+P))},0);if(O>0&&m.row(i("kassa.receiptVat"),w(O)),h!=null&&h.fiscalSign&&(m.rule(),m.center().line(i("kassa.receiptFiscal")).left(),m.row(i("kassa.receiptFiscalSign"),h.fiscalSign),h.terminalId&&m.row(i("kassa.receiptTerminal"),h.terminalId),h.receiptNo&&m.row(i("kassa.receiptFiscalNo"),h.receiptNo),h.qrUrl&&m.feed().center().qr(h.qrUrl).left()),s){const $=H(s);m.feed().center().barcode128($).line($).left()}return g&&m.feed().center().qr(g,6).line(i("kassa.receiptQrHint")).left(),m.rule(),m.center().line(i("kassa.receiptThanks")).line("e-kassam.uz"),m}async function Je(e){const s=q();if(!C())return xe(e);const n=Oe(e);s.openDrawer&&e.payType==="CASH"&&n.kick(),n.cut(),await E(n.build())}function ve(e){const s=String(e||"").startsWith("SAVINGS_");if(!s)return{sav:s,title:i("kassa.receiptDebtPay"),main:i("kassa.receiptPaid"),before:i("credit.wasDebt"),after:i("kassa.receiptDebtLeft")};const n=String(e).slice(8);return{sav:s,title:i("savings.receiptTitle"),main:i(`savings.rcp.${n}`),before:i("savings.wasBalance"),after:i("savings.nowBalance")}}function Re({customer:e,amount:s,balanceAfter:n,balanceBefore:t,method:a,shopName:c,cashier:r,date:o,receiptNo:d,qrUrl:u,toSavings:b,bonusEarned:f,kind:h,linkedNo:g}){const v=q(),p=new L(v.width===58?A:z),x=ve(h),m=se(c);return p.center().double().line(m.name).double(!1),m.phone&&p.line(m.phone),p.line(x.title),p.left().rule(),d&&p.row(i("kassa.receiptNo"),d),p.row(i("common.date"),(o||new Date).toLocaleString("uz-UZ")),r&&p.row(i("kassa.receiptCashier"),r),e!=null&&e.fullName&&p.row(i("kassa.receiptCustomer"),e.fullName),p.rule(),p.bold().double().row(x.main,w(Math.abs(Number(s)||0))).double(!1).bold(!1),(a||!x.sav)&&p.row(i("kassa.receiptPayment"),D(a)),g&&p.row(i("savings.linkedSale"),g),t!=null&&p.row(x.before,w(t)),p.row(x.after,w(n??0)),Number(b)>0&&p.row(i("savings.toSavings"),w(b)),Number(f)>0&&p.row(i("kassa.receiptBonusEarned"),"+"+w(f)),u&&(p.rule(),p.center().line(i("kassa.receiptQrHint")),p.qr(u,6)),p.rule(),p.center().line(i("kassa.receiptThanks")).line("e-kassam.uz"),p}async function et(e){const s=q();if(!C())return xe({...e,__debt:!0});const n=Re(e);s.openDrawer&&e.method==="CASH"&&n.kick(),n.cut(),await E(n.build())}async function tt({fullName:e,username:s,version:n,token:t,shopName:a}){if(!C())throw new Error(i("hw.errNoDesktop"));const c=q(),r=new L(c.width===58?A:z);r.center().double().line(i("badge.printTitle")).double(!1),r.line(a||"E-KASSAM.UZ"),r.left().rule(),r.center().bold().line(e||s||"-").bold(!1),r.line("@"+(s||"-")),r.line(`${i("badge.version")} ${n??1}`),r.feed(),r.qr(t,8),r.feed(),r.line(new Date().toLocaleString("uz-UZ")),r.left().rule(),r.wrap(i("badge.printWarn")),r.cut(),await E(r.build())}async function nt(e,s){var c;if(!C())throw new Error(i("hw.errNoDesktop"));const n=q(),t=new L(n.width===58?A:z),a=r=>r?new Date(r).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"}):"-";t.center().double().line(e.closedAt?"Z-HISOBOT":"X-HISOBOT").double(!1),t.line(s||"E-KASSAM.UZ"),t.left().rule(),t.row(i("sales.colCashier"),e.cashierName||"-"),t.row(i("sec.openedAt"),a(e.openedAt)),e.closedAt&&t.row(i("shift.closedAt"),a(e.closedAt)),t.rule(),t.row(i("rpt.salesCount"),String(e.salesCount)),t.bold().row(i("rpt.salesTotal"),w(e.salesTotal)).bold(!1);for(const[r,o]of Object.entries(e.byPaymentType||{}))t.row("  "+D(r),w(o));if(t.rule(),t.row(i("rpt.cancelled"),`${e.cancelledCount} / ${w(e.cancelledTotal)}`),t.row(i("rpt.confirmations"),String(e.confirmationsCount)),e.suspiciousCount>0&&t.bold().row(i("rpt.suspicious"),String(e.suspiciousCount)).bold(!1),e.cash&&(t.rule(),t.row(i("cash.openingFloat"),w(e.cash.openingFloat)),e.cash.expectedCash!=null&&t.row(i("cash.expected"),w(e.cash.expectedCash)),e.cash.countedCash!=null&&(t.bold().row(i("cash.counted"),w(e.cash.countedCash)).bold(!1),t.bold().row(i("cash.difference"),w(e.cash.difference)).bold(!1))),(c=e.nonCash)!=null&&c.length){t.rule(),t.line(i("noncash.title"));for(const r of e.nonCash)r.counted==null?t.row("  "+D(r.paymentType),r.expected==null?"-":w(r.expected)):(t.row("  "+D(r.paymentType),`${w(r.expected)} / ${w(r.counted)}`),Number(r.difference)!==0&&t.bold().row("  "+i("cash.difference"),w(r.difference)).bold(!1))}t.rule(),t.center().line(new Date().toLocaleString("uz-UZ")).line("e-kassam.uz"),t.cut(),await E(t.build())}async function st(){if(!C())throw new Error(i("hw.errNoDesktop"));await E(qe())}async function at(e=[],s={}){if(!C())throw new Error(i("hw.errNoDesktop"));await E(Ie(e,s))}function Ie(e=[],{copies:s=1,shopName:n,width:t}={}){const a=(e||[]).filter(Boolean);if(!a.length)throw new Error(i("label.nothing"));const c=q(),r=t??(c.width===58?A:z),o=new L(r),d=Math.max(1,Math.min(20,Number(s)||1));for(const u of a)for(let b=0;b<d;b++)o.center(),n&&o.line(n),o.bold().wrap(u.name||"-").bold(!1),o.feed(),o.double().line(w(u.salePrice)).double(!1),u.oldPrice!=null&&Number(u.oldPrice)>Number(u.salePrice)&&o.line(`${i("label.oldPrice")}: ${w(u.oldPrice)}`),o.feed(),u.barcode&&(o.barcodeEan13(u.barcode)||o.barcode128(u.barcode,{hri:!0}),o.feed()),o.line(new Date().toLocaleDateString("uz-UZ")),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}async function it(e=[],s={}){const n=(e||[]).filter(Boolean);if(!n.length)throw new Error(i("label.nothing"));if(!C())return je(n,s);await E(Ue(n,s))}function Ue(e=[],{copies:s=1,shopName:n,width:t}={}){const a=(e||[]).filter(Boolean);if(!a.length)throw new Error(i("label.nothing"));const c=q(),r=t??(c.width===58?A:z),o=new L(r),d=Math.max(1,Math.min(20,Number(s)||1));for(const u of a)for(let b=0;b<d;b++)o.center(),n&&o.line(n),o.bold().line(i("label.expiryTitle")).bold(!1),o.bold().wrap(u.name||"-").bold(!1),o.feed(),o.double().line(me(u.expiryDate)).double(!1),u.daysLeft!=null&&o.line(u.daysLeft<=0?i("label.expiryToday"):i("inv.nearDays",{n:u.daysLeft})),u.salePrice!=null&&o.line(w(u.salePrice)),o.feed(),u.barcode&&(o.barcodeEan13(u.barcode)||o.barcode128(u.barcode,{hri:!0}),o.feed()),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}function je(e,{shopName:s}={}){const n=window.open("","_blank","width=820,height=900");if(!n)throw new Error(i("hw.errPopup"));const t=c=>String(c??"").replace(/[&<>"]/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[r]),a=e.map(c=>{const r=c.daysLeft,o=r==null?"":r<=0?i("label.expiryToday"):i("inv.nearDays",{n:r});return`<div class="lbl">
      <div class="hdr">${t(i("label.expiryTitle"))}</div>
      <div class="nm">${t(c.name||"-")}</div>
      <div class="dt">${t(me(c.expiryDate))}</div>
      ${o?`<div class="lf">${t(o)}</div>`:""}
      ${c.salePrice!=null?`<div class="pr">${t(w(c.salePrice))}</div>`:""}
      ${c.barcode?`<div class="bc">${ae(String(c.barcode),{height:22})}</div>`:""}
      ${s?`<div class="sh">${t(s)}</div>`:""}
    </div>`}).join("");return n.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${t(i("label.expiryTitle"))}</title>
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
    </style></head><body>${a}</body></html>`),n.document.close(),n.onload=()=>{n.focus(),n.print()},Promise.resolve()}async function rt(e,s={}){if(!e)throw new Error(i("label.nothing"));if(!C())return He(e,s);await E(Be(e,s))}function Be(e,{shopName:s,width:n}={}){const t=q(),a=new L(n??(t.width===58?A:z));a.center().double().line(i("pickup.slipTitle")).double(!1),s&&a.line(s),a.left().rule(),a.row(`${i("kassa.receiptNo")} ${e.saleCode||"-"}`,e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):""),e.cashierName&&a.row(i("kassa.receiptCashier"),e.cashierName),e.customerName&&a.row(i("kassa.receiptCustomer"),e.customerName),e.customerPhone&&a.row(i("common.phone"),e.customerPhone),a.rule();for(const c of e.items||[])a.wrap(c.productName),a.double().line(`  ${Q(c.quantity)} ${V(c.unit)}`).double(!1);if(a.rule(),e.saleId){const c=H(e.saleId);a.feed().center().barcode128(c).line(c).left()}return a.feed(),a.row(i("pickup.signStore"),"______________"),a.feed().row(i("pickup.signCustomer"),"______________"),a.cut(),a.build()}function He(e,{shopName:s}={}){const n=window.open("","_blank","width=360,height=640");if(!n)throw new Error(i("hw.errPopup"));const t=q().width===58?58:80,a=r=>String(r??"").replace(/[&<>"]/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[o]),c=(e.items||[]).map(r=>`<div class="it"><div class="nm">${a(r.productName)}</div>
     <div class="qt">${a(Q(r.quantity))} ${a(V(r.unit))}</div></div>`).join("");return n.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${a(i("pickup.slipTitle"))} ${a(e.saleCode||"")}</title>
    <style>
      @page { size: ${t}mm auto; margin: 0; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
             font-variant-numeric: tabular-nums; font-size:12px; line-height:1.35;
             color:#000; width:${t}mm; padding:3mm; }
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
      <div class="c"><div class="ttl">${a(i("pickup.slipTitle"))}</div>
        ${s?`<small>${a(s)}</small>`:""}</div>
      <div class="hr"></div>
      <div class="row"><b>${a(i("kassa.receiptNo"))} ${a(e.saleCode||"-")}</b>
        <span>${a(e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):"")}</span></div>
      ${e.cashierName?`<div class="row"><span>${a(i("kassa.receiptCashier"))}</span><span>${a(e.cashierName)}</span></div>`:""}
      ${e.customerName?`<div class="row"><span>${a(i("kassa.receiptCustomer"))}</span><span>${a(e.customerName)}</span></div>`:""}
      ${e.customerPhone?`<div class="row"><span>${a(i("common.phone"))}</span><span>${a(e.customerPhone)}</span></div>`:""}
      <div class="hr"></div>
      ${c}
      <div class="hr"></div>
      ${e.saleId?`<div class="c">${ae(H(e.saleId),{height:14})}
        <div><b>${a(H(e.saleId))}</b></div></div>`:""}
      <div class="row" style="margin-top:14px"><span>${a(i("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${a(i("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`),n.document.close(),n.onload=()=>{n.focus(),n.print()},Promise.resolve()}async function ot(){const e=q(),s=new L(e.width===58?A:z);s.center().double().line(i("hw.testTitle")).double(!1),s.line(new Date().toLocaleString("uz-UZ")),s.left().rule();const n=ge(e);s.row(i("hw.transport"),n),s.row(i("hw.printer"),n==="tcp"?`${e.host}:${e.port}`:e.printerName||i("hw.defaultPrinter")),s.row(i("hw.width"),`${e.width} mm`),s.rule(),s.line("1234567890".repeat(6).slice(0,s.width)),s.center().line(i("hw.testOk")),s.cut(),await E(s.build())}function xe({saleId:e,serverSaleId:s,cart:n=[],total:t=0,subtotal:a,discount:c=0,payType:r,payments:o,customer:d,offline:u,shopName:b,cashier:f,receiptUrl:h,credit:g,__debt:v,amount:p,balanceAfter:x,balanceBefore:m,method:I,date:W,receiptNo:K,qrUrl:U,toSavings:O,bonusEarned:$,kind:M,linkedNo:P}){const T=window.open("","_blank","width=360,height=640,toolbar=no,menubar=no");if(!T)throw new Error(i("hw.errPopup"));const j=ve(M),le=q().width===58?58:80,B=se(b),l=N=>String(N??"").replace(/[&<>"]/g,F=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[F]),$e=be(n,c),ye=n.reduce((N,F)=>N+(Number(F.discount)||0),0),X=c+ye,ke=n.map((N,F)=>{const Ne=`${Q(N.qty,N.unitDecimals)}${N.unit?" "+V(N.unit):""}`,ue=(Number(N.discount)||0)+($e[F]||0);return`<div class="row"><span>${l(N.name)} × ${l(Ne)}</span><span>${l(w(N.salePrice*N.qty))}</span></div>`+(ue>0?`<div class="row sub"><span>${l(i("kassa.discount"))}</span><span>-${l(w(ue))}</span></div>`:"")}).join(""),_e=v?`
      <div class="c"><div class="logo">${l(B.name)}</div>
        ${B.phone?`<small>${l(B.phone)}</small><br>`:""}
        <small>${l(j.title)}</small></div>
      <div class="hr"></div>
      ${K?`<div class="row"><span>${l(i("kassa.receiptNo"))}</span><span>${l(K)}</span></div>`:""}
      <div class="row"><span>${l(i("common.date"))}</span><span>${l((W||new Date).toLocaleString("uz-UZ"))}</span></div>
      ${f?`<div class="row"><span>${l(i("kassa.receiptCashier"))}</span><span>${l(f)}</span></div>`:""}
      ${d!=null&&d.fullName?`<div class="row"><span>${l(i("kassa.receiptCustomer"))}</span><span>${l(d.fullName)}</span></div>`:""}
      <div class="hr"></div>
      <div class="row"><b>${l(j.main)}</b><b>${l(w(Math.abs(Number(p)||0)))}</b></div>
      ${I||!j.sav?`<div class="row"><span>${l(i("kassa.receiptPayment"))}</span><span>${l(D(I))}</span></div>`:""}
      ${P?`<div class="row"><span>${l(i("savings.linkedSale"))}</span><span>${l(P)}</span></div>`:""}
      ${m!=null?`<div class="row"><span>${l(j.before)}</span><span>${l(w(m))}</span></div>`:""}
      <div class="row"><span>${l(j.after)}</span><span>${l(w(x??0))}</span></div>
      ${Number(O)>0?`<div class="row"><span>${l(i("savings.toSavings"))}</span><span>${l(w(O))}</span></div>`:""}
      ${Number($)>0?`<div class="row"><span>${l(i("kassa.receiptBonusEarned"))}</span><span>+${l(w($))}</span></div>`:""}
      ${U?`<div class="hr"></div><div class="c">
        ${de(U,{size:96,margin:1})}
        <small>${l(i("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(i("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`:"";T.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${l(v?j.title:i("kassa.receiptNo")+" "+e)}</title>
    <style>
      /* CHEK QOG'OZI - A4 EMAS.
         @page bo'lmasa brauzer chekni A4 sahifaga joylashtiradi, chetiga
         o'z sarlavha-izohini (manzil, sana, bet raqami) qo'shadi va matn
         chek printeriga umuman sig'maydi - aynan shu "noto'g'ri format"
         edi. margin:0 esa brauzerning o'sha sarlavhalarini olib tashlaydi.
         Balandlik auto: chek uzunligi tovar soniga qarab o'zgaradi. */
      @page { size: ${le}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${le}mm; padding: 3mm; }
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
      ${_e}
      ${v?"":`
      <div class="c"><div class="logo">${l(B.name)}</div>
        ${B.phone?`<small>${l(B.phone)}</small><br>`:""}
        <small>${l(i("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${l(i("kassa.receiptNo"))} ${l(e)}</span><span>${l(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${ke}
      <div class="hr"></div>
      ${X>0?`<div class="row"><span>${l(i("kassa.receiptSubtotal"))}</span><span>${l(w(a??t+X))}</span></div>
      <div class="row"><span>${l(i("kassa.discount"))}</span><span>-${l(w(X))}</span></div>`:""}
      <div class="row"><b>${l(i("kassa.receiptTotal"))}</b><b>${l(w(t))}</b></div>
      <div class="row"><span>${l(i("kassa.receiptPayment"))}</span><span>${l(D(r))}</span></div>
      ${Array.isArray(o)&&o.length>1?o.map(N=>`<div class="row"><span>&nbsp;&nbsp;${l(D(N.type))}</span><span>${l(w(N.amount))}</span></div>`).join(""):""}
      ${Number(O)>0&&!v?`<div class="row"><span>${l(i("savings.toSavings"))}</span><span>+${l(w(O))}</span></div>`:""}
      ${d!=null&&d.fullName?`<div class="row"><span>${l(i("kassa.receiptCustomer"))}</span><span>${l(d.fullName)}</span></div>`:""}
      ${g&&Number(g.amount)>0?`<div class="hr"></div>
      <div class="c"><b>${l(i("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${l(i("kassa.receiptCreditThis"))}</span><b>${l(w(g.amount))}</b></div>
      ${g.balance!=null?`<div class="row"><span>${l(i("kassa.receiptCreditTotal"))}</span><span>${l(w(g.balance))}</span></div>`:""}
      ${g.dueDate?`<div class="row"><span>${l(i("kassa.receiptCreditDue"))}</span><span>${l(g.dueDate)}</span></div>`:""}
      <div class="row" style="margin-top:10px"><span>${l(i("kassa.receiptCreditSign"))}</span><span>______________</span></div>`:""}
      ${u?`<div class="off">${l(i("kassa.receiptOffline"))}<br>${l(i("kassa.receiptOfflineSub"))}</div>`:""}
      ${s?`<div class="c" style="margin-top:6px">
        ${ae(H(s),{height:12})}
        <div class="no">${l(H(s))}</div>
      </div>`:""}
      ${h?`<div class="c" style="margin-top:8px">
        ${de(h,{size:96,margin:1})}
        <small>${l(i("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(i("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`}
    </body></html>`),T.document.close(),T.onafterprint=()=>T.close(),setTimeout(()=>T.print(),60)}export{ie as T,it as a,rt as b,et as c,nt as d,Ye as e,We as f,ce as g,Ee as h,Qe as i,Je as j,st as k,Ge as l,Fe as m,Xe as n,Ve as o,at as p,tt as q,Ke as r,be as s,ot as t};
