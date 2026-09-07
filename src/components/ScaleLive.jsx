import { useEffect, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import Select from "./ek/Select";
import { available, known, pick, open, hexDump, POLL } from "../lib/ek-serial";
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
  /* ⚠ OXIRGI TUTILGAN OQIM SAQLANADI. Boshqa bo'limga o'tib qaytganda
     panel qaytadan yig'iladi va port yopiladi — do'kon esa yozuvni
     ko'chirib ulgurmay, hammasi yo'qolib qolardi. Endi u qaytganda
     joyida turadi. */
  const [raw, setRaw] = useState(() => cfg.lastDump || "");
  const stopRef = useRef(null);
  /* Baytlar to'planib boradi: hex ko'rinish har bo'lakda qaytadan
     yig'iladi va bo'lak chegarasi qatorni buzmasligi kerak. */
  const bytesRef = useRef([]);

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
        /* ⚠ ACK javobi: tarozi «06» desa, asosiy buyruq yuboriladi
           (`ek-serial.js` dagi izoh). */
        after: POLL[poll]?.after || [],
        pollMs: 700,
      }, (st, chunk) => {
        setKg(st.kg);
        setStable(st.stable);
        /* ⚠ OXIRGI 128 BAYT. Protokolni aniqlash uchun bir necha ramka
           yetarli; uzunroq oqim sahifani cho'zib, ko'chirishni
           qiyinlashtirardi. */
        const next = bytesRef.current.concat(Array.from(chunk)).slice(-128);
        bytesRef.current = next;
        const dump = hexDump(next);
        setRaw(dump);
        writeCfg({ ...readCfg(), lastDump: dump });
      });
      stopRef.current = stop;
      setOn(true);
      writeCfg({ ...readCfg(), baudRate: Number(baud), poll });
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="form-label" style={{ margin: 0 }}>{t("scale.rawStream")}</div>
          {/* ⚠ NUSXA TUGMASI — panelning ma'nosi shu yozuvni YUBORISHDA.
              Uni sichqoncha bilan belgilash hex jadvalida noqulay va
              do'kon aksar hollarda skrinshot yuborishga o'tib ketardi;
              skrinshotdan esa baytlarni aniq o'qib bo'lmaydi. */}
          <button className="btn btn-outline btn-sm" disabled={!raw}
                  onClick={() => {
                    navigator.clipboard?.writeText(raw)
                      .then(() => toast?.success(t("scale.copied")))
                      .catch(() => { /* ruxsat yo'q — qo'lda belgilanadi */ });
                  }}>
            <i className="fa-solid fa-copy" aria-hidden="true" /> {t("common.copy")}
          </button>
        </div>
        <pre className="mono" style={{
          margin: 0, padding: "10px 12px", minHeight: 90, maxHeight: 160, overflow: "auto",
          background: "var(--bg-sunken)", borderRadius: 10, fontSize: 12,
          whiteSpace: "pre-wrap", wordBreak: "break-all",
        }}>{raw || t("scale.rawEmpty")}</pre>
      </div>
    </div>
  );
}
