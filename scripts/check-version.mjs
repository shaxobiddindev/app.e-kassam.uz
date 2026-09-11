/* ══════════════════════════════════════════════════════════════════════════
   VERSIYA UCH JOYDA BIR XIL BO'LSIN (desktop relizi)

   ═══ NEGA KERAK — BU XATO ALLAQACHON SODIR BO'LGAN ═══════════════════════

   2026-08-17 da `desktop-v1.10.0` chiqdi. Undan keyin 153 commit, 168 fayl,
   +46 000 qator front kod yozildi — lekin `src-tauri/tauri.conf.json` dagi
   versiya 1.10.0 da qolib ketdi. Cargo.toml esa undan ham orqada, 1.9.0 da.

   ⚠ VA BU JIMGINA BUZADI. `desktop.yml:122` versiyani TEGDAN EMAS, aynan
   `tauri.conf.json` dan oladi (bu ataylab — teg xato yozilishi mumkin).
   Ya'ni `desktop-v1.11.0` tegi qo'yilsa ham:

     · o'rnatuvchi `e-Kassam_1.10.0_x64-setup.exe` nomi bilan quriladi;
     · `latest.json` ichida `"version": "1.10.0"` yoziladi;
     · kassadagi ilova ham o'zini 1.10.0 deb biladi (tauri versiyani
       Cargo.toml dan emas, config dan oladi);
     · updater 1.10.0 ni 1.10.0 bilan solishtiradi → «yangilanish yo'q».

   Reliz chiqadi, sahifasi to'g'ri ko'rinadi, XATO CHIQMAYDI — va birorta
   kassa yangilanmaydi. Buni faqat bir-ikki haftadan keyin do'kon egasi
   «va'da qilingan bo'lim yo'q-ku» deb aytganda bilib olasiz.

   ═══ NEGA UCHALASI ═════════════════════════════════════════════════════

   · `tauri.conf.json` — HAL QILUVCHI: latest.json, ilovaning o'z
     versiyasi va `.exe` ning FILEVERSION i shundan.
   · `package.json`    — ekranda ko'rsatiladigan versiya shundan.
   · `Cargo.toml`      — ilovaga ta'siri yo'q, lekin ajralgan holda
     qolishi keyingi safar chalkashtiradi (aynan shu bo'ldi: 1.9.0).

   Ishga tushirish:  node scripts/check-version.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const pkg  = JSON.parse(read("package.json")).version;
const conf = JSON.parse(read("src-tauri/tauri.conf.json")).version;
const toml = read("src-tauri/Cargo.toml").match(/^version\s*=\s*"(.+?)"/m)?.[1];

const rows = [
  ["package.json", pkg],
  ["src-tauri/tauri.conf.json", conf],
  ["src-tauri/Cargo.toml", toml],
];

const uniq = new Set(rows.map(([, v]) => v));

if (uniq.size !== 1) {
  console.error("\n  ❌ Desktop versiyalari AJRALGAN:\n");
  for (const [f, v] of rows) console.error(`       ${v ?? "(o'qilmadi)"}   ${f}`);
  console.error("\n  `tauri.conf.json` latest.json ni va ilovaning o'z versiyasini");
  console.error("  belgilaydi. U ko'tarilmasa auto-update JIMGINA ishlamaydi:");
  console.error("  reliz chiqadi, xato chiqmaydi, kassalar esa eski buildda qoladi.\n");
  process.exit(1);
}

/* ⚠ SHAKLI HAM TEKSHIRILADI: `latest.json` ni o'qiydigan tomon versiyani
   semver deb tahlil qiladi va «1.11» yoki «v1.11.0» uni yiqitadi. */
const v = [...uniq][0];
if (!/^\d+\.\d+\.\d+$/.test(v)) {
  console.error(`\n  ❌ Versiya shakli noto'g'ri: «${v}» — X.Y.Z bo'lishi kerak\n`);
  process.exit(1);
}

console.log(`  ✅ Desktop versiyasi uch joyda bir xil: ${v}`);
