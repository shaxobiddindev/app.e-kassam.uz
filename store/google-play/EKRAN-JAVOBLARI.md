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

⚠ VPS'da `APP_DEMO_ENABLED=true` va `APP_DEMO_PASSWORD` bo'lishi SHART.
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

## 8 · App category va aloqa

| Maydon | Qiymat |
|---|---|
| App or game | App |
| Category | **Business** |
| Email | `ekassam.uz@gmail.com` |
| Website | `https://e-kassam.uz` |

---

## 9 · Store listing

Matn va rasm — shu papkada: `matn-{uz,ru,en}.md`, `grafika/`, `skrinshot/`.

⚠ Planshet skrinshotlarini albatta qo'ying, aks holda Play «planshet
uchun moslashtirilmagan» deb ogohlantiradi.

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
