# e-Kassam — ishlab chiqish qoidalari

O'zbek do'konlari uchun kassa va CRM tizimi. Bu repo — **frontend**
(React + Vite), backend esa `shaxobiddindev/api.e-kassam.uz`.

## Til

**Kod izohlari, commit xabarlari va interfeys matni — O'ZBEKCHA.**
Interfeys uch tilda (uz · ru · en), lekin manba til — o'zbekcha:
yangi kalit avval `src/lib/locales/uz.js` ga qo'shiladi.

## Izoh yozish qoidasi

Izoh **nima qilinganini emas, NEGA shunday qilinganini** yozadi.
Ayniqsa: nima sinab ko'rilgan va nega ishlamagan, qaysi xato shu
yechimni keltirib chiqargan. Kod o'zi «nima» ni aytadi.

## Sifat darvozalari

Har o'zgarishdan keyin:

```
npm test                       # birlik sinovlari
npm run build
node scripts/check-budget.mjs  # hajm byudjeti
CHROME_PATH=/opt/pw-browsers/chromium node scripts/check-a11y.mjs
```

Backend uchun `e2e/*.sh` — jonli serverga qarshi ishlaydi.

⚠ **Byudjetni ONGLI ravishda oshiring**: `size-budget.json` da sababini
yozing. KIRISH raqami muhimroq — kassir har ochilishda aynan shuni
kutadi.

## Chiqarish

- **Frontend** — Netlify, `main` ga push bilan (`dist/` repoda).
- **Backend** — GitHub Actions → VPS (docker compose).
- **Android** — `git tag android-vX.Y.Z` → Actions `.apk` va `.aab` chiqaradi.

## Google Play

⚠ **Yangi ilova chiqarayotgan bo'lsangiz yoki Play Console anketasiga
javob kerak bo'lsa — avval shu ikki faylni o'qing:**

- **`store/google-play/PLAY-YORIQNOMA.md`** — HAR QANDAY ilova uchun
  umumiy yo'riqnoma: konsolni ochishdan oldin kodda bajarilishi shart
  bo'lgan ishlar, anketalar mantiqi va e-Kassam'da aynan qaysi xato
  bo'lgani. **Yangi ilovada shu fayldan boshlang.**
- **`store/google-play/EKRAN-JAVOBLARI.md`** — Play Console'ning HAR
  ekrani va e-Kassam uchun berilgan aniq javob, kodga qarab
  tekshirilgan. Namuna sifatida ishlating.
- `store/google-play/README.md` — e-Kassam'ni chiqarishning qadamba-qadam
  yo'riqnomasi.

Bu fayllar ATAYLAB repoda: Claude seanslar orasida hech narsani
eslamaydi, repo esa eslaydi. Yangi javob aniqlansa — o'sha yerga
yozing, aks holda keyingi safar hammasi qaytadan so'raladi.
