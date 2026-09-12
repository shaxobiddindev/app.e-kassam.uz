/* ══════════════════════════════════════════════════════════════════════════
   KO'K KARTOCHKA USTIDAGI MATN — KONTRAST QOROVULI (V88)

   ⚠ NEGA BOR. Savat jamlanmasi (`.total-card`) — TO'Q KO'K fon, ustidagi
   hamma narsa oq bo'lishi kerak. Uning ichiga qo'yiladigan yangi blok
   esa odatda boshqa joydan ko'chiriladi va u yerda fon OQ bo'lgan:
   ranglar `--fg-secondary`, `--bg-brand` kabi «to'q» tokenlardan
   olingan bo'ladi.

   Aynan shu 2026-09-06 da yuz berdi: «birga olinadi» taklifi (V79) ko'k
   kartochka ichida turardi-yu, uslubi oq fon uchun yozilgan edi —
   yorliq to'q siyoh rangda, tugmaning MATNI HAM, PUNKTIR CHEGARASI HAM
   ko'k. Ya'ni KO'K FONDA KO'K: blok butunlay ko'rinmasdi va faqat
   `:hover` da paydo bo'lardi. Sensorli kassa monoblogida esa hover
   umuman yo'q — funksiya bor edi, foydalanuvchisi yo'q edi.

   Xato jimgina: hech narsa buzilmaydi, sinovlar yashil, ekranda esa
   bo'sh joy turadi. Uni do'kon egasi topdi.

   ⚠ Bu tekshiruv KONTRASTNI O'LCHAMAYDI (buning uchun brauzer kerak);
   u soddaroq va ishonchliroq narsani qiladi — ko'k fonda ishlatilishi
   MUMKIN BO'LMAGAN tokenlarni to'sadi.

   Ishga tushirish:  node test/contrast.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ⚠ `URL.pathname` YO'L EMAS. Windows'da u
   `/C:/Users/.../E-KASSAM%20Project/...` beradi: oldida ortiqcha
   qiyshiq chiziq, ichida esa `%20` — va `readFileSync` bunday
   nomdagi faylni topa olmaydi. Sinov shu sababdan egasining O'Z
   mashinasida umuman ishlamasdi, ya'ni kontrast qoidasi u yerda
   hech qachon tekshirilmasdi. `fileURLToPath` ikkala holatni ham
   to'g'ri yechadi. */
const CSS = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "styles.css"), "utf8");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + `\n     olindi: ${got}`); };

/* Izohlarni olib tashlaymiz: izoh ichidagi «yomon» token qorovulni
   bekorga uyg'otardi (aynan shu faylning o'zida ular sanab o'tilgan). */
const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** `.selector { ... }` juftlarini ajratadi. */
function rules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) out.push({ sel: m[1].trim(), body: m[2] });
  return out;
}

const ALL = rules(clean);

/* ⚠ RO'YXAT QO'LDA: `.total-card` ichida nima chizilishini CSS dan
   bilib bo'lmaydi (u JSX da hal bo'ladi). Ro'yxatga yangi blok
   qo'shilsa, bu yerga ham qo'shiladi — bu ONGLI qadam bo'lishi kerak. */
const ON_BRAND = ["sugg", "sugg__lab", "sugg__b", "sugg__n", "sugg__p",
                  "total-row", "total-big"];

/* Ko'k fonda MATN rangi bo'la olmaydigan tokenlar. */
const DARK = ["--fg-secondary", "--fg-tertiary", "--fg-muted", "--fg-primary",
              "--text2", "--text3", "--bg-brand", "--blue"];

console.log("── Ko'k kartochka ichidagi ranglar ──");

for (const name of ON_BRAND) {
  /* Faqat SHU klassning o'z qoidalari: `.sugg__b:hover` ham kiradi,
     `.pay-sugg` kabi boshqa nom kirmaydi. */
  const own = ALL.filter((r) => new RegExp(`\\.${name}(?![\\w-])`).test(r.sel));
  if (own.length === 0) { bad(`.${name} — qoida topilmadi (nomi o'zgarganmi?)`, "yo'q"); continue; }

  for (const r of own) {
    /* `:hover` va `:active` da fon OQARADI, ya'ni matn ko'k bo'lishi
       TO'G'RI — ular tekshiruvdan chiqariladi. */
    if (/:hover|:active|:focus/.test(r.sel)) continue;

    const color = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(r.body);
    if (!color) continue;
    const value = color[1].trim();
    const wrong = DARK.find((tok) => value.includes(tok));
    if (wrong) bad(`${r.sel} — ko'k fonda «${wrong}» matn rangi bo'la olmaydi`, value);
    else ok(`${r.sel} — rang to'g'ri (${value})`);
  }

  /* ⚠ SHAFFOFLIK HAM KONTRASTNI YEYDI. `.total-card` izohida yozilgan:
     ko'k fonda toza oq 4.8:1 beradi, 0.6 gacha xiralashtirilgani esa
     2.7:1 — ya'ni talabdan past. */
  for (const r of own) {
    const op = /(?:^|;)\s*opacity\s*:\s*([\d.]+)/.exec(r.body);
    if (op && Number(op[1]) < 0.9) {
      bad(`${r.sel} — matn shaffofligi kontrastni yeydi`, op[1]);
    }
  }
}

/* ⚠ PUNKTIR CHEGARA HAM KO'RINISHNING BIR QISMI: «bu bosiladigan
   narsa» degan yagona ishora aynan u. Ko'k fonda ko'k chegara ham
   xuddi ko'k matn kabi ko'rinmasdi. */
console.log("\n── Taklif tugmasining chegarasi ──");
{
  const btn = ALL.find((r) => /^\.sugg__b$/.test(r.sel.trim()));
  const border = btn && /(?:^|;)\s*border\s*:\s*([^;]+)/.exec(btn.body);
  if (!border) bad(".sugg__b — chegara topilmadi", "yo'q");
  else {
    const v = border[1];
    /--bg-brand|--border-brand|--blue/.test(v)
      ? bad(".sugg__b — ko'k fonda ko'k chegara ko'rinmaydi", v)
      : ok(`chegara ko'k emas (${v.trim()})`);
  }
}

console.log(`\n${fail === 0 ? "✅" : "❌"} kontrast: ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
