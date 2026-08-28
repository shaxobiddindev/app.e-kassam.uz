import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appApi, clearAppToken, getAppToken } from "./customerApi";
import Receipt from "../portal/Receipt";
import { qrSvg, totpNow, secondsLeft } from "../lib/ek-qr";
import { code128Svg } from "../lib/ek-barcode";
import { useConfirm } from "../context/ConfirmProvider";
import CodeZoom from "../components/CodeZoom";
import { dateTime, groupDigits } from "../lib/ek-format";
import { registerPushIfPossible, getPushToken } from "../lib/ek-push";

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ ILOVASI (V37–V39) — Korzinka Go / Makro uslubidagi sodda daraxt

   Besh ekran: KARTA (jami ball) · AKSIYALAR · CHEKLAR · DO'KONLARIM ·
   PROFIL. Kassa interfeysining hech bir qismi bu yerda ko'rinmaydi.

   ⚠ Ballar do'kon bo'yicha ALOHIDA (do'konlar pulni bo'lishmaydi), jami
   esa faqat ko'rsatish uchun: bir do'konda ikkinchisining balliga to'lab
   bo'lmaydi va interfeys buni yashirmasligi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

/* ⚠ AJRATGICH BUTUN MAHSULOTDA BIR XIL bo'lishi shart
   (02-DESIGN-SYSTEM.md). Bu yerda `Intl.NumberFormat("uz-UZ")` ishlatilardi
   va u brauzerga qarab vergul qaytarardi: mijoz SMS da «500 000 so'm»,
   sahifada esa «500,000 so'm» ko'rib, ikkalasi bir xil summami deb
   o'ylardi. `groupDigits` — tizimning yagona guruhlagichi. */
const money = (v) => groupDigits(v || 0);

const TABS = [
  { key: "card",     icon: "fa-id-card",  label: "Kartam" },
  { key: "news",     icon: "fa-bullhorn", label: "Aksiyalar" },
  { key: "receipts", icon: "fa-receipt",  label: "Cheklar" },
  { key: "shops",    icon: "fa-store",    label: "Do'konlar" },
  { key: "profile",  icon: "fa-user",     label: "Profil" },
];

/* ⚠ Sana TIZIMNING umumiy formatchisidan (`ek-format.dateTime`):
   `toLocaleString("uz-UZ")` brauzerda «2026 M08 16» deb chiqadi — o'zbekcha
   oy nomlari yo'q va u odam o'qiydigan ko'rinish emas. */
const dateLabel = (v) => dateTime(v);

export default function CustomerApp({ onLoggedOut }) {
  const [tab, setTab]   = useState("card");
  const [me, setMe]     = useState(null);
  const [shops, setShops] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    appApi.me().then(setMe).catch((e) => {
      /* Kalit eskirgan yoki bekor qilingan — kirish ekraniga qaytamiz. */
      if (e.status === 404) { clearAppToken(); onLoggedOut(); return; }
      setError(e.message);
    });
    appApi.shops().then(setShops).catch(() => {});
  }, [onLoggedOut]);

  useEffect(load, [load]);

  /* ── Bildirishnoma (V38) ───────────────────────────────────────────
     ⚠ Ilgari Profildagi tugma HECH NARSA QILMASDI: bayroq bazaga
     yozilardi-yu, qurilma tokeni ro'yxatga olinmasdi. Ro'yxatga olish
     ekran ochilishida, faqat mijoz xabarni O'CHIRMAGAN bo'lsa
     (o'chirgan odamdan Android ruxsatini qayta so'rash — bezorilik). */
  useEffect(() => {
    if (!me?.pushEnabled) return;
    registerPushIfPossible(appApi.pushRegister).catch(() => {});
  }, [me?.pushEnabled]);

  const logout = async () => {
    try { await appApi.logout(getPushToken()); } catch (_) { /* baribir chiqamiz */ }
    clearAppToken();
    onLoggedOut();
  };

  /* ⚠ XATO EKRANI BOSHI BERK EDI (2026-08-17 shikoyati): «Failed to
     fetch» yozuvi chiqib, na qaytish, na qayta urinish tugmasi bo'lardi —
     ilovani o'chirib-yoqishdan boshqa yo'l qolmasdi. */
  if (error) {
    return (
      <div className="cu-wrap">
        <div className="cu-card cu-center">
          <i className="fa-solid fa-wifi cu-big-icon" aria-hidden="true" />
          <p><b>Ma'lumot yuklanmadi</b></p>
          <p className="cu-muted">{error}</p>
          <button className="cu-btn" onClick={() => { setError(""); load(); }}>
            Qayta urinish
          </button>
          <button className="cu-btn cu-btn--ghost" onClick={logout}>Chiqish</button>
        </div>
      </div>
    );
  }
  if (!me)   return <div className="cu-wrap"><div className="cu-card cu-center">Yuklanmoqda…</div></div>;

  return (
    <div className="cu-app">
      <main className="cu-page">
        {tab === "card"     && <CardScreen me={me} shops={shops} />}
        {tab === "news"     && <NewsScreen />}
        {tab === "receipts" && <ReceiptsScreen />}
        {tab === "shops"    && <ShopsScreen shops={shops} />}
        {tab === "profile"  && <ProfileScreen me={me} onSaved={setMe} onLogout={logout} />}
      </main>

      <nav className="cu-nav" aria-label="Menyu">
        {TABS.map(({ key, icon, label }) => (
          <button key={key} type="button"
                  className={`cu-nav__btn ${tab === key ? "active" : ""}`}
                  aria-current={tab === key ? "page" : undefined}
                  onClick={() => setTab(key)}>
            <i className={`fa-solid ${icon}`} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ⚠ Har bir xato ekranida CHIQISH YO'LI bo'lishi shart: tarmoq uzilishi
   odatiy hol va u ilovani boshi berk ko'chaga olib kirmasligi kerak. */
function Retry({ text, onRetry }) {
  return (
    <div className="cu-card cu-center">
      <i className="fa-solid fa-wifi cu-big-icon" aria-hidden="true" />
      <p className="cu-muted">{text}</p>
      <button className="cu-btn" onClick={onRetry}>Qayta urinish</button>
    </div>
  );
}

/* ── 1. Karta: jami ball va kassada ko'rsatiladigan kod ──────────────── */

/* ══════════════════════════════════════════════════════════════════════════
   QARZLARIM — TASDIQ KUTAYOTGANLARI (V46)

   ⚠ NEGA ALOHIDA VARAQ EMAS, BANNER. Bu ro'yxat odatda BO'SH bo'ladi, va
   bo'sh varaq uchun doimiy tugma menyuni bekorga to'ldirardi. Qarz esa
   paydo bo'lganda SHOSHILINCH: mijoz uni ko'rishi va javob berishi kerak
   — shuning uchun u ochilgan zahoti, birinchi ekranning tepasida turadi.

   ⚠ RAD ETISH QARZNI O'CHIRMAYDI. Bu do'konga «men olmadim» degan xabar,
   hukm emas — do'kon buni ko'radi va o'zi hal qiladi. Mijozga ham shu
   aytiladi, aks holda u tugmani «qarzni bekor qilish» deb tushunardi.
   ══════════════════════════════════════════════════════════════════════════ */
function DebtsBanner({ debts, onAnswer, busy }) {
  if (!debts.length) return null;
  return (
    <div className="cu-card cu-debt">
      <div className="cu-debt__head">
        <i className="fa-solid fa-hand-holding-dollar" aria-hidden="true" />
        <b>Nasiya tasdig'i</b>
      </div>
      {debts.map((d) => (
        <div key={d.id} className="cu-debt__row">
          <div>
            <div className="cu-debt__shop">{d.shopName}</div>
            <div className="cu-debt__sum">{money(d.amount)} so'm</div>
            <div className="cu-muted cu-debt__date">{dateTime(d.createdAt)}</div>
          </div>
          <div className="cu-debt__btns">
            <button type="button" className="cu-btn cu-btn--sm"
                    disabled={busy === d.id}
                    onClick={() => onAnswer(d, true)}>Ha, oldim</button>
            <button type="button" className="cu-btn cu-btn--sm cu-btn--ghost"
                    disabled={busy === d.id}
                    onClick={() => onAnswer(d, false)}>Men olmadim</button>
          </div>
        </div>
      ))}
      <p className="cu-muted cu-debt__note">
        «Men olmadim» qarzni o'chirmaydi — javobingiz do'konga boradi va
        ular siz bilan bog'lanadi.
      </p>
    </div>
  );
}

const PICKED_KEY = "ek_app_card_shop";

function CardScreen({ me, shops }) {
  const items = shops?.items || [];

  /* Tasdiq kutayotgan qarzlar (V46). Xato JIMGINA yutiladi: karta
     ekranining o'zi bundan buzilmasligi kerak. */
  const [debts, setDebts] = useState([]);
  const [debtBusy, setDebtBusy] = useState(null);
  const confirm = useConfirm();

  useEffect(() => {
    let alive = true;
    appApi.debts().then((d) => { if (alive) setDebts(d || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const answerDebt = async (d, confirmed) => {
    /* ⚠ RAD ETISHDA TASDIQ SO'RALADI: bu do'kon bilan munosabatga
       ta'sir qiladigan javob va uni tasodifan bosib yuborish mumkin
       emas. Tasdiqlashda esa so'ralmaydi — u kutilgan harakat. */
    if (!confirmed) {
      const ok = await confirm({
        title: "Men olmadim",
        message: `${d.shopName}: ${money(d.amount)} so'm. Do'konga «bu qarzni men olmaganman» deb xabar boradi. Davom etamizmi?`,
        type: "warning",
        confirmText: "Ha, men olmadim",
        cancelText: "Bekor qilish",
      });
      if (!ok) return;
    }
    setDebtBusy(d.id);
    try {
      await appApi.answerDebt(d.id, confirmed);
      setDebts((prev) => prev.filter((x) => x.id !== d.id));
    } catch (_) {
      /* Javob ketmadi — qator joyida qoladi va mijoz qayta urinadi. */
    } finally {
      setDebtBusy(null);
    }
  };

  /* ⚠ Karta kodi DO'KONGA tegishli: bitta odamda har do'konda o'z kodi
     bor. Ilgari bu yerda DOIM BIRINCHI do'kon kartasi chizilardi va ikki
     do'konli mijoz ikkinchi do'konda noto'g'ri kod ko'rsatib turardi —
     kassir uni topa olmasdi. Endi do'kon tanlanadi va tanlov qurilmada
     saqlanadi (odam odatda bitta do'konga qatnaydi). */
  const [pickedId, setPickedId] = useState(() => {
    const saved = Number(localStorage.getItem(PICKED_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : null;
  });

  const picked = items.find((s) => s.id === pickedId) || items[0];

  const pick = (id) => {
    setPickedId(id);
    localStorage.setItem(PICKED_KEY, String(id));
  };

  /* Qaysi kod kattalashtirilgan: `null` · `"qr"` · `"bar"` */
  const [zoom, setZoom] = useState(null);

  /* ══ AYLANMA KARTA (V45) ═══════════════════════════════════════════════

     ⚠ MUAMMO. Karta QAT'IY kod edi: bu ekranni bir marta suratga olgan
     odam uni cheksiz ishlatishi mumkin edi. Kassada karta skanerlanganda
     mijoz TANLANADI, ya'ni nusxasi bo'lgan odam BEGONANING ballarini
     ishlatib yuborishi mumkin — ball esa pulga teng.

     Endi kod ikki qismdan: `EKC-K7M2P9QX-482915`. Birinchisi kimligini
     aytadi, ikkinchisi har 30 soniyada yangilanadi (TOTP). Surat 30
     soniyadan keyin ishlamaydi.

     ⚠ KOD SERVERDAN SO'RALMAYDI, ILOVADA yasaladi. Sir bir marta olinadi
     va kod undan oflayn hisoblanadi: kassa navbatida internet yo'qolishi
     oddiy hol va o'sha payt karta ishlamay qolsa, mexanizm mijoz uchun
     ishonchsiz bo'lib qolardi.

     ⚠ Sir do'kon bo'yicha ALOHIDA (har do'konda o'z kartasi), shuning
     uchun kesh `id` bo'yicha saqlanadi.

     ⚠ Sir olinmasa karta ESKICHA — qat'iy kod bilan — ishlayveradi.
     Bu ataylab: eski server yoki tarmoqsiz birinchi ochilish mijozni
     kartasiz qoldirmasligi kerak. */
  const [secrets, setSecrets] = useState({});
  const [otp, setOtp] = useState("");
  const [left, setLeft] = useState(30);
  /* ⚠ SO'RALGANLAR RO'YXATI ALOHIDA (`ref`), holatda emas: holat
     yangilangunicha effekt qayta ishga tushib, o'sha do'kon uchun sirni
     IKKINCHI marta so'rardi. */
  const asked = useRef({});

  /* ⚠ «ALIVE» BAYROG'I ATAYLAB YO'Q — u bu yerda TUZOQ edi. React ishlab
     chiqish rejimida effektni ikki marta ishga tushiradi: 1-yurish sirni
     so'raydi va `asked` ni belgilaydi, tozalash `alive = false` qiladi,
     2-yurish esa `asked` tufayli qaytib ketadi. Natijada javob kelganda
     uni QABUL QILADIGAN hech kim qolmasdi va karta hech qachon
     aylanmasdi. Tugaganidan keyin holat o'zgartirish React 18 da
     zararsiz (hech narsa qilmaydi), qo'riqchi esa `asked` ning o'zi. */
  useEffect(() => {
    const id = picked?.id;
    if (!id || asked.current[id]) return;
    asked.current[id] = true;
    appApi.cardSecret(id)
      /* ⚠ `call()` JAVOB TANASINI EMAS, `data` ni qaytaradi. */
      .then((r) => setSecrets((p) => ({ ...p, [id]: r || null })))
      /* Xato JIMGINA yutiladi: karta qat'iy kod bilan baribir ishlaydi. */
      .catch(() => setSecrets((p) => ({ ...p, [id]: null })));
  }, [picked?.id]);

  const cfg = picked?.id ? secrets[picked.id] : null;

  useEffect(() => {
    if (!cfg?.secret) { setOtp(""); return undefined; }
    let stopped = false;
    const period = cfg.periodSeconds || 30;

    const tick = async () => {
      try {
        const code = await totpNow(cfg.secret, period);
        if (!stopped) setOtp(code);
      } catch (_) {
        /* `crypto.subtle` yo'q (HTTPS bo'lmagan kontekst) — qat'iy kodga
           tushamiz, karta baribir ishlaydi. */
        if (!stopped) setOtp("");
      }
    };

    tick();
    const timer = setInterval(() => {
      const s = secondsLeft(period);
      setLeft(s);
      if (s === period) tick();
    }, 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, [cfg]);

  /* Skanerlanadigan qiymat: sir bo'lsa aylanma, bo'lmasa eskicha. */
  const cardValue = picked
    ? "EKC-" + picked.cardCode + (otp ? "-" + otp : "")
    : "";

  /* ⚠ RASMLAR KESHLANADI. Orqa hisob har soniyada yangilanadi, ya'ni
     ekran ham har soniyada qayta chiziladi — QR va shtrixni har safar
     qaytadan yasash telefonni bekorga qizdirardi. Ular faqat KOD
     o'zgarganda (30 soniyada bir marta) yangilanadi. */
  const qrHtml  = useMemo(() => (cardValue ? qrSvg(cardValue, { size: 180, margin: 1 }) : ""), [cardValue]);
  const barHtml = useMemo(() => (cardValue ? code128Svg(cardValue) : ""), [cardValue]);

  return (
    <div className="cu-screen">
      {/* ⚠ ENG TEPADA: qarz tasdig'i shoshilinch va uni pastga surib
          qo'yish «ko'rmadim» degan javobga olib kelardi. */}
      <DebtsBanner debts={debts} onAnswer={answerDebt} busy={debtBusy} />
      <div className="cu-hero">
        <span className="cu-hero__label">Jami ballaringiz</span>
        <b className="cu-hero__value">{money(me.totalBonus)}</b>
        <span className="cu-hero__sub">{me.shopCount} ta do'konda</span>
      </div>

      {/* Do'kon tanlagich — faqat bir nechta do'kon bo'lsa. Bitta do'konli
          mijozga bu qator ortiqcha shovqin bo'lardi. */}
      {items.length > 1 && (
        <div className="cu-chips" role="tablist" aria-label="Do'kon tanlash">
          {items.map((s) => (
            <button key={s.id} type="button" role="tab"
                    aria-selected={picked?.id === s.id}
                    className={`cu-chip ${picked?.id === s.id ? "active" : ""}`}
                    onClick={() => pick(s.id)}>
              {s.shopName}
            </button>
          ))}
        </div>
      )}

      {picked ? (
        <div className="cu-card cu-card--code">
          <div className="cu-code__shop">{picked.shopName}</div>
          {/* Oq fon SHART: qorong'i temada teskari rangdagi kodni ko'p
              skaner va kamera umuman o'qimaydi.

              ⚠ Ikkalasi ham BOSILADI: ustiga bosilganda aynan o'sha kod
              butun ekranda va maksimal yorug'likda ochiladi (`CodeZoom`).
              Kartadagi kichik kodni xira telefondan skaner ololmasdi. */}
          <button type="button" className="ek-code-btn cu-code__qr"
                  onClick={() => setZoom("qr")} aria-label="QR kodni kattalashtirish"
                  dangerouslySetInnerHTML={{ __html: qrHtml }} />
          <button type="button" className="ek-code-btn cu-code__bars"
                  onClick={() => setZoom("bar")} aria-label="Shtrix kodni kattalashtirish"
                  dangerouslySetInnerHTML={{ __html: barHtml }} />
          <div className="cu-code__num">{picked.cardCode}</div>
          {/* ⚠ Orqa hisob KO'RINADI. Kod jimgina yangilansa, mijoz
              skanerlanmagan kodni ushlab turib «buzuq» deb o'ylardi;
              hisoblagich esa «hozir yangilanadi, kutib turing» deydi. */}
          {otp ? (
            <p className="cu-muted cu-center">
              Kassada shu kodni ko'rsating · <b>{left} s</b> dan keyin yangilanadi
            </p>
          ) : (
            <p className="cu-muted cu-center">Kassada shu kodni ko'rsating — kattalashtirish uchun bosing</p>
          )}
          <div className="cu-code__bonus">
            <span>Shu do'kondagi ball</span><b>{money(picked.bonusBalance)}</b>
          </div>
          {/* Muddat ogohlantirishi kartaning O'ZIDA: mijoz bu ekranni
              kassada ochadi va aynan o'sha payt «kuyib ketishidan oldin
              ishlatay» deb ayta oladi. */}
          {Number(picked.bonusExpiringSoon) > 0 && (
            <p className="cu-warn cu-center">
              <i className="fa-solid fa-clock" aria-hidden="true" />{" "}
              {money(picked.bonusExpiringSoon)} ball 30 kun ichida kuyadi
            </p>
          )}
        </div>
      ) : (
        <div className="cu-card cu-center">
          <i className="fa-solid fa-qrcode cu-big-icon" aria-hidden="true" />
          <p><b>Hali do'konga qo'shilmagansiz</b></p>
          <p className="cu-muted">
            Do'kondagi QR kodni skanerlang — karta shu yerda paydo bo'ladi.
          </p>
        </div>
      )}

      {zoom && picked && (
        <CodeZoom kind={zoom} value={cardValue}
                  caption={picked.cardCode} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

/* ── 2. Aksiyalar va yangiliklar ─────────────────────────────────────────
   ⚠ Muddati o'tgani KO'RINMAYDI (server filtrlaydi): tugagan aksiya
   ro'yxatda osilib tursa, do'kon yolg'onchi bo'lib qoladi. */

function NewsScreen() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    setItems(null);
    appApi.announcements().then(setItems).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error)  return <div className="cu-screen"><Retry text={error} onRetry={load} /></div>;
  if (!items) return <div className="cu-screen"><div className="cu-card cu-center">Yuklanmoqda…</div></div>;

  return (
    <div className="cu-screen">
      <h1 className="cu-title">Aksiyalar</h1>

      {items.length === 0 && (
        <div className="cu-card cu-center">
          <i className="fa-solid fa-bullhorn cu-big-icon" aria-hidden="true" />
          <p><b>Hozircha e'lon yo'q</b></p>
          <p className="cu-muted">
            Do'konlaringiz chegirma yoki yangilik e'lon qilsa, u shu yerda paydo bo'ladi.
          </p>
        </div>
      )}

      {items.map((a) => (
        <article key={a.id} className="cu-card cu-news">
          <div className="cu-news__shop">{a.shopName}</div>
          <h2 className="cu-news__title">{a.title}</h2>
          {a.body && <p className="cu-news__body">{a.body}</p>}
          <div className="cu-news__foot">
            <span className="cu-muted">{dateLabel(a.date)}</span>
            {a.endsAt && (
              <span className="cu-warn">
                <i className="fa-solid fa-clock" aria-hidden="true" /> {dateLabel(a.endsAt)} gacha
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

/* ── 3. Cheklarim ───────────────────────────────────────────────────────
   ⚠ Lenta HAMMA do'kon bo'yicha bitta ro'yxat: mijoz xaridni sana bo'yicha
   eslaydi, «qaysi do'konda edi» deb emas. Do'kon nomi har satrda turadi. */

function ReceiptsScreen() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen]   = useState(null);   // { id, customerId }

  const load = () => {
    setError("");
    setItems(null);
    appApi.receipts(50).then(setItems).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <div className="cu-screen"><Retry text={error} onRetry={load} /></div>;
  if (!items) return <div className="cu-screen"><div className="cu-card cu-center">Yuklanmoqda…</div></div>;

  return (
    <div className="cu-screen">
      <h1 className="cu-title">Cheklarim</h1>

      {items.length === 0 && (
        <div className="cu-card cu-center">
          <i className="fa-solid fa-receipt cu-big-icon" aria-hidden="true" />
          <p><b>Hali chek yo'q</b></p>
          <p className="cu-muted">
            Kassada kartangizni ko'rsating — xarid cheki shu yerda saqlanadi.
          </p>
        </div>
      )}

      <ul className="cu-list">
        {items.map((r) => (
          <li key={`${r.customerId}-${r.id}`}>
            <button className="cu-rcp" onClick={() => setOpen({ id: r.id, customerId: r.customerId })}>
              <span className="cu-rcp__left">
                <b>{r.receiptNo}</b>
                <small className="cu-muted">{r.shopName}</small>
                <small className="cu-muted">{dateLabel(r.date)}</small>
              </span>
              <span className="cu-rcp__right">
                <b>{money(r.total)}</b>
                {Number(r.bonusEarned) > 0 && <small className="cu-pos">+{money(r.bonusEarned)} ball</small>}
                {Number(r.bonusUsed) > 0 && <small className="cu-muted">−{money(r.bonusUsed)} ball</small>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Chek ko'rinishi kabinet bilan BIR XIL komponentdan — qog'oz
          chekning taqlidi ikki joyda ayri-ayri yozilmasin. */}
      {open && (
        <Receipt appToken={getAppToken()} id={open.id} customerId={open.customerId}
                 onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

/* ── 4. Do'konlarim ─────────────────────────────────────────────────── */

function ShopsScreen({ shops }) {
  const items = shops?.items || [];
  const [history, setHistory] = useState(null);   // { id, shopName }

  return (
    <div className="cu-screen">
      <h1 className="cu-title">Do'konlarim</h1>

      {items.length === 0 && (
        <div className="cu-card cu-center">
          <p className="cu-muted">
            Do'kondagi QR kodni skanerlang — u shu ro'yxatga qo'shiladi.
          </p>
        </div>
      )}

      {/* ⚠ Har satr BOSILADI: ball — mijozning puliga teng narsa va
          «qayerdan yig'ildi, qayerga ketdi» degan savolga javob bo'lishi
          kerak. Jurnal do'konникi bilan bir xil manbadan o'qiladi. */}
      <ul className="cu-list">
        {items.map((s) => (
          <li key={s.id}>
            <button className="cu-shop cu-shop--btn"
                    onClick={() => setHistory({ id: s.id, shopName: s.shopName })}>
              <span className="cu-shop__left">
                <b>{s.shopName}</b>
                <small className="cu-muted">Karta: {s.cardCode || "—"}</small>
                {Number(s.bonusExpiringSoon) > 0 && (
                  <small className="cu-warn">
                    <i className="fa-solid fa-clock" aria-hidden="true" />{" "}
                    {money(s.bonusExpiringSoon)} ball 30 kun ichida kuyadi
                  </small>
                )}
              </span>
              <span className="cu-shop__right">
                <b className="cu-pos">{money(s.bonusBalance)}</b>
                <small className="cu-muted">ball</small>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {items.length > 0 && (
        <div className="cu-total">
          <span>Jami</span><b>{money(shops.totalBonus)}</b>
        </div>
      )}

      {history && (
        <BonusSheet customerId={history.id} shopName={history.shopName}
                    onClose={() => setHistory(null)} />
      )}
    </div>
  );
}

/* ── 4b. Ball tarixi ────────────────────────────────────────────────────
   ⚠ Turlar SERVERDAN kelgan nom bilan keladi va shu yerda tarjima
   qilinadi. Summani mijoz IMZO bilan ko'radi (+840 / −5 000) — «SPEND»
   degan so'zni o'qib yo'nalishni o'zi topishi kerak emas. */

const BONUS_LABEL = {
  EARN:   { text: "Xariddan yig'ildi",        icon: "fa-plus" },
  SPEND:  { text: "Xaridda ishlatildi",       icon: "fa-minus" },
  REVOKE: { text: "Qaytarish tufayli olindi", icon: "fa-rotate-left" },
  RESTORE:{ text: "Qaytarishda qaytarildi",   icon: "fa-rotate-left" },
  ADJUST: { text: "Do'kon to'g'irladi",       icon: "fa-pen" },
  EXPIRE: { text: "Muddati o'tdi",            icon: "fa-clock" },
};

function BonusSheet({ customerId, shopName, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    appApi.bonus(customerId).then(setData).catch((e) => setError(e.message));
  }, [customerId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cu-sheet" role="dialog" aria-modal="true" aria-label="Ball tarixi">
      <header className="cu-sheet__head">
        <button className="cu-sheet__back" onClick={onClose} aria-label="Orqaga">
          <i className="fa-solid fa-chevron-left" aria-hidden="true" />
        </button>
        <div>
          <b>Ball tarixi</b>
          <small className="cu-muted">{shopName}</small>
        </div>
      </header>

      <div className="cu-sheet__body">
        {error && <Retry text={error} onRetry={() =>
          { setError(""); appApi.bonus(customerId).then(setData).catch((e) => setError(e.message)); }} />}
        {!data && !error && <div className="cu-card cu-center">Yuklanmoqda…</div>}

        {data && (
          <>
            <div className="cu-card cu-center">
              <span className="cu-muted">Hozirgi ball</span>
              <div className="cu-sheet__sum">{money(data.balance)}</div>
              {data.expiryDays
                ? <p className="cu-muted">Ball yig'ilganidan {data.expiryDays} kun ichida ishlatilishi kerak</p>
                : <p className="cu-muted">Bu do'konda ball muddati yo'q</p>}
              {Number(data.expiringSoon) > 0 && (
                <p className="cu-warn">
                  <i className="fa-solid fa-clock" aria-hidden="true" />{" "}
                  {money(data.expiringSoon)} ball 30 kun ichida kuyadi
                </p>
              )}
            </div>

            {data.items.length === 0 && (
              <p className="cu-muted cu-center">Hali harakat yo'q.</p>
            )}

            <ul className="cu-list">
              {data.items.map((b, i) => {
                const meta = BONUS_LABEL[b.type] || { text: b.type, icon: "fa-circle" };
                const plus = Number(b.amount) > 0;
                return (
                  <li key={i} className="cu-bonus">
                    <span className={`cu-bonus__icon ${plus ? "pos" : "neg"}`}>
                      <i className={`fa-solid ${meta.icon}`} aria-hidden="true" />
                    </span>
                    <span className="cu-bonus__mid">
                      <b>{meta.text}</b>
                      <small className="cu-muted">{dateLabel(b.date)}</small>
                      {b.receiptNo && <small className="cu-muted">Chek {b.receiptNo}</small>}
                      {b.note && <small className="cu-muted">{b.note}</small>}
                    </span>
                    <b className={plus ? "cu-pos" : "cu-neg"}>
                      {plus ? "+" : "−"}{money(Math.abs(Number(b.amount)))}
                    </b>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 5. Profil ──────────────────────────────────────────────────────── */

function ProfileScreen({ me, onSaved, onLogout }) {
  const [name, setName] = useState(me.fullName || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const confirm = useConfirm();

  /* ⚠ Chiqish TASDIQSIZ edi: tasodifan bosilgan tugma mijozni kirish
     ekraniga otib yuborardi va u qayta kirish uchun Telegramga borishi
     kerak bo'lardi. Tasdiq brauzerning `confirm` oynasi emas, ILOVANING
     modali — qolgan hamma joyda ham shunday. */
  const askLogout = async () => {
    const ok = await confirm({
      title: "Chiqish",
      message: "Hisobingizdan chiqasizmi? Qayta kirish uchun Telegram orqali tasdiqlash kerak bo'ladi.",
      type: "warning",
      confirmText: "Chiqish",
      cancelText: "Bekor qilish",
    });
    if (ok) onLogout();
  };

  const save = async () => {
    setBusy(true);
    try {
      const r = await appApi.updateMe({ fullName: name, pushEnabled: me.pushEnabled });
      onSaved(r);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  const togglePush = async () => {
    const r = await appApi.updateMe({ pushEnabled: !me.pushEnabled });
    onSaved(r);
  };

  return (
    <div className="cu-screen">
      <h1 className="cu-title">Profil</h1>

      <div className="cu-card">
        <label className="cu-label" htmlFor="cu-name">Ismingiz</label>
        <input id="cu-name" className="cu-input" value={name}
               onChange={(e) => setName(e.target.value)} />

        {/* ⚠ Telefon o'zgartirilmaydi: u hisobning kaliti va Telegram
            orqali tasdiqlangan. O'zgartirish kerak bo'lsa — yangi hisob. */}
        <label className="cu-label">Telefon</label>
        <div className="cu-readonly">+998 {me.phone}</div>

        <button className="cu-btn" onClick={save} disabled={busy}>
          {saved ? "Saqlandi ✓" : busy ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>

      <EmailCard me={me} onSaved={onSaved} />

      <div className="cu-card">
        <div className="cu-row">
          <span><i className="fa-solid fa-bell" aria-hidden="true" /> Bildirishnomalar</span>
          <button className={`cu-switch ${me.pushEnabled ? "on" : ""}`} onClick={togglePush}
                  aria-pressed={me.pushEnabled} aria-label="Bildirishnomalar">
            <span />
          </button>
        </div>
        <p className="cu-muted" style={{ fontSize: 13, marginTop: 6 }}>
          Ball yig'ilganda va muddati tugayotganda xabar keladi.
        </p>
      </div>

      <button className="cu-btn cu-btn--ghost" onClick={askLogout}>Chiqish</button>
    </div>
  );
}

/* ── Pochta bilan kirish (V40) ───────────────────────────────────────────
   ⚠ Pochta TELEFONNING O'RNINI BOSMAYDI: do'kondagi karta va ballar
   telefon bo'yicha bog'lanadi, pochta esa faqat SHU hisobga kirishning
   ikkinchi yo'li (Telegram o'chirilgan yoki qo'lda emas holat uchun).
   Shu sababli u profilda qo'shiladi va kod bilan tasdiqlanadi. */

function EmailCard({ me, onSaved }) {
  const [email, setEmail] = useState(me.email || "");
  const [code, setCode]   = useState("");
  const [stage, setStage] = useState(me.emailVerified ? "done" : (me.email ? "code" : "edit"));
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");
  const [note, setNote]   = useState("");

  const send = async () => {
    setError(""); setNote(""); setBusy(true);
    try {
      await appApi.emailAdd(email.trim());
      setStage("code");
      setNote("Tasdiqlash kodi pochtangizga yuborildi.");
    } catch (e) {
      setError(e.message || "Yuborilmadi");
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    setError(""); setBusy(true);
    try {
      const r = await appApi.emailConfirm(code.trim());
      onSaved(r);
      setStage("done");
      setNote("Pochta tasdiqlandi — endi u bilan ham kirsangiz bo'ladi.");
    } catch (e) {
      setError(e.message || "Kod noto'g'ri");
    } finally { setBusy(false); }
  };

  return (
    <div className="cu-card">
      <div className="cu-row">
        <span><i className="fa-solid fa-envelope" aria-hidden="true" /> Pochta bilan kirish</span>
        {me.emailVerified && <span className="cu-pos">tasdiqlangan</span>}
      </div>
      <p className="cu-muted" style={{ fontSize: 13, margin: "6px 0 8px" }}>
        Telegramsiz ham kira olishingiz uchun. Kirish kodi shu manzilga keladi.
      </p>

      {stage === "done" ? (
        <>
          <div className="cu-readonly">{me.email}</div>
          <button className="cu-btn cu-btn--ghost"
                  onClick={() => { setStage("edit"); setNote(""); }}>
            Boshqa pochta
          </button>
        </>
      ) : (
        <>
          <label className="cu-label" htmlFor="cu-email">Pochta manzili</label>
          <input id="cu-email" className="cu-input" type="email" inputMode="email"
                 autoComplete="email" placeholder="ism@pochta.uz" value={email}
                 disabled={stage === "code"}
                 onChange={(e) => setEmail(e.target.value)} />

          {stage === "code" && (
            <>
              <label className="cu-label" htmlFor="cu-email-code">Kelgan kod</label>
              <input id="cu-email-code" className="cu-input" inputMode="numeric"
                     autoComplete="one-time-code" maxLength={6} placeholder="123456"
                     value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </>
          )}

          {error && <div className="cu-error" role="alert">{error}</div>}
          {note && <p className="cu-muted">{note}</p>}

          <button className="cu-btn" disabled={busy || (stage === "edit" ? !email.trim() : code.length < 4)}
                  onClick={stage === "edit" ? send : confirm}>
            {busy ? "Kutilmoqda…" : stage === "edit" ? "Kod yuborish" : "Tasdiqlash"}
          </button>
          {stage === "code" && (
            <button className="cu-btn cu-btn--ghost" onClick={() => { setStage("edit"); setCode(""); }}>
              Manzilni o'zgartirish
            </button>
          )}
        </>
      )}
    </div>
  );
}
