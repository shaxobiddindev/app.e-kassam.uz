import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "../config";
import { qrSvg } from "../lib/ek-qr";
import { code128Svg } from "../lib/ek-barcode";
import Receipt from "./Receipt";

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

const money = (v) =>
  new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(Number(v || 0));

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
            <input id="pt-phone" className="pt-input" type="tel" inputMode="tel"
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

/* ── 2. Kabinet: karta, ball, cheklar ──────────────────────────────────── */

function CabinetScreen({ token, onLogout }) {
  const [me, setMe]             = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [openId, setOpenId]     = useState(null);
  const [error, setError]       = useState("");

  useEffect(() => {
    api("/me", { token }).then(setMe).catch((e) => setError(e.message));
    api("/receipts?limit=50", { token }).then(setReceipts).catch(() => {});
  }, [token]);

  if (error) {
    return (
      <div className="pt-wrap">
        <div className="pt-card pt-center">
          <i className="fa-solid fa-circle-exclamation pt-icon-bad" aria-hidden="true" />
          <h2>Karta topilmadi</h2>
          <p className="pt-muted">{error}</p>
          <button className="pt-btn pt-btn--ghost" onClick={onLogout}>Yopish</button>
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

        <div className="pt-codes">
          <div className="pt-qr" dangerouslySetInnerHTML={{ __html: qrSvg(me.cardCode, { size: 168, margin: 1 }) }} />
          <div className="pt-bars" dangerouslySetInnerHTML={{ __html: code128Svg(me.cardCode) }} />
          <div className="pt-cardcode">{me.cardCode}</div>
        </div>

        <div className="pt-balance">
          <span>Ballaringiz</span>
          <b>{money(me.bonusBalance)}</b>
        </div>
      </div>

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
                  <small>{new Date(r.date).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" })}</small>
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

      <button className="pt-btn pt-btn--ghost pt-logout" onClick={onLogout}>
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
