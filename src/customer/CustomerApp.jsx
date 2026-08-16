import { useCallback, useEffect, useState } from "react";
import { appApi, clearAppToken } from "./customerApi";
import { qrSvg } from "../lib/ek-qr";
import { code128Svg } from "../lib/ek-barcode";
import { useConfirm } from "../context/ConfirmProvider";
import CodeZoom from "../components/CodeZoom";

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
  { key: "card",   icon: "fa-id-card",  label: "Kartam" },
  { key: "shops",  icon: "fa-store",    label: "Do'konlar" },
  { key: "profile", icon: "fa-user",    label: "Profil" },
];

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
        {tab === "card"    && <CardScreen me={me} shops={shops} />}
        {tab === "shops"   && <ShopsScreen shops={shops} />}
        {tab === "profile" && <ProfileScreen me={me} onSaved={setMe} onLogout={logout} />}
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

function CardScreen({ me, shops }) {
  /* ⚠ Karta kodi DO'KONGA tegishli: bitta odamda har do'konda o'z kodi
     bor. Shu sababli bu yerda BIRINCHI do'kon kartasi ko'rsatiladi va
     ostida qaysi do'kon ekani yozilади — mijoz chalkashmasligi uchun. */
  const first = shops?.items?.[0];

  /* Qaysi kod kattalashtirilgan: `null` · `"qr"` · `"bar"` */
  const [zoom, setZoom] = useState(null);

  return (
    <div className="cu-screen">
      <div className="cu-hero">
        <span className="cu-hero__label">Jami ballaringiz</span>
        <b className="cu-hero__value">{money(me.totalBonus)}</b>
        <span className="cu-hero__sub">{me.shopCount} ta do'konda</span>
      </div>

      {first ? (
        <div className="cu-card cu-card--code">
          <div className="cu-code__shop">{first.shopName}</div>
          {/* Oq fon SHART: qorong'i temada teskari rangdagi kodni ko'p
              skaner va kamera umuman o'qimaydi.

              ⚠ Ikkalasi ham BOSILADI: ustiga bosilganda aynan o'sha kod
              butun ekranda va maksimal yorug'likda ochiladi (`CodeZoom`).
              Kartadagi kichik kodni xira telefondan skaner ololmasdi. */}
          <button type="button" className="ek-code-btn cu-code__qr"
                  onClick={() => setZoom("qr")} aria-label="QR kodni kattalashtirish"
                  dangerouslySetInnerHTML={{ __html: qrSvg("EKC-" + first.cardCode, { size: 180, margin: 1 }) }} />
          <button type="button" className="ek-code-btn cu-code__bars"
                  onClick={() => setZoom("bar")} aria-label="Shtrix kodni kattalashtirish"
                  dangerouslySetInnerHTML={{ __html: code128Svg("EKC-" + first.cardCode) }} />
          <div className="cu-code__num">{first.cardCode}</div>
          <p className="cu-muted cu-center">Kassada shu kodni ko'rsating — kattalashtirish uchun bosing</p>
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

      {zoom && first && (
        <CodeZoom kind={zoom} value={"EKC-" + first.cardCode}
                  caption={first.cardCode} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

/* ── 2. Do'konlarim ─────────────────────────────────────────────────── */

function ShopsScreen({ shops }) {
  const items = shops?.items || [];
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

      <ul className="cu-list">
        {items.map((s) => (
          <li key={s.id} className="cu-shop">
            <div className="cu-shop__left">
              <b>{s.shopName}</b>
              <small className="cu-muted">Karta: {s.cardCode || "—"}</small>
            </div>
            <div className="cu-shop__right">
              <b className="cu-pos">{money(s.bonusBalance)}</b>
              <small className="cu-muted">ball</small>
            </div>
          </li>
        ))}
      </ul>

      {items.length > 0 && (
        <div className="cu-total">
          <span>Jami</span><b>{money(shops.totalBonus)}</b>
        </div>
      )}
    </div>
  );
}

/* ── 3. Profil ──────────────────────────────────────────────────────── */

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
