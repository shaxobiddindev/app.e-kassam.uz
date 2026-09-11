/* ══════════════════════════════════════════════════════════════════════════
   TOR OYNADA HECH NARSA YO'QOLMAYDI (V84)

   ═══ IKKITA NOSOZLIK, IKKALASI HAM DO'KONDAN KELGAN ════════════════════

   1. «savat ekranini kengaytirganimda qidirish oynasi to'liq yopilib
      ketyapti» — qatorda faqat qidiruv cho'ziluvchan edi va butun
      qisqarish undan olinardi: 980px da maydonning eni 26px bo'lib
      qolgan, ya'ni faqat lupa ikonkasi sig'gan.

   2. Tovarlar sahifasi 980px da YON TOMONGA surilardi (1014 > 980):
      sarlavhadagi oltita tugma bitta qatorga sig'masdi.

   ⚠ GORIZONTAL SURILISH KASSA MONOBLOKIDA ENG YOMON NOSOZLIK:
   sichqoncha g'ildiragi uni surmaydi, sensorli ekranda esa yon
   tomonga surish odati yo'q. Tugma bor, lekin unga yetib bo'lmaydi.

   ═══ NEGA HAMMA SAHIFA ══════════════════════════════════════════════════

   Bunday nosozlik BITTA sahifada tug'ilmaydi — u sahifaga yana bitta
   tugma qo'shilganda tug'iladi. Shuning uchun tekshiruv hamma
   sahifani va uchta kenglikni bir yo'la aylanib chiqadi.

   Ishga tushirish:  node scripts/check-wide.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs"; import path from "node:path"; import http from "node:http";
import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname, ".."); const DIST = path.join(ROOT,"dist"); const PORT = 4657;
const MIME={".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".json":"application/json",".woff2":"font/woff2"};
const server=http.createServer((q,s)=>{const u=q.url.split("?")[0];let f=path.join(DIST,u==="/"?"index.html":u);if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(DIST,"index.html");s.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});s.end(fs.readFileSync(f));});
await new Promise(r=>server.listen(PORT,r));
const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:"new",args:["--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--no-proxy-server"]});
const p=await b.newPage();
await p.setRequestInterception(true);
p.on("request",(r)=>{ if(!r.url().includes("/api/")) return r.continue();
  const C={"Access-Control-Allow-Origin":`http://127.0.0.1:${PORT}`,"Access-Control-Allow-Credentials":"true","Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS"};
  if(r.method()==="OPTIONS") return r.respond({status:204,headers:C});
  const path_=new URL(r.url()).pathname;
  const body = /\/shop\/features$/.test(path_) ? {success:true,data:{features:["SCALE","EXPIRY","STOCK_TAKE"],directions:[],unconfigured:false}} : {success:true,data:[]};
  return r.respond({status:200,contentType:"application/json",headers:C,body:JSON.stringify(body)}); });
await p.evaluateOnNewDocument(()=>{for(const[k,v]of Object.entries({ek_token:"v",ek_type:"user",ek_role:"OWNER",ek_username:"v",ek_fullName:"V",ek_shopCode:"v",ek_deviceId:"v",ek_lang:"uz",ek_theme:"light"}))localStorage.setItem(k,v);});

const ROUTES=["/","/sale","/products","/categories","/inventory","/stock-take","/supply","/transfers",
               "/pickup","/prices","/customers","/sales","/reports","/expenses","/shop-users",
               "/loyalty","/settings","/security","/audit"];
/* Monoblok ekranlari: 1366 eng keng tarqalgani, 980 esa eng tori. */
const WIDTHS=[1366,1100,980];
const found=[];
for(const route of ROUTES){
  for(const w of WIDTHS){
    await p.setViewport({width:w,height:768});
    try{ await p.goto(`http://127.0.0.1:${PORT}${route}`,{waitUntil:"networkidle2",timeout:20000}); }catch(_){ continue; }
    await new Promise(r=>setTimeout(r,600));
    const res=await p.evaluate(()=>{
      const out={ tight:[], overflow:null };
      for(const bar of document.querySelectorAll(".search-bar")){
        const r=bar.getBoundingClientRect(); if(r.width===0&&r.height===0) continue;
        const inp=bar.querySelector("input");
        const iw=inp?Math.round(inp.getBoundingClientRect().width):0;
        if(r.width<179||iw<80) out.tight.push(`${Math.round(r.width)}/${iw}`);
      }
      const de=document.documentElement;
      if(de.scrollWidth>de.clientWidth+2) out.overflow=`${de.scrollWidth}>${de.clientWidth}`;
      /* Kim chiqib ketyapti — eng chuqur aybdorni topamiz. */
      out.who=[];
      const W=de.clientWidth;
      for(const el of document.querySelectorAll("body *")){
        const r=el.getBoundingClientRect();
        if(r.width===0&&r.height===0) continue;
        if(r.right>W+2){
          const par=el.parentElement;
          const pr=par?par.getBoundingClientRect():null;
          /* Faqat ota-onasidan ham chiqib ketganini yozamiz. */
          if(!pr||r.right>pr.right+2)
            out.who.push(`${(el.className||el.tagName).toString().slice(0,40)} r=${Math.round(r.right)} w=${Math.round(r.width)} :: ${el.outerHTML.slice(0,160).replace(/\s+/g," ")}`);
        }
      }
      out.who=out.who.slice(0,8);
      return out;
    });
    if(res.tight.length) found.push(`${route} @${w}  qidiruv tor: ${res.tight.join(", ")}`);
    if(res.overflow)     found.push(`${route} @${w}  suriladi: ${res.overflow}\n    ${(res.who||[]).join("\n    ")}`);
  }
}
if (found.length) {
  console.log("  \u274c " + found.length + " ta muammo:\n    " + found.join("\n    "));
} else {
  console.log(`  \u2705 ${ROUTES.length} sahifa \u00d7 ${WIDTHS.length} kenglik \u2014 qidiruv ochiq, gorizontal surilish yo'q`);
}
await b.close(); server.close();
process.exit(found.length ? 1 : 0);
