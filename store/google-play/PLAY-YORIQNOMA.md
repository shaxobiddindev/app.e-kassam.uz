# Google Play'ga ilova chiqarish — umumiy yo'riqnoma

Bu fayl **har qanday ilova** uchun. e-Kassam'ni chiqarishda duch kelgan
har bir to'siq shu yerda yozilgan: nima bo'lgani, nega bo'lgani va
qanday tuzatilgani.

Ilovaga xos aniq javoblar `EKRAN-JAVOBLARI.md` da — u e-Kassam misoli.
Yangi ilovada **shu fayldan** boshlang, keyin o'sha faylni namuna qilib
o'zingiznikini yozing.

> ⚠ Google ta'riflarni o'zgartirib turadi. Har bir ekranda «Learn more»
> va «View definitions» havolalarini o'qing — bu yerdagi mantiq
> qoladi, so'zlar o'zgarishi mumkin.

---

# A · KONSOLNI OCHISHDAN OLDIN

Bu qismni tashlab ketib bo'lmaydi: quyidagilarning har biri **rad
etish sababi**, va ularning hammasi kodda hal qilinadi. Konsolga
kirgandan keyin bilinsa — qayta qurish, qayta yuklash, qayta navbat.

## A1. Hisobni o'chirish yo'li

2023-yildan **majburiy**: foydalanuvchi hisobini ilova ichidan ham,
veb sahifadan ham o'chira olishi kerak.

Ikkitasi kerak:

1. **Ilova ichida** — «Hisobni o'chirish» tugmasi, tasdiq oynasi bilan.
2. **Veb sahifa** — Play Console'ga havola sifatida beriladi; ilovani
   o'rnatmagan odam ham shu yerdan so'rov yubora olishi kerak.

⚠ **Nima o'chadi va nima QOLADI — aniq yozilsin.** e-Kassam'da ilova
hisobi o'chadi, lekin do'konning qarz daftaridagi yozuv qoladi (u
do'konning buxgalteriya hujjati). Shu chegara **uch joyda bir xil**
yozilgan: kod izohida, ilovadagi tasdiq matnida va maxfiylik
siyosatida. Uchtasi bir-biriga zid bo'lsa — tekshiruvchi shuni
ushlaydi.

## A2. Tekshiruvchi ilovaga QANDAY kiradi

Google ilovani **qo'lda** ochib ko'radi. Kirish faqat SMS yoki
Telegram kodi bilan bo'lsa — tekshiruvchi kira olmaydi va ilova
**rad etiladi**.

Yechim: **namoyish (demo) rejimi**.

- Kirish tugmasi hech qanday parametr so'ramaydi — endpoint parametrsiz,
  ya'ni u faqat oldindan tayyorlangan bitta demo hisobga token beradi.
  Bu **orqa eshik emas**: boshqa hech qaysi hisobga bu yo'l bilan
  kirib bo'lmaydi.
- Standart holatda **o'chiq**, prod'da **yoqiq**.
- Demo ma'lumot **o'ylab topilgan** bo'lsin.

⚠ **Demo xodim hisobida pochta BO'LMASIN.** Pochtali hisob yangi
qurilmadan kirganda tasdiq kodi so'raydi va tekshiruvchi shu yerda
to'xtaydi.

⚠ **Tekshiruvdan keyin demo'ni o'chirmang.** Google har yangilanishda
qayta tekshiradi.

## A3. Huquqiy sahifalar

| Sahifa | Majburiymi |
|---|---|
| Maxfiylik siyosati | **Ha** — havolasiz reliz yo'q |
| Hisobni o'chirish | **Ha** (A1 ga qarang) |

- Uch tilda (o'zbek, rus, ingliz) bo'lgani ma'qul.
- `__EMAIL__` kabi **joker qolmasin**.
- Manzil **doimiy** bo'lsin va **brauzerda ochilishi tekshirilsin**.

⚠ **Google bu havolani AVTOMAT ochib ko'radi.** e-Kassam'da manzil
noto'g'ri yozilgani uchun «Privacy policy page returns a page not
found error» chiqdi va **hamma o'zgarish** to'sildi. Diqqat: sayt
domeni bilan ilova domeni har xil bo'lishi mumkin
(`e-kassam.uz` ≠ `app.e-kassam.uz`), fayl nomi `.html` bilan
tugashi ham e'tibordan qolmasin.

## A4. Paket talablari

| Talab | Nima bo'lishi kerak |
|---|---|
| Format | **AAB** (`.apk` yangi ilovaga umuman qabul qilinmaydi) |
| Target SDK | Eng so'nggi talab (2026: **36**) |
| Min API | 24+ |
| Nativ platformalar | 64-bit **shart** (arm64-v8a) |
| Memory page size | **16 KB** qo'llab-quvvatlansin |
| versionCode | Har qurilishda **o'sadi** (epoch-daqiqa qulay) |

## A5. Ruxsatlar auditi

Manifestda **faqat haqiqatan kerak bo'lganlari** tursin. Har bir
ortiqcha ruxsat — Data safety'da qo'shimcha savol va tekshiruvda
shubha.

⚠ **`com.google.android.gms.permission.AD_ID` ga alohida qarang.**
Reklama yo'q bo'lsa u bo'lmasligi kerak. Kutubxona olib kirgan bo'lsa:

```xml
<uses-permission android:name="com.google.android.gms.permission.AD_ID"
    tools:node="remove" />
```

Aks holda «Advertising ID: No» javobi manifest bilan zid bo'ladi.

## A6. Imzo kaliti

- **Play App Signing** yoqilsin — Google o'z kalitini saqlaydi, sizniki
  faqat yuklash uchun. Kalit yo'qolsa ilova o'lmaydi.
- Kalit **GitHub Secrets** da (`ANDROID_KEYSTORE_BASE64` +
  `_PASSWORD`), base64 nusxasi parol menejerida.
- ⚠ Kalitni chatga, hujjatga, repoga **hech qachon** qo'ymang.
- Saytdan tarqatiladigan `.apk` va Play'dagi `.aab` **bir xil kalit**
  bilan imzolansin, aks holda saytdan o'rnatgan odam Play'dagi
  yangilanishni ololmaydi.

## A7. Serverdagi sozlamalar

Demo rejim serverda yoqilishi kerak. Bu yerda ikkita tuzoq bor va
ikkalasi ham e-Kassam'da **jimgina** ishlamay turgan edi:

1. **Deploy `.env` ni qayta yozadi.** Serverga qo'lda qo'shilgan
   o'zgaruvchi keyingi deployda yo'qoladi. Yechim: o'zgaruvchini
   deploy yozadigan ro'yxatga kiritish (yoki deploy tegmaydigan
   alohida faylga chiqarish).
2. **`docker compose` da qobiq muhiti `.env` dan USTUN.** Deploy
   bo'sh qiymatni eksport qilsa (secret qo'yilmagan bo'lsa), o'sha
   bo'shliq `.env` dagi haqiqiy qiymatni bosib ketadi. e-Kassam'da
   aynan shu bo'ldi: `.env` da parol bor edi, konteynerga esa bo'sh
   qiymat yetib bordi.

⚠ **Seeding xatosi yutilsa — tekshiruv qadamini qo'ying.** Demo
ma'lumot tayyorlanmasa server ko'tarilaverishi kerak (namoyish
tufayli savdo to'xtamasin), lekin bu xato **hech qayerda
ko'rinmaydi**. Deploy oxirida jurnalni tekshirib chiqaring — bizda
xatoni aynan shu qadam ko'rsatdi.

## A8. Do'kon materiallari

| Material | Talab |
|---|---|
| Ikonka | 512×512 PNG |
| Feature grafika | 1024×500 |
| Telefon skrinshoti | 2–8 ta, 16:9 yoki 9:16, tomoni 320–3840 px; **4 tadan ko'p** bo'lsa promo'ga yaroqli |
| Planshet 7" | 16:9 yoki 9:16, tomoni 320–3840 px |
| Planshet 10" | 16:9 yoki 9:16, tomoni **1080**–7680 px |
| Chromebook, Android XR | **bo'sh** |
| Video | ixtiyoriy, bo'sh qolsa ham bo'ladi |

⚠ **16:10 rad etiladi.** Planshet skrinshotlari 2560×1600 edi —
yuklovchi qabul qilmadi. Kesib bo'lmaydi (tepada logotip, pastda
asosiy tugma), shuning uchun balandlik bo'yicha sig'dirilib, yon
tomonlar ilovaning o'z fon rangi bilan to'ldirildi → **2560×1440**.
Yon chiziq rangi hamma rasmda bir xil bo'lsin: karuselda ular
yonma-yon turadi.

⚠ **Skrinshotda haqiqiy shaxs ma'lumoti bo'lmasin** — ism, telefon,
qarz summasi hammasi o'ylab topilgan bo'lsin.

---

# B · APP CONTENT ANKETALARI

Tartib Console'dagi ro'yxat bo'yicha.

## B1. App access

Ilovaning biror qismi cheklanganmi degan savol. Kirish talab
qilinsa — **«All or some functionality is restricted»** va
tekshiruvchi uchun **aniq yo'riqnoma** yoziladi (ingliz tilida,
qadamma-qadam).

## B2. Ads

Reklama yo'q bo'lsa — yo'q. Bor bo'lsa Data safety va Content rating
javoblari ham o'zgaradi.

## B3. Content rating

Anketani halol to'ldiring. ⚠ **Do'kon nima sotishi ilovaning mazmuni
emas** — kassa har qanday tovarni qayd etadi, shuning uchun tamaki va
alkogol savoliga «yo'q».

## B4. Target audience

⚠ **Faqat 18+.** 18 dan kichik guruh belgilansa ilova **Families**
siyosatiga tushadi: qo'shimcha talablar, qo'shimcha tekshiruv va
ko'p hollarda rad javobi.

## B5. Data safety

Eng ko'p vaqt oladigan anketa. Uch qoida:

1. **Kod nima qilsa — o'shani yozing.** Manifest va SDK ro'yxatiga
   qarab javob bering, taxminga emas.
2. ⚠ **Ortiqcha belgilash ZARAR.** «Crash logs» ni Crashlytics/Sentry
   bo'lmasa belgilamang. **«Shared»** ni deyarli hech qachon
   belgilamang: xizmat ko'rsatuvchiga (hosting, FCM, SMS operatori)
   uzatish Google ta'rifida «sharing» emas — ortiqcha belgilasangiz
   do'kon sahifasida «uchinchi tomonlarga beriladi» degan **yolg'on
   yozuv** chiqadi.
3. **Hisobni o'chirish havolasi** shu anketada so'raladi (A1).

## B6. Government apps

Davlat organi nomidan chiqmasa — yo'q.

## B7. Financial features

⚠ **Bu ekranda «ikkilansang belgila» qoidasi ISHLAMAYDI.** Har
belgilangan band keyingi qadamda **hujjat** talab qiladi (litsenziya,
guvohnoma) va hujjatsiz reliz to'xtaydi.

e-Kassam misoli: ilovada nasiya bor, lekin qarzni **do'kon** beradi,
ilova emas — «My app doesn't provide any financial features».

## B8. Health apps

Xuddi shu asimmetriya: belgilangan band **mintaqaviy talab** ochadi
(HIPAA, MDR, sog'liq litsenziyasi).

⚠ Do'kon dorixona bo'lsa ham ilova **tovar sotuvini** qayd etadi —
dori tavsiya qilmaydi. Yaroqlilik muddati stikerlari ham sog'liq
funksiyasi emas.

## B9. Advertising ID

⚠ **Android 13+ uchun MAJBURIY.** To'ldirilmasa Play hech qanday
o'zgarishni tekshiruvga yubormaydi («Incomplete advertising ID
declaration»). Reklama va analitika SDK yo'q bo'lsa — **No**, lekin
avval A5 dagi manifest tekshiruvini qiling.

---

# C · STORE SETTINGS VA LISTING

## C1. App category

Toifani **anketalarga zid bo'lmagan** qilib tanlang. e-Kassam
«Business»: «Finance» ni tanlash Financial features'dagi «moliyaviy
funksiya yo'q» javobiga zid ko'rinardi.

**Tags** — Google'ning tayyor ro'yxatidan, ko'pi bilan 5 ta,
**majburiy emas**. Ro'yxat Category'ga bog'liq: avval toifani
tanlab saqlang. Mos tag topilmasa bo'sh qoldiring — nomuvofiqini
belgilashdan yaxshi.

## C2. Aloqa

| Maydon | Izoh |
|---|---|
| Email | **majburiy**, do'kon sahifasida ochiq ko'rinadi |
| Telefon | ixtiyoriy, ochiq ko'rinadi — shaxsiy raqamni yozmang |
| Website | ixtiyoriy; ochilmasa bo'sh qoldiring |
| External marketing | yoqilgan qolsin |

## C3. Store listing — TIL

⚠ **Til va matn mos bo'lsin.** e-Kassam'da standart sahifa
«Russian – ru-RU» edi, ichida esa o'zbekcha matn — bu Metadata
siyosatiga zid.

To'g'ri tartib: standart tilga **o'sha tildagi** matn, qolgan tillar
**Manage translations** orqali.

Tarjimaga alohida rasm yuklash shart emas — Play standart tildagi
grafikani ishlatadi.

---

# D · RELIZ VA SINOV

## D1. Closed testing relizi

- AAB yuklanadi, **Release name** ichki (mijozga ko'rinmaydi).
- **Release notes** har til uchun alohida — teglar do'kon
  sahifasidagi tillardan chiqadi.
- «Releases are signed by Google Play» — shunday qolsin.

⚠ **Eski qurilishni yuklamang.** Yangi majburiy funksiyalar (hisobni
o'chirish, demo) qachon qo'shilganini tekshiring: undan oldingi
paketda ular yo'q va tekshiruv o'tmaydi.

## D2. Testerlar (shaxsiy akkaunt uchun)

Shart: **12 ta tester, 14 kun uzluksiz**.

⚠ **Pochta qo'shishning o'zi sanalmaydi** — tester havolani ochib
«Become a tester» ni bosishi kerak, **taklif kelgan Google hisobi
bilan**.

⚠ Son bir kunga 12 dan tushsa sanoq **noldan** boshlanadi. Shuning
uchun **20–25 ta** taklif qiling.

⚠ Sanoq «Submit» bosilgan kundan emas, **reliz testerlarga
chiqqandan** boshlanadi.

## D3. Submit

Hamma o'zgarish **bittada** yuboriladi. «Running quick checks» —
14 daqiqagacha; tugagunicha tugma o'chiq turadi.

⚠ **«View issues» ni albatta oching.** Bu Google'ning avtomatik
tekshiruvi: topilgani yuborishdan oldin tuzatilsa, navbatda kutib
qolmaysiz.

Paket sahifasidagi **«App optimization: Low»**, «Localizations: 85»
kabi ko'rsatkichlar — **maslahat, to'siq emas**. Capacitor ilovasida
R8 to'liq rejimi plaginlarning refleksiyasini buzishi mumkin;
birinchi relizdan oldin tegmang.

---

# E · BIZDA AYNAN NIMA XATO BO'LDI

| Xato | Sabab | Yechim |
|---|---|---|
| «Privacy policy page returns a page not found» | Manzil boshqa domen va boshqa yo'lda yozilgan | To'g'ri, ochiladigan havola |
| «Incomplete advertising ID declaration» | Anketa to'ldirilmagan | App content → Advertising ID → No |
| Do'kon sahifasi ru-RU, matni o'zbekcha | Standart til e'tibordan qolgan | Har tilga o'z matni |
| Planshet rasmi qabul qilinmadi | 2560×1600 = 16:10 | Yon to'ldirib 2560×1440 |
| Demo hisob ishlamadi | Qobiq muhiti `.env` dan ustun, bo'sh parol bosib ketgan | Qiymatni qobiqqa ham eksport qilish |
| Demo jimgina yaratilmadi | Seeding xatosi ataylab yutiladi | Deployda jurnal tekshiruvi |
| Teg allaqachon mavjud | Hujjatda eski versiya raqami | Keyingi versiya raqami |
| Data safety'da ortiqcha «Shared» | «Ikkilansang belgila» qoidasini noto'g'ri qo'llash | Xizmat ko'rsatuvchi istisnosi |

---

# F · YANGI ILOVA UCHUN TO'LDIRILADIGAN RO'YXAT

Har ilovada **qaytadan** aniqlanadi — javoblar shularga bog'liq:

1. `AndroidManifest.xml` dagi ruxsatlar ro'yxati
2. Qanday SDK'lar bor (crash, analitika, reklama, xarita)
3. Kamera, joylashuv, kontakt, mikrofon ishlatiladimi
4. Kirish usullari qanday — tekshiruvchi kira oladimi
5. Ilova to'lovni O'ZI qabul qiladimi
6. Sog'liq, fitnes yoki tibbiy ma'lumot bilan ishlaydimi
7. Bolalar auditoriyasi ko'zda tutilganmi
8. Hisobni o'chirishda nima o'chadi, nima qoladi
9. Huquqiy sahifalar qaysi manzilda turadi
10. Do'kon sahifasi qaysi tilda bo'ladi
