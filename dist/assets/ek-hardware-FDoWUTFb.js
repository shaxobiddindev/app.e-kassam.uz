import{al as q,t as i,T as M,b5 as te,m as b,ak as z,b6 as re,E as V,G as X,b3 as he,b7 as ne,b8 as oe,b9 as B,w as $e}from"./index-DN4xQpyM.js";const I=27,k=29,E=48,O=32,S={init:[I,64],alignLeft:[I,97,0],alignCenter:[I,97,1],alignRight:[I,97,2],boldOn:[I,69,1],boldOff:[I,69,0],doubleOn:[k,33,17],doubleOff:[k,33,0],cut:[k,86,66,3],kick:[I,112,0,25,25]};function Pe(e){const s=String(e??"").replace(/[‘’ʻʼ′]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g," ").replace(/[\t\r\n\v\f]/g," "),t=[];for(const n of s){const a=n.codePointAt(0);t.push(a<128?a:63)}return t}class R{constructor(s=E){this.width=s,this.bytes=[...S.init]}raw(s){return this.bytes.push(...s),this}left(){return this.raw(S.alignLeft)}center(){return this.raw(S.alignCenter)}right(){return this.raw(S.alignRight)}bold(s=!0){return this.raw(s?S.boldOn:S.boldOff)}double(s=!0){return this.raw(s?S.doubleOn:S.doubleOff)}line(s=""){return this.raw(Pe(s)).raw([10])}feed(s=1){for(let t=0;t<s;t++)this.raw([10]);return this}rule(s="-"){return this.line(s.repeat(this.width))}row(s,t){const n=String(s??""),a=String(t??""),c=this.width-a.length;if(c<1)return this.line(a);const r=n.length>c-1?n.slice(0,c-1):n;return this.line(r+" ".repeat(this.width-r.length-a.length)+a)}wrap(s){const t=String(s??"").split(/\s+/).filter(Boolean);let n="";for(const a of t){if(!n.length){n=a;continue}n.length+1+a.length<=this.width?n+=" "+a:(this.line(n),n=a)}return n.length&&this.line(n),this}qr(s,t=8){const n=[];for(const c of String(s??"")){const r=c.codePointAt(0);r<128&&n.push(r)}this.raw([k,40,107,4,0,49,65,50,0]),this.raw([k,40,107,3,0,49,67,Math.max(1,Math.min(16,t))]),this.raw([k,40,107,3,0,49,69,49]);const a=n.length+3;return this.raw([k,40,107,a&255,a>>8&255,49,80,48]),this.raw(n),this.raw([k,40,107,3,0,49,81,48]),this}barcode128(s,{height:t=60,width:n=2,hri:a=!1}={}){const c=String(s??""),r=[];for(const d of c){const u=d.charCodeAt(0);if(u<32||u>127)return this;r.push(u)}if(!r.length)return this;this.raw([k,104,Math.max(1,Math.min(255,t))]),this.raw([k,119,Math.max(2,Math.min(6,n))]),this.raw([k,72,a?2:0]);const o=[123,66,...r];return this.raw([k,107,73,o.length]),this.raw(o),this}barcodeEan13(s){const t=String(s??"").replace(/\D/g,"");if(t.length!==13)return!1;let n=0;for(let r=0;r<12;r++)n+=Number(t[r])*(r%2===0?1:3);if((10-n%10)%10!==Number(t[12]))return!1;this.raw([k,104,60]),this.raw([k,119,2]),this.raw([k,72,2]);const c=[...t].map(r=>r.charCodeAt(0));return this.raw([k,107,67,c.length]),this.raw(c),!0}cut(){return this.feed(4).raw(S.cut)}kick(){return this.bytes.splice(S.init.length,0,...S.kick),this}build(){return this.bytes}}const De=()=>[...S.init,...S.kick],K=[{step:1e3,score:100},{step:500,score:80},{step:100,score:60},{step:50,score:40}],ze=10,ce=K[0].score;function H(e,s=K){const t=Math.round(Number(e)||0);if(t<=0)return ce;for(const n of s)if(t%n.step===0)return n.score;return ze}function le(e,s=K){let t=0,n=0;for(const a of e||[]){const c=Number(a.unitRefund)||0,r=Number(a.qty)||0,o=Math.max(0,c*r);o<=0||(n+=H(c,s)*o,t+=o)}return t>0?n/t:ce}const Ee=1e3,Ae=.02;function Ve(e,s={}){const t=Math.round(Number(e)||0);if(t<=0||H(t)>=ce)return null;const n=Math.min(s.maxCut==null?Ee:s.maxCut,t*(s.maxShare==null?Ae:s.maxShare));if(n<1)return null;for(const a of K){const c=Math.floor(t/a.step)*a.step;if(c<=0||c>=t)continue;const r=t-c;if(r<=n)return{amount:c,cut:r,score:a.score}}return null}const se=e=>Math.floor((Number(e)||0)*100)/100;function Le(e,s){const t=Number(e)||0,n=Number(s)||0;return n<=0||t<=0?0:se(t/n)}function Xe(e,s,t,n){const a=Number(n)||0;if(a<=0)return 0;const c=Number(s)||0,r=Number(t)||0,o=Le(e,c);if(r+a>=c){const d=se(o*r),u=Math.round(((Number(e)||0)-d)*100)/100;return u>0?u:0}return se(o*a)}const Oe=e=>(Number(e.salePrice)||0)*(Number(e.qty)||0),ae=e=>Math.max(0,Math.floor(Oe(e))-(Number(e.discount)||0)),me=e=>{const s=ae(e);if(s<=0)return 0;const t=e.costPrice==null?null:Number(e.costPrice);if(t==null||!Number.isFinite(t))return s;const n=s-t*(Number(e.qty)||0);return n>0?n:0};function be(e,s,t,n,a){let c=0,r=0,o=-1;for(let u=0;u<s.length;u++){const m=a(s[u]),f=Math.floor(t*m/n);e[u]+=f,c+=f,m>o&&(o=m,r=u)}const d=Math.round(t-c);d!==0&&(e[r]+=d)}function xe(e,s){const t=Number(s)||0,n=(e||[]).map(()=>0);if(t<=0||!(e!=null&&e.length))return n;const c=e.map(me).reduce((o,d)=>o+d,0);let r=t;if(c>0){const o=Math.min(r,c);r=Math.round(r-o),be(n,e,o,c,me)}if(r>0){const o=e.reduce((d,u)=>d+ae(u),0);o>0&&be(n,e,r,o,ae)}return n}const J=[1e4,5e3,1e3,500];function ue(e){const s=Number(e.salePrice)||0,t=Number(e.qty)||0,n=e.minPrice==null?null:Number(e.minPrice);if(n==null||!Number.isFinite(n))return 0;const a=(s-n)*t-(Number(e.discount)||0);return a>0?Math.floor(a):0}const de=e=>(e||[]).reduce((s,t)=>s+ue(t),0);function Ye(e,s,t=3){const n=Math.round(Number(s)||0),a=de(e);if(n<=0||a<=0)return[];if(n%J[J.length-1]===0)return[];const c=[],r=new Set;for(const o of[...J].reverse()){const d=Math.floor(n/o)*o,u=n-d;if(!(u<=0||u>a)&&!r.has(d)&&(r.add(d),c.push({target:d,discount:u}),c.length>=t))break}return c}function Re(e){const s=Number(e.salePrice)||0,t=Number(e.qty)||0,n=e.costPrice==null?null:Number(e.costPrice);if(n==null||!Number.isFinite(n))return ue(e);const a=(s-n)*t-(Number(e.discount)||0);return a>0?Math.floor(a):0}const Ie=e=>(e||[]).reduce((s,t)=>s+Re(t),0);function Je(e,s){const t=Math.round(Number(s)||0);return t<=0?"ok":t>Ie(e)?"loss":t>de(e)?"over":"ok"}const y=e=>Math.round((Number(e)||0)*100)/100,_=.005;function ye(e){const s=Number(e.salePrice)||0,t=Number(e.qty)||0,n=y(Math.max(0,s*t-(Number(e.discount)||0))),a=ue(e);return{price:s,qty:t,paid:n,room:a,unit:t>0?n/t:0}}function ee(e,s,t){const n=e.map(()=>0),a=[];e.forEach((r,o)=>{if(r.qty<=0||r.paid<=0)return;const d=Math.floor(r.unit/s)*s;if(d<=0)return;const u=y(r.paid-d*r.qty);if(u<=_||u>r.room+_)return;const m=(H(d)-H(r.unit))*r.paid;m<=0||a.push({i:o,cost:u,gain:m})}),a.sort((r,o)=>o.gain/o.cost-r.gain/r.cost||r.cost-o.cost);let c=0;for(const r of a)c+r.cost>t+_||(n[r.i]=r.cost,c=y(c+r.cost));return n}function we(e,s,t,n){const a=n.slice(),c=e.map((p,$)=>Math.max(0,p.room-a[$])),r=c.reduce((p,$)=>p+$,0),o=a.reduce((p,$)=>p+$,0),d=Math.min(t-o,r);if(d<=_)return a;const u=y(e.reduce((p,$,P)=>p+$.paid-a[P],0)),m=Math.ceil((u-d)/s)*s,f=y(u-m);if(f<=_||f>d+_)return a;let h=0,g=0;for(let p=0;p<e.length;p++){const $=Math.min(c[p],y(f*c[p]/r));a[p]=y(a[p]+$),h=y(h+$),c[p]>c[g]&&(g=p)}const v=y(f-h);return v>0&&(a[g]=y(Math.min(e[g].room,a[g]+v))),a}function ge(e,s,t){const n=t.slice(),a=e.map((m,f)=>Math.max(0,m.room-n[f])),c=a.reduce((m,f)=>m+f,0),r=y(s-n.reduce((m,f)=>m+f,0));if(r<=_||c<=_)return n;let o=0,d=0;for(let m=0;m<e.length;m++){const f=Math.min(a[m],y(r*a[m]/c));n[m]=y(n[m]+f),o=y(o+f),a[m]>a[d]&&(d=m)}const u=y(r-o);return u>0&&(n[d]=y(Math.min(e[d].room,n[d]+u))),n}function Ue(e,s){const t=e.map((h,g)=>({paid:y(h.paid-s[g]),qty:h.qty})),n=t.map(h=>h.qty>0?h.paid/h.qty:0),a=le(t.map((h,g)=>({unitRefund:n[g],qty:h.qty})));let c=0,r=0;t.forEach((h,g)=>{h.paid<=0||(c++,H(n[g])>=60&&r++)});const o=c?r/c:1,d=y(t.reduce((h,g)=>h+g.paid,0));let u=1,m=0;e.forEach((h,g)=>{if(h.paid<=0)return;const v=s[g]/h.paid;v<u&&(u=v),v>m&&(m=v)});const f=c?Math.max(0,Math.min(1,1-(m-u))):1;return{refund:a,roundItems:o,roundTotal:H(d),even:f,total:d}}function je(e,s){const t=n=>Math.round(n*100)/100;return t(s.score.refund)-t(e.score.refund)||t(s.score.roundItems)-t(e.score.roundItems)||s.score.roundTotal-e.score.roundTotal||s.discount-e.discount||t(s.score.even)-t(e.score.even)}function et(e,s,t=3){const n=Math.min(Math.round(Number(s)||0),de(e));if(!(e!=null&&e.length)||n<=0)return[];const a=e.map(ye);if(a.every(f=>f.paid<=0))return[];const c=le(a.map(f=>({unitRefund:f.unit,qty:f.qty}))),r=a.map(()=>0),o=K.map(f=>f.step),d=[];for(const f of o)d.push(ee(a,f,n));for(const f of o)d.push(we(a,f,n,r));for(const f of o){const h=ee(a,f,n);if(!h.every(g=>g<=_))for(const g of o)d.push(we(a,g,n,h))}d.push(ge(a,n,r));for(const f of o){const h=ee(a,f,n);h.every(g=>g<=_)||d.push(ge(a,n,h))}const u=new Set,m=[];for(const f of d){const h=y(f.reduce((p,$)=>p+$,0));if(h<=_||h>n+_||f.some((p,$)=>p<-_||p>a[$].room+_))continue;const g=f.map(p=>p.toFixed(2)).join("|");if(u.has(g))continue;u.add(g);const v=Ue(a,f);v.refund<c-_||m.push({discount:h,total:v.total,add:f,units:a.map((p,$)=>p.qty>0?y((p.paid-f[$])/p.qty):0),score:v,gain:Math.round(v.refund-c),exact:h>=n-_})}return m.sort(je),m.slice(0,t)}function tt(e){const s=(e||[]).map(ye);return le(s.map(t=>({unitRefund:t.unit,qty:t.qty})))}async function nt(){if(!M())return[];try{return await te("list_printers")||[]}catch{return[]}}function ke(e){return M()?e.transport==="tcp"?"tcp":"windows":"browser"}let ie=null;const st=()=>ie;function ve(e,s){ie={ok:e,at:Date.now(),error:s?String(s.message||s):null};try{window.dispatchEvent(new CustomEvent("ek:printer",{detail:ie}))}catch{}}async function A(e){const s=q();if(!M())throw new Error(i("hw.errNoDesktop"));try{let t;if(ke(s)==="tcp"){if(!s.host)throw new Error(i("hw.errNoHost"));t=await te("print_tcp",{host:s.host,port:Number(s.port)||9100,data:e})}else t=await te("print_raw",{printer:s.printerName||null,data:e});return ve(!0,null),t}catch(t){throw ve(!1,t),t}}function Be({saleId:e,serverSaleId:s,cart:t=[],total:n=0,subtotal:a,discount:c=0,payType:r,payments:o,customer:d,offline:u,shopName:m,cashier:f,fiscal:h,receiptUrl:g,credit:v,toSavings:p,rounding:$=0}){const P=q(),w=new R(P.width===58?O:E),Z=re(m);w.center().double().line(Z.name).double(!1),Z.phone&&w.line(Z.phone),w.line(i("kassa.receiptSystem")),w.left().rule(),w.row(`${i("kassa.receiptNo")} ${e??"-"}`,new Date().toLocaleString("uz-UZ")),f&&w.row(i("kassa.receiptCashier"),f),w.rule();const Q=xe(t,c);t.forEach((x,C)=>{w.wrap(x.name);const D=`${V(x.qty,x.unitDecimals)}${x.unit?" "+X(x.unit):""}`;w.row(`  ${D} x ${b(x.salePrice)}`,ne(x.salePrice*x.qty));const T=(Number(x.discount)||0)+(Q[C]||0);T>0&&w.row(`    ${i("kassa.discount")}`,"-"+b(T))}),w.rule();const W=t.reduce((x,C)=>x+(Number(C.discount)||0),0),L=c+W;if(L>0&&(w.row(i("kassa.receiptSubtotal"),b(a??n+L)),w.row(i("kassa.discount"),"-"+b(L))),Number($)>0&&w.row(i("kassa.rounding"),"-"+ne($)),w.bold().double().row(i("kassa.receiptTotal"),b(n)).double(!1).bold(!1),w.row(i("kassa.receiptPayment"),z(r)),Array.isArray(o)&&o.length>1)for(const x of o)w.row("  "+z(x.type),b(x.amount));Number(p)>0&&w.row(i("savings.toSavings"),"+"+b(p)),d!=null&&d.fullName&&w.row(i("kassa.receiptCustomer"),d.fullName),v&&Number(v.amount)>0&&(w.rule(),w.center().bold().line(i("kassa.receiptCredit")).bold(!1).left(),w.row(i("kassa.receiptCreditThis"),b(v.amount)),v.balance!=null&&w.row(i("kassa.receiptCreditTotal"),b(v.balance)),v.dueDate&&w.row(i("kassa.receiptCreditDue"),v.dueDate),w.feed().row(i("kassa.receiptCreditSign"),"______________")),u&&w.feed().center().line(i("kassa.receiptOffline")).line(i("kassa.receiptOfflineSub")).left();const F=t.reduce((x,C)=>{const D=Number(C.vatRate);if(!D)return x;const T=Number(C.salePrice)*Number(C.qty);return x+(C.priceIncludesVat===!1?T*D/100:T*D/(100+D))},0);if(F>0&&w.row(i("kassa.receiptVat"),b(F)),h!=null&&h.fiscalSign&&(w.rule(),w.center().line(i("kassa.receiptFiscal")).left(),w.row(i("kassa.receiptFiscalSign"),h.fiscalSign),h.terminalId&&w.row(i("kassa.receiptTerminal"),h.terminalId),h.receiptNo&&w.row(i("kassa.receiptFiscalNo"),h.receiptNo),h.qrUrl&&w.feed().center().qr(h.qrUrl).left()),s){const x=B(s);w.feed().center().barcode128(x).line(x).left()}return g&&w.feed().center().qr(g,6).line(i("kassa.receiptQrHint")).left(),w.rule(),w.center().line(i("kassa.receiptThanks")).line("e-kassam.uz"),w}async function at(e){const s=q();if(!M())return Ne(e);const t=Be(e);s.openDrawer&&e.payType==="CASH"&&t.kick(),t.cut(),await A(t.build())}function _e(e){const s=String(e||"").startsWith("SAVINGS_");if(!s)return{sav:s,title:i("kassa.receiptDebtPay"),main:i("kassa.receiptPaid"),before:i("credit.wasDebt"),after:i("kassa.receiptDebtLeft")};const t=String(e).slice(8);return{sav:s,title:i("savings.receiptTitle"),main:i(`savings.rcp.${t}`),before:i("savings.wasBalance"),after:i("savings.nowBalance")}}function He({customer:e,amount:s,balanceAfter:t,balanceBefore:n,method:a,shopName:c,cashier:r,date:o,receiptNo:d,qrUrl:u,toSavings:m,bonusEarned:f,kind:h,linkedNo:g}){const v=q(),p=new R(v.width===58?O:E),$=_e(h),P=re(c);return p.center().double().line(P.name).double(!1),P.phone&&p.line(P.phone),p.line($.title),p.left().rule(),d&&p.row(i("kassa.receiptNo"),d),p.row(i("common.date"),(o||new Date).toLocaleString("uz-UZ")),r&&p.row(i("kassa.receiptCashier"),r),e!=null&&e.fullName&&p.row(i("kassa.receiptCustomer"),e.fullName),p.rule(),p.bold().double().row($.main,b(Math.abs(Number(s)||0))).double(!1).bold(!1),(a||!$.sav)&&p.row(i("kassa.receiptPayment"),z(a)),g&&p.row(i("savings.linkedSale"),g),n!=null&&p.row($.before,b(n)),p.row($.after,b(t??0)),Number(m)>0&&p.row(i("savings.toSavings"),b(m)),Number(f)>0&&p.row(i("kassa.receiptBonusEarned"),"+"+b(f)),u&&(p.rule(),p.center().line(i("kassa.receiptQrHint")),p.qr(u,6)),p.rule(),p.center().line(i("kassa.receiptThanks")).line("e-kassam.uz"),p}async function it(e){const s=q();if(!M())return Ne({...e,__debt:!0});const t=He(e);s.openDrawer&&e.method==="CASH"&&t.kick(),t.cut(),await A(t.build())}async function rt({fullName:e,username:s,version:t,token:n,shopName:a}){if(!M())throw new Error(i("hw.errNoDesktop"));const c=q(),r=new R(c.width===58?O:E);r.center().double().line(i("badge.printTitle")).double(!1),r.line(a||"E-KASSAM.UZ"),r.left().rule(),r.center().bold().line(e||s||"-").bold(!1),r.line("@"+(s||"-")),r.line(`${i("badge.version")} ${t??1}`),r.feed(),r.qr(n,8),r.feed(),r.line(new Date().toLocaleString("uz-UZ")),r.left().rule(),r.wrap(i("badge.printWarn")),r.cut(),await A(r.build())}async function ot(e,s){var c;if(!M())throw new Error(i("hw.errNoDesktop"));const t=q(),n=new R(t.width===58?O:E),a=r=>r?new Date(r).toLocaleString("uz-UZ",{dateStyle:"short",timeStyle:"short"}):"-";n.center().double().line(e.closedAt?"Z-HISOBOT":"X-HISOBOT").double(!1),n.line(s||"E-KASSAM.UZ"),n.left().rule(),n.row(i("sales.colCashier"),e.cashierName||"-"),n.row(i("sec.openedAt"),a(e.openedAt)),e.closedAt&&n.row(i("shift.closedAt"),a(e.closedAt)),n.rule(),n.row(i("rpt.salesCount"),String(e.salesCount)),n.bold().row(i("rpt.salesTotal"),b(e.salesTotal)).bold(!1);for(const[r,o]of Object.entries(e.byPaymentType||{}))n.row("  "+z(r),b(o));if(n.rule(),n.row(i("rpt.cancelled"),`${e.cancelledCount} / ${b(e.cancelledTotal)}`),n.row(i("rpt.confirmations"),String(e.confirmationsCount)),e.suspiciousCount>0&&n.bold().row(i("rpt.suspicious"),String(e.suspiciousCount)).bold(!1),e.cash&&(n.rule(),n.row(i("cash.openingFloat"),b(e.cash.openingFloat)),e.cash.expectedCash!=null&&n.row(i("cash.expected"),b(e.cash.expectedCash)),e.cash.countedCash!=null&&(n.bold().row(i("cash.counted"),b(e.cash.countedCash)).bold(!1),n.bold().row(i("cash.difference"),b(e.cash.difference)).bold(!1))),(c=e.nonCash)!=null&&c.length){n.rule(),n.line(i("noncash.title"));for(const r of e.nonCash)r.counted==null?n.row("  "+z(r.paymentType),r.expected==null?"-":b(r.expected)):(n.row("  "+z(r.paymentType),`${b(r.expected)} / ${b(r.counted)}`),Number(r.difference)!==0&&n.bold().row("  "+i("cash.difference"),b(r.difference)).bold(!1))}n.rule(),n.center().line(new Date().toLocaleString("uz-UZ")).line("e-kassam.uz"),n.cut(),await A(n.build())}async function ct(){if(!M())throw new Error(i("hw.errNoDesktop"));await A(De())}async function lt(e=[],s={}){if(!M())throw new Error(i("hw.errNoDesktop"));await A(Ze(e,s))}function Ze(e=[],{copies:s=1,shopName:t,width:n}={}){const a=(e||[]).filter(Boolean);if(!a.length)throw new Error(i("label.nothing"));const c=q(),r=n??(c.width===58?O:E),o=new R(r),d=Math.max(1,Math.min(20,Number(s)||1));for(const u of a)for(let m=0;m<d;m++)o.center(),t&&o.line(t),o.bold().wrap(u.name||"-").bold(!1),o.feed(),o.double().line(b(u.salePrice)).double(!1),u.oldPrice!=null&&Number(u.oldPrice)>Number(u.salePrice)&&o.line(`${i("label.oldPrice")}: ${b(u.oldPrice)}`),o.feed(),u.barcode&&(o.barcodeEan13(u.barcode)||o.barcode128(u.barcode,{hri:!0}),o.feed()),o.line(new Date().toLocaleDateString("uz-UZ")),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}async function ut(e=[],s={}){const t=(e||[]).filter(Boolean);if(!t.length)throw new Error(i("label.nothing"));if(!M())return Ge(t,s);await A(Fe(t,s))}function Fe(e=[],{copies:s=1,shopName:t,width:n}={}){const a=(e||[]).filter(Boolean);if(!a.length)throw new Error(i("label.nothing"));const c=q(),r=n??(c.width===58?O:E),o=new R(r),d=Math.max(1,Math.min(20,Number(s)||1));for(const u of a)for(let m=0;m<d;m++)o.center(),t&&o.line(t),o.bold().line(i("label.expiryTitle")).bold(!1),o.bold().wrap(u.name||"-").bold(!1),o.feed(),o.double().line($e(u.expiryDate)).double(!1),u.daysLeft!=null&&o.line(u.daysLeft<=0?i("label.expiryToday"):i("inv.nearDays",{n:u.daysLeft})),u.salePrice!=null&&o.line(b(u.salePrice)),o.feed(),u.barcode&&(o.barcodeEan13(u.barcode)||o.barcode128(u.barcode,{hri:!0}),o.feed()),o.left().line("- ".repeat(Math.floor(o.width/2)).trimEnd()).center();return o.cut(),o.build()}function Ge(e,{shopName:s}={}){const t=window.open("","_blank","width=820,height=900");if(!t)throw new Error(i("hw.errPopup"));const n=c=>String(c??"").replace(/[&<>"]/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[r]),a=e.map(c=>{const r=c.daysLeft,o=r==null?"":r<=0?i("label.expiryToday"):i("inv.nearDays",{n:r});return`<div class="lbl">
      <div class="hdr">${n(i("label.expiryTitle"))}</div>
      <div class="nm">${n(c.name||"-")}</div>
      <div class="dt">${n($e(c.expiryDate))}</div>
      ${o?`<div class="lf">${n(o)}</div>`:""}
      ${c.salePrice!=null?`<div class="pr">${n(b(c.salePrice))}</div>`:""}
      ${c.barcode?`<div class="bc">${oe(String(c.barcode),{height:22})}</div>`:""}
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
    </style></head><body>${a}</body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},Promise.resolve()}async function dt(e,s={}){if(!e)throw new Error(i("label.nothing"));if(!M())return Qe(e,s);await A(Ke(e,s))}function Ke(e,{shopName:s,width:t}={}){const n=q(),a=new R(t??(n.width===58?O:E));a.center().double().line(i("pickup.slipTitle")).double(!1),s&&a.line(s),a.left().rule(),a.row(`${i("kassa.receiptNo")} ${e.saleCode||"-"}`,e.createdAt?new Date(e.createdAt).toLocaleString("uz-UZ"):""),e.cashierName&&a.row(i("kassa.receiptCashier"),e.cashierName),e.customerName&&a.row(i("kassa.receiptCustomer"),e.customerName),e.customerPhone&&a.row(i("common.phone"),e.customerPhone),a.rule();for(const c of e.items||[])a.wrap(c.productName),a.double().line(`  ${V(c.quantity)} ${X(c.unit)}`).double(!1);if(a.rule(),e.saleId){const c=B(e.saleId);a.feed().center().barcode128(c).line(c).left()}return a.feed(),a.row(i("pickup.signStore"),"______________"),a.feed().row(i("pickup.signCustomer"),"______________"),a.cut(),a.build()}function Qe(e,{shopName:s}={}){const t=window.open("","_blank","width=360,height=640");if(!t)throw new Error(i("hw.errPopup"));const n=q().width===58?58:80,a=r=>String(r??"").replace(/[&<>"]/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[o]),c=(e.items||[]).map(r=>`<div class="it"><div class="nm">${a(r.productName)}</div>
     <div class="qt">${a(V(r.quantity))} ${a(X(r.unit))}</div></div>`).join("");return t.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
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
      ${e.saleId?`<div class="c">${oe(B(e.saleId),{height:14})}
        <div><b>${a(B(e.saleId))}</b></div></div>`:""}
      <div class="row" style="margin-top:14px"><span>${a(i("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${a(i("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},Promise.resolve()}async function pt(){const e=q(),s=new R(e.width===58?O:E);s.center().double().line(i("hw.testTitle")).double(!1),s.line(new Date().toLocaleString("uz-UZ")),s.left().rule();const t=ke(e);s.row(i("hw.transport"),t),s.row(i("hw.printer"),t==="tcp"?`${e.host}:${e.port}`:e.printerName||i("hw.defaultPrinter")),s.row(i("hw.width"),`${e.width} mm`),s.rule(),s.line("1234567890".repeat(6).slice(0,s.width)),s.center().line(i("hw.testOk")),s.cut(),await A(s.build())}function Ne({saleId:e,serverSaleId:s,cart:t=[],total:n=0,subtotal:a,discount:c=0,payType:r,payments:o,customer:d,offline:u,shopName:m,cashier:f,receiptUrl:h,credit:g,__debt:v,amount:p,balanceAfter:$,balanceBefore:P,method:w,date:Z,receiptNo:Q,qrUrl:W,toSavings:L,bonusEarned:F,kind:x,linkedNo:C,rounding:D=0}){const T=window.open("","_blank","width=360,height=640,toolbar=no,menubar=no");if(!T)throw new Error(i("hw.errPopup"));const U=_e(x),pe=q().width===58?58:80,j=re(m),l=N=>String(N??"").replace(/[&<>"]/g,G=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[G]),Se=xe(t,c),qe=t.reduce((N,G)=>N+(Number(G.discount)||0),0),Y=c+qe,Te=t.map((N,G)=>{const Me=`${V(N.qty,N.unitDecimals)}${N.unit?" "+X(N.unit):""}`,fe=(Number(N.discount)||0)+(Se[G]||0);return`<div class="row"><span>${l(N.name)} × ${l(Me)}</span><span>${l(b(N.salePrice*N.qty))}</span></div>`+(fe>0?`<div class="row sub"><span>${l(i("kassa.discount"))}</span><span>-${l(b(fe))}</span></div>`:"")}).join(""),Ce=v?`
      <div class="c"><div class="logo">${l(j.name)}</div>
        ${j.phone?`<small>${l(j.phone)}</small><br>`:""}
        <small>${l(U.title)}</small></div>
      <div class="hr"></div>
      ${Q?`<div class="row"><span>${l(i("kassa.receiptNo"))}</span><span>${l(Q)}</span></div>`:""}
      <div class="row"><span>${l(i("common.date"))}</span><span>${l((Z||new Date).toLocaleString("uz-UZ"))}</span></div>
      ${f?`<div class="row"><span>${l(i("kassa.receiptCashier"))}</span><span>${l(f)}</span></div>`:""}
      ${d!=null&&d.fullName?`<div class="row"><span>${l(i("kassa.receiptCustomer"))}</span><span>${l(d.fullName)}</span></div>`:""}
      <div class="hr"></div>
      <div class="row"><b>${l(U.main)}</b><b>${l(b(Math.abs(Number(p)||0)))}</b></div>
      ${w||!U.sav?`<div class="row"><span>${l(i("kassa.receiptPayment"))}</span><span>${l(z(w))}</span></div>`:""}
      ${C?`<div class="row"><span>${l(i("savings.linkedSale"))}</span><span>${l(C)}</span></div>`:""}
      ${P!=null?`<div class="row"><span>${l(U.before)}</span><span>${l(b(P))}</span></div>`:""}
      <div class="row"><span>${l(U.after)}</span><span>${l(b($??0))}</span></div>
      ${Number(L)>0?`<div class="row"><span>${l(i("savings.toSavings"))}</span><span>${l(b(L))}</span></div>`:""}
      ${Number(F)>0?`<div class="row"><span>${l(i("kassa.receiptBonusEarned"))}</span><span>+${l(b(F))}</span></div>`:""}
      ${W?`<div class="hr"></div><div class="c">
        ${he(W,{size:96,margin:1})}
        <small>${l(i("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(i("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`:"";T.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${l(v?U.title:i("kassa.receiptNo")+" "+e)}</title>
    <style>
      /* CHEK QOG'OZI - A4 EMAS.
         @page bo'lmasa brauzer chekni A4 sahifaga joylashtiradi, chetiga
         o'z sarlavha-izohini (manzil, sana, bet raqami) qo'shadi va matn
         chek printeriga umuman sig'maydi - aynan shu "noto'g'ri format"
         edi. margin:0 esa brauzerning o'sha sarlavhalarini olib tashlaydi.
         Balandlik auto: chek uzunligi tovar soniga qarab o'zgaradi. */
      @page { size: ${pe}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${pe}mm; padding: 3mm; }
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
      ${Ce}
      ${v?"":`
      <div class="c"><div class="logo">${l(j.name)}</div>
        ${j.phone?`<small>${l(j.phone)}</small><br>`:""}
        <small>${l(i("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${l(i("kassa.receiptNo"))} ${l(e)}</span><span>${l(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${Te}
      <div class="hr"></div>
      ${Y>0?`<div class="row"><span>${l(i("kassa.receiptSubtotal"))}</span><span>${l(b(a??n+Y))}</span></div>
      <div class="row"><span>${l(i("kassa.discount"))}</span><span>-${l(b(Y))}</span></div>`:""}
      ${Number(D)>0?`<div class="row"><span>${l(i("kassa.rounding"))}</span><span>-${l(ne(D))}</span></div>`:""}
      <div class="row"><b>${l(i("kassa.receiptTotal"))}</b><b>${l(b(n))}</b></div>
      <div class="row"><span>${l(i("kassa.receiptPayment"))}</span><span>${l(z(r))}</span></div>
      ${Array.isArray(o)&&o.length>1?o.map(N=>`<div class="row"><span>&nbsp;&nbsp;${l(z(N.type))}</span><span>${l(b(N.amount))}</span></div>`).join(""):""}
      ${Number(L)>0&&!v?`<div class="row"><span>${l(i("savings.toSavings"))}</span><span>+${l(b(L))}</span></div>`:""}
      ${d!=null&&d.fullName?`<div class="row"><span>${l(i("kassa.receiptCustomer"))}</span><span>${l(d.fullName)}</span></div>`:""}
      ${g&&Number(g.amount)>0?`<div class="hr"></div>
      <div class="c"><b>${l(i("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${l(i("kassa.receiptCreditThis"))}</span><b>${l(b(g.amount))}</b></div>
      ${g.balance!=null?`<div class="row"><span>${l(i("kassa.receiptCreditTotal"))}</span><span>${l(b(g.balance))}</span></div>`:""}
      ${g.dueDate?`<div class="row"><span>${l(i("kassa.receiptCreditDue"))}</span><span>${l(g.dueDate)}</span></div>`:""}
      <div class="row" style="margin-top:10px"><span>${l(i("kassa.receiptCreditSign"))}</span><span>______________</span></div>`:""}
      ${u?`<div class="off">${l(i("kassa.receiptOffline"))}<br>${l(i("kassa.receiptOfflineSub"))}</div>`:""}
      ${s?`<div class="c" style="margin-top:6px">
        ${oe(B(s),{height:12})}
        <div class="no">${l(B(s))}</div>
      </div>`:""}
      ${h?`<div class="c" style="margin-top:8px">
        ${he(h,{size:96,margin:1})}
        <small>${l(i("kassa.receiptQrHint"))}</small>
      </div>`:""}
      <div class="hr"></div>
      <div class="c"><p>${l(i("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`}
    </body></html>`),T.document.close(),T.onafterprint=()=>T.close(),setTimeout(()=>T.print(),60)}export{ce as T,ut as a,dt as b,it as c,ot as d,st as e,tt as f,de as g,Ie as h,Je as i,at as j,ct as k,Xe as l,Ve as m,nt as n,et as o,lt as p,rt as q,Ye as r,xe as s,pt as t};
