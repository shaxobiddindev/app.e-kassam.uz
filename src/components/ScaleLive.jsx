import { useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import Select from "./ek/Select";
import { available, known, pick, hexDump, POLL } from "../lib/ek-serial";
import { subscribe, start, stop, forget, pickPort, readCfg } from "../lib/ek-scale-live";
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
  const [raw, setRaw] = useState("");
  /* ⚠ TAROZI TANISHTIRILGANMI. Ruxsat brauzerda saqlangan bo'lsa,
     panel «o'zi ulanadi» deb aytadi va do'kon har safar shu yerga
     kirib o'tirmaydi. */
  const [paired, setPaired] = useState(Boolean(cfg.enabled || cfg.id));

  /* ⚠ ULANISH PANELGA TEGISHLI EMAS (V111). Ilgari port shu
     komponentning ichida ochilardi va do'kon boshqa bo'limga o'tib
     qaytganda ulanish uzilib qolardi — kassada esa tarozi umuman
     yo'q edi. Endi port modul darajasida yashaydi
     (`ek-scale-live.js`), panel esa uni faqat KO'RSATADI va
     boshqaradi. */
  useEffect(() => subscribe((st) => {
    setOn(st.on);
    setKg(st.kg);
    setStable(st.stable);
    setRaw(st.bytes.length ? hexDump(st.bytes) : "");
    /* `||` qisqa tutashadi — bir marta topilgach, sozlama boshqa o'qilmaydi. */
    setPaired((prev) => prev || st.on || Boolean(readCfg().id));
  }), []);

  /**
   * Tarozini ulaydi.
   *
   * ⚠ ILGARI RUXSAT BERILGAN PORT BIRINCHI (V112). Do'kon: «har safar
   * tarozini ulayverish yaxshi emas». Brauzer ruxsatni eslab qoladi,
   * shuning uchun tanlash oynasi FAQAT tarozi hali tanishtirilmaganda
   * chiqadi — keyin esa umuman chiqmaydi.
   *
   * @param force  `true` — oyna majburan ochiladi (tarozi almashtirilgan)
   */
  const connect = async (force) => {
    try {
      const port = (!force && pickPort(await known(), readCfg().id)) || await pick();
      await start(port, { baudRate: Number(baud), poll });
    } catch (err) {
      /* Foydalanuvchi tanlash oynasini yopdi — bu xato emas. */
      if (err?.name !== "NotFoundError") {
        toast?.error(err?.message === "no-serial" ? t("scale.liveNoSupport") : String(err?.message || err));
      }
    }
  };

  const disconnect = () => stop();

  /* Brauzer ruxsati ham qaytariladi — boshqa tarozi ulanganda kerak. */
  const forgetPort = async () => {
    await forget();
    setPaired(false);
    toast?.success(t("scale.forgot"));
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
        {/* ⚠ «O'ZI ULANADI» DEB AYTILADI (V112). Do'kon buni BILMASA,
            har smenada shu sahifaga kirib ulash odat bo'lib qolardi —
            aynan shundan shikoyat qilingan edi. */}
        {paired && (
          <p style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: -6,
                      color: on ? "var(--fg-success)" : "var(--fg-warning)" }}>
            <i className={`fa-solid ${on ? "fa-circle-check" : "fa-rotate"}`} aria-hidden="true" />{" "}
            {on ? t("scale.auto") : t("scale.autoWait")}
          </p>
        )}

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
            <button className="btn btn-primary" onClick={() => connect(false)}>
              <i className="fa-solid fa-plug" aria-hidden="true" /> {t("scale.liveConnect")}
            </button>
          )}
          {/* ⚠ TANLASH OYNASI ALOHIDA TUGMADA. Asosiy tugma eslab
              qolingan portni ochadi; oyna esa faqat tarozi
              almashtirilganda kerak bo'ladi. */}
          <button className="btn btn-outline" onClick={() => connect(true)}>
            {t("scale.liveAgain")}
          </button>
          {paired && (
            <button className="btn btn-outline" onClick={forgetPort}>
              {t("scale.liveForget")}
            </button>
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
