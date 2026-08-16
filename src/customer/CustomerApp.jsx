import { useCallback, useEffect, useState } from "react";
import { appApi, clearAppToken, getAppToken } from "./customerApi";
import Receipt from "../portal/Receipt";
import { qrSvg } from "../lib/ek-qr";
import { code128Svg } from "../lib/ek-barcode";
import { useConfirm } from "../context/ConfirmProvider";
import CodeZoom from "../components/CodeZoom";
import { dateTime } from "../lib/ek-format";

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ ILOVASI (V37) — Korzinka Go / Makro uslubidagi sodda daraxt

   Uch ekran, xolos: KARTA (jami ball) · DO'KONLARIM · PROFIL.
   Kassa interfeysining hech bir qismi bu yerda ko'rinmaydi.

   ⚠ Ballar do'kon bo'yicha ALOHIDA (do'konlar pulni bo'lishmaydi), jami
   esa faqat ko'rsatish uchun: bir do'konda ikkinchisining balliga to'lab
   bo'lmaydi va interfeys buni yashirmasligi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

const money = (v) =>
  new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(Number(v || 0));

const TABS = [
  { key: "card",     icon: "fa-id-card",  label: "Kartam" },
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

  const logout = async () => {
    try { await appApi.logout(); } catch (_) { /* baribir chiqamiz */ }
    clearAppToken();
    onLoggedOut();
  };

  if (error) return <div className="cu-wrap"><div className="cu-card cu-center">{error}</div></div>;
  if (!me)   return <div className="cu-wrap"><div className="cu-card cu-center">Yuklanmoqda…</div></div>;

  return (
    <div className="cu-app">
      <main className="cu-page">
        {tab === "card"     && <CardScreen me={me} shops={shops} />}
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

/* ── 1. Karta: jami ball va kassada ko'rsatiladigan kod ──────────────── */

const PICKED_KEY = "ek_app_card_shop";

function CardScreen({ me, shops }) {
  const items = shops?.items || [];

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

  return (
    <div className="cu-screen">
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
                  dangerouslySetInnerHTML={{ __html: qrSvg("EKC-" + picked.cardCode, { size: 180, margin: 1 }) }} />
          <button type="button" className="ek-code-btn cu-code__bars"
                  onClick={() => setZoom("bar")} aria-label="Shtrix kodni kattalashtirish"
                  dangerouslySetInnerHTML={{ __html: code128Svg("EKC-" + picked.cardCode) }} />
          <div className="cu-code__num">{picked.cardCode}</div>
          <p className="cu-muted cu-center">Kassada shu kodni ko'rsating — kattalashtirish uchun bosing</p>
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
        <CodeZoom kind={zoom} value={"EKC-" + picked.cardCode}
                  caption={picked.cardCode} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

/* ── 2. Cheklarim ───────────────────────────────────────────────────────
   ⚠ Lenta HAMMA do'kon bo'yicha bitta ro'yxat: mijoz xaridni sana bo'yicha
   eslaydi, «qaysi do'konda edi» deb emas. Do'kon nomi har satrda turadi. */

function ReceiptsScreen() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen]   = useState(null);   // { id, customerId }

  useEffect(() => {
    appApi.receipts(50).then(setItems).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="cu-screen"><div className="cu-card cu-center">{error}</div></div>;
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

/* ── 3. Do'konlarim ─────────────────────────────────────────────────── */

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

/* ── 3b. Ball tarixi ────────────────────────────────────────────────────
   ⚠ Turlar SERVERDAN kelgan nom bilan keladi va shu yerda tarjima
   qilinadi. Summani mijoz IMZO bilan ko'radi (+840 / −5 000) — «SPEND»
   degan so'zni o'qib yo'nalishni o'zi topishi kerak emas. */

const BONUS_LABEL = {
  EARN:   { text: "Xariddan yig'ildi",        icon: "fa-plus" },
  SPEND:  { text: "Xaridda ishlatildi",       icon: "fa-minus" },
  REVOKE: { text: "Qaytarish tufayli olindi", icon: "fa-rotate-left" },
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
        {error && <div className="cu-card cu-center">{error}</div>}
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

/* ── 4. Profil ──────────────────────────────────────────────────────── */

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
