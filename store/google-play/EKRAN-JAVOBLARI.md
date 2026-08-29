# Play Console — ekran bo'yicha javoblar

> **Bu fayl KEYINGI ILOVALAR uchun ham.** Har bir Play Console ekrani va
> unga berilgan javob shu yerda. Yangi ilova chiqarganda qaytadan
> o'ylab o'tirmang — shu faylni oching.
>
> ⚠ **Nega fayl, xotira emas.** Claude seanslar orasida hech narsani
> eslamaydi: har suhbat toza varaqdan boshlanadi. Repo esa eslaydi.
> Shuning uchun har bir aniqlangan javob shu yerga yoziladi va keyingi
> seansda faqat shu faylni ko'rsatish kifoya.
>
> ⚠ **Har javob KODGA qarab berilgan**, taxmin bilan emas. Ilova
> o'zgarsa (kamera, joylashuv, to'lov qo'shilsa) javoblar ham
> o'zgaradi — o'sha paytda shu faylni yangilang.
>
> Oxirgi tekshiruv: **2026-08-29**, `uz.ekassam.app`

---

## Ilova haqidagi asosiy faktlar

Javoblarning HAMMASI shu beshta faktdan kelib chiqadi. Yangi ilovada
avval shularni tekshiring:

| Fakt | Qiymat | Qayerdan |
|---|---|---|
| Android ruxsatlari | **faqat `INTERNET`** | `android/app/src/main/AndroidManifest.xml` |
| Joylashuv | **yo'q** | kodda `geolocation`, `ACCESS_*_LOCATION` yo'q |
| Nosozlik hisoboti SDK | **yo'q** | Crashlytics, Sentry, Bugsnag — hech biri yo'q |
| Analitika SDK | **yo'q** | — |
| FCM (push) | **bor** | `android/app/google-services.json` |

---

## 1 · App access — «Is any part of your app restricted?»

**Yes** → ikkita yozuv:

**Customer side** — parol kerak emas. Instructions:
```
No credentials are needed for the customer side.

On the first screen, tap "Demo rejimida ko'rish" (View in demo mode).
It opens a demonstration account instantly - no phone number, no SMS
and no one-time code. All data in it is fictional.
```

**Staff side** — username `demo`, parol `APP_DEMO_PASSWORD`. Instructions:
```
On the first screen, tap "Do'kon xodimiman" (I am a shop employee)
at the bottom, then enter:

  Shop code (Do'kon kodi): demo
  Username:                demo
  Password:                <APP_DEMO_PASSWORD>
```

✅ VPS'da yoqilgan: bu ikkovini deploy `.env` ga o'zi yozadi (parolni
eski fayldan ko'chiradi yoki yangisini yaratadi). Qo'lda qo'shmang —
deploy faylni qayta yozadi va qo'lda qo'yilgani yo'qoladi.
⚠ Namoyish xodimida **pochta bo'lmasin** — pochtali hisob yangi
qurilmadan kirganda tasdiq kodi kutadi va tekshiruvchi to'xtab qoladi.

---

## 2 · Data safety → Data collection and security

| Savol | Javob |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data encrypted in transit? | **Yes** (HTTPS) |
| Methods of account creation | ☑ **Username and other authentication** (telefon/pochta + bir martalik kod) · ☑ **OAuth** (Telegram) |
| Delete account URL | `https://app.e-kassam.uz/legal/hisobni-ochirish.html` |
| Way to request partial data deletion? | **Yes** + o'sha havola |

⚠ «Username and password» BELGILANMAYDI: savol hisob **yaratish**
haqida, ilovada esa parolli hisob yaratilmaydi — do'kon xodimining
logini admin panelda beriladi.

---

## 3 · Data safety → Data types

| Kategoriya | Tanlanadi |
|---|---|
| **Location** | ❌ **hech narsa** — ilova joylashuvni yig'a olmaydi |
| **Personal info** | Name · Email address · User IDs · Phone number *(Address emas)* |
| **Financial info** | Purchase history · Other financial info *(nasiya qarzi)* — ⚠ **User payment info EMAS** |
| **Device or other IDs** | ✅ *(FCM tokeni)* |
| **Photos and videos** | Photos — *ixtiyoriy*, tovar rasmi yuklanadi |
| **App activity** | Other user-generated content — *ixtiyoriy* |
| **App info and performance** | ❌ — crash SDK yo'q |
| Health · Messages · Audio · Files · Calendar · Contacts · Web browsing | ❌ |

---

## 4 · Data safety → Data usage and handling

Hamma turda bir xil: ☑ **Collected** *(Shared EMAS)* · ephemeral → **No**

| Tur | Required / Optional | Why |
|---|---|---|
| Name | Required | App functionality · Account management |
| Email address | **Optional** | Account management · Fraud prevention, security, and compliance |
| User IDs | Required | Account management · App functionality |
| Phone number | Required | Account management · App functionality |
| Purchase history | Required | App functionality |
| Other financial info | Required | App functionality |
| Device or other IDs | Required | App functionality · Fraud prevention, security, and compliance |

⚠ **«Shared» hech qayerda belgilanmaydi.** Google ta'rifi bo'yicha
sizning nomingizdan ish bajaradigan **xizmat ko'rsatuvchiga** (FCM, SMS
operatori, hosting) uzatish «sharing» hisoblanmaydi — bu uning rasmiy
istisnolari ro'yxatida. Ortiqcha belgilash bu yerda **zararli**: do'kon
sahifasida «uchinchi tomonlarga beriladi» degan yolg'on yozuv chiqadi.

---

## 5 · Financial features

**«My app doesn't provide any financial features»** — boshqa hech narsa.

⚠ **Bu ekranda «ikkilansang belgila» qoidasi ISHLAMAYDI.** Har belgilangan
band uchun keyingi qadamda Google **hujjat** so'raydi (litsenziya,
guvohnoma). Bermasangiz reliz to'xtaydi.

Ikkita bahsli band va nega belgilanmaydi:

- **Buy now, pay later** — nasiya shunga o'xshaydi, lekin BNPL uchinchi
  tomon moliyalashtiradigan xizmat. Bizda do'konning O'Z daftari: o'z
  tovarini o'z mijoziga, foizsiz, komissiyasiz. e-Kassam bu
  munosabatning tarafi emas.
- **Rewards, points…** — ball tizimi bor, lekin uni **do'kon** yuritadi;
  dastur faqat vosita. Google savol bersa — bahslashmang, o'shanda
  belgilang.

---

## 6 · Health apps

**1-qadam «Health features in your app»** — eng pastdagi **«My app does
not have any health features»**. Yuqoridagi hech bir katakcha
belgilanmaydi. Shundan keyin **2-qadam «Regional requirements» o'zi
yopiladi** — to'ldiradigan narsa qolmaydi.

⚠ **Financial features bilan bir xil: «ikkilansang belgila» qoidasi bu
yerda ham ISHLAMAYDI.** Belgilangan har bir band 2-qadamni ochadi va
mintaqaviy talab qo'yadi: AQShda HIPAA, Yevropada tibbiy qurilma (MDR)
hujjatlari, ayrim davlatlarda sog'liqni saqlash litsenziyasi. Hujjatsiz
reliz to'xtaydi.

Nega hech biri belgilanmaydi:

- sog'liq ma'lumoti yig'ilmaydi, saqlanmaydi, ko'rsatilmaydi;
- tadqiqot va klinik sinov (Human subjects research) yo'q;
- fitnes, ovqatlanish, uyqu, ruhiy holat funksiyalari yo'q.

⚠ **Do'kon dorixona bo'lsa ham javob o'zgarmaydi.** Ilova **tovar
sotuvini** qayd etadi — nomi, narxi, miqdori. Dori tavsiya qilmaydi,
retsept bilan ishlamaydi, dozani hisoblamaydi va mijozning kasalligi
haqida hech nima bilmaydi. Sotilgan tovar nomi dori bo'lishi ilovaning
funksiyasi emas.

**Yaroqlilik muddati stikerlari** ham sog'liq funksiyasi emas — bu
ombor va savdo hisobi.

---

## 7 · Qolgan anketalar

| Anketa | Javob |
|---|---|
| **Ads** | Reklama yo'q |
| **Content rating** | Kategoriya: Utility, Productivity, Communication, or Other. Hamma savolga «yo'q». Natija: **3+ / Everyone** |
| **Target audience** | ⚠ **faqat 18+**. 18 dan kichik guruh belgilansa ilova Families siyosatiga tushadi va ko'p hollarda rad etiladi |
| **Government apps** | Yo'q |

⚠ **Content rating — tamaki va alkogol** savoliga «yo'q»: ilova ularni
sotmaydi va reklama qilmaydi. Do'kon nima sotishi ilovaning mazmuni
emas — kassa har qanday tovarni qayd etadi.

---

## 8 · Store settings — App category va aloqa

| Maydon | Qiymat |
|---|---|
| App or game | **App** |
| Category | **Business** |
| Tags | tayyor ro'yxatdan, ko'pi bilan 5 ta (pastda) |
| Email address | `ekassam.uz@gmail.com` |
| Phone number | majburiy emas — bo'sh qoldirsa ham bo'ladi |
| Website | `https://e-kassam.uz` |
| External marketing | **yoqilgan holda qoldiriladi** |

**Category — nega Business, Finance emas.** Finance toifasi bank, to'lov
va kredit ilovalari uchun. Uni tanlash Financial features'dagi «hech
qanday moliyaviy funksiya yo'q» javobiga zid ko'rinadi va tekshiruvchida
ortiqcha savol tug'diradi. e-Kassam — do'kon uchun ish quroli: Business.

**Tags — erkin matn EMAS va MAJBURIY EMAS.** «Manage tags» Google'ning
tayyor ro'yxatini ochadi, ko'pi bilan **5 ta** belgilanadi.

⚠ **Ro'yxat Category'ga bog'liq.** Category «Not selected» turganda tag
ro'yxati bo'sh yoki begona chiqadi. Shuning uchun tartib qat'iy:
avval **Category = Business** → Save → keyin «Manage tags».

Ro'yxatdan qidiriladigan inglizcha so'zlar: `Point of Sale`, `Retail`,
`Inventory`, `Sales`, `Small Business`, `Business Management`,
`Invoicing`, `Accounting`, `Customer Management`, `Barcode`,
`Reporting`, `Analytics`.

**Mos tag topilmasa — hech nima belgilamang va Save bosing.** Tag
majburiy emas, relizni to'xtatmaydi va tekshiruvga ta'sir qilmaydi; u
faqat Play ichidagi ko'rinishga xizmat qiladi. Keyin istalgan payt
qo'shiladi, yangi reliz kerak emas. Nomuvofiq tegni «bo'sh qolmasin»
deb belgilash zarar: Google uni o'zi olib tashlaydi.

⚠ «Banking», «Payments», «Loans» kabi teglarni **olmang** — Financial
features javobiga zid bo'ladi.

**Email** do'kon sahifasida hammaga ko'rinadi va uni kuzatib turish
kerak: hisobni o'chirish so'rovi ham shu manzilga keladi.

**Phone number** ham hammaga ko'rinadi, lekin **majburiy emas**. Shaxsiy
raqamni chop etishni istamasangiz bo'sh qoldiring; yozsangiz xalqaro
formatda — `+998 …`.

**Website** — bu maydon **ixtiyoriy** va u tanishtiruv sayti
(`e-kassam.uz`). Havola ochilmasa, bo'sh qoldiring: o'lik havola
tekshiruvchini bezovta qiladi.

⚠ Maxfiylik siyosati **boshqa domenda** — `app.e-kassam.uz/legal/…`.
U esa **majburiy** va albatta ochilishi shart (App content → Privacy
policy). Ikkovini aralashtirmang: Website ochilmasa reliz to'xtamaydi,
maxfiylik havolasi ochilmasa — to'xtaydi.

**External marketing** yoqilgan qoladi. O'chirish faqat Google'ning
Play'dan tashqaridagi reklamasini to'xtatadi — ko'rinish kamayadi,
siyosiy foydasi yo'q.

---

## 9 · Store listing

Matn va rasm — shu papkada: `matn-{uz,ru,en}.md`, `grafika/`, `skrinshot/`.

| Maydon | Nima qo'yiladi |
|---|---|
| App icon | `grafika/ikonka-512.png` — 512×512 |
| Feature graphic | `grafika/feature-1024x500.png` — 1024×500 |
| Video | **bo'sh** |
| Phone screenshots | 7 ta `skrinshot/phone-*.png` — 1080×1920 |
| 7-inch tablet | 4 ta `skrinshot/tab-*.png` — 2560×1440 |
| 10-inch tablet | **o'sha 4 ta fayl** |
| Chromebook | **bo'sh** — Play planshet rasmlarini oladi |
| Android XR | **bo'sh** — VR qurilma uchun ilova emas |
| Spatial / Non-spatial XR video | **bo'sh** |

⚠ **Play faqat 16:9 yoki 9:16 qabul qiladi.** Planshet rasmlari avval
2560×1600 (16:10) edi — yuklovchi rad etadi. Kesib bo'lmaydi: tepada
logotip, pastda «To'lovga o'tish» tugmasi bor. Shuning uchun rasm
balandligi bo'yicha sig'dirilib, yon tomonlar ilovaning o'z fon rangi
(`#F6F8FB`) bilan to'ldirildi — natija 2560×1440. Yon chiziq rangi
hamma rasmda bir xil: karuselda to'rttasi yonma-yon turadi.

Bitta to'plam ikkala planshet bo'limiga ham yaraydi: 7-inch 320–3840 px
oralig'ini, 10-inch 1080–7680 px oralig'ini talab qiladi, 2560×1440
ikkoviga ham tushadi.

⚠ Planshet skrinshotlarini albatta qo'ying, aks holda Play «planshet
uchun moslashtirilmagan» deb ogohlantiradi.

---

## 10 · Closed testing relizi

AAB shu yerga yuklanadi: **Testing → Closed testing → Create new
release → Upload**.

| Maydon | Qiymat |
|---|---|
| App bundles | `e-kassam.aab` (Actions artifaktidan) |
| Release name | Play o'zi taklif qiladi (`versionName`) — o'zgartirish shart emas, mijozga ko'rinmaydi |
| Release notes | quyidagi matn, HAR TIL uchun |

⚠ **«Releases are signed by Google Play»** — shunday qolsin. Bu Play App
Signing: Google o'z kalitini saqlaydi, bizning kalit esa faqat yuklash
uchun. Kalit yo'qolsa ilova o'lmaydi.

**Release notes (500 belgigacha, har til uchun alohida):**

```
<ru-RU>
Первый выпуск e-Kassam.

Для клиента: карта лояльности с QR-кодом, баллы, история чеков,
подтверждение долга и акции магазина.

Для магазина: касса со сканером и весами, склад, рассрочка, выдача
товара со склада, отчёты и работа без интернета.
</ru-RU>
```

```
<uz>
e-Kassam birinchi relizi.

Mijoz uchun: QR bilan sodiqlik kartasi, ballar, cheklar tarixi, qarzni
tasdiqlash va aksiyalar.

Do'kon uchun: skaner va tarozili kassa, ombor, nasiya, ombordan berish,
hisobotlar va oflayn ishlash.
</uz>
```

```
<en-US>
First release of e-Kassam.

For customers: loyalty card with QR, points, receipt history, debt
confirmation and shop promotions.

For shops: POS with scanner and scales, stock, credit ledger, warehouse
pickup, reports and offline mode.
</en-US>
```

⚠ **Qaysi til teglari chiqishini do'kon sahifasi belgilaydi.** Agar bu
yerda faqat `<ru-RU>` ko'rinsa — demak ilovaning do'kon sahifasi
hozircha faqat rus tilida. Unda avval **Main store listing → Manage
translations** dan o'zbek va ingliz tillarini qo'shing; shundan keyin
bu yerda uchala teg chiqadi.

⚠ O'zbekcha matnni rus tilidagi sahifaga joylashtirib qo'ymang — matn
va til bir-biriga mos bo'lishi kerak, aks holda Metadata siyosati
buzilgan hisoblanadi.

### AAB «Details» paneli — nimasiga qarash kerak

Yuklangach Play paketni tahlil qilib ko'rsatadi. **Majburiy** shartlar
(bularsiz reliz o'tmaydi) va shunchaki **maslahat** aralash chiqadi:

| Ko'rsatkich | Bizda | Ma'nosi |
|---|---|---|
| Target SDK | **36** | ✅ majburiy — Play yangi ilovadan eng so'nggi darajani talab qiladi |
| API levels | **24+** | ✅ Android 7.0 dan yuqorisi |
| Native platforms | arm64-v8a, armeabi-v7a, x86, x86_64 | ✅ 64-bit bor — 2019-yildan majburiy |
| Memory page size | **Supports 16 KB** | ✅ majburiy — 2025-yil noyabridan yangi ilovalar uchun shart |
| Releases | 0 | reliz hali chiqarilmagan, **Start rollout** dan keyin 1 bo'ladi |
| Localizations | 85 | AndroidX va Firebase kutubxonalaridan keladi, bizning matnlar emas |
| App optimization | Low | ⚠ **faqat maslahat**, to'siq emas — pastga qarang |

⚠ **«App optimization: Low» ni tuzatishga urinmang.** Play R8 bilan
kodni qisqartirishni taklif qiladi, lekin bizda Java qatlami — Capacitor
ko'prigi, ya'ni ilovaning o'zi web ichida. R8 to'liq rejimi Capacitor
plaginlarining refleksiyasini buzishi mumkin, yutuq esa 4.5 MB dan bir
necha yuz kilobayt. Birinchi relizdan oldin tegmaslik xavfsizroq.

**Permissions → Show detail** ni ochib ko'ring. Bizning manifestda
faqat bittasi bor — `INTERNET`; qolganlari FCM (push) kutubxonasidan
qo'shiladi: `POST_NOTIFICATIONS`, `WAKE_LOCK`, `VIBRATE`,
`ACCESS_NETWORK_STATE`, `c2dm.permission.RECEIVE` kabi.

⚠ Ro'yxatda **joylashuv, kamera, kontaktlar, SMS yoki xotira** ruxsati
BO'LMASLIGI kerak. Bo'lsa — Data safety javoblari bilan zid bo'ladi
(u yerda «Location 0/2» deb aytilgan) va tekshiruvchi savol beradi.

Reliz yaratilgach: **Testers** yorlig'ida testerlar (e-pochta ro'yxati
yoki Google Group), keyin **Preview and confirm → Start rollout**.

### Testerlar: 12 raqami nimani anglatadi

⚠ **Ro'yxatga e-pochta qo'shish YETARLI EMAS.** Google **opt-in
qilganlarni** sanaydi: tester havolani ochib «Become a tester» ni
bosishi kerak. Ya'ni 20 ta pochta kiritib, 5 tasi havolaga
kirmasa — hisob 5 ta emas, 15 ta bo'ladi.

⚠ **14 kun UZLUKSIZ.** Son bir kunga ham 12 dan tushsa (kimdir chiqib
ketsa yoki boshqa Google hisobiga o'tsa), sanoq **noldan** boshlanadi.

Shuning uchun aniq 12 ta bilan ishlamang — **20–25 ta** taklif qiling.
Zaxira bo'lsin: kimdir havolani ochmaydi, kimdir telefonini
almashtiradi.

Testerga aytiladigan uch qadam:

1. Havolani **taklif kelgan Google hisobi bilan** oching (boshqa
   hisobda ochilsa sanalmaydi).
2. «Become a tester» → Play'dan o'rnating.
3. Ikki hafta davomida ishlatib turing — production'ga ariza berganda
   Google sinov qanday o'tgani haqida savol beradi.

Google Group ishlatgan ma'qul: keyin tester qo'shish uchun relizga
tegish shart bo'lmaydi.

Console'dagi hisoblagichning o'zi hakam — har kuni bir qarab qo'ying.

---

## 11 · Publishing overview — yuborishdan oldingi tekshiruv

Hamma o'zgarish shu yerda to'planadi va **bittada** yuboriladi
(«Submit N changes for review»). Tugma «Running quick checks» tugaguncha
kutadi — 14 daqiqagacha.

⚠ **«View N issues» ni albatta oching.** Bu Google'ning avtomatik
tekshiruvi: topilgan muammo yuborishdan OLDIN tuzatilsa, tekshiruv
navbatida turmaysiz.

Yuborishdan oldin brauzerda ochib ko'riladigan ikki havola — ular
ishlamasa reliz shu yerda to'xtaydi:

| Maydon | To'g'ri manzil |
|---|---|
| Privacy policy | `https://app.e-kassam.uz/legal/maxfiylik.html` |
| Delete account (Data safety) | `https://app.e-kassam.uz/legal/hisobni-ochirish.html` |

⚠ Sahifalar `app.e-kassam.uz` da, `e-kassam.uz` da EMAS — ikkovi boshqa
domen. Manzilni qisqartirib yozish ham ishlamaydi: fayl nomi
`.html` bilan tugaydi va `/legal/` papkasida.

⚠ **Store listing tili va matn tili bir xil bo'lsin.** Ro'yxatda
«Russian – ru-RU · Default store listing» tursa-yu, ichida o'zbekcha
matn bo'lsa — Metadata siyosati buzilgan hisoblanadi. To'g'ri yo'l:
ru-RU ga `matn-ru.md`, keyin **Manage translations** dan o'zbek qo'shib
unga `matn-uz.md`, xohlasangiz inglizcha ham.

---

## Keyingi ilova uchun nima o'zgaradi

Yangi ilovada shu fayldan boshlang, lekin quyidagilarni **qayta
tekshiring** — javoblar aynan shularga bog'liq:

1. `AndroidManifest.xml` dagi ruxsatlar ro'yxati
2. Crash/analitika SDK qo'shilganmi
3. Kamera, joylashuv, kontakt, mikrofon ishlatiladimi
4. Ilova to'lovni O'ZI qabul qiladimi (agar ha — Financial features va
   Payments butunlay boshqacha bo'ladi)
5. Hisob yaratish usullari o'zgardimi
6. Sog'liq, fitnes yoki tibbiy ma'lumot bilan ishlaydimi (agar ha —
   Health apps ochiladi va mintaqaviy hujjatlar so'raladi)
