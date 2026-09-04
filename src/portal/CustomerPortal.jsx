import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { API_BASE } from "../config";
import { qrSvg, totpNow, secondsLeft } from "../lib/ek-qr";
import { code128Svg } from "../lib/ek-barcode";
import { useConfirm } from "../context/ConfirmProvider";
import CodeZoom from "../components/CodeZoom";
import { dateTime, groupDigits } from "../lib/ek-format";
import { MaskedField } from "../components/ek/EkFields";
import { phoneInput } from "../lib/ek-input";
import Receipt from "./Receipt";
import PaymentReceipt from "./PaymentReceipt";

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ KABINETI — do'kon xaridorining sahifasi (V34)

   Bu daraxt XODIMLARNIKIDAN BUTUNLAY AJRATILGAN:
     · kirish, rol, do'kon tanlash — YO'Q;
     · yagona kalit — ro'yxatdan o'tganda olingan `portalToken`, u
       brauzerda saqlanadi;
     · tashqi ko'rinishi ham boshqa: bu mijozning kartasi, kassa emas.

   Ikki holat:
     1. `/qr?r=<ref>&c=<kod>` — do'kon QR i o'qilgan: ro'yxatdan o'tish.
     2. `/kabinet`            — saqlangan kalit bilan: karta, ball, cheklar.

   ⚠ Xodim ilovasining `api/index.js` i ATAYLAB ishlatilmadi: u har so'rovga
   xodim tokenini qo'shadi va 401 da kirish sahifasiga otadi. Mijozda esa
   xodim tokeni yo'q va uni kirish sahifasiga otish mantiqsiz.
   ══════════════════════════════════════════════════════════════════════════ */

const TOKEN_KEY = "ek_portal_token";

/** Karta shtrixi/QR prefiksi — kassa va server bilan BIR XIL bo'lishi shart
    (`KassaPage.CARD_PREFIX`, `CustomerService.CARD_PREFIX`). */
const CARD_PREFIX = "EKC-";

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_BASE}/public/portal${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Portal-Token": token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Xatolik ${res.status}`);
  }
  return json.data;
}

/* ⚠ AJRATGICH BUTUN MAHSULOTDA BIR XIL bo'lishi shart
   (02-DESIGN-SYSTEM.md). Bu yerda `Intl.NumberFormat("uz-UZ")` ishlatilardi
   va u brauzerga qarab vergul qaytarardi: mijoz SMS da «500 000 so'm»,
   sahifada esa «500,000 so'm» ko'rib, ikkalasi bir xil summami deb
   o'ylardi. `groupDigits` — tizimning yagona guruhlagichi. */
const money = (v) => groupDigits(v || 0);

/* ── 1. Ro'yxatdan o'tish (QR o'qilgandan keyin) ────────────────────────── */

function JoinScreen({ ref_, code, onDone }) {
  const [shop, setShop]       = useState(null);
  const [error, setError]     = useState("");
  const [busy, setBusy]       = useState(false);
  const [form, setForm]       = useState({ fullName: "", phone: "" });

  useEffect(() => {
    api(`/shop/${encodeURIComponent(ref_)}`)
      .then(setShop)
      .catch((e) => setError(e.message));
  }, [ref_]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.fullName.trim()) return setError("Ismingizni yozing");
    if (form.phone.replace(/\D/g, "").length < 9) return setError("Telefon raqami to'liq emas");
    setBusy(true);
    try {
      const data = await api("/join", {
        method: "POST",
        body: { ref: ref_, code, fullName: form.fullName.trim(), phone: form.phone },
      });
      localStorage.setItem(TOKEN_KEY, data.portalToken);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (error && !shop) {
    return (
      <div className="pt-wrap">
        <div className="pt-card pt-center">
          <i className="fa-solid fa-circle-exclamation pt-icon-bad" aria-hidden="true" />
          <h2>Havola ishlamadi</h2>
          <p className="pt-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-wrap">
      <div className="pt-card">
        <div className="pt-shop">{shop?.name || "…"}</div>
        <h1 className="pt-title">Mijozlar kartasi</h1>
        <p className="pt-muted">
          Ro'yxatdan o'ting — har xaridingizdan ball yig'iladi va cheklaringiz
          shu yerda saqlanadi.
        </p>

        {error && <div className="pt-error" role="alert">{error}</div>}

        <form onSubmit={submit} className="pt-form">
          <label className="pt-label" htmlFor="pt-name">Ismingiz</label>
          <input id="pt-name" className="pt-input" autoComplete="name"
                 value={form.fullName}
                 onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />

          <label className="pt-label" htmlFor="pt-phone">Telefon</label>
          {/* ⚠ `+998` maydon ICHIDA emas, yonida: kod ichida bo'lsa odam
              to'liq raqam yozadi va u abonent raqami bo'lib tushadi
              (landing va kassa formalarida ushlangan xato). */}
          <div className="pt-phone">
            <span className="pt-phone__cc">+998</span>
            {/* ⚠ NIQOB ORQALI — kassadagi maydon bilan bir xil qoidada.
                Ilgari bu oddiy matn maydoni edi va mijoz raqamni
                xohlagan ko'rinishda yozardi; bazada esa u kassirniki
                bilan solishtiriladi. */}
            <MaskedField id="pt-phone" className="pt-input" mask={phoneInput}
                         type="tel" inputMode="tel"
                         autoComplete="tel" placeholder="90 123 45 67"
                         value={form.phone}
                         onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>

          <button className="pt-btn" type="submit" disabled={busy}>
            {busy ? "Yuborilmoqda…" : "Karta olish"}
          </button>
        </form>

        <p className="pt-fine">
          Ma'lumotlaringiz faqat shu do'konning mijozlar bazasida saqlanadi.
        </p>
      </div>
    </div>
  );
}

/* ── 1b. QARZ TASDIG'I (V46) — SMS havolasi ortidagi sahifa ─────────────

   ⚠ KABINET KALITI TALAB QILINMAYDI. SMS ni olgan odam qarzning egasi va
   havoladagi imzo FAQAT shu bitta qatorni ochadi. Kalit talab qilinsa,
   ro'yxatdan o'tmagan mijoz qarzini umuman tasdiqlay olmasdi — SMS esa
   aynan o'shalar uchun (ilovasi ham, Telegrami ham yo'q).

   ⚠ Sahifada mijozning ismi ham, telefoni ham YO'Q: havola boshqa
   odamning qo'liga tushsa, u faqat summani va do'kon nomini ko'radi. */
function DebtScreen({ id, sig }) {
  const [debt, setDebt]   = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy]   = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    api(`/debt/${id}?k=${encodeURIComponent(sig)}`)
      .then(setDebt)
      .catch((e) => setError(e.message));
  }, [id, sig]);

  const answer = async (confirmed) => {
    if (!confirmed) {
      const ok = await confirm({
        title: "Men olmadim",
        message: "Do'konga «bu qarzni men olmaganman» deb xabar boradi. Qarz o'chmaydi — do'kon buni ko'rib, siz bilan bog'lanadi. Davom etamizmi?",
        type: "warning",
        confirmText: "Ha, men olmadim",
        cancelText: "Bekor qilish",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      setDebt(await api(`/debt/${id}/answer?k=${encodeURIComponent(sig)}&confirmed=${confirmed}`,
                        { method: "POST" }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="pt-wrap">
        <div className="pt-card pt-center">
          <i className="fa-solid fa-circle-exclamation pt-icon-bad" aria-hidden="true" />
          <h2>Ochilmadi</h2>
          <p className="pt-muted">{error}</p>
        </div>
      </div>
    );
  }
  if (!debt) return <div className="pt-wrap"><div className="pt-card pt-center">Yuklanmoqda…</div></div>;

  const answered = debt.state === "CONFIRMED" || debt.state === "REJECTED";
  return (
    <div className="pt-wrap">
      <div className="pt-card pt-center">
        <div className="pt-shop">{debt.shopName}</div>
        <p className="pt-muted">Sizga nasiya yozildi</p>
        <div className="pt-debt-sum">{money(debt.amount)} so'm</div>
        <p className="pt-muted">{dateTime(debt.createdAt)}</p>

        {answered ? (
          <p className={debt.state === "CONFIRMED" ? "pt-ok" : "pt-bad"}>
            {debt.state === "CONFIRMED"
              ? "Tasdiqladingiz. Rahmat!"
              : "«Men olmadim» deb javob berdingiz — do'kon buni ko'radi."}
          </p>
        ) : (
          <>
            {/* ⚠ Tugmalar bir xil o'lchamda: birini kattaroq qilib
                qo'yish mijozni bir tomonga undardi. */}
            <div className="pt-debt-btns">
              <button className="pt-btn" disabled={busy} onClick={() => answer(true)}>Ha, oldim</button>
              <button className="pt-btn pt-btn--ghost" disabled={busy} onClick={() => answer(false)}>Men olmadim</button>
            </div>
            <p className="pt-muted" style={{ fontSize: 13 }}>
              «Men olmadim» qarzni o'chirmaydi — javobingiz do'konga boradi.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 2. Kabinet: karta, ball, cheklar ──────────────────────────────────── */

function CabinetScreen({ token, onLogout }) {
  const [me, setMe]             = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [openId, setOpenId]     = useState(null);
  const [error, setError]       = useState("");
  const [tgBusy, setTgBusy]     = useState(false);
  /* ⚠ Telegram xatosi ALOHIDA: u `error` ga yozilganda butun kabinet
     «Karta topilmadi» ekraniga almashib ketardi — karta esa joyida. */
  const [tgError, setTgError]   = useState("");
  /* Qaysi kod kattalashtirilgan: `null` · `"qr"` · `"bar"` */
  const [zoom, setZoom]         = useState(null);
  const confirm                 = useConfirm();

  /* ⚠ Kartani o'chirish TASDIQSIZ edi. Kalit faqat shu brauzerda saqlanadi
     va o'chsa mijoz kabinetga qayta kira olmaydi — do'konda QR ni qaytadan
     skanerlashi kerak bo'ladi. Tasdiq brauzer oynasi emas, ILOVA modali. */
  const askLogout = async () => {
    const ok = await confirm({
      title: "Kartani o'chirish",
      message: "Karta shu qurilmadan o'chiriladi. Qayta ochish uchun do'kondagi QR kodni yana skanerlashingiz kerak bo'ladi.",
      type: "danger",
      confirmText: "O'chirish",
      cancelText: "Bekor qilish",
    });
    if (ok) onLogout();
  };

  useEffect(() => {
    api("/me", { token }).then(setMe).catch((e) => setError(e.message));
    api("/receipts?limit=50", { token }).then(setReceipts).catch(() => {});
  }, [token]);

  /* ══ AYLANMA KARTA (V45) ═══════════════════════════════════════════════

     ⚠ ILOVADAGI BILAN BIR XIL bo'lishi SHART. Aynan bitta karta ikki
     joyda ko'rsatiladi: telefon ilovasida va shu kabinetda. Ilova sirni
     olgan ondan boshlab kassa TOTP ni talab qiladi — kabinet esa eski,
     qat'iy kodni chizib turaversa, o'sha mijozning kabinetdagi kartasi
     jimgina ishlamay qolardi.

     ⚠ KOD SERVERDAN SO'RALMAYDI, SAHIFADA yasaladi: kassa navbatida
     internet yo'qolishi oddiy hol va o'sha payt karta ishlamay qolsa,
     mexanizm mijoz uchun ishonchsiz bo'lib qolardi.

     ⚠ Sir olinmasa karta ESKICHA — qat'iy kod bilan — ishlayveradi. */
  const [cfg, setCfg]   = useState(null);
  const [otp, setOtp]   = useState("");
  const [left, setLeft] = useState(30);
  const asked = useRef(false);

  /* ⚠ «ALIVE» BAYROG'I ATAYLAB YO'Q — u bu yerda TUZOQ edi. React ishlab
     chiqish rejimida effektni ikki marta ishga tushiradi: 1-yurish sirni
     so'raydi va `asked` ni belgilaydi, tozalash `alive = false` qiladi,
     2-yurish esa `asked` tufayli qaytib ketadi. Natijada javob kelganda
     uni QABUL QILADIGAN hech kim qolmasdi va karta hech qachon
     aylanmasdi. Tugaganidan keyin holat o'zgartirish React 18 da
     zararsiz (hech narsa qilmaydi), qo'riqchi esa `asked` ning o'zi. */
  useEffect(() => {
    if (!token || asked.current) return;
    asked.current = true;
    api("/card-secret", { method: "POST", token })
      .then((d) => setCfg(d || null))
      /* Xato JIMGINA yutiladi: karta qat'iy kod bilan baribir ishlaydi. */
      .catch(() => {});
  }, [token]);

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
  const cardValue = me?.cardCode
    ? CARD_PREFIX + me.cardCode + (otp ? "-" + otp : "")
    : "";

  /* ⚠ RASMLAR KESHLANADI. Orqa hisob har soniyada yangilanadi, ya'ni
     ekran ham har soniyada qayta chiziladi — QR va shtrixni har safar
     qaytadan yasash telefonni bekorga qizdirardi. */
  const qrHtml  = useMemo(() => (cardValue ? qrSvg(cardValue, { size: 168, margin: 1 }) : ""), [cardValue]);
  const barHtml = useMemo(() => (cardValue ? code128Svg(cardValue) : ""), [cardValue]);

  /* Telegramga ulash: server bir martalik kod beradi, biz esa botni
     ochamiz. Bot `/start <kod>` ni olgach chat kabinetga bog'lanadi.
     ⚠ Yangi oynada ochiladi: telefonda bu Telegram ilovasini ishga
     tushiradi, kabinet esa brauzerda ochiq qoladi. */
  const linkTelegram = async () => {
    setTgBusy(true);
    setTgError("");
    try {
      const data = await api("/telegram-link", { method: "POST", token });
      if (data?.link) window.open(data.link, "_blank", "noopener");
    } catch (e) {
      setTgError(e.message || "Havola olinmadi");
    } finally {
      setTgBusy(false);
    }
  };

  if (error) {
    /* ⚠ Bu yerda yagona tugma «Yopish» deb turardi-yu, aslida KARTANI
       O'CHIRARDI: internet uzilib qolgan odam kalitini bilmasdan yo'qotib,
       do'konga borib QR ni qayta skanerlashga majbur bo'lardi. Endi
       birinchi taklif — qayta urinish; o'chirish esa tasdiq so'raydi. */
    return (
      <div className="pt-wrap">
        <div className="pt-card pt-center">
          <i className="fa-solid fa-circle-exclamation pt-icon-bad" aria-hidden="true" />
          <h2>Karta ochilmadi</h2>
          <p className="pt-muted">{error}</p>
          <button className="pt-btn" onClick={() => window.location.reload()}>Qayta urinish</button>
          <button className="pt-btn pt-btn--ghost" onClick={askLogout}>
            Kartani bu qurilmadan o'chirish
          </button>
        </div>
      </div>
    );
  }

  if (!me) return <div className="pt-wrap"><div className="pt-card pt-center">Yuklanmoqda…</div></div>;

  return (
    <div className="pt-wrap">
      {/* ── Karta: kassada ko'rsatiladi ────────────────────────────────
          ⚠ Ikkala kod ham chiziladi: QR va Code128. Do'kon skanerlarining
          deyarli hammasi bir o'lchovli (lazerli) va QR ni o'qimaydi —
          shtrix o'sha skanerlar uchun, QR esa telefon kamerasi uchun. */}
      <div className="pt-card pt-card--card">
        <div className="pt-shop">{me.shopName}</div>
        <div className="pt-name">{me.fullName}</div>

        {/* ⚠ Kodlarda `EKC-` PREFIKSI bor, ekranda ko'rinadigan raqamda
            esa YO'Q. Sabab: kassa skanerlangan matnni aynan shu prefiks
            bilan tovar barkodidan ajratadi (`KassaPage`, `CustomerService`),
            mijoz esa kartasini og'zaki aytganda qisqa kodni aytadi. */}
        {/* ⚠ Ikkala kod ham BOSILADI: ustiga bosilganda aynan o'sha bittasi
            butun ekranda va maksimal yorug'likda ochiladi (`CodeZoom`) —
            kartadagi kichik kodni xira telefondan skaner ololmasdi. */}
        <div className="pt-codes">
          <button type="button" className="ek-code-btn pt-qr"
                  onClick={() => setZoom("qr")} aria-label="QR kodni kattalashtirish"
                  dangerouslySetInnerHTML={{ __html: qrHtml }} />
          <button type="button" className="ek-code-btn pt-bars"
                  onClick={() => setZoom("bar")} aria-label="Shtrix kodni kattalashtirish"
                  dangerouslySetInnerHTML={{ __html: barHtml }} />
          <div className="pt-cardcode">{me.cardCode}</div>
          {/* ⚠ Orqa hisob KO'RINADI. Kod jimgina yangilansa, mijoz
              skanerlanmagan kodni ushlab turib «buzuq» deb o'ylardi;
              hisoblagich esa «hozir yangilanadi, kutib turing» deydi. */}
          {otp ? (
            <p className="pt-muted"><b>{left} s</b> dan keyin yangilanadi · kattalashtirish uchun bosing</p>
          ) : (
            <p className="pt-muted">Kattalashtirish uchun kod ustiga bosing</p>
          )}
        </div>

        {zoom && (
          <CodeZoom kind={zoom} value={cardValue}
                    caption={me.cardCode} onClose={() => setZoom(null)} />
        )}

        <div className="pt-balance">
          <span>Ballaringiz</span>
          <b>{money(me.bonusBalance)}</b>
        </div>
      </div>

      {/* ── Telegram: xabar olish ─────────────────────────────────────
          ⚠ Faqat MIJOZNING o'zi ulaydi — telefon raqamidan chat'ni topib
          bo'lmaydi va bu yaxshi: aks holda do'kon so'ramasdan yozaverardi. */}
      {!me.telegramLinked && (
        <section className="pt-card">
          <div className="pt-tg">
            <i className="fa-brands fa-telegram pt-tg__icon" aria-hidden="true" />
            <div>
              <b>Telegramda xabar oling</b>
              <p className="pt-muted">
                Har xariddan keyin yig'ilgan ball va chek havolasi keladi.
              </p>
            </div>
          </div>
          {tgError && <div className="pt-error" role="alert">{tgError}</div>}
          <button className="pt-btn pt-btn--ghost" onClick={linkTelegram} disabled={tgBusy}>
            {tgBusy ? "Havola olinmoqda…" : "Telegramga ulash"}
          </button>
        </section>
      )}

      {/* ── Cheklar lentasi ──────────────────────────────────────────── */}
      <div className="pt-section">
        <h2 className="pt-h2">Cheklarim</h2>
        {receipts.length === 0 && (
          <p className="pt-muted pt-center">
            Hali chek yo'q. Kassada kartangizni ko'rsating — chek shu yerda paydo bo'ladi.
          </p>
        )}
        <ul className="pt-list">
          {receipts.map((r) => (
            <li key={r.id}>
              <button className="pt-row" onClick={() => setOpenId(r.id)}>
                <span className="pt-row__left">
                  <b>{r.receiptNo}</b>
                  {/* ⚠ `toLocaleString("uz-UZ")` brauzerda «2026 M08 16» beradi —
                      tizimning umumiy formatchisi ishlatiladi. */}
                  <small>{dateTime(r.date)}</small>
                </span>
                <span className="pt-row__right">
                  <b>{money(r.total)}</b>
                  {Number(r.bonusEarned) > 0 && <small className="pt-plus">+{money(r.bonusEarned)} ball</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {openId && <Receipt token={token} id={openId} onClose={() => setOpenId(null)} />}

      <button className="pt-btn pt-btn--ghost pt-logout" onClick={askLogout}>
        Kartani bu qurilmadan o'chirish
      </button>
    </div>
  );
}

/* ── Yo'naltiruvchi ────────────────────────────────────────────────────── */

export default function CustomerPortal() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");

  const params = new URLSearchParams(window.location.search);
  const ref_ = params.get("r") || "";
  const code = params.get("c") || "";
  const isJoin = window.location.pathname.startsWith("/qr");

  /* ── Qog'oz chekdagi QR: `/c/{saleId}-{imzo}` ────────────────────────
     ⚠ Kabinet kaliti TALAB QILINMAYDI — chekni qo'lida ushlab turgan
     odam uni allaqachon ko'rgan, QR shuni telefonga ko'chiradi. Ya'ni
     ro'yxatdan o'tmagan xaridor ham o'z chekini ochadi. */
  const signed = /^\/c\/(\d+)-([0-9a-f]+)$/i.exec(window.location.pathname);
  if (signed) {
    return <Receipt signedId={signed[1]} signature={signed[2]} onClose={() => window.history.back()} />;
  }

  /* ── QARZ TO'LOVINING CHEKI (V61): `/t/{id}-{imzo}` ──────────────────
     ⚠ Kabinet kaliti TALAB QILINMAYDI — xarid chekidagi bilan bir xil
     sabab, faqat bu yerda u KUCHLIROQ: qarzini naqd yopib ketgan odamda
     ilova ham, kabinet ham bo'lmasligi mumkin, chek esa aynan unga
     kerak. Imzo faqat SHU bitta to'lovni ochadi. */
  const paidLink = /^\/t\/(\d+)-([0-9a-f]+)$/i.exec(window.location.pathname);
  if (paidLink) {
    return <PaymentReceipt signedId={paidLink[1]} signature={paidLink[2]}
                           onClose={() => window.history.back()} />;
  }

  /* ── QARZ TASDIG'I (V46): `/q/{id}-{imzo}` ────────────────────────────
     ⚠ Chek havolasi bilan bir xil naqsh va bir xil sabab: SMS ga sig'ishi
     kerak, ya'ni bitta qisqa segment. */
  const debtLink = /^\/q\/(\d+)-([0-9a-f]+)$/i.exec(window.location.pathname);
  if (debtLink) {
    return <DebtScreen id={debtLink[1]} sig={debtLink[2]} />;
  }

  const finishJoin = useCallback(() => {
    setToken(localStorage.getItem(TOKEN_KEY) || "");
    // QR parametrlari (bir martalik kod) manzil qatorida qolmasin
    window.history.replaceState({}, "", "/kabinet");
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    window.history.replaceState({}, "", "/kabinet");
  }, []);

  if (isJoin && ref_ && code) {
    return <JoinScreen ref_={ref_} code={code} onDone={finishJoin} />;
  }
  if (token) return <CabinetScreen token={token} onLogout={logout} />;

  return (
    <div className="pt-wrap">
      <div className="pt-card pt-center">
        <i className="fa-solid fa-qrcode pt-icon" aria-hidden="true" />
        <h2>Karta topilmadi</h2>
        <p className="pt-muted">
          Do'konda kassadagi QR kodni telefoningiz kamerasi bilan o'qing —
          karta shu yerda paydo bo'ladi.
        </p>
      </div>
    </div>
  );
}
