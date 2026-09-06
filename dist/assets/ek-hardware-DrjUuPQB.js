import{ag as q,t as i,T as C,aP as ee,m as b,a4 as D,aQ as ae,E as K,G as W,aR as pe,aS as ie,aT as H,w as ge}from"./index-BkQb1aBX.js";const O=27,k=29,z=48,A=32,S={init:[O,64],alignLeft:[O,97,0],alignCenter:[O,97,1],alignRight:[O,97,2],boldOn:[O,69,1],boldOff:[O,69,0],doubleOn:[k,33,17],doubleOff:[k,33,0],cut:[k,86,66,3],kick:[O,112,0,25,25]};function Ce(e){const s=String(e??"").replace(/[‘’ʻʼ′]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g," ").replace(/[\t\r\n\v\f]/g," "),t=[];for(const n of s){const a=n.codePointAt(0);t.push(a<128?a:63)}return t}class L{constructor(s=z){this.width=s,this.bytes=[...S.init]}raw(s){return this.bytes.push(...s),this}left(){return this.raw(S.alignLeft)}center(){return this.raw(S.alignCenter)}right(){return this.raw(S.alignRight)}bold(s=!0){return this.raw(s?S.boldOn:S.boldOff)}double(s=!0){return this.raw(s?S.doubleOn:S.doubleOff)}line(s=""){return this.raw(Ce(s)).raw([10])}feed(s=1){for(let t=0;t<s;t++)this.raw([10]);return this}rule(s="-"){return this.line(s.repeat(this.width))}row(s,t){const n=String(s??""),a=String(t??""),c=this.width-a.length;if(c<1)return this.line(a);const r=n.length>c-1?n.slice(0,c-1):n;return this.line(r+" ".repeat(this.width-r.length-a.length)+a)}wrap(s){const t=String(s??"").split(/\s+/).filter(Boolean);let n="";for(const a of t){if(!n.length){n=a;continue}n.length+1+a.length<=this.width?n+=" "+a:(this.line(n),n=a)}return n.length&&this.line(n),this}qr(s,t=8){const n=[];for(const c of String(s??"")){const r=c.codePointAt(0);r<128&&n.push(r)}this.raw([k,40,107,4,0,49,65,50,0]),this.raw([k,40,107,3,0,49,67,Math.max(1,Math.min(16,t))]),this.raw([k,40,107,3,0,49,69,49]);const a=n.length+3;return this.raw([k,40,107,a&255,a>>8&255,49,80,48]),this.raw(n),this.raw([k,40,107,3,0,49,81,48]),this}barcode128(s,{height:t=60,width:n=2,hri:a=!1}={}){const c=String(s??""),r=[];for(const d of c){const u=d.charCodeAt(0);if(u<32||u>127)return this;r.push(u)}if(!r.length)return this;this.raw([k,104,Math.max(1,Math.min(255,t))]),this.raw([k,119,Math.max(2,Math.min(6,n))]),this.raw([k,72,a?2:0]);const o=[123,66,...r];return this.raw([k,107,73,o.length]),this.raw(o),this}barcodeEan13(s){const t=String(s??"").replace(/\D/g,"");if(t.length!==13)return!1;let n=0;for(let r=0;r<12;r++)n+=Number(t[r])*(r%2===0?1:3);if((10-n%10)%10!==Number(t[12]))return!1;this.raw([k,104,60]),this.raw([k,119,2]),this.raw([k,72,2]);const c=[...t].map(r=>r.charCodeAt(0));return this.raw([k,107,67,c.length]),this.raw(c),!0}cut(){return this.feed(4).raw(S.cut)}kick(){return this.bytes.splice(S.init.length,0,...S.kick),this}build(){return this.bytes}}const Me=()=>[...S.init,...S.kick],G=[{step:1e3,score:100},{step:500,score:80},{step:100,score:60},{step:50,score:40}],Pe=10,re=G[0].score;function Z(e,s=G){const t=Math.round(Number(e)||0);if(t<=0)return re;for(const n of s)if(t%n.step===0)return n.score;return Pe}function oe(e,s=G){let t=0,n=0;for(const a of e||[]){const c=Number(a.unitRefund)||0,r=Number(a.qty)||0,o=Math.max(0,c*r);o<=0||(n+=Z(c,s)*o,t+=o)}return t>0?n/t:re}const De=1e3,ze=.02;function Qe(e,s={}){const t=Math.round(Number(e)||0);if(t<=0||Z(t)>=re)return null;const n=Math.min(s.maxCut==null?De:s.maxCut,t*(s.maxShare==null?ze:s.maxShare));if(n<1)return null;for(const a of G){const c=Math.floor(t/a.step)*a.step;if(c<=0||c>=t)continue;const r=t-c;if(r<=n)return{amount:c,cut:r,score:a.score}}return null}const te=e=>Math.floor((Number(e)||0)*100)/100;function Ee(e,s){const t=Number(e)||0,n=Number(s)||0;return n<=0||t<=0?0:te(t/n)}function Ke(e,s,t,n){const a=Number(n)||0;if(a<=0)return 0;const c=Number(s)||0,r=Number(t)||0,o=Ee(e,c);if(r+a>=c){const d=te(o*r),u=Math.round(((Number(e)||0)-d)*100)/100;return u>0?u:0}return te(o*a)}const ne=e=>Math.max(0,(Number(e.salePrice)||0)*(Number(e.qty)||0)-(Number(e.discount)||0)),fe=e=>{const s=ne(e);if(s<=0)return 0;const t=e.costPrice==null?null:Number(e.costPrice);if(t==null||!Number.isFinite(t))return s;const n=s-t*(Number(e.qty)||0);return n>0?n:0};function he(e,s,t,n,a){let c=0,r=0,o=-1;for(let u=0;u<s.length;u++){const w=a(s[u]),f=Math.floor(t*w/n*100)/100;e[u]=Math.round((e[u]+f)*100)/100,c+=f,w>o&&(o=w,r=u)}const d=Math.round((t-c)*100)/100;d!==0&&(e[r]=Math.round((e[r]+d)*100)/100)}function ve(e,s){const t=Number(s)||0,n=(e||[]).map(()=>0);if(t<=0||!(e!=null&&e.length))return n;const c=e.map(fe).reduce((o,d)=>o+d,0);let r=t;if(c>0){const o=Math.min(r,c);r=Math.round((r-o)*100)/100,he(n,e,o,c,fe)}if(r>0){const o=e.reduce((d,u)=>d+ne(u),0);o>0&&he(n,e,r,o,ne)}return n}const Y=[1e4,5e3,1e3,500];function ce(e){const s=Number(e.salePrice)||0,t=Number(e.qty)||0,n=e.minPrice==null?null:Number(e.minPrice);if(n==null||!Number.isFinite(n))return 0;const a=(s-n)*t-(Number(e.discount)||0);return a>0?Math.floor(a):0}const le=e=>(e||[]).reduce((s,t)=>s+ce(t),0);function We(e,s,t=3){const n=Math.round(Number(s)||0),a=le(e);if(n<=0||a<=0)return[];if(n%Y[Y.length-1]===0)return[];const c=[],r=new Set;for(const o of[...Y].reverse()){const d=Math.floor(n/o)*o,u=n-d;if(!(u<=0||u>a)&&!r.has(d)&&(r.add(d),c.push({target:d,discount:u}),c.length>=t))break}return c}function Ae(e){const s=Number(e.salePrice)||0,t=Number(e.qty)||0,n=e.costPrice==null?null:Number(e.costPrice);if(n==null||!Number.isFinite(n))return ce(e);const a=(s-n)*t-(Number(e.discount)||0);return a>0?Math.floor(a):0}const Le=e=>(e||[]).reduce((s,t)=>s+Ae(t),0);function Ve(e,s){const t=Math.round(Number(s)||0);return t<=0?"ok":t>Le(e)?"loss":t>le(e)?"over":"ok"}const y=e=>Math.round((Number(e)||0)*100)/100,_=.005;function xe(e){const s=Number(e.salePrice)||0,t=Number(e.qty)||0,n=y(Math.max(0,s*t-(Number(e.discount)||0))),a=ce(e);return{price:s,qty:t,paid:n,room:a,unit:t>0?n/t:0}}function J(e,s,t){const n=e.map(()=>0),a=[];e.forEach((r,o)=>{if(r.qty<=0||r.paid<=0)return;const d=Math.floor(r.unit/s)*s;if(d<=0)return;const u=y(r.paid-d*r.qty);if(u<=_||u>r.room+_)return;const w=(Z(d)-Z(r.unit))*r.paid;w<=0||a.push({i:o,cost:u,gain:w})}),a.sort((r,o)=>o.gain/o.cost-r.gain/r.cost||r.cost-o.cost);let c=0;for(const r of a)c+r.cost>t+_||(n[r.i]=r.cost,c=y(c+r.cost));return n}function me(e,s,t,n){const a=n.slice(),c=e.map((p,x)=>Math.max(0,p.room-a[x])),r=c.reduce((p,x)=>p+x,0),o=a.reduce((p,x)=>p+x,0),d=Math.min(t-o,r);if(d<=_)return a;const u=y(e.reduce((p,x,m)=>p+x.paid-a[m],0)),w=Math.ceil((u-d)/s)*s,f=y(u-w);if(f<=_||f>d+_)return a;let h=0,g=0;for(let p=0;p<e.length;p++){const x=Math.min(c[p],y(f*c[p]/r));a[p]=y(a[p]+x),h=y(h+x),c[p]>c[g]&&(g=p)}const v=y(f-h);return v>0&&(a[g]=y(Math.min(e[g].room,a[g]+v))),a}function be(e,s,t){const n=t.slice(),a=e.map((w,f)=>Math.max(0,w.room-n[f])),c=a.reduce((w,f)=>w+f,0),r=y(s-n.reduce((w,f)=>w+f,0));if(r<=_||c<=_)return n;let o=0,d=0;for(let w=0;w<e.length;w++){const f=Math.min(a[w],y(r*a[w]/c));n[w]=y(n[w]+f),o=y(o+f),a[w]>a[d]&&(d=w)}const u=y(r-o);return u>0&&(n[d]=y(Math.min(e[d].room,n[d]+u))),n}function Re(e,s){const t=e.map((h,g)=>({paid:y(h.paid-s[g]),qty:h.qty})),n=t.map(h=>h.qty>0?h.paid/h.qty:0),a=oe(t.map((h,g)=>({unitRefund:n[g],qty:h.qty})));let c=0,r=0;t.forEach((h,g)=>{h.paid<=0||(c++,Z(n[g])>=60&&r++)});const o=c?r/c:1,d=y(t.reduce((h,g)=>h+g.paid,0));let u=1,w=0;e.forEach((h,g)=>{if(h.paid<=0)return;const v=s[g]/h.paid;v<u&&(u=v),v>w&&(w=v)});const f=c?Math.max(0,Math.min(1,1-(w-u))):1;return{refund:a,roundItems:o,roundTotal:Z(d),even:f,total:d}}function Oe(e,s){const t=n=>Math.round(n*100)/100;return t(s.score.refund)-t(e.score.refund)||t(s.score.roundItems)-t(e.score.roundItems)||s.score.roundTotal-e.score.roundTotal||s.discount-e.discount||t(s.score.even)-t(e.score.even)}function Xe(e,s,t=3){const n=Math.min(Math.round(Number(s)||0),le(e));if(!(e!=null&&e.length)||n<=0)return[];const a=e.map(xe);if(a.every(f=>f.paid<=0))return[];const c=oe(a.map(f=>({unitRefund:f.unit,qty:f.qty}))),r=a.map(()=>0),o=G.map(f=>f.step),d=[];for(const f of o)d.push(J(a,f,n));for(const f of o)d.push(me(a,f,n,r));for(const f of o){const h=J(a,f,n);if(!h.every(g=>g<=_))for(const g of o)d.push(me(a,g,n,h))}d.push(be(a,n,r));for(const f of o){const h=J(a,f,n);h.every(g=>g<=_)||d.push(be(a,n,h))}const u=new Set,w=[];for(const f of d){const h=y(f.reduce((p,x)=>p+x,0));if(h<=_||h>n+_||f.some((p,x)=>p<-_||p>a[x].room+_))continue;const g=f.map(p=>p.toFixed(2)).join("|");if(u.has(g))continue;u.add(g);const v=Re(a,f);v.refund<c-_||w.push({discount:h,total:v.total,add:f,units:a.map((p,x)=>p.qty>0?y((p.paid-f[x])/p.qty):0),score:v,gain:Math.round(v.refund-c),exact:h>=n-_})}return w.sort(Oe),w.slice(0,t)}function Ye(e){const s=(e||[]).map(xe);return oe(s.map(t=>({unitRefund:t.unit,qty:t.qty})))}async function Je(){if(!C())return[];try{return await ee("list_printers")||[]}catch{return[]}}function $e(e){return C()?e.transport==="tcp"?"tcp":"windows":"browser"}let se=null;const et=()=>se;function we(e,s){se={ok:e,at:Date.now(),error:s?String(s.message||s):null};try{window.dispatchEvent(new CustomEvent("ek:printer",{detail:se}))}catch{}}async function E(e){const s=q();if(!C())throw new Error(i("hw.errNoDesktop"));try{let t;if($e(s)==="tcp"){if(!s.host)throw new Error(i("hw.errNoHost"));t=await ee("print_tcp",{host:s.host,port:Number(s.port)||9100,data:e})}else t=await ee("print_raw",{printer:s.printerName||null,data:e});return we(!0,null),t}catch(t){throw we(!1,t),t}}function Ie({saleId:e,serverSaleId:s,cart:t=[],total:n=0,subtotal:a,discount:c=0,payType:r,payments:o,customer:d,offline:u,shopName:w,cashier:f,fiscal:h,receiptUrl:g,credit:v,toSavings:p}){const x=q(),m=new L(x.width===58?A:z),I=ae(w);m.center().double().line(I.name).double(!1),I.phone&&m.line(I.phone),m.line(i("kassa.receiptSystem")),m.left().rule(),m.row(`${i("kassa.receiptNo")} ${e??"-"}`,new Date().toLocaleString("uz-UZ")),f&&m.row(i("kassa.receiptCashier"),f),m.rule();const V=ve(t,c);t.forEach(($,M)=>{m.wrap($.name);const P=`${K($.qty,$.unitDecimals)}${$.unit?" "+W($.unit):""}`;m.row(`  ${P} x ${b($.salePrice)}`,b($.salePrice*$.qty));const T=(Number($.discount)||0)+(V[M]||0);T>0&&m.row(`    ${i("kassa.discount")}`,"-"+b(T))}),m.rule();const Q=t.reduce(($,M)=>$+(Number(M.discount)||0),0),U=c+Q;if(U>0&&(m.row(i("kassa.receiptSubtotal"),b(a??n+U)),m.row(i("kassa.discount"),"-"+b(U))),m.bold().double().row(i("kassa.receiptTotal"),b(n)).double(!1).bold(!1),m.row(i("kassa.receiptPayment"),D(r)),Array.isArray(o)&&o.length>1)for(const $ of o)m.row("  "+D($.type),b($.amount));Number(p)>0&&m.row(i("savings.toSavings"),"+"+b(p)),d!=null&&d.fullName&&m.row(i("kassa.receiptCustomer"),d.fullName),v&&Number(v.amount)>0&&(m.rule(),m.center().bold().line(i("kassa.receiptCredit")).bold(!1).left(),m.row(i("kassa.receiptCreditThis"),b(v.amount)),v.balance!=null&&m.row(i("kassa.receiptCreditTotal"),b(v.balance)),v.dueDate&&m.row(i("kassa.receiptCreditDue"),v.dueDate),m.feed().row(i("kassa.receiptCreditSign"),"______________")),u&&m.feed().center().line(i("kassa.receiptOffline")).line(i("kassa.receiptOfflineSub")).left();const R=t.reduce(($,M)=>{const P=Number(M.vatRate);if(!P)return $;const T=Number(M.salePrice)*Number(M.qty);return $+(M.priceIncludesVat===!1?T*P/100:T*P/(100+P))},0);if(R>0&&m.row(i("kassa.receiptVat"),b(R)),h!=null&&h.fiscalSign&&(m.rule(),m.center().line(i("kassa.receiptFiscal")).left(),m.row(i("kassa.receiptFiscalSign"),h.fiscalSign),h.terminalId&&m.row(i("kassa.receiptTerminal"),h.terminalId),h.receiptNo&&m.row(i("kassa.receiptFiscalNo"),h.receiptNo),h.qrUrl&&m.feed().center().qr(h.qrUrl).left()),s){const $=H(s);m.feed().center().barcode128($).line($).left()}return g&&m.feed().center().qr(g,6).line(i("kassa.receiptQrHint")).left(),m.rule(),m.center().line(i("kassa.receiptThanks")).line("e-kassam.uz"),m}async function tt(e){const s=q();if(!C())return ke(e);const t=Ie(e);s.openDrawer&&e.payType==="CASH"&&t.kick(),t.cut(),await E(t.build())}function ye(e){const s=String(e||"").startsWith("SAVINGS_");if(!s)return{sav:s,title:i("kassa.receiptDebtPay"),main:i("kassa.receiptPaid"),before:i("credit.wasDebt"),after:i("kassa.receiptDebtLeft")};const t=String(e).slice(8);return{sav:s,title:i("savings.receiptTitle"),main:i(`savings.rcp.${t}`),before:i("savings.wasBalance"),after:i("savings.nowBalance")}}function Ue({customer:e,amount:s,balanceAfter:t,balanceBefore:n,method:a,shopName:c,cashier:r,date:o,receiptNo:d,qrUrl:u,toSavings:w,bonusEarned:f,kind:h,linkedNo:g}){const v=q(),p=new L(v.width===58?A:z),x=ye(h),m=ae(c);return p.center().double().line(m.name).double(!1),m.phone&&p.line(m.phone),p.line(x.title),p.left().rule(),d&&p.row(i("kassa.receiptNo"),d),p.row(i("common.date"),(o||new Date).toLocaleString("uz-UZ")),r&&p.row(i("kassa.receiptCashier"),r),e!=null&&e.fullName&&p.row(i("kassa.receiptCustomer"),e.fullName),p.rule(),p.bold().double().row(x.main,b(Math.abs(Number(s)||0))).double(!1).bold(!1),(a||!x.sav)&&p.row(i("kassa.receiptPayment"),D(a)),g&&p.row(i("savings.linkedSale"),g),n!=null&&p.row(x.before,b(n)),p.row(x.after,b(t??0)),Number(w)>0&&p.row(i("savings.toSavings"),b(w)),Number(f)>0&&p.row(i("kassa.receiptBonusEarned"),"+"+b(f)),u&&(p.rule(),p.center().line(i("kassa.receiptQrHint")),p.qr(u,6)),p.rule(),p.center().line(i("kassa.receiptThanks")).line("e-kassam.uz"),p}async function nt(e){const s=q();if(!C())return ke({...e,__debt:!0});const t=Ue(e);s.openDrawer&&e.method==="CASH"&&t.kick(),t.cut(),await E(t.build())}async function st({fullName:e,username:s,version:t,token:n,shopName:a}){if(!C())throw new Error(i("hw.errNoDesktop"));const c=q(),r=new L(c.width===58?A:z);r.center().double().line(i("badge.printTitle")).double(!1),r.line(a||"E-KASSAM.UZ"),r.left().rule(),r.center().bold().line(e||s||"-").bold(!1),r.line("@"+(s||"-")),r.line(`${i("badge.version")} ${t??1}`),r.feed(),r.qr(n,8),r.feed(),r.line(new Date().toLocaleString("uz-UZ")),r.left().rule(),r.wrap(i("badge.printWarn")),r.cut(),await E(r.build())}async function at(e,s){var c;if(!C())throw new Error(i("hw.errNoDesktop"));const t=q(),n=new L(t.width===58?A:z),a=r=>r?new Date(r).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"}):"-";n.center().double().line(e.closedAt?"Z-HISOBOT":"X-HISOBOT").double(!1),n.line(s||"E-KASSAM.UZ"),n.left().rule(),n.row(i("sales.colCashier"),e.cashierName||"-"),n.row(i("sec.openedAt"),a(e.openedAt)),e.closedAt&&n.row(i("shift.closedAt"),a(e.closedAt)),n.rule(),n.row(i("rpt.salesCount"),String(e.salesCount)),n.bold().row(i("rpt.salesTotal"),b(e.salesTotal)).bold(!1);for(const[r,o]of Object.entries(e.byPaymentType||{}))n.row("  "+D(r),b(o));if(n.rule(),n.row(i("rpt.cancelled"),`${e.cancelledCount} / ${b(e.cancelledTotal)}`),n.row(i("rpt.confirmations"),String(e.confirmationsCount)),e.suspiciousCount>0&&n.bold().row(i("rpt.suspicious"),String(e.suspiciousCount)).bold(!1),e.cash&&(n.rule(),n.row(i("cash.openingFloat"),b(e.cash.openingFloat)),e.cash.expectedCash!=null&&n.row(i("cash.expected"),b(e.cash.expectedCash)),e.cash.countedCash!=null&&(n.bold().row(i("cash.counted"),b(e.cash.countedCash)).bold(!1),n.bold().row(i("cash.difference"),b(e.cash.difference)).bold(!1))),(c=e.nonCash)!=null&&c.length){n.rule(),n.line(i("noncash.title"));for(const r of e.nonCash)r.counted==null?n.row("  "+D(r.paymentType),r.expected==null?"-":b(r.expected)):(n.row("  "+D(r.paymentType),`${b(r.expected)} / ${b(r.counted)}`),Number(r.difference)!==0&&n.bold().row("  "+i("cash.difference"),b(r.difference)).bold(!1))}n.rule(),n.center().line(new Date().toLocaleString("uz-UZ")).line("e-kassam.uz"),n.cut(),await E(n.build())}async function it(){if(!C())throw new Error(i("hw.errNoDesktop"));await E(Me())}async function rt(e=[],s={}){if(!C())throw new Error(i("hw.errNoDesktop"));await E(je(e,s))}function je(e=[],{copies:s=1,shopName:t,width:n}={}){const a=(e||[]).filter(Boolean);if(!a.length)throw new Error(i("label.nothing"));const c=q(),r=n??(c.width===58?A:z),o=new L(r),d=Math.max(1,Math.min(20,Number(s)||1));for(const u of a)for(let w=0;w<d;w++)o.center(),t&&o.line(t),o.bold().wrap(u.name||"-").bold(!1),o.feed(),o.double().line(b(u.salePrice)).double(!1),u.oldPrice!=null&&Number(u.oldPrice)>Number(u.salePrice)&&o.line(`${i("label.oldPrice")}: ${b(u.oldPrice)}`),o.feed(),u.barcode&&(o.barcodeEan13(u.barcode)||o.barcode128(u.barcode,{hri:!0}),o.feed()),o.line(new Date().toLocaleDateString("uz-UZ")),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}async function ot(e=[],s={}){const t=(e||[]).filter(Boolean);if(!t.length)throw new Error(i("label.nothing"));if(!C())return He(t,s);await E(Be(t,s))}function Be(e=[],{copies:s=1,shopName:t,width:n}={}){const a=(e||[]).filter(Boolean);if(!a.length)throw new Error(i("label.nothing"));const c=q(),r=n??(c.width===58?A:z),o=new L(r),d=Math.max(1,Math.min(20,Number(s)||1));for(const u of a)for(let w=0;w<d;w++)o.center(),t&&o.line(t),o.bold().line(i("label.expiryTitle")).bold(!1),o.bold().wrap(u.name||"-").bold(!1),o.feed(),o.double().line(ge(u.expiryDate)).double(!1),u.daysLeft!=null&&o.line(u.daysLeft<=0?i("label.expiryToday"):i("inv.nearDays",{n:u.daysLeft})),u.salePrice!=null&&o.line(b(u.salePrice)),o.feed(),u.barcode&&(o.barcodeEan13(u.barcode)||o.barcode128(u.barcode,{hri:!0}),o.feed()),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}function He(e,{shopName:s}={}){const t=window.open("","_blank","width=820,height=900");if(!t)throw new Error(i("hw.errPopup"));const n=c=>String(c??"").replace(/[&<>"]/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[r]),a=e.map(c=>{const r=c.daysLeft,o=r==null?"":r<=0?i("label.expiryToday"):i("inv.nearDays",{n:r});return`<div class="lbl">
      <div class="hdr">${n(i("label.expiryTitle"))}</div>
      <div class="nm">${n(c.name||"-")}</div>
      <div class="dt">${n(ge(c.expiryDate))}</div>
      ${o?`<div class="lf">${n(o)}</div>`:""}
      ${c.salePrice!=null?`<div class="pr">${n(b(c.salePrice))}</div>`:""}
      ${c.barcode?`<div class="bc">${ie(String(c.barcode),{height:22})}</div>`:""}
      ${s?`<div class="sh">${n(s)}</div>`:""}
    </div>`}).join("");return t.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${n(i("label.expiryTitle"))}</title>
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
    </style></head><body>${a}</body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},Promise.resolve()}async function ct(e,s={}){if(!e)throw new Error(i("label.nothing"));if(!C())return Fe(e,s);await E(Ze(e,s))}function Ze(e,{shopName:s,width:t}={}){const n=q(),a=new L(t??(n.width===58?A:z));a.center().double().line(i("pickup.slipTitle")).double(!1),s&&a.line(s),a.left().rule(),a.row(`${i("kassa.receiptNo")} ${e.saleCode||"-"}`,e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):""),e.cashierName&&a.row(i("kassa.receiptCashier"),e.cashierName),e.customerName&&a.row(i("kassa.receiptCustomer"),e.customerName),e.customerPhone&&a.row(i("common.phone"),e.customerPhone),a.rule();for(const c of e.items||[])a.wrap(c.productName),a.double().line(`  ${K(c.quantity)} ${W(c.unit)}`).double(!1);if(a.rule(),e.saleId){const c=H(e.saleId);a.feed().center().barcode128(c).line(c).left()}return a.feed(),a.row(i("pickup.signStore"),"______________"),a.feed().row(i("pickup.signCustomer"),"______________"),a.cut(),a.build()}function Fe(e,{shopName:s}={}){const t=window.open("","_blank","width=360,height=640");if(!t)throw new Error(i("hw.errPopup"));const n=q().width===58?58:80,a=r=>String(r??"").replace(/[&<>"]/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[o]),c=(e.items||[]).map(r=>`<div class="it"><div class="nm">${a(r.productName)}</div>
     <div class="qt">${a(K(r.quantity))} ${a(W(r.unit))}</div></div>`).join("");return t.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${a(i("pickup.slipTitle"))} ${a(e.saleCode||"")}</title>
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
      ${e.saleId?`<div class="c">${ie(H(e.saleId),{height:14})}
        <div><b>${a(H(e.saleId))}</b></div></div>`:""}
      <div class="row" style="margin-top:14px"><span>${a(i("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${a(i("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},Promise.resolve()}async function lt(){const e=q(),s=new L(e.width===58?A:z);s.center().double().line(i("hw.testTitle")).double(!1),s.line(new Date().toLocaleString("uz-UZ")),s.left().rule();const t=$e(e);s.row(i("hw.transport"),t),s.row(i("hw.printer"),t==="tcp"?`${e.host}:${e.port}`:e.printerName||i("hw.defaultPrinter")),s.row(i("hw.width"),`${e.width} mm`),s.rule(),s.line("1234567890".repeat(6).slice(0,s.width)),s.center().line(i("hw.testOk")),s.cut(),await E(s.build())}function ke({saleId:e,serverSaleId:s,cart:t=[],total:n=0,subtotal:a,discount:c=0,payType:r,payments:o,customer:d,offline:u,shopName:w,cashier:f,receiptUrl:h,credit:g,__debt:v,amount:p,balanceAfter:x,balanceBefore:m,method:I,date:V,receiptNo:Q,qrUrl:U,toSavings:R,bonusEarned:$,kind:M,linkedNo:P}){const T=window.open("","_blank","width=360,height=640,toolbar=no,menubar=no");if(!T)throw new Error(i("hw.errPopup"));const j=ye(M),ue=q().width===58?58:80,B=ae(w),l=N=>String(N??"").replace(/[&<>"]/g,F=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[F]),_e=ve(t,c),Ne=t.reduce((N,F)=>N+(Number(F.discount)||0),0),X=c+Ne,Se=t.map((N,F)=>{const Te=`${K(N.qty,N.unitDecimals)}${N.unit?" "+W(N.unit):""}`,de=(Number(N.discount)||0)+(_e[F]||0);return`<div class="row"><span>${l(N.name)} × ${l(Te)}</span><span>${l(b(N.salePrice*N.qty))}</span></div>`+(de>0?`<div class="row sub"><span>${l(i("kassa.discount"))}</span><span>-${l(b(de))}</span></div>`:"")}).join(""),qe=v?`
      <div class="c"><div class="logo">${l(B.name)}</div>
        ${B.phone?`<small>${l(B.phone)}</small><br>`:""}
        <small>${l(j.title)}</small></div>
      <div class="hr"></div>
      ${Q?`<div class="row"><span>${l(i("kassa.receiptNo"))}</span><span>${l(Q)}</span></div>`:""}
      <div class="row"><span>${l(i("common.date"))}</span><span>${l((V||new Date).toLocaleString("uz-UZ"))}</span></div>
      ${f?`<div class="row"><span>${l(i("kassa.receiptCashier"))}</span><span>${l(f)}</span></div>`:""}
      ${d!=null&&d.fullName?`<div class="row"><span>${l(i("kassa.receiptCustomer"))}</span><span>${l(d.fullName)}</span></div>`:""}
      <div class="hr"></div>
      <div class="row"><b>${l(j.main)}</b><b>${l(b(Math.abs(Number(p)||0)))}</b></div>
      ${I||!j.sav?`<div class="row"><span>${l(i("kassa.receiptPayment"))}</span><span>${l(D(I))}</span></div>`:""}
      ${P?`<div class="row"><span>${l(i("savings.linkedSale"))}</span><span>${l(P)}</span></div>`:""}
      ${m!=null?`<div class="row"><span>${l(j.before)}</span><span>${l(b(m))}</span></div>`:""}
      <div class="row"><span>${l(j.after)}</span><span>${l(b(x??0))}</span></div>
      ${Number(R)>0?`<div class="row"><span>${l(i("savings.toSavings"))}</span><span>${l(b(R))}</span></div>`:""}
      ${Number($)>0?`<div class="row"><span>${l(i("kassa.receiptBonusEarned"))}</span><span>+${l(b($))}</span></div>`:""}
      ${U?`<div class="hr"></div><div class="c">
        ${pe(U,{size:96,margin:1})}
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
      @page { size: ${ue}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${ue}mm; padding: 3mm; }
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
      ${qe}
      ${v?"":`
      <div class="c"><div class="logo">${l(B.name)}</div>
        ${B.phone?`<small>${l(B.phone)}</small><br>`:""}
        <small>${l(i("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${l(i("kassa.receiptNo"))} ${l(e)}</span><span>${l(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${Se}
      <div class="hr"></div>
      ${X>0?`<div class="row"><span>${l(i("kassa.receiptSubtotal"))}</span><span>${l(b(a??n+X))}</span></div>
      <div class="row"><span>${l(i("kassa.discount"))}</span><span>-${l(b(X))}</span></div>`:""}
      <div class="row"><b>${l(i("kassa.receiptTotal"))}</b><b>${l(b(n))}</b></div>
      <div class="row"><span>${l(i("kassa.receiptPayment"))}</span><span>${l(D(r))}</span></div>
      ${Array.isArray(o)&&o.length>1?o.map(N=>`<div class="row"><span>&nbsp;&nbsp;${l(D(N.type))}</span><span>${l(b(N.amount))}</span></div>`).join(""):""}
      ${Number(R)>0&&!v?`<div class="row"><span>${l(i("savings.toSavings"))}</span><span>+${l(b(R))}</span></div>`:""}
      ${d!=null&&d.fullName?`<div class="row"><span>${l(i("kassa.receiptCustomer"))}</span><span>${l(d.fullName)}</span></div>`:""}
      ${g&&Number(g.amount)>0?`<div class="hr"></div>
      <div class="c"><b>${l(i("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${l(i("kassa.receiptCreditThis"))}</span><b>${l(b(g.amount))}</b></div>
      ${g.balance!=null?`<div class="row"><span>${l(i("kassa.receiptCreditTotal"))}</span><span>${l(b(g.balance))}</span></div>`:""}
      ${g.dueDate?`<div class="row"><span>${l(i("kassa.receiptCreditDue"))}</span><span>${l(g.dueDate)}</span></div>`:""}
      <div class="row" style="margin-top:10px"><span>${l(i("kassa.receiptCreditSign"))}</span><span>______________</span></div>`:""}
      ${u?`<div class="off">${l(i("kassa.receiptOffline"))}<br>${l(i("kassa.receiptOfflineSub"))}</div>`:""}
      ${s?`<div class="c" style="margin-top:6px">
        ${ie(H(s),{height:12})}
        <div class="no">${l(H(s))}</div>
      </div>`:""}
      ${h?`<div class="c" style="margin-top:8px">
        ${pe(h,{size:96,margin:1})}
        <small>${l(i("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(i("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`}
    </body></html>`),T.document.close(),T.onafterprint=()=>T.close(),setTimeout(()=>T.print(),60)}export{re as T,ot as a,ct as b,nt as c,at as d,et as e,Ye as f,le as g,Le as h,Ve as i,tt as j,it as k,Ke as l,Qe as m,Je as n,Xe as o,rt as p,st as q,We as r,ve as s,lt as t};
