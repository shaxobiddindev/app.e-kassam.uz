/* ══════════════════════════════════════════════════════════════════════════
   HOOK TARTIBI — shartli `return` dan KEYIN hook chaqirilmasin

   ═══ NEGA BU TEKSHIRUV BOR ════════════════════════════════════════════

   HAQIQIY XATO. Sanoq sahifasida `useDataFilter` shartli `return`
   dan keyin qo'yilgan edi:

       if (session === undefined || busy) {
         return <Skeleton/>;            // ← yuklanayotganda
       }
       ...
       const hFlt = useDataFilter(...);  // ← faqat yuklangach

   Birinchi chizishda hooklar soni kam, ikkinchisida ko'p — React
   buni «Rendered more hooks than during the previous render» (#310)
   deb butun bo'limni yiqitadi. Ekranda foydalanuvchi «Bu bo'limda
   xatolik yuz berdi» degan oynani ko'radi.

   ⚠ XATO KO'RINMAYDI: `npm run build` o'tadi, ESLint yo'q, sahifa
   ochilganda esa hammasi joyida — chunki birinchi chizish
   skeletonda tugaydi. Yiqilish faqat ma'lumot KELGANDA yuz beradi
   va ishlab chiqishda tez internet tufayli u ko'pincha sezilmaydi.

   ⚠ Bu tekshiruv HAQIQIY PARSER bilan ishlaydi (`@babel/parser`),
   qidiruv bilan emas: birinchi urinishda `if (x) {` va `return` boshqa
   qatorda bo'lgani uchun oddiy `grep` uni TOPMADI va xato «yo'q» deb
   xulosa qilingan edi.

   Ishga tushirish:  node scripts/check-hooks.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

/** Barcha `.jsx` va `.js` fayllar. */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const isHookName = (n) => typeof n === "string" && /^use[A-Z]/.test(n);

/**
 * MODUL darajasidagi o'zgarmaslar.
 *
 * ⚠ Ular bo'yicha shoxlangan erta `return` XAVFSIZ: qiymat modul bir
 * marta yuklanganda hisoblanadi va har render'da BIR XIL shox
 * tanlanadi, ya'ni hooklar soni o'zgarmaydi. `App.jsx` dagi
 * `IS_PORTAL` va `IS_APP_WEB` aynan shunday va u yerda buning izohi
 * ham yozilgan.
 *
 * Bu qoidasiz tekshiruv to'g'ri kodni «xato» deb ko'rsatardi va
 * birinchi yolg'on ogohlantirishdan keyin unga qaralmay qo'yardi.
 */
function moduleConstants(program) {
  const out = new Set();
  for (const st of program.body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (decl?.type !== "VariableDeclaration" || decl.kind !== "const") continue;
    for (const d of decl.declarations) {
      if (d.id.type === "Identifier") out.add(d.id.name);
    }
  }
  return out;
}

/** Shart FAQAT modul o'zgarmaslari va adabiyotlardan iboratmi. */
function isStableTest(node, consts) {
  if (!node || typeof node !== "object") return true;
  switch (node.type) {
    case "Identifier":       return consts.has(node.name);
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
    case "NullLiteral":      return true;
    case "UnaryExpression":  return isStableTest(node.argument, consts);
    case "LogicalExpression":
    case "BinaryExpression": return isStableTest(node.left, consts) && isStableTest(node.right, consts);
    default:                 return false;
  }
}

/** Chaqiruv hookmi: `useX(...)` yoki `React.useX(...)`. */
function hookCall(node) {
  if (node.type !== "CallExpression") return null;
  const c = node.callee;
  if (c.type === "Identifier" && isHookName(c.name)) return c.name;
  if (c.type === "MemberExpression" && c.property?.type === "Identifier"
      && isHookName(c.property.name)) return c.property.name;
  return null;
}

/** Komponentmi: nomi katta harf bilan boshlanadigan funksiya. */
const isComponentName = (n) => typeof n === "string" && /^[A-Z]/.test(n);

const problems = [];

function checkComponent(name, body, file, code, consts) {
  /* Funksiya TANASIDAGI to'g'ridan-to'g'ri gaplar bo'yicha yuriladi.
     Ichki funksiyalarga KIRILMAYDI: ulardagi `return` komponentning
     chizilishini to'xtatmaydi (`onClick` ichidagi `return` — oddiy
     ish). */
  let returnedAt = null;

  const scan = (node, depth) => {
    if (!node || typeof node !== "object") return;

    /* Ichki funksiya — o'z hikoyasi, unga kirmaymiz. */
    if (depth > 0 && /Function(Declaration|Expression)|ArrowFunctionExpression/.test(node.type)) return;

    /* Modul o'zgarmasi bo'yicha shoxlangan `if` — o'tkazib
       yuboriladi: undagi `return` hooklar tartibini buzmaydi. */
    if (node.type === "IfStatement" && isStableTest(node.test, consts)) {
      scan(node.alternate, depth);
      return;
    }

    if (node.type === "ReturnStatement" && returnedAt === null) {
      returnedAt = node.loc.start.line;
    }

    const hook = hookCall(node);
    if (hook && returnedAt !== null) {
      problems.push({
        file: path.relative(ROOT, file), component: name, hook,
        hookLine: node.loc.start.line, returnLine: returnedAt,
      });
    }

    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((x) => scan(x, depth + 1));
      else if (v && typeof v.type === "string") scan(v, depth + 1);
    }
  };

  body.body?.forEach((st) => scan(st, 0));
}

/** Faylda hook ishlatiladigan komponentlarni topadi. */
function checkFile(file) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["jsx"], errorRecovery: true });
  } catch (e) {
    console.log(`  ⚠ ${path.relative(ROOT, file)} o'qilmadi: ${e.message}`);
    return;
  }

  const consts = moduleConstants(ast.program);

  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    let name = null, body = null;
    if (node.type === "FunctionDeclaration" && isComponentName(node.id?.name)) {
      name = node.id.name; body = node.body;
    } else if (node.type === "VariableDeclarator" && isComponentName(node.id?.name)
               && /ArrowFunctionExpression|FunctionExpression/.test(node.init?.type || "")
               && node.init.body?.type === "BlockStatement") {
      name = node.id.name; body = node.init.body;
    }
    if (name && body) checkComponent(name, body, file, code, consts);

    for (const key of Object.keys(node)) {
      if (key === "loc") continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === "string") visit(v);
    }
  };
  visit(ast.program);
}

walk(SRC).forEach(checkFile);

if (problems.length) {
  console.log("\n  ❌ SHARTLI `return` DAN KEYIN HOOK — React #310 yiqilishi:\n");
  for (const p of problems) {
    console.log(`     ${p.file}  ${p.component}()`);
    console.log(`        ${p.returnLine}-qatorda return, ${p.hookLine}-qatorda ${p.hook}()`);
  }
  console.log("\n     Yechim: hookni erta `return` dan YUQORIGA ko'chiring.\n");
  process.exit(1);
}
console.log("  ✅ Hamma hook shartli `return` dan OLDIN chaqiriladi");
