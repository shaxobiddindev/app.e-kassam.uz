import { useEffect, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import Select from "./ek/Select";
import { available, known, pick, open, visible, POLL } from "../lib/ek-serial";
import { quantity as fmtQty } from "../utils";

/* ══════════════════════════════════════════════════════════════════════════
   JONLI TAROZI (V111)

   Do'kon egasi: «bir do'konda smart tarozi bor, lekin sticker
   chiqarmaydi; monoblokga ulangan, kassa bilan aloqa qilishi kerak».

   Tarozi: MERTECH M-ER 328ACPX LED (Max 15 kg, e = 2 g).

   ═══ NEGA XOM OQIM HAM KO'RSATILADI ════════════════════════════════════

   Tarozilar bir xil gapirmaydi va bitta model ham sozlamasiga qarab
   boshqacha yuboradi. Formatni «bilaman» deb yozib qo'yish eng qimmat
   xato bo'lardi: noto'g'ri o'qilgan og'irlik ekranda ishonchli
   ko'rinadi va jimgina chekka tushadi.

   Shuning uchun panel ikki narsani ko'rsatadi:

     · O'QILGAN og'irlik — kassir tarozining ekrani bilan solishtiradi;
     · XOM OQIM — do'kon uni ko'chirib yuboradi va format aynan shunga
       qarab sozlanadi.

   Ya'ni panel ishlaydigan tarozini ko'rsatadi va ishlamaganini
   TUSHUNTIRIB beradi.

   ═══ ⚠ TEZLIK TAROZINIKI BILAN BIR XIL BO'LISHI SHART ══════════════════

   Noto'g'ri tezlikda port ochiladi-yu, oqim «axlat» bo'lib keladi.
   Shuning uchun tezlik tanlanadigan va oqim ko'rinadigan: 9600 da
   tushunarsiz belgilar chiqsa, 4800 yoki 19200 ni sinab ko'rish
   mumkin. M-ER 328AC odatda 9600, 8, N, 1 da ishlaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Portning eslab qolingan sozlamasi — har smenada qayta terilmasin. */
const LS = "ek_scale_port";
const readCfg = () => {
  try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (_) { return {}; }
};
const writeCfg = (v) => {
  try { localStorage.setItem(LS, JSON.stringify(v)); } catch (_) { /* shaxsiy oyna */ }
};

const BAUDS = [4800, 9600, 19200, 38400, 57600, 115200];

/* ⚠ SO'ROV RO'YXATI — TANLOV, TAXMIN EMAS. Qaysi buyruq to'g'ri
   ekanini faqat tarozining o'zi ko'rsatadi: birma-bir sinaladi va
   javob kelgani xom oqimda darhol ko'rinadi. */
const POLLS = Object.entries(POLL).map(([k, v]) => ({ value: k, label: v.label }));

export default function ScaleLive({ toast }) {
  const cfg = readCfg();
  const [baud, setBaud] = useState(cfg.baudRate || 9600);
  const [poll, setPoll] = useState(cfg.poll || "NONE");
  const [on, setOn] = useState(false);
  const [kg, setKg] = useState(null);
  const [stable, setStable] = useState(false);
  const [raw, setRaw] = useState("");
  const stopRef = useRef(null);

  /* ⚠ Port ochiq qolmasin: sahifadan chiqilganda o'qish to'xtatiladi,
     aks holda port band bo'lib qolar va ikkinchi marta ochib
     bo'lmasdi. */
  useEffect(() => () => { stopRef.current?.(); }, []);

  const start = async (port) => {
    try {
      const stop = await open(port, {
        baudRate: Number(baud),
        /* ⚠ Tarozi jim tursa — biz so'raymiz. Ko'p model uzluksiz
           yubormaydi va port ochiq bo'lgani holda hech narsa
           kelmaydi; buni «tarozi buzuq» deb o'ylash juda oson. */
        poll: POLL[poll]?.bytes || [],
        pollMs: 500,
      }, (st, chunk) => {
        setKg(st.kg);
        setStable(st.stable);
        /* Oxirgi 600 belgi yetarli: bir necha ramka ko'rinsa format
           aniqlanadi, uzunroq matn esa sahifani cho'zardi. */
        setRaw((prev) => (prev + visible(chunk)).slice(-600));
      });
      stopRef.current = stop;
      setOn(true);
      writeCfg({ baudRate: Number(baud), poll });
    } catch (err) {
      toast?.error(err?.message === "no-serial" ? t("scale.liveNoSupport") : String(err?.message || err));
    }
  };

  /** Tugmadan — brauzer port tanlashni FAQAT shundan ruxsat beradi. */
  const connect = async () => {
    try {
      const port = await pick();
      await start(port);
    } catch (err) {
      /* Foydalanuvchi tanlash oynasini yopdi — bu xato emas. */
      if (err?.name !== "NotFoundError") {
        toast?.error(err?.message === "no-serial" ? t("scale.liveNoSupport") : String(err?.message || err));
      }
    }
  };

  /** Ilgari ruxsat berilgan port — oyna ochilmaydi. */
  const reconnect = async () => {
    const ports = await known();
    if (!ports.length) return connect();
    await start(ports[0]);
  };

  const disconnect = async () => {
    await stopRef.current?.();
    stopRef.current = null;
    setOn(false);
  };

  if (!available()) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">{t("scale.liveTitle")}</h3></div>
        <div className="card-body">
          {/* ⚠ Chegara YASHIRILMAYDI. Tugmani ko'rsatib, bosilganda jim
              qolish kassirni monoblokni qayta yoqishga majbur qilardi. */}
          <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            {t("scale.liveNoSupport")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">{t("scale.liveTitle")}</h3>
      </div>
      <div className="card-body">
        <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
          {t("scale.liveHint")}
        </p>
        {/* ⚠ Jimlikning eng ko'p uchraydigan sababi — tarozi
            so'ralmaguncha gapirmasligi. Buni kassirga AYTIB qo'yish
            uni «tarozi buzuq» degan xulosadan qaytaradi. */}
        <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: -6 }}>
          {t("scale.pollHint")}
        </p>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ width: 140 }}>
            <Select value={String(baud)} onChange={(v) => setBaud(Number(v))} block
                    ariaLabel={t("scale.baud")} disabled={on}
                    options={BAUDS.map((b) => ({ value: String(b), label: `${b} bod` }))} />
          </div>
          {/* ⚠ SO'ROV — ENG KO'P VAQT YEYDIGAN SOZLAMA. Tarozi
              uzluksiz yubormasa, port ochiq bo'lsa ham ekranda
              jimlik bo'ladi. */}
          <div style={{ width: 160 }}>
            <Select value={poll} onChange={setPoll} block
                    ariaLabel={t("scale.poll")} disabled={on}
                    options={POLLS} />
          </div>
          {on ? (
            <button className="btn btn-outline" onClick={disconnect}>
              <i className="fa-solid fa-plug-circle-xmark" aria-hidden="true" /> {t("scale.liveStop")}
            </button>
          ) : (
            <>
              <button className="btn btn-primary" onClick={connect}>
                <i className="fa-solid fa-plug" aria-hidden="true" /> {t("scale.liveConnect")}
              </button>
              <button className="btn btn-outline" onClick={reconnect}>
                {t("scale.liveAgain")}
              </button>
            </>
          )}
        </div>

        {/* ⚠ O'QILGAN OG'IRLIK — kassir uni tarozining EKRANI bilan
            solishtiradi. Ikkalasi bir xil bo'lsa format to'g'ri. */}
        <div style={{
          display: "flex", alignItems: "baseline", gap: 12,
          padding: "12px 16px", borderRadius: 12,
          background: "var(--bg-sunken)", marginBottom: 12,
        }}>
          <span className="ek-num" style={{ fontSize: 32, fontWeight: 900 }}>
            {kg == null ? "—" : `${fmtQty(kg, 3)} kg`}
          </span>
          {kg != null && (
            <span style={{ fontSize: 13, fontWeight: 700,
                           color: stable ? "var(--fg-success)" : "var(--fg-warning)" }}>
              {stable ? t("scale.steady") : t("scale.moving")}
            </span>
          )}
        </div>

        {/* ⚠ XOM OQIM — panelning eng muhim qismi. Do'kon shu matnni
            ko'chirib yuboradi va format aynan shunga qarab sozlanadi;
            «tarozi ishlamayapti» degan xabardan ko'ra bu ancha
            foydali. */}
        <div className="form-label">{t("scale.rawStream")}</div>
        <pre className="mono" style={{
          margin: 0, padding: "10px 12px", minHeight: 90, maxHeight: 160, overflow: "auto",
          background: "var(--bg-sunken)", borderRadius: 10, fontSize: 12,
          whiteSpace: "pre-wrap", wordBreak: "break-all",
        }}>{raw || t("scale.rawEmpty")}</pre>
      </div>
    </div>
  );
}
