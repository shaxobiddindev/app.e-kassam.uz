# Google Play'ga chiqarish — to'liq yo'riqnoma

Bu papkada Play Console'ga qo'yiladigan HAMMA narsa bor.

> **Ochiladigan sahifa:** https://claude.ai/code/artifact/8196dd42-0f12-4d7d-8266-72caedc9e607
> — bosqichlar Play Console ekranidagi TARTIBDA, matnlar nusxa tugmasi
> bilan. Telefonda Console yonida ochib ishlash uchun.

⚠ TARTIB. Quyidagi bo'limlar mantiqiy guruhlangan, Play Console esa
bandlarni O'Z tartibida ko'rsatadi:

  **App content** — Set privacy policy · Sign in details · Ads ·
  Content rating · Target audience · Data safety · Government apps ·
  Financial features · Health

  **Store presence** — App category va aloqa · Store listing

Console'dagi tartib bo'yicha yurish qulayroq; sahifadagi versiya aynan
shunday tuzilgan. Quyidagi uch band bu faylda qisqa, to'lig'i
`EKRAN-JAVOBLARI.md` da:

  · **Government apps** → yo'q (xususiy tijorat dasturi)
  · **Health apps** → «My app does not have any health features»;
    boshqa hech narsa belgilanmaydi, shunda 2-qadam «Regional
    requirements» o'zi yopiladi
  · **Financial features** → «doesn't provide any financial features»,
    boshqa hech narsa.

⚠ Oxirgi ikki ekranda **«ikkilansang belgila» qoidasi ISHLAMAYDI**:
belgilangan har bir band Google'dan **hujjat** (litsenziya, guvohnoma)
yoki mintaqaviy talab (HIPAA, MDR) keltirib chiqaradi va hujjatsiz
reliz to'xtaydi. Sabablari `EKRAN-JAVOBLARI.md` ning 5- va 6-bo'limida.

> ⚠ **Vaqt haqida ochiq gap.** Shaxsiy (individual) Play akkaunti bilan
> ilova do'konga DARHOL chiqmaydi: Google yangi shaxsiy akkauntlardan
> production'dan oldin **yopiq sinov** talab qiladi — kamida **12 ta
> tester**, **14 kun uzluksiz**. Ya'ni bugun yuklasangiz ham, ilova
> do'konda eng erta ikki haftadan keyin paydo bo'ladi. Tashkilot
> akkauntiga bu talab tegishli emas.
>
> Bu qoida o'zgarib turadi — yuklashdan oldin Play Console'ning o'zi
> ko'rsatadigan talabni tekshiring.

---

## 0. Nima allaqachon tayyor

| Narsa | Holati |
|---|---|
| `targetSdk 36`, `minSdk 24` | ✅ Play talabiga mos |
| Ruxsatlar — faqat `INTERNET` | ✅ Data Safety juda oddiy bo'ladi |
| Imzo kaliti (CI sirlarida) | ✅ `ANDROID_KEYSTORE_BASE64` |
| `.aab` qurilishi | ✅ `android.yml` chiqaradi |
| Ikonka, feature grafika, skrinshotlar | ✅ shu papkada |
| Tavsif (uz/ru/en) | ✅ `matn-*.md` |
| Maxfiylik siyosati | ✅ `public/legal/maxfiylik.html` |
| Hisobni o'chirish (ilovada + havola) | ✅ Profil → «Hisobni o'chirish» |

---

## 1. AAB faylni olish  *(siz)*

```
git tag android-v1.4.0
git push origin android-v1.4.0
```

Keyin **GitHub → Actions → «Android ilova» → oxirgi run → Artifacts →
`e-kassam-aab`** dan `e-kassam.aab` ni yuklab oling.

⚠ **Eski qurilish yaramaydi.** `android-v1.3.14` gacha bo'lgan
qurilishlarda Play uchun HAL QILUVCHI ikki narsa yo'q: **hisobni
o'chirish** tugmasi va **demo rejim**. Eski AAB yuklansa, tekshiruvchi
ilovaga kira olmaydi va hisob o'chirish yo'li topilmaydi — ikkalasi
ham rad etish sababi.

**Play uchun AAB tayyor:** `main` dan qurilgan **#34-run**
(`workflow_dispatch`, 29-avgust) — Actions'dan `e-kassam-aab` ni oling.
Teg emas, qo'lda ishga tushirilgan: teg qo'shimcha ravishda saytdagi
`.apk` ni ham yangilaydi, AAB uchun esa shart emas.

> `.apk` ham chiqadi, lekin u **saytdan o'rnatish uchun**. Play faqat
> `.aab` qabul qiladi.

---

## 2. Play App Signing  *(siz, bir marta)*

Birinchi yuklashda Google **Play App Signing** ni taklif qiladi — **rozi
bo'ling**. Shunda:

* sizdagi kalit **upload key** bo'lib qoladi (CI'dagi sir o'zgarmaydi);
* haqiqiy imzo kalitini Google saqlaydi va uni yo'qotib qo'yish xavfi
  yo'qoladi.

> ⚠ Kalit yo'qolsa, ilovani **yangilab bo'lmaydi** — yangisini noldan
> chiqarishga to'g'ri keladi. `ANDROID_KEYSTORE_BASE64` sirining zaxira
> nusxasini xavfsiz joyda saqlang (parol menejeri, seyf).

---

## 3. Do'kon sahifasi  *(siz — matn va rasm tayyor)*

**Grow → Store presence → Main store listing**

| Maydon | Manba |
|---|---|
| Nom, qisqa va to'liq tavsif | `matn-uz.md` (standart til), `matn-ru.md`, `matn-en.md` |
| Ilova ikonkasi (512×512) | `grafika/ikonka-512.png` |
| Feature grafika (1024×500) | `grafika/feature-1024x500.png` |
| Telefon skrinshotlari (1080×1920) | `skrinshot/phone-*.png` — 7 ta |
| Planshet 10" (2560×1600) | `skrinshot/tab-*.png` — 4 ta |

Skrinshot tartibi (mijoz birinchi — ilova aynan shunday ochiladi):

1. `phone-1-kartam` — sodiqlik kartasi, QR
2. `phone-5-nasiya-tasdigi` — mijoz qarzni tasdiqlaydi
3. `phone-3-cheklar` — cheklar tarixi
4. `phone-4-dokonlar` — do'konlar va ballar
5. `phone-2-aksiyalar` — aksiyalar
6. `phone-6-panel` — rahbar nazorat paneli
7. `phone-7-qarzdorlar` — qarzdorlar

> ⚠ Planshet skrinshotlarisiz Play sahifada **«Planshet uchun
> moslashtirilmagan»** degan ogohlantirish chiqaradi. Kassa aynan
> planshetda ishlatiladi — `tab-*.png` ni albatta qo'ying.

---

## 4. Maxfiylik va hisobni o'chirish  *(siz)*

| Play maydoni | Qiymat |
|---|---|
| Privacy policy URL | `https://app.e-kassam.uz/legal/maxfiylik.html` |
| Account deletion URL | `https://app.e-kassam.uz/legal/hisobni-ochirish.html` |

> ⚠ **Avval saytga chiqaring.** Bu ikki sahifa `public/legal/` da turibdi
> va Netlify'ga push bilan chiqadi. Play havolani TEKSHIRADI — ochilmasa
> reliz rad etiladi.
>
> ✅ Ikkala sahifa TO'LDIRILGAN: aloqa `ekassam.uz@gmail.com`, ma'lumot
> boshqaruvchisi — «e-Kassam». Manzil va telefon ataylab yo'q: sahifa
> uchun ular shart emas, ishlaydigan pochta yetadi.
>
> ⚠ Pochta ISHLAYDIGAN bo'lishi shart: Play ham, hisobini o'chirmoqchi
> bo'lgan mijoz ham aynan shu manzilga yozadi.

---

## 4b. App access — tekshiruvchi qanday kiradi  *(siz)*

**App content → App access → «All or some functionality is restricted»**

⚠ Bu bo'lim eng ko'p rad javob keltiradi: Google ilovani QO'LDA
tekshiradi va tekshiruvchi ichiga KIRA OLMASA, ilova rad etiladi. Bizda
uchala mijoz kirishi ham bir martalik kod talab qilardi (Telegram · SMS
· pochta) — tekshiruvchi ularning hech birini o'tolmasdi. Shu sababdan
**namoyish rejimi** qo'shildi.

✅ **Serverda YOQILGAN** (29-avgust). `APP_DEMO_ENABLED` va
`APP_DEMO_PASSWORD` deploy yozadigan qat'iy ro'yxatga kiritildi, ya'ni
har chiqishda o'zi qo'yiladi va qo'lda hech narsa qilish shart emas.
Parol serverdagi `.env` ichida — o'zingiz belgilamoqchi bo'lsangiz,
GitHub'da `APP_DEMO_PASSWORD` secret'ini qo'ying.

Server o'zi yaratdi: `demo` kodli do'kon, `demo` xodimi, namoyish
mijozi, 5 ta tovar va 3 ta chek. Qayta ishga tushirilganda takrorlamaydi.

⚠ Bu qiymatlarni serverdagi `.env` ga QO'LDA qo'shmang: deploy faylni
har safar qayta yozadi va qo'lda qo'shilgani jimgina yo'qolardi.

Keyin **+ Add details** bilan IKKITA yozuv qo'shing:

**1) Customer side**

| Maydon | Qiymat |
|---|---|
| Username | `demo` |
| Password | `demo` *(ishlatilmaydi — pastdagi izohga qarang)* |

```
No credentials are needed for the customer side.

On the first screen, tap "Demo rejimida ko'rish" (View in demo mode).
It opens a demonstration account instantly - no phone number, no SMS
and no one-time code. All data in it is fictional.

This shows the loyalty card (rotating QR/barcode), points, receipts
and shop list.
```

**2) Staff side (point of sale)**

| Maydon | Qiymat |
|---|---|
| Username | `demo` |
| Password | `<APP_DEMO_PASSWORD>` |

```
On the first screen, tap "Do'kon xodimiman" (I am a shop employee)
at the bottom, then enter:

  Shop code (Do'kon kodi): demo
  Username:                demo
  Password:                <APP_DEMO_PASSWORD>

This account has owner access: till, stock, credit, warehouse pickup
and reports.
```

⚠ Namoyish xodimida **pochta ataylab yo'q**: pochtali hisob yangi
qurilmadan kirganda pochtaga tasdiq kodi kutadi va tekshiruvchi uni
o'qiy olmasdi. Buni o'zgartirmang.

⚠ Tekshiruv tugagach namoyishni o'chirmang: Google har yangilanishda
qayta tekshiradi.

---

## 5. Data safety anketasi  *(siz — javoblar tayyor)*

**App content → Data safety**. Quyidagi javoblar ilovaning HAQIQIY
xatti-harakatiga mos (kod bo'yicha tekshirilgan):

**Umumiy**
- Ma'lumot uchinchi tomonga uzatiladimi? → **Ha** (Google FCM, SMS
  operatori, Telegram — faqat xizmat ko'rsatuvchi sifatida)
- Ma'lumot uzatishda shifrlanadimi? → **Ha** (HTTPS)
- Foydalanuvchi o'chirishni so'ray oladimi? → **Ha** (ilovada + havola)
- Bolalar uchunmi? → **Yo'q**

**Yig'iladigan turlar**

⚠ TUZATILDI 2026-08-29: ilgari bu ro'yxatda **«Xato jurnali (crash)»**
turgan edi — XATO. Kodda nosozlik hisoboti SDK'si yo'q (Crashlytics ham,
Sentry ham, Bugsnag ham; xatoni serverga yuboradigan kod ham yo'q).
**App info and performance → hech narsa belgilanmaydi.**

**Kategoriya bo'yicha**

| Kategoriya | Tanlanadi | Nega |
|---|---|---|
| **Location** | ❌ hech narsa | Ilovada joylashuv YO'Q — manifestda faqat `INTERNET` |
| **Personal info** | Name · Email address · User IDs · Phone number | Address emas — mijozdan manzil so'ralmaydi |
| **Financial info** | Purchase history · Other financial info | Ikkinchisi — nasiya qarzi (Google ta'rifida «debts»). ⚠ **User payment info EMAS** |
| **Device or other IDs** | ✅ | Firebase FCM qurilma tokeni |
| **Photos and videos** | Photos | Katalogda tovar rasmi yuklanadi — ixtiyoriy, belgilash xavfsizroq |
| **App activity** | Other user-generated content | Tovar nomi, izohlar, qarzni rad etish sababi — ixtiyoriy |
| App info and performance | ❌ | Nosozlik hisoboti SDK'si yo'q |
| Health · Messages · Audio · Files · Calendar · Contacts · Web browsing | ❌ | Ilova bularga umuman tegmaydi |

**4-qadam — Data usage and handling**

⚠ TUZATILDI: ilgari bu jadvalda telefon, User ID va Device ID uchun
«Shared ✅» turgan edi — XATO. Google ta'rifi bo'yicha **sizning
nomingizdan ish bajaradigan xizmat ko'rsatuvchiga** (service provider)
uzatish «sharing» HISOBLANMAYDI va bu uning rasmiy istisnolari
ro'yxatida turadi. FCM, SMS operatori va hosting aynan shunday.
Ortiqcha belgilash bu yerda ZARARLI: do'kon sahifasida «ma'lumot
uchinchi tomonlarga beriladi» degan yozuv chiqadi, holbuki berilmaydi.

Hamma turda bir xil:

| Savol | Javob |
|---|---|
| Is this data collected, shared, or both? | faqat **Collected** — Shared emas |
| Is this data processed ephemerally? | **No** — hammasi bazada saqlanadi |

Turga qarab:

| Tur | Required / Optional | Why — maqsad |
|---|---|---|
| Name | Required | App functionality · Account management |
| Email address | **Optional** | Account management · Fraud prevention, security, and compliance |
| User IDs | Required | Account management · App functionality |
| Phone number | Required | Account management · App functionality |
| Purchase history | Required | App functionality |
| Other financial info | Required | App functionality |
| Device or other IDs | Required | App functionality · Fraud prevention, security, and compliance |
| Photos | **Optional** | App functionality |
| Other user-generated content | Required | App functionality |

> **Email — yagona «Optional»**: mijoz uni faqat xohlasa qo'shadi,
> Telegramsiz kirishning zaxira yo'li sifatida.
>
> **Email va Device ID da «Fraud prevention»**: yangi qurilmadan
> kirganda pochtaga tasdiq kodi yuboriladi va qurilma identifikatori
> begona kirishni aniqlash uchun ishlatiladi.
>
> **Hech qayerda belgilanmaydi**: Analytics (SDK yo'q), Advertising or
> marketing (reklama yo'q), Personalization (tavsiya tizimi yo'q),
> Developer communications (bildirishnomalar mijozning O'Z ballari va
> qarzi haqida — bu App functionality).

> ⚠ ENG KO'P UCHRAYDIGAN XATO — **Location** ni belgilab qo'yish. Ilova
> joylashuvni yig'a OLMAYDI: bunday ruxsat umuman so'ralmagan. Yig'a
> olmaydigan narsani «yig'aman» deb e'lon qilish ham qoidabuzarlik.
>
> Ikkinchisi — **User payment info**. Karta raqami saqlanmaydi: naqd va
> terminal do'konning o'zida, ilova faqat to'lov TURINI qayd etadi.
>
> Ikkilansangiz — belgilang. Jazo assimetrik: kam ko'rsatish
> qoidabuzarlik va ilovani o'chirish, ortiqcha ko'rsatish esa hech
> qanday oqibatga olib kelmaydi.

> ⚠ **Anketani ilovaga qarab to'ldiring, menga ishonib emas.** Yolg'on
> javob — Play qoidalarini buzish va ilova o'chirilishiga olib keladi.
> Yuqoridagi jadval 2026-08-29 dagi kod holatiga mos; keyin ilovaga
> kamera yoki joylashuv qo'shilsa, anketani ham yangilash SHART.

---

## 6. Qolgan anketalar  *(siz)*

- **Content rating** — «Utility, Productivity, Communication, Other» ni
  tanlang; ilovada zo'ravonlik, qimor, foydalanuvchilar o'rtasida muloqot
  yo'q. Natija odatda **3+ / Everyone**.
- **Target audience** — **18+** (biznes ilovasi).
- **Ads** — **Reklama yo'q**.
- **Government apps** — yo'q.
- **Financial features** — ilova **to'lovni o'zi qabul qilmaydi** (naqd va
  terminal do'konning o'zida), shuning uchun «moliyaviy xizmat» emas.
  Click/Payme faqat to'lov TURI sifatida qayd etiladi. Shunga qaramay bu
  savolni Play Console'dagi joriy ta'rifga qarab belgilang.

---

## 7. Sinov va chiqarish  *(siz)*

1. **Internal testing** — o'zingiz va bir-ikki xodim. Darhol ishlaydi.
2. **Closed testing** — 12+ tester, 14 kun (shaxsiy akkaunt uchun shart).
   Testerlarni e-pochta ro'yxati yoki Google Group bilan qo'shasiz.
3. **Production** — sinov muddati to'lgach.

> Tester sifatida do'kon egalarini qo'shish eng foydalisi: ular haqiqiy
> foydalanuvchi va fikri ham keladi.

---

## 8. Keyingi relizlar

`git tag android-v1.4.1 && git push origin android-v1.4.1` → Actions →
`e-kassam-aab` → Play Console'ga yuklash.

`versionCode` avtomatik o'sadi (epoch-daqiqa), ya'ni qo'lda hech narsa
o'zgartirish kerak emas.

Avtomatlashtirish kerak bo'lsa (service account + Play Developer API) —
ayting, CI'ga qo'shib beraman. Birinchi reliz baribir qo'lda bo'lishi
shart: API faqat ilova do'konda paydo bo'lgandan keyin ishlaydi.
