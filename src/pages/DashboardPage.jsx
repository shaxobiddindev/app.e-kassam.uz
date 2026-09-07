import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useT } from "../lib/ek-i18n";
import { reportApi, inventoryApi, loyaltyApi, plannerApi, shopApi } from "../api";
import { BranchSelector } from "../components";
import OnboardingCard from "../components/OnboardingCard";
import Modal from "../components/Modal";
import CommandPalette from "../components/ek/CommandPalette";
import { useAuth } from "../hooks/useAuth";
import { roleSet } from "../lib/ek-roles";
import { Empty } from "../components/ui";
import { money, percent, time, shortDate } from "../lib/ek-format";
import { CountUp, Sparkline } from "../components/ek/Kpi";
import { LineChart, Donut, shortNum } from "../components/ek/Charts";
import { paymentEntry } from "../lib/ek-labels";
import { PERIODS, periodRange, isoInstant, isoDay } from "../lib/ek-period";
import {
  buildAlerts, moneyAtRisk, countBySeverity, changes, opportunities,
  healthTone, readLayout, saveLayout, move, toggle, comparePoints,
} from "../lib/ek-dash";
import { asArray } from "../lib/ek-array";

/* ══════════════════════════════════════════════════════════════════════════
   BOSH SAHIFA — boshqaruv paneli (V74)

   ═══ EKRAN NIMA UCHUN BOR ═══════════════════════════════════════════════

   Bitta savol: «ishlar qanday va bugun nimaga aralashish kerak?».
   Hamma narsa shu savolga xizmat qiladi; xizmat qilmaydigan narsa bu
   yerda emas, hisobot bo'limida.

   ⚠ ENG KATTA XATO — GRAFIKLARNI TIQIB TASHLASH. Yigirmata grafik
   qo'yilgan panel chiroyli ko'rinadi va hech qanday qaror qabul
   qildirmaydi: ko'z qayerga qarashni bilmaydi. Shu sababli bu yerda
   BITTA katta grafik bor (bugun va taqqoslash kuni), qolgani — raqam,
   ro'yxat va sparkline.

   ═══ TARTIB — MAQSADGA QARAB ════════════════════════════════════════════

     40% — biznes holati:  KPI, egri chiziq, filial, tovar, to'lov
     20% — samaradorlik:   kassir, filial bali
     15% — xavf:           ogohlantirishlar markazi
     10% — bashorat:       reja va kun oxiri
     10% — amal:           tezkor tugmalar, imkoniyatlar
      5% — tahlil:         «nima o'zgardi?»

   ═══ IKKI QATLAM, IKKI SO'ROV ═══════════════════════════════════════════

     `pulse`     — HOZIR: bugun, jonli lenta, ochiq kassa, tugash
                   arafasidagi tovar. Yengil, har daqiqada yangilanadi.
     `analytics` — DAVR: tanlangan oraliqning to'liq tahlili. Og'ir,
                   faqat davr yoki filial o'zgarganda so'raladi.

   ⚠ AVTO-YANGILANISH FAQAT `pulse` NI TAKRORLAYDI. Ikkalasini birga
   yangilash har daqiqada butun davr tahlilini qaytadan hisoblatardi —
   bitta ochiq oyna serverni bo'g'ishi mumkin edi.

   ⚠ YANGILANISH ILOVA KO'RINMAGANDA TO'XTAYDI. Ochiq qolgan va hech
   kim qaramaydigan varaq kechasi ham har daqiqada so'rov yuborardi.

   ═══ ROL ═══════════════════════════════════════════════════════════════

   ⚠ Omborchiga PUL so'rovi YUBORILMAYDI. Serverda `/reports/**` faqat
   egasi va do'kon administratoriga ochiq; ilgari omborchi bosh
   sahifani ochganda so'rov 403 bilan qaytar va ekranda tushunarsiz
   xato chiqardi. Endi u so'rov umuman ketmaydi va omborchi o'ziga
   tegishli bloklarni ko'radi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Avto-yangilanish oralig'i. */
const REFRESH_MS = 60_000;

/* ══════════════════════════════════════════════════════════════════════
   KICHIK BO'LAKLAR
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Izoh belgisi — FORMULANI aytadi.
 *
 * ⚠ Shrift ikonkasi EMAS, CSS bilan chizilgan. Font Awesome tashqi
 * manbadan keladi va u yuklanmaganda joyida bo'sh to'rtburchak
 * («tofu») qolardi.
 */
function Hint({ text }) {
  if (!text) return null;
  return (
    <button type="button" className="kpi__hint" title={text} aria-label={text}
            onClick={(e) => e.currentTarget.focus()}>i</button>
  );
}

/** O'zgarish ko'rsatkichi. `good` — o'sish yaxshimi. */
function Delta({ pct, good = "up", small }) {
  const { t } = useT();
  if (pct == null || !Number.isFinite(pct)) return null;
  const up = pct > 0;
  const nice = (up === (good === "up")) ? "good" : "bad";
  if (Math.abs(pct) < 0.05) {
    return <span className={`dlt${small ? " dlt--s" : ""}`} data-tone="flat">= {t("dash.same")}</span>;
  }
  return (
    <span className={`dlt${small ? " dlt--s" : ""}`} data-tone={nice}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/** Panel — sarlavha, izoh, o'ng tarafdagi amal va tanasi. */
function Panel({ title, icon, hint, right, children, className = "", onTitleClick }) {
  return (
    <section className={`dpn ${className}`}>
      <header className="dpn__h">
        <h3 className="dpn__t">
          {icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />}
          {onTitleClick
            ? <button type="button" className="dpn__link" onClick={onTitleClick}>{title}</button>
            : title}
          <Hint text={hint} />
        </h3>
        {right}
      </header>
      <div className="dpn__b">{children}</div>
    </section>
  );
}

/**
 * KPI kartochkasi — raqam, o'zgarish, sparkline va DRILL-DOWN.
 *
 * ⚠ Bosilganda avval PASTDA kichik tafsilot ochiladi, sahifa
 * almashmaydi. Sabab: egasi ko'pincha «nega shunday?» degan savolga
 * bir qatorlik javob bilan qanoatlanadi va boshqa sahifaga o'tib,
 * keyin orqaga qaytish uni yo'qotardi. To'liq tahlil kerak bo'lsa —
 * tafsilot ichidagi havola.
 */
function Kpi({ label, value, format = money, delta, good, spark, hint, tone, detail, onOpen }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const can = Boolean(detail || onOpen);

  return (
    <div className={`kpi2${can ? " is-click" : ""}`} data-tone={tone || undefined}>
      {/* ⚠ YORLIQ VA IZOH TUGMADAN TASHQARIDA. Izoh belgisi ham
          tugma (sensorli ekranda `title` ishlamaydi), tugma ichidagi
          tugma esa klaviatura va skrinrider uchun buziq tuzilma:
          qaysi biri bosilgani aniq bo'lmaydi. Shu sababli bosiladigan
          joy faqat RAQAMNING o'zi. */}
      <span className="kpi2__l">{label}<Hint text={hint} /></span>
      <button
        type="button"
        className="kpi2__hit"
        onClick={can ? () => setOpen((v) => !v) : undefined}
        aria-expanded={can ? open : undefined}
        aria-label={label}
        disabled={!can}
      >
        <span className="kpi2__v ek-num">
          <CountUp value={Number(value) || 0} format={format} />
        </span>
        <span className="kpi2__f">
          <Delta pct={delta} good={good} small />
          {spark?.length > 1 && <Sparkline data={spark} width={70} height={20} />}
        </span>
      </button>

      {open && (
        <div className="kpi2__d">
          {detail}
          {onOpen && (
            <button type="button" className="kpi2__more" onClick={onOpen}>
              {t("dash.drill")} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Bir qatorlik «nom — qiymat» tafsiloti. */
function Line({ label, value, tone }) {
  return (
    <div className="kpi2__row">
      <span>{label}</span>
      <span className="ek-num" data-tone={tone || undefined}>{value}</span>
    </div>
  );
}

/** Progress chizig'i — reja, ombor va boshqalar uchun. */
function Bar({ value, max, tone = "brand", label }) {
  const pct = max > 0 ? Math.min(100, (Number(value) / Number(max)) * 100) : 0;
  return (
    <div className="prg" role="img" aria-label={label}>
      <div className="prg__f" data-tone={tone} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   OGOHLANTIRISHLAR MARKAZI
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Muhimlik bo'yicha guruhlangan ro'yxat.
 *
 * ⚠ Sarlavhada «xavf ostidagi pul» turadi. Ilgari bu blok satrlar
 * SONINI ko'rsatardi va «7 ta ogohlantirish» degani hech narsani
 * anglatmasdi: yettitasi ham mayda bo'lishi mumkin edi. Endi birinchi
 * ko'rinadigan narsa — qancha pul xavf ostida.
 */
function Alerts({ alerts, loading, onGo }) {
  const { t } = useT();
  const [all, setAll] = useState(false);
  const risk = moneyAtRisk(alerts);
  const cnt = countBySeverity(alerts);
  const SHOW = 6;
  const shown = all ? alerts : alerts.slice(0, SHOW);

  return (
    <Panel
      title={t("attention.title")}
      icon="fa-bell"
      hint={t("dash.hintAlerts")}
      right={
        <div className="alr__sum">
          {risk > 0 && <span className="alr__money ek-num">{money(risk)}</span>}
          {cnt.critical > 0 && <span className="alr__chip" data-tone="critical">{cnt.critical}</span>}
          {cnt.warning > 0 && <span className="alr__chip" data-tone="warning">{cnt.warning}</span>}
          {cnt.info > 0 && <span className="alr__chip" data-tone="info">{cnt.info}</span>}
        </div>
      }
    >
      {loading ? (
        <div className="alr__list">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="ek-skeleton" style={{ height: 44, borderRadius: 10 }} />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="attn__empty">
          <i className="fa-solid fa-circle-check" aria-hidden="true" />
          {t("attention.empty")}
        </div>
      ) : (
        <>
          <div className="alr__list">
            {shown.map((a) => (
              <button key={a.id} type="button" className="alr__row" data-tone={a.severity}
                      onClick={() => onGo(a.to)}>
                <span className="alr__ico"><i className={`fa-solid ${a.icon}`} aria-hidden="true" /></span>
                <span className="alr__txt">{t(a.key, a.args)}</span>
                {a.money > 0 && <span className="alr__val ek-num">{money(a.money)}</span>}
                {a.money == null && a.count != null && <span className="alr__val ek-num">{a.count}</span>}
                <i className="fa-solid fa-chevron-right alr__go" aria-hidden="true" />
              </button>
            ))}
          </div>
          {alerts.length > SHOW && (
            <button type="button" className="dpn__more" onClick={() => setAll((v) => !v)}>
              {all ? t("dash.less") : t("dash.moreN", { n: alerts.length - SHOW })}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   BUGUN — egri chiziq, tezlik, kun oxiri
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Bugungi va taqqoslash kunining JAMLANMA egri chizig'i.
 *
 * ⚠ Ikki chiziq orasidagi masofa — javobning o'zi: «kechagidan
 * oldindamizmi yoki orqadamizmi?». Soatlik ustunlar bilan bu savolga
 * javob berib bo'lmasdi — ular tishli bo'lib ko'rinadi va ko'z
 * yig'indini o'zi hisoblay olmaydi.
 */
function PulsePanel({ pulse, cmp, onCmp, loading, onGo }) {
  const { t } = useT();
  if (loading) return <Panel title={t("dash.today")} icon="fa-wave-square"><span className="ek-skeleton" style={{ height: 220 }} /></Panel>;
  if (!pulse) return null;

  const ref = cmp === "week" ? pulse.lastWeekCurve : pulse.yesterdayCurve;
  const refDay = cmp === "week" ? pulse.lastWeek : pulse.yesterday;
  const pts = comparePoints(pulse.todayCurve || [], ref || []);
  const diff = Number(pulse.today?.netSales || 0) - Number(refDay?.netSales || 0);
  const v = pulse.velocity || {};
  const f = pulse.forecast || {};

  return (
    <Panel
      title={t("dash.today")}
      icon="fa-wave-square"
      hint={t("dash.hintPulse")}
      onTitleClick={() => onGo("/reports?tab=sales")}
      right={
        <div className="seg" role="group" aria-label={t("dash.compare")}>
          <button type="button" className={`seg__b${cmp === "yesterday" ? " is-on" : ""}`}
                  onClick={() => onCmp("yesterday")}>{t("dash.cmpYesterday")}</button>
          <button type="button" className={`seg__b${cmp === "week" ? " is-on" : ""}`}
                  onClick={() => onCmp("week")}>{t("dash.cmpLastWeek")}</button>
        </div>
      }
    >
      <div className="pls">
        <div className="pls__chart">
          <LineChart
            points={pts}
            lines={[
              { key: "today", label: t("dash.today"), color: "var(--bg-brand)" },
              { key: "ref", label: cmp === "week" ? t("dash.cmpLastWeek") : t("dash.cmpYesterday"),
                color: "var(--fg-tertiary)", dashed: true },
            ]}
            height={230}
            fmt={shortNum}
            empty={t("dash.noSales")}
          />
        </div>

        <div className="pls__side">
          {/* ⚠ Farq PULDA va FOIZDA birga: foiz yolg'iz turganda kichik
              do'konda «+300%» chiqib, aslida 30 000 so'm bo'lishi
              mumkin edi. */}
          <div className="pls__big">
            <span className="pls__lbl">{t("dash.vsCompare")}</span>
            <span className="ek-num pls__num" data-tone={diff >= 0 ? "good" : "bad"}>
              {diff >= 0 ? "+" : "−"}{money(Math.abs(diff))}
            </span>
            <Delta pct={refDay?.netSales ? (diff / Number(refDay.netSales)) * 100 : null} />
          </div>

          <div className="pls__grid">
            <div><span className="pls__lbl">{t("dash.perHour")}</span>
                 <b className="ek-num">{money(v.perHourAvg || 0)}</b></div>
            <div><span className="pls__lbl">{t("dash.lastHour")}</span>
                 <b className="ek-num">{v.receiptsLastHour || 0}</b>
                 <Delta small good="up" pct={v.receiptsPrevHour
                   ? ((v.receiptsLastHour - v.receiptsPrevHour) / v.receiptsPrevHour) * 100 : null} /></div>
            <div><span className="pls__lbl">{t("dash.sinceSale")}</span>
                 <b className="ek-num">{v.sinceLastSaleMin == null ? "—" : t("dash.minAgo", { n: v.sinceLastSaleMin })}</b></div>
            <div><span className="pls__lbl">{t("dash.receipts")}</span>
                 <b className="ek-num">{pulse.today?.receipts || 0}</b></div>
          </div>

          {/* Kun oxiriga bashorat — ISHONCH bilan birga. Ishonchsiz
              bashoratni yashirmaymiz, lekin uni ishonchsiz deb
              belgilaymiz: yashirish egasini o'ylantirardi. */}
          {f.endOfDay != null && (
            <div className="pls__fc">
              <span className="pls__lbl">{t("dash.endOfDay")}<Hint text={t("dash.hintForecast")} /></span>
              <b className="ek-num">{money(f.endOfDay)}</b>
              <span className="pls__band">
                {money(f.low)} … {money(f.high)} · {t("dash.confidence", { n: Math.round(Number(f.confidence) || 0) })}
              </span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   REJA
   ══════════════════════════════════════════════════════════════════════ */

function TargetPanel({ pulse, onGo }) {
  const { t } = useT();
  const tg = pulse?.target;
  if (!tg) return null;

  /* Reja qo'yilmagan bo'lsa — blok o'rniga TAKLIF. Bo'sh progress
     chizig'i hech qanday ma'lumot bermaydi. */
  if (!tg.monthly) {
    return (
      <Panel title={t("dash.plan")} icon="fa-flag-checkered" hint={t("dash.hintPlan")}>
        <div className="dtg__none">
          <p>{t("dash.planNone")}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onGo("/settings?tab=shop")}>
            {t("dash.planSet")}
          </button>
        </div>
      </Panel>
    );
  }

  const behind = Number(tg.pace) - Number(tg.progress);
  return (
    <Panel title={t("dash.plan")} icon="fa-flag-checkered" hint={t("dash.hintPlan")}
           onTitleClick={() => onGo("/reports?tab=home")}>
      <div className="dtg">
        <div className="dtg__top">
          <b className="ek-num dtg__now">{money(tg.achieved)}</b>
          <span className="dtg__of">/ {money(tg.monthly)}</span>
          <span className="dtg__pct ek-num" data-tone={behind > 10 ? "bad" : "good"}>
            {percent(tg.progress)}
          </span>
        </div>
        <Bar value={tg.progress} max={100} tone={behind > 10 ? "bad" : "good"}
             label={t("dash.plan")} />
        {/* Sur'at belgisi — bugungi kunga qadar QAYERDA bo'lish kerak
            edi. Usiz progress chizig'i «45% — yaxshimi yoki yomonmi?»
            degan savolni javobsiz qoldirardi. */}
        <div className="dtg__marks">
          <span className="dtg__pace" style={{ left: `${Math.min(100, Number(tg.pace))}%` }}
                title={t("dash.paceMark", { v: percent(tg.pace) })} />
        </div>
        <div className="dtg__rows">
          <Line label={t("dash.paceLbl")} value={percent(tg.pace)} />
          <Line label={t("dash.projected")} value={money(tg.projected)}
                tone={Number(tg.projected) >= Number(tg.monthly) ? "good" : "bad"} />
          <Line label={t("dash.daysLeft")} value={tg.daysInMonth - tg.daysPassed} />
        </div>
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   NIMA O'ZGARDI
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Davrni oldingi davr bilan taqqoslab, ENG SEZILARLI farqlarni aytadi.
 *
 * ⚠ Bu «AI» emas va shunday da'vo qilinmaydi. Bu — chegara qo'yilgan
 * taqqoslash: 8% dan katta farqlar, ahamiyati bo'yicha tartiblangan.
 * Foydalanuvchi uchun muhimi — raqam qayerdan chiqqani tushunarli
 * bo'lishi.
 */
function ChangesPanel({ analytics, loading, onGo }) {
  const { t } = useT();
  const list = useMemo(() => changes(analytics?.now, analytics?.prev), [analytics]);

  if (loading) return <Panel title={t("dash.whatChanged")} icon="fa-lightbulb"><span className="ek-skeleton" style={{ height: 90 }} /></Panel>;

  return (
    <Panel title={t("dash.whatChanged")} icon="fa-lightbulb" hint={t("dash.hintChanged")}
           onTitleClick={() => onGo("/reports?tab=home")}>
      {list.length === 0 ? (
        <Empty text={t("dash.noChanges")} />
      ) : (
        <div className="chg">
          {list.map((c) => (
            <div key={c.key} className="chg__row" data-tone={c.tone}>
              <i className={`fa-solid ${c.dir === "up" ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}`}
                 aria-hidden="true" />
              <span className="chg__t">{t(`dash.chg.${c.key}`)}</span>
              <b className="ek-num chg__v">
                {c.pct == null
                  ? `${c.diff > 0 ? "+" : "−"}${Math.abs(c.diff).toFixed(1)} ${t("dash.point")}`
                  : `${c.pct > 0 ? "+" : "−"}${Math.abs(c.pct).toFixed(0)}%`}
              </b>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   JONLI LENTA
   ══════════════════════════════════════════════════════════════════════ */

function LivePanel({ pulse, loading, onGo }) {
  const { t } = useT();
  const rows = pulse?.live || [];

  return (
    <Panel title={t("dash.live")} icon="fa-tower-broadcast" hint={t("dash.hintLive")}
           onTitleClick={() => onGo("/sales")}
           right={<span className="live__dot" aria-hidden="true" />}>
      {loading ? <span className="ek-skeleton" style={{ height: 160 }} />
       : rows.length === 0 ? <Empty text={t("dash.noSales")} />
       : (
        <div className="live">
          {rows.map((r) => (
            <button key={r.id} type="button" className="live__row" data-kind={
                     r.status !== "PAID" && r.status !== "COMPLETED" ? "cancel"
                     : r.type === "RETURN" ? "return" : "sale"}
                    onClick={() => onGo(`/sales?id=${r.id}`)}>
              <span className="live__time ek-num">{time(r.at)}</span>
              <span className="live__who">
                {r.cashier || "—"}
                {r.customer && <span className="live__cust">{r.customer}</span>}
              </span>
              <span className="live__pay">
                <i className={`fa-solid ${paymentEntry(r.payment).icon || "fa-wallet"}`}
                   style={{ color: paymentEntry(r.payment).color }} aria-hidden="true" />
              </span>
              <span className="live__amt ek-num">{money(r.amount)}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   KASSALAR
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Ochiq smenalar.
 *
 * ⚠ «Kassada bo'lishi kerak» summasi smena YOPILGUNCHA ko'rinadi.
 * Ilgari bu raqam faqat yopishda hisoblanardi va egasi kamomadni
 * ertasi kuni bilardi — pul allaqachon ketgan bo'lardi.
 */
function RegistersPanel({ pulse, loading, onGo }) {
  const { t } = useT();
  const rows = pulse?.registers || [];

  return (
    <Panel title={t("dash.registers")} icon="fa-cash-register" hint={t("dash.hintRegisters")}
           onTitleClick={() => onGo("/security?tab=shifts")}>
      {loading ? <span className="ek-skeleton" style={{ height: 90 }} />
       : rows.length === 0 ? <Empty text={t("dash.noOpenShift")} />
       : (
        <div className="reg">
          {rows.map((r) => (
            <button key={r.shiftId} type="button" className="reg__row"
                    data-tone={r.openHours >= 24 ? "bad" : undefined}
                    onClick={() => onGo("/security?tab=shifts")}>
              <span className="reg__who">
                <b>{r.cashier || r.terminal || "—"}</b>
                <span className="reg__meta">
                  {r.branch} · {t("dash.openHours", { n: r.openHours })}
                </span>
              </span>
              <span className="reg__nums">
                <span className="ek-num reg__cash">{money(r.expectedCash)}</span>
                <span className="reg__meta">{t("dash.nReceipts", { n: r.receipts })}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   FILIALLAR
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Filiallar — bugungi savdo va SALOMATLIK BALI.
 *
 * ⚠ Ekranda ball emas, uning SABABI ko'rsatiladi. «63 ball» degan son
 * hech qanday ish bermaydi; «marja past, qaytarish ko'p» esa ertaga
 * tekshiriladigan gap. Ball faqat tartiblash uchun: yomon filial
 * birinchi turadi.
 */
function BranchesPanel({ pulse, loading, onGo }) {
  const { t } = useT();
  const rows = pulse?.branches || [];
  if (!loading && rows.length === 0) return null;

  return (
    <Panel title={t("dash.branches")} icon="fa-store" hint={t("dash.hintBranches")}
           onTitleClick={() => onGo("/reports?tab=staff")}>
      {loading ? <span className="ek-skeleton" style={{ height: 120 }} /> : (
        <div className="brn">
          {rows.map((b) => (
            <div key={b.shopId} className="brn__row">
              <div className="brn__head">
                <span className="brn__dot" data-tone={healthTone(b.health)} aria-hidden="true" />
                <b className="brn__name">{b.name}</b>
                <Delta pct={b.growth} />
              </div>
              <div className="brn__nums">
                <span className="ek-num brn__sales">{money(b.netSales)}</span>
                <span className="brn__meta">
                  {t("dash.nReceipts", { n: b.receipts })} · {t("rpt2.margin")} {percent(b.margin)}
                </span>
              </div>
              {b.issues?.length > 0 && (
                <div className="brn__why">
                  {b.issues.map((i) => (
                    <span key={i} className="brn__tag">{t(`dash.iss.${i}`)}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TOVARLAR
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Eng yaxshi va eng yomon tovarlar — YONMA-YON.
 *
 * ⚠ Faqat «top 5» ko'rsatish yarim rasm. Eng ko'p sotilgan tovarni
 * hamma biladi; PULNI YEYAYOTGANI esa hech qayerda ko'rinmasdi.
 * Zarariga sotilgan tovar shu yerda topiladi.
 */
/**
 * Tovarlar ro'yxatining bir bo'lagi.
 *
 * ⚠ ATAYLAB tashqarida. Render ichida e'lon qilingan komponentning
 * turi har chizishda YANGI bo'ladi va React uning butun ostini qaytadan
 * o'rnatadi — ro'yxat har yangilanishda «sakrab» ketardi.
 */
function ProfitList({ items, tone, onGo }) {
  return (
    <div className="dtop">
      {items.map((p, i) => (
        <button key={p.productId ?? i} type="button" className="dtop__row"
                onClick={() => onGo(`/products?q=${encodeURIComponent(p.name || "")}`)}>
          <span className="dtop__n ek-num">{i + 1}</span>
          <span className="dtop__name">{p.name}</span>
          <span className="dtop__v ek-num" data-tone={tone}>{money(p.profit)}</span>
        </button>
      ))}
    </div>
  );
}

function ProductsPanel({ analytics, loading, onGo }) {
  const { t } = useT();
  const all = analytics?.products || [];
  /* ⚠ «Eng ko'p foyda» ro'yxatiga ZARAR keltirgani TUSHMAYDI. Kam
     tovarli do'konda oddiy saralash bilan bitta tovar ikkala ustunda
     ham chiqib qolardi — «eng yaxshi» va «eng yomon» bir xil satr
     bo'lgan ro'yxatga ishonib bo'lmaydi. */
  const top = useMemo(
    () => [...all].filter((p) => Number(p.profit) > 0)
                  .sort((a, b) => Number(b.profit) - Number(a.profit)).slice(0, 5), [all]);
  const worst = useMemo(
    () => [...all].filter((p) => Number(p.profit) < 0)
                  .sort((a, b) => Number(a.profit) - Number(b.profit)).slice(0, 5), [all]);

  return (
    <Panel title={t("dash.products")} icon="fa-ranking-star" hint={t("dash.hintProducts")}
           onTitleClick={() => onGo("/reports?tab=products")}>
      {loading ? <span className="ek-skeleton" style={{ height: 150 }} />
       : all.length === 0 ? <Empty text={t("dash.noSales")} />
       : (
        <div className="two">
          <div>
            <div className="two__t">{t("dash.bestProfit")}</div>
            <ProfitList items={top} tone="good" onGo={onGo} />
          </div>
          <div>
            <div className="two__t">{t("dash.lossMakers")}</div>
            {worst.length === 0
              ? <div className="two__ok"><i className="fa-solid fa-circle-check" aria-hidden="true" /> {t("dash.noLossMakers")}</div>
              : <ProfitList items={worst} tone="bad" onGo={onGo} />}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   OMBOR
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Ombor holati + TUGASH BASHORATI.
 *
 * ⚠ «Kam qoldi» va «tugaydi» — BOSHQA-BOSHQA narsa. Birinchisi
 * qoldiqni eng kam chegara bilan solishtiradi va sotuv sur'atidan
 * bexabar; ikkinchisi «kuniga ikkita sotiladigan tovarning oltitasi
 * uch kunga yetadi» deb hisoblaydi. Buyurtma berishga aynan ikkinchisi
 * kerak.
 */
function StockPanel({ pulse, analytics, lowStock, loading, canMoney, onGo }) {
  const { t } = useT();
  const st = analytics?.stock;
  const so = pulse?.stockouts || [];
  const inc = pulse?.incoming;

  const outN = inc?.outOfStock ?? lowStock.filter((i) => Number(i.quantity) <= 0).length;
  const lowN = inc?.lowStock ?? lowStock.filter((i) => Number(i.quantity) > 0).length;

  return (
    <Panel title={t("dash.stock")} icon="fa-warehouse" hint={t("dash.hintStock")}
           onTitleClick={() => onGo("/inventory")}>
      {loading ? <span className="ek-skeleton" style={{ height: 130 }} /> : (
        <>
          <div className="stk__row">
            <button type="button" className="stk__c" data-tone={outN ? "bad" : undefined}
                    onClick={() => onGo("/inventory")}>
              <b className="ek-num">{outN}</b><span>{t("dash.attOutOfStock")}</span>
            </button>
            <button type="button" className="stk__c" data-tone={lowN ? "warn" : undefined}
                    onClick={() => onGo("/inventory")}>
              <b className="ek-num">{lowN}</b><span>{t("dash.attLowStock")}</span>
            </button>
            {st && (
              <button type="button" className="stk__c" data-tone={st.expired ? "bad" : st.expiringSoon ? "warn" : undefined}
                      onClick={() => onGo("/batches")}>
                <b className="ek-num">{(st.expired || 0) + (st.expiringSoon || 0)}</b>
                <span>{t("rpt2.expiringSoon")}</span>
              </button>
            )}
            {canMoney && st && (
              <button type="button" className="stk__c" onClick={() => onGo("/reports?tab=stock")}>
                <b className="ek-num">{money(st.totalValue)}</b><span>{t("rpt2.stockValue")}</span>
              </button>
            )}
          </div>

          {so.length > 0 && (
            <>
              <div className="two__t stk__t">
                {t("dash.stockoutSoon")}<Hint text={t("dash.hintStockout")} />
              </div>
              <div className="stk__list">
                {so.slice(0, 6).map((s) => (
                  <button key={s.productId} type="button" className="stk__so"
                          data-tone={s.daysLeft <= 2 ? "bad" : "warn"}
                          onClick={() => onGo(`/products?q=${encodeURIComponent(s.name || "")}`)}>
                    <span className="stk__name">{s.name}</span>
                    <span className="stk__days ek-num">{t("dash.nDays", { n: s.daysLeft })}</span>
                    {canMoney && <span className="stk__lost ek-num">−{money(s.lostPerDay)}/{t("dash.perDay")}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TO'LOVLAR
   ══════════════════════════════════════════════════════════════════════ */

function PaymentsPanel({ analytics, loading, onGo }) {
  const { t } = useT();
  const rows = analytics?.payments || [];
  const slices = rows.map((p) => {
    const e = paymentEntry(p.type);
    return { label: e.label, value: Number(p.amount) || 0, color: e.color || "var(--bg-brand)" };
  });
  const total = slices.reduce((a, s) => a + s.value, 0);

  return (
    <Panel title={t("dash.paymentTypes")} icon="fa-credit-card" hint={t("dash.hintPayments")}
           onTitleClick={() => onGo("/reports?tab=money")}>
      {loading ? <span className="ek-skeleton" style={{ height: 150 }} />
       : rows.length === 0 ? <Empty text={t("dash.noPayments")} />
       : (
        <div className="pay">
          <Donut slices={slices} size={140} thickness={18}
                 center={<><span className="ek-num">{shortNum(total)}</span></>} />
          <div className="pay__list">
            {rows.map((p, i) => {
              const e = paymentEntry(p.type);
              return (
                <div key={i} className="pay__row">
                  <span className="pay__dot" style={{ background: e.color || "var(--bg-brand)" }} aria-hidden="true" />
                  <span className="pay__n">{e.label}</span>
                  <span className="ek-num pay__s">{percent(p.share)}</span>
                  <span className="ek-num pay__v">{money(p.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   KASSIRLAR
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Kassirlar — savdo va NAZORAT ustunlari birga.
 *
 * ⚠ Bekor qilish va qaytarish ATAYLAB shu yerda. Ular yolg'iz
 * «savdo» ustuni bilan yonma-yon turganda ma'no oladi: eng ko'p
 * sotgan kassirning eng ko'p bekor qilgani ham bo'lishi tasodif emas.
 */
function StaffPanel({ analytics, loading, onGo }) {
  const { t } = useT();
  const rows = (analytics?.cashiers || []).slice(0, 6);
  const anomalies = analytics?.anomalies || [];
  const flagged = new Set(anomalies.map((a) => a.subjectName));

  return (
    <Panel title={t("dash.staff")} icon="fa-user-tie" hint={t("dash.hintStaff")}
           onTitleClick={() => onGo("/reports?tab=staff")}>
      {loading ? <span className="ek-skeleton" style={{ height: 130 }} />
       : rows.length === 0 ? <Empty text={t("dash.noSales")} />
       : (
        <div className="table-wrap">
          <table className="tbl-sm">
            <thead>
              <tr>
                <th>{t("dash.cashier")}</th>
                <th className="num">{t("dash.receipts")}</th>
                <th className="num">{t("common.sum")}</th>
                <th className="num">{t("rpt2.avgReceipt")}</th>
                <th className="num">{t("rpt2.returns")}</th>
                <th className="num">{t("rpt2.cancelled")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.userId} data-flag={flagged.has(c.name) ? "" : undefined}>
                  <td>
                    {c.name}
                    {flagged.has(c.name) && (
                      <i className="fa-solid fa-triangle-exclamation stf__flag"
                         title={t("dash.staffFlag")} aria-label={t("dash.staffFlag")} />
                    )}
                  </td>
                  <td className="num">{c.receipts}</td>
                  <td className="num">{money(c.netSales)}</td>
                  <td className="num">{money(c.avgReceipt)}</td>
                  <td className="num" data-tone={c.returnCount ? "bad" : undefined}>{c.returnCount}</td>
                  <td className="num" data-tone={c.cancelled ? "bad" : undefined}>{c.cancelled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MIJOZLAR
   ══════════════════════════════════════════════════════════════════════ */

function PeoplePanel({ analytics, loyalty, loading, onGo }) {
  const { t } = useT();
  const c = analytics?.customers;
  const d = analytics?.debt;
  const top = c?.top || [];

  return (
    <Panel title={t("dash.people")} icon="fa-users" hint={t("dash.hintPeople")}
           onTitleClick={() => onGo("/customers")}>
      {loading ? <span className="ek-skeleton" style={{ height: 150 }} /> : (
        <>
          <div className="stk__row">
            <div className="stk__c"><b className="ek-num">{c?.active || 0}</b><span>{t("dash.buyers")}</span></div>
            <div className="stk__c"><b className="ek-num">{c?.newInPeriod || 0}</b><span>{t("rpt2.customersNew")}</span></div>
            <div className="stk__c">
              <b className="ek-num">{percent(c?.repeatRate || 0)}</b>
              <span>{t("dash.repeat")}<Hint text={t("dash.hintRepeat")} /></span>
            </div>
            {d && (
              <button type="button" className="stk__c" data-tone={Number(d.overdue) > 0 ? "bad" : undefined}
                      onClick={() => onGo("/customers")}>
                <b className="ek-num">{money(d.total)}</b><span>{t("rpt2.debtTotal")}</span>
              </button>
            )}
          </div>

          {top.length > 0 && (
            <>
              <div className="two__t stk__t">{t("dash.vip")}</div>
              <div className="dtop">
                {top.slice(0, 5).map((p, i) => (
                  <button key={p.customerId} type="button" className="dtop__row"
                          onClick={() => onGo(`/customers?q=${encodeURIComponent(p.name || p.phone || "")}`)}>
                    <span className="dtop__n ek-num">{i + 1}</span>
                    <span className="dtop__name">
                      {p.name || p.phone}
                      <span className="dtop__sub">{t("dash.nReceipts", { n: p.receipts })}</span>
                    </span>
                    <span className="dtop__v ek-num">{money(p.spent)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {loyalty?.receipts > 0 && (
            <div className="loy">
              <span>{t("dash.loyaltyGiven")} <b className="ek-num">{money(loyalty.discountGiven)}</b></span>
              <span>{t("dash.loyaltyRevenue")} <b className="ek-num" data-tone="good">{money(loyalty.revenue)}</b></span>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   KALENDAR VA VAZIFALAR (V72)
   ══════════════════════════════════════════════════════════════════════ */

/** Voqea turining belgisi va rangi — bitta lug'atdan. */
const EVENT_ICON = {
  HOLIDAY: "fa-star", PROMO: "fa-tag", SUPPLY: "fa-truck-ramp-box",
  PAYMENT: "fa-money-bill-wave", MEETING: "fa-users", OTHER: "fa-calendar",
};

/**
 * Yaqin kunlar va ochiq vazifalar.
 *
 * ⚠ IKKALASI BITTA BLOKDA. Ular ikki xil jadval, lekin bitta savolga
 * javob beradi: «bugun nima bo'ladi va kim nima qilishi kerak?».
 * Ikkita alohida blokda ular bir-biridan uzoqlashib, egasi ikkalasini
 * ham qaramay o'tib ketardi.
 *
 * ⚠ VAZIFA SHU YERDAN QO'SHILADI VA YOPILADI. Alohida sahifaga
 * o'tishni talab qiladigan ro'yxat ishlatilmaydi: «sut buyurtma
 * qilish» kabi ish o'ttiz soniyada yozilishi kerak, aks holda u
 * baribir daftarda qoladi.
 */
function PlanPanel({ plan, loading, canEdit, shopId, toast, onOpenAll, onChanged }) {
  const { t } = useT();
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const events = plan?.events || [];
  const tasks = plan?.tasks;
  const rows = tasks?.top || [];

  const add = () => {
    const title = adding.trim();
    if (!title || busy) return;
    setBusy(true);
    plannerApi.addTask({ title }, shopId)
      .then(() => { setAdding(""); onChanged(); })
      .catch((e) => toast.error(e.message))
      .finally(() => setBusy(false));
  };

  const close = (id) => {
    setBusy(true);
    plannerApi.setStatus(id, "DONE", shopId)
      .then(onChanged)
      .catch((e) => toast.error(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <Panel title={t("dash.plan2")} icon="fa-calendar-check" hint={t("dash.hintPlan2")}
           right={tasks?.open > 0 ? (
             <span className="pln__n" data-tone={tasks.overdue > 0 ? "bad" : undefined}>
               {t("dash.nOpen", { n: tasks.open })}
             </span>
           ) : null}>
      {loading ? <span className="ek-skeleton" style={{ height: 150 }} /> : (
        <>
          {/* ── Yaqin kunlar ──────────────────────────────────────── */}
          <div className="two__t">{t("dash.upcoming")}</div>
          {events.length === 0 ? (
            <div className="pln__none">{t("dash.noEvents")}</div>
          ) : (
            <div className="pln__ev">
              {events.slice(0, 4).map((e) => (
                <div key={`${e.id}-${e.startsOn}`} className="pln__row"
                     data-now={e.active ? "" : undefined}>
                  <i className={`fa-solid ${EVENT_ICON[e.kind] || EVENT_ICON.OTHER}`} aria-hidden="true" />
                  <span className="pln__t">{e.title}</span>
                  <span className="pln__when ek-num">
                    {e.active ? t("dash.today")
                     : e.daysAway === 1 ? t("dash.tomorrow")
                     : t("dash.inDays", { n: e.daysAway })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Vazifalar ─────────────────────────────────────────── */}
          <div className="two__t stk__t">{t("dash.tasks")}</div>
          {rows.length === 0 ? (
            <div className="pln__none">{t("dash.noTasks")}</div>
          ) : (
            <div className="pln__tk">
              {rows.map((k) => (
                <div key={k.id} className="pln__row" data-tone={k.overdue ? "bad" : undefined}>
                  {/* ⚠ Yopish tugmasi HAMMA rolga ochiq — serverda ham
                      shunday. Vazifani yopadigan odam aynan uni
                      bajargan xodim. */}
                  <button type="button" className="pln__done" disabled={busy}
                          onClick={() => close(k.id)}
                          aria-label={t("dash.markDone", { name: k.title })}>
                    <i className="fa-solid fa-check" aria-hidden="true" />
                  </button>
                  <span className="pln__t">
                    {k.title}
                    {k.assignee && <span className="pln__who">{k.assignee}</span>}
                  </span>
                  {k.dueOn && (
                    <span className="pln__when ek-num" data-tone={k.overdue ? "bad" : undefined}>
                      {shortDate(k.dueOn)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ⚠ Qo'shish maydoni faqat rahbarga — serverda ham shunday. */}
          {canEdit && (
            <div className="pln__add">
              <input
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") add(); }}
                placeholder={t("dash.addTask")}
                aria-label={t("dash.addTask")}
                maxLength={200}
              />
              <button type="button" disabled={!adding.trim() || busy} onClick={add}
                      aria-label={t("common.add")} title={t("common.add")}>
                <i className="fa-solid fa-plus" aria-hidden="true" />
              </button>
            </div>
          )}

          {(tasks?.open > rows.length || events.length > 4) && (
            <button type="button" className="dpn__more" onClick={onOpenAll}>
              {t("dash.allPlan")}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TO'LIQ BOSHQARUV OYNASI (V72)
   ══════════════════════════════════════════════════════════════════════ */

const EVENT_KINDS = ["HOLIDAY", "PROMO", "SUPPLY", "PAYMENT", "MEETING", "OTHER"];
const PRIORITIES = ["HIGH", "NORMAL", "LOW"];

/**
 * Vazifa va kalendarni to'liq boshqarish.
 *
 * ⚠ ALOHIDA SAHIFA EMAS, OYNA. Bosh sahifadagi blok kundalik ish uchun
 * yetadi (ko'rish, qo'shish, yopish); bu yerga esa kamdan-kam —
 * bayramni kiritish yoki bajarilganlar tarixini ko'rish uchun
 * kiriladi. Bunday ish uchun alohida sahifa qilish menyuni
 * uzaytirardi va u yerdan bosh sahifaga qaytish kerak bo'lardi.
 *
 * ⚠ Yopilgan vazifalar TARIXI ham shu yerda: bosh sahifada ular
 * ko'rinmaydi (u ochiq ishlar uchun), lekin «kim nima bajardi?» degan
 * savolga javob beradigan yagona joy shu.
 */
function PlannerModal({ open, onClose, shopId, canEdit, toast, onChanged }) {
  const { t } = useT();
  const [tab, setTab] = useState("tasks");
  const [status, setStatus] = useState("OPEN");
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);

  const load = useCallback(() => {
    setBusy(true);
    Promise.all([
      plannerApi.tasks(status, shopId).then((r) => asArray(r.data)).catch(() => []),
      plannerApi.events(null, isoDay(new Date(Date.now() + 365 * 864e5)), shopId)
        .then((r) => asArray(r.data)).catch(() => []),
    ]).then(([tk, ev]) => { setTasks(tk); setEvents(ev); }).finally(() => setBusy(false));
  }, [status, shopId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  /* Xodimlar ro'yxati faqat rahbarga va faqat BIR MARTA kerak. */
  useEffect(() => {
    if (!open || !canEdit || staff.length) return;
    shopApi.getUsers(shopId).then((r) => setStaff(asArray(r.data))).catch(() => setStaff([]));
  }, [open, canEdit, shopId, staff.length]);

  const done = (p) => p.then(() => { load(); onChanged(); })
                       .catch((e) => toast.error(e.message));

  if (!open) return null;

  const empty = { title: "", note: "", kind: "PROMO", startsOn: isoDay(new Date()),
                  endsOn: "", repeatYearly: false, remindDays: 0,
                  assigneeId: "", dueOn: "", priority: "NORMAL" };
  const f = form || empty;
  const set = (k, v) => setForm({ ...f, [k]: v });

  const save = () => {
    if (!f.title.trim()) return;
    const body = tab === "tasks"
      ? { title: f.title, note: f.note || null,
          assigneeId: f.assigneeId ? Number(f.assigneeId) : null,
          dueOn: f.dueOn || null, priority: f.priority }
      : { title: f.title, note: f.note || null, kind: f.kind,
          startsOn: f.startsOn, endsOn: f.endsOn || null,
          repeatYearly: f.repeatYearly, remindDays: Number(f.remindDays) || 0 };
    const req = tab === "tasks"
      ? (f.id ? plannerApi.editTask(f.id, body, shopId) : plannerApi.addTask(body, shopId))
      : (f.id ? plannerApi.editEvent(f.id, body, shopId) : plannerApi.addEvent(body, shopId));
    done(req.then(() => setForm(null)));
  };

  return (
    <Modal onClose={onClose} title={t("dash.plan2")} maxWidth={720}>
      <div className="seg pmd__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "tasks"}
                className={`seg__b${tab === "tasks" ? " is-on" : ""}`}
                onClick={() => { setTab("tasks"); setForm(null); }}>{t("dash.tasks")}</button>
        <button type="button" role="tab" aria-selected={tab === "events"}
                className={`seg__b${tab === "events" ? " is-on" : ""}`}
                onClick={() => { setTab("events"); setForm(null); }}>{t("dash.calendar")}</button>
      </div>

      {tab === "tasks" ? (
        <>
          <div className="seg pmd__f" role="group" aria-label={t("common.status")}>
            {["OPEN", "DONE", "CANCELLED"].map((x) => (
              <button key={x} type="button" className={`seg__b${status === x ? " is-on" : ""}`}
                      onClick={() => setStatus(x)}>{t(`dash.st.${x}`)}</button>
            ))}
          </div>

          <div className="pmd__list">
            {busy ? <span className="ek-skeleton" style={{ height: 90 }} />
             : tasks.length === 0 ? <Empty text={t("dash.noTasks")} />
             : tasks.map((k) => (
              <div key={k.id} className="pmd__row" data-tone={k.overdue ? "bad" : undefined}>
                <span className="pmd__pri" data-p={k.priority} aria-hidden="true" />
                <span className="pmd__t">
                  {k.title}
                  <span className="pmd__meta">
                    {k.assignee || t("dash.wholeShop")}
                    {k.dueOn && ` · ${shortDate(k.dueOn)}`}
                    {k.doneBy && ` · ${k.doneBy}`}
                  </span>
                </span>
                <span className="pmd__acts">
                  {k.status === "OPEN" ? (
                    <>
                      <button type="button" title={t("dash.st.DONE")}
                              onClick={() => done(plannerApi.setStatus(k.id, "DONE", shopId))}>
                        <i className="fa-solid fa-check" aria-hidden="true" />
                      </button>
                      {canEdit && (
                        <button type="button" title={t("dash.st.CANCELLED")}
                                onClick={() => done(plannerApi.setStatus(k.id, "CANCELLED", shopId))}>
                          <i className="fa-solid fa-ban" aria-hidden="true" />
                        </button>
                      )}
                    </>
                  ) : (
                    /* Qayta ochish — yopilgan vazifani tahrirlashning
                       yagona yo'li: matnni o'zgartirish taqiqlangan. */
                    <button type="button" title={t("dash.reopen")}
                            onClick={() => done(plannerApi.setStatus(k.id, "OPEN", shopId))}>
                      <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                    </button>
                  )}
                  {canEdit && (
                    <button type="button" title={t("common.delete")}
                            onClick={() => done(plannerApi.delTask(k.id, shopId))}>
                      <i className="fa-solid fa-trash" aria-hidden="true" />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="pmd__list">
          {busy ? <span className="ek-skeleton" style={{ height: 90 }} />
           : events.length === 0 ? <Empty text={t("dash.noEvents")} />
           : events.map((e) => (
            <div key={`${e.id}-${e.startsOn}`} className="pmd__row">
              <i className={`fa-solid ${EVENT_ICON[e.kind] || EVENT_ICON.OTHER} pmd__ico`} aria-hidden="true" />
              <span className="pmd__t">
                {e.title}
                <span className="pmd__meta">
                  {shortDate(e.startsOn)}{e.endsOn && ` — ${shortDate(e.endsOn)}`}
                  {e.repeatYearly && ` · ${t("dash.yearly")}`}
                  {e.remindDays > 0 && ` · ${t("dash.remindN", { n: e.remindDays })}`}
                </span>
              </span>
              {canEdit && (
                <span className="pmd__acts">
                  <button type="button" title={t("common.edit")}
                          onClick={() => setForm({
                            id: e.id, title: e.title, note: e.note || "", kind: e.kind,
                            /* ⚠ Tahrirlashda BAZADAGI sana ochiladi, ekrandagi
                               ko'chirilgani emas — aks holda har yilgi voqea
                               saqlanganda joriy yilga «yopishib» qolardi. */
                            startsOn: e.originalOn, endsOn: e.endsOn || "",
                            repeatYearly: e.repeatYearly, remindDays: e.remindDays,
                          })}>
                    <i className="fa-solid fa-pen" aria-hidden="true" />
                  </button>
                  <button type="button" title={t("common.delete")}
                          onClick={() => done(plannerApi.delEvent(e.id, shopId))}>
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="pmd__form">
          <input value={f.title} onChange={(e) => set("title", e.target.value)}
                 placeholder={tab === "tasks" ? t("dash.addTask") : t("dash.addEvent")}
                 aria-label={tab === "tasks" ? t("dash.addTask") : t("dash.addEvent")}
                 maxLength={200} />

          {tab === "tasks" ? (
            <div className="pmd__grid">
              <label>{t("dash.due")}
                <input type="date" value={f.dueOn} onChange={(e) => set("dueOn", e.target.value)} /></label>
              <label>{t("dash.priority")}
                <select value={f.priority} onChange={(e) => set("priority", e.target.value)}>
                  {PRIORITIES.map((x) => <option key={x} value={x}>{t(`dash.pr.${x}`)}</option>)}
                </select></label>
              <label>{t("dash.assignee")}
                <select value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
                  <option value="">{t("dash.wholeShop")}</option>
                  {staff.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
                </select></label>
            </div>
          ) : (
            <div className="pmd__grid">
              <label>{t("dash.kind")}
                <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>
                  {EVENT_KINDS.map((x) => <option key={x} value={x}>{t(`dash.ek.${x}`)}</option>)}
                </select></label>
              <label>{t("dash.from")}
                <input type="date" value={f.startsOn} onChange={(e) => set("startsOn", e.target.value)} /></label>
              <label>{t("dash.to")}
                <input type="date" value={f.endsOn} onChange={(e) => set("endsOn", e.target.value)} /></label>
              <label>{t("dash.remind")}
                <input type="number" min="0" max="60" value={f.remindDays}
                       onChange={(e) => set("remindDays", e.target.value)} /></label>
              <label className="pmd__chk">
                <input type="checkbox" checked={f.repeatYearly}
                       onChange={(e) => set("repeatYearly", e.target.checked)} />
                {t("dash.yearly")}
              </label>
            </div>
          )}

          <div className="pmd__save">
            {f.id && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm(null)}>
                {t("common.cancel")}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm"
                    disabled={!f.title.trim() || busy} onClick={save}>
              {f.id ? t("common.save") : t("common.add")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   IMKONIYATLAR VA TEZKOR AMALLAR
   ══════════════════════════════════════════════════════════════════════ */

function OppsPanel({ analytics, pulse, loading, onGo }) {
  const { t } = useT();
  const list = useMemo(() => opportunities({ analytics, pulse }), [analytics, pulse]);
  if (!loading && list.length === 0) return null;

  return (
    <Panel title={t("dash.opps")} icon="fa-wand-magic-sparkles" hint={t("dash.hintOpps")}>
      {loading ? <span className="ek-skeleton" style={{ height: 90 }} /> : (
        <div className="opp">
          {list.map((o) => (
            <button key={o.id} type="button" className="opp__row" onClick={() => onGo(o.to)}>
              <i className={`fa-solid ${o.icon}`} aria-hidden="true" />
              <span className="opp__t">{t(o.key, o.args)}</span>
              {o.money > 0 && <span className="ek-num opp__v">{money(o.money)}</span>}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Tezkor amallar — rolga qarab. */
function ActionsPanel({ role, onGo }) {
  const { t } = useT();
  const set = roleSet(role);
  const can = (...rs) => rs.some((r) => set.has(r));

  const acts = [
    can("OWNER", "SHOP_ADMIN", "ADMIN", "CASHIER") && { id: "sale", icon: "fa-cash-register", key: "dash.qaSale", to: "/sale" },
    can("OWNER", "SHOP_ADMIN", "ADMIN", "STOREKEEPER") && { id: "product", icon: "fa-plus", key: "dash.qaProduct", to: "/products?new=1" },
    can("OWNER", "SHOP_ADMIN", "ADMIN", "STOREKEEPER") && { id: "supply", icon: "fa-truck-ramp-box", key: "dash.qaSupply", to: "/supply?new=1" },
    can("OWNER", "SHOP_ADMIN", "ADMIN") && { id: "expense", icon: "fa-money-bill-wave", key: "dash.qaExpense", to: "/expenses?new=1" },
    can("OWNER", "SHOP_ADMIN", "ADMIN", "STOREKEEPER") && { id: "count", icon: "fa-clipboard-list", key: "dash.qaCount", to: "/stock-take" },
    can("OWNER", "SHOP_ADMIN") && { id: "report", icon: "fa-chart-bar", key: "dash.qaReport", to: "/reports" },
  ].filter(Boolean);

  return (
    <Panel title={t("dash.actions")} icon="fa-bolt">
      <div className="qa">
        {acts.map((a) => (
          <button key={a.id} type="button" className="qa__b" onClick={() => onGo(a.to)}>
            <i className={`fa-solid ${a.icon}`} aria-hidden="true" />
            <span>{t(a.key)}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   BLOKLARNI SOZLASH
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Qaysi blok ko'rinishi va qaysi tartibda.
 *
 * ⚠ Sudrab ko'chirish (drag-and-drop) O'RNIGA tugmalar. Sudrash
 * telefonda ishlamaydi, klaviatura bilan umuman qilib bo'lmaydi va
 * skrinrider uchun ko'rinmas. Yuqori/quyi tugmalari esa hamma joyda
 * bir xil ishlaydi va o'sha ishni bajaradi.
 */
function LayoutModal({ open, onClose, list, setList }) {
  const { t } = useT();
  if (!open) return null;

  const apply = (next) => { setList(next); saveLayout(next); };

  return (
    <Modal onClose={onClose} title={t("dash.customize")} maxWidth={440}>
      <p className="lay__hint">{t("dash.customizeHint")}</p>
      <div className="lay">
        {list.map((w, i) => (
          <div key={w.id} className="lay__row">
            <label className="lay__on">
              <input type="checkbox" checked={w.on} onChange={() => apply(toggle(list, w.id))} />
              <span>{t(w.key)}</span>
            </label>
            <span className="lay__mv">
              <button type="button" disabled={i === 0} onClick={() => apply(move(list, w.id, -1))}
                      aria-label={t("dash.moveUp")}>
                <i className="fa-solid fa-chevron-up" aria-hidden="true" />
              </button>
              <button type="button" disabled={i === list.length - 1} onClick={() => apply(move(list, w.id, 1))}
                      aria-label={t("dash.moveDown")}>
                <i className="fa-solid fa-chevron-down" aria-hidden="true" />
              </button>
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SAHIFA
   ══════════════════════════════════════════════════════════════════════ */

export default function DashboardPage({ toast }) {
  const { t } = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const set = roleSet(user?.role);
  /* ⚠ Serverdagi qoidaning NUSXASI: `/reports/**` faqat egasi va
     do'kon administratoriga ochiq (`SecurityConfig`). Shu bayroq
     bo'lmasa omborchiga so'rov ketardi va 403 qaytardi. */
  const canMoney = set.has("OWNER") || set.has("SHOP_ADMIN");
  const canOnboard = canMoney;

  /* ── Holat MANZILDA (V74) ─────────────────────────────────────────
     Davr, filial va taqqoslash manzil qatorida turadi: shu ko'rinishni
     hamkasbga yuborsa, u AYNAN shu rasmni ko'radi. Ilgari havola
     doim standart ko'rinishni ochardi. */
  const period = params.get("p") || "today";
  const cmp = params.get("c") === "week" ? "week" : "yesterday";
  const branchId = params.get("b") ? Number(params.get("b")) : null;

  const patch = useCallback((next) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") p.delete(k); else p.set(k, String(v));
    }
    setParams(p, { replace: true });
  }, [params, setParams]);

  const [pulse, setPulse] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [signals, setSignals] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [planned, setPlanned] = useState(null);
  const [loadingSlow, setLoadingSlow] = useState(true);
  const [loadingFast, setLoadingFast] = useState(true);
  const [at, setAt] = useState(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [layout, setLayout] = useState(() => readLayout(canMoney));

  /* Rol o'zgarsa (boshqa hisobga kirilsa) ro'yxat qayta quriladi. */
  useEffect(() => { setLayout(readLayout(canMoney)); }, [canMoney]);

  const range = useMemo(() => periodRange(period), [period]);

  /* Bitta manba — blok ham, ogohlantirishlar ham shundan o'qiydi. */
  const plan = canMoney
    ? { events: pulse?.events || [], tasks: pulse?.tasks || null }
    : planned;

  /* ── OG'IR so'rov: davr tahlili ───────────────────────────────────
     Faqat davr yoki filial o'zgarganda. Avto-yangilanish bunga
     TEGMAYDI. */
  useEffect(() => {
    let alive = true;
    setLoadingSlow(true);
    /* ⚠ KALENDAR VA VAZIFA IKKI YO'LDAN KELADI. Rahbarda ular puls
       javobining ichida (qo'shimcha so'rovsiz), pul ko'rmaydigan rolda
       esa alohida so'rov bilan — chunki unga puls umuman yuborilmaydi.
       Bitta manbaga bog'lansa, omborchi o'ziga berilgan vazifani hech
       qachon ko'rmasdi, holbuki uni bajaradigan odam aynan u. */
    if (!canMoney) {
      Promise.all([
        plannerApi.events(null, null, branchId).then((r) => asArray(r.data)).catch(() => []),
        plannerApi.tasks("OPEN", branchId).then((r) => asArray(r.data)).catch(() => []),
      ]).then(([events, open]) => {
        if (!alive) return;
        const today = new Date().toISOString().slice(0, 10);
        setPlanned({
          events,
          tasks: {
            open: open.length,
            overdue: open.filter((t) => t.overdue).length,
            dueToday: open.filter((t) => t.dueOn === today).length,
            mine: 0,
            top: open.slice(0, 5),
          },
        });
      });
    }

    const jobs = [
      /* ⚠ `getLow` FILIAL qabul qilmaydi — server yo'li joriy do'kon
         bo'yicha ishlaydi. Rahbarda bu raqamlar `pulse.incoming` dan
         olinadi (u filialni biladi); shu ro'yxat faqat omborchi uchun
         zaxira. Argument berish uni filtrlaydi deb o'ylatardi. */
      inventoryApi.getLow().then((r) => asArray(r.data)).catch(() => []),
    ];
    if (canMoney) {
      jobs.push(
        reportApi.analytics(isoInstant(range.from), isoInstant(range.to), null, branchId)
          .then((r) => r.data).catch((e) => { toast.error(e.message); return null; }),
        /* ⚠ Signallar va sodiqlik JIMGINA yiqiladi: ular blokni
           boyitadi, lekin ularsiz ham sahifa to'liq ishlaydi. Xatoni
           toast qilish har yangilanishda tushunarsiz xabar berardi. */
        reportApi.signals(branchId).then((r) => r.data).catch(() => null),
        loyaltyApi.summary().then((r) => r.data).catch(() => null),
      );
    }
    Promise.all(jobs).then(([low, an, sig, loy]) => {
      if (!alive) return;
      setLowStock(low); setAnalytics(an ?? null);
      setSignals(sig ?? null); setLoyalty(loy ?? null);
      setLoadingSlow(false);
    });
    return () => { alive = false; };
  }, [period, branchId, canMoney, range.from, range.to, toast]);

  /* ── YENGIL so'rov: hozirgi holat ─────────────────────────────────
     Avto-yangilanish faqat SHUNI takrorlaydi. */
  /** Vazifa qo'shilgan yoki yopilgandan keyin — o'sha rolning manbayi. */
  const reloadPlan = useCallback(() => {
    if (canMoney) return;
    Promise.all([
      plannerApi.events(null, null, branchId).then((r) => asArray(r.data)).catch(() => []),
      plannerApi.tasks("OPEN", branchId).then((r) => asArray(r.data)).catch(() => []),
    ]).then(([events, open]) => {
      const today = new Date().toISOString().slice(0, 10);
      setPlanned({
        events,
        tasks: {
          open: open.length,
          overdue: open.filter((t) => t.overdue).length,
          dueToday: open.filter((t) => t.dueOn === today).length,
          mine: 0,
          top: open.slice(0, 5),
        },
      });
    });
  }, [canMoney, branchId]);

  const loadPulse = useCallback((quiet) => {
    if (!canMoney) { setLoadingFast(false); return Promise.resolve(); }
    if (!quiet) setLoadingFast(true);
    return reportApi.pulse(branchId)
      .then((r) => { setPulse(r.data); setAt(new Date()); })
      .catch(() => { /* jimgina: keyingi urinish bir daqiqadan keyin */ })
      .finally(() => setLoadingFast(false));
  }, [branchId, canMoney]);

  useEffect(() => { loadPulse(false); }, [loadPulse]);

  /* ⚠ Ko'rinmayotgan varaqda yangilanish TO'XTAYDI. Ochiq qolgan
     varaq kechasi ham har daqiqada so'rov yuborardi; o'nta shunday
     varaq serverni bekorga bo'g'ardi. Varaq qaytganda esa DARHOL
     yangilanadi — eski raqamni ko'rsatib turish yomonroq. */
  useEffect(() => {
    if (!canMoney) return;
    let id = null;
    const start = () => { stop(); id = setInterval(() => loadPulse(true), REFRESH_MS); };
    const stop = () => { if (id) clearInterval(id); id = null; };
    const onVis = () => {
      if (document.hidden) stop();
      else { loadPulse(true); start(); }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [loadPulse, canMoney]);

  /* ── Ctrl+K ───────────────────────────────────────────────────────
     ⚠ Kirish maydonida turgan bo'lsa ham ishlaydi: bu kombinatsiya
     brauzerda boshqa ma'no anglatmaydi va foydalanuvchi uni yozish
     paytida ham bosishi mumkin. */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /**
   * Ogohlantirish yoki blok havolasi.
   *
   * ⚠ `planner:` — sahifa emas, OYNA. Kalendar va vazifalar uchun
   * alohida marshrut qilinmadi (sabab `PlannerModal` da), lekin
   * ogohlantirish satri baribir biror joyga olib borishi kerak.
   * Havolani bo'sh qoldirish «bosdim, hech narsa bo'lmadi» degan eng
   * yomon holatni berardi.
   */
  const go = useCallback((to) => {
    if (!to) return;
    if (to === "/planner") { setPlanOpen(true); return; }
    navigate(to);
  }, [navigate]);

  /* ── Ogohlantirishlar ─────────────────────────────────────────────
     Butun tizimdan kelgan signallar bitta tartiblangan ro'yxatda —
     mantiq `ek-dash.js` da, chunki u SINALADIGAN qaror. */
  const alerts = useMemo(() => buildAlerts({
    signals, pulse, lowStock, plan,
    /* Omborchida savdo so'rovi yuborilmaydi — «bilmaymiz» deb
       beriladi, «sotuv yo'q» deb emas. */
    hasSales: canMoney ? Number(pulse?.today?.receipts || analytics?.now?.receipts || 0) > 0 : null,
  }), [signals, pulse, lowStock, analytics, canMoney, plan]);

  /* ── KPI qatori ───────────────────────────────────────────────────
     ⚠ Tartib — HISOBOTNING O'ZI: tushumdan sof foydagacha zinapoya.
     Har qator yuqoridagidan qanday chiqqani ko'rinib turadi. */
  const k = analytics?.now;
  const kp = analytics?.prev;
  const spark = useMemo(
    () => (analytics?.series || []).map((p) => Number(p.netSales) || 0),
    [analytics]);

  const pct = (a, b) => (Number(b) ? ((Number(a) - Number(b)) / Math.abs(Number(b))) * 100 : null);

  const periodName = t(`rpt2.p.${PERIODS.includes(period) ? period : "today"}`);

  /* ── Bloklar ──────────────────────────────────────────────────────
     Har blok ID bo'yicha chizadi; tartib va ko'rinish `layout` dan.
     Shu sababli yangi blok qo'shish — bitta satr. */
  const RENDER = {
    kpi: () => (
      <div className="kpi2row" key="kpi">
        <Kpi label={t("dash.revenue")} value={k?.netSales} spark={spark}
             delta={pct(k?.netSales, kp?.netSales)} hint={t("dash.hintRevenue")}
             onOpen={() => go("/reports?tab=sales")}
             detail={<>
               <Line label={t("rpt2.grossSales")} value={money(k?.grossSales)} />
               <Line label={t("rpt2.discount")} value={`− ${money(k?.discount)}`} />
               <Line label={t("rpt2.returns")} value={`− ${money(k?.returns)}`} tone={Number(k?.returns) ? "bad" : undefined} />
             </>} />
        <Kpi label={t("dash.salesCount")} value={k?.receipts} format={(v) => String(v)}
             delta={pct(k?.receipts, kp?.receipts)} hint={t("dash.hintReceipts")}
             onOpen={() => go("/sales")}
             detail={<>
               <Line label={t("rpt2.avgReceipt")} value={money(k?.avgReceipt)} />
               <Line label={t("rpt2.maxReceipt")} value={money(k?.maxReceipt)} />
               <Line label={t("rpt2.returns")} value={k?.returnReceipts ?? 0} />
             </>} />
        <Kpi label={t("rpt2.grossProfit")} value={k?.grossProfit}
             delta={pct(k?.grossProfit, kp?.grossProfit)} hint={t("dash.hintGross")}
             onOpen={() => go("/reports?tab=profit")}
             detail={<>
               <Line label={t("rpt2.cogs")} value={money(k?.cogs)} />
               <Line label={t("rpt2.margin")} value={percent(k?.margin)} />
             </>} />
        <Kpi label={t("rpt2.expenses")} value={k?.expenses} good="down"
             delta={pct(k?.expenses, kp?.expenses)} hint={t("dash.hintExpenses")}
             onOpen={() => go("/expenses")} />
        <Kpi label={t("rpt2.netProfit")} value={k?.netProfit}
             delta={pct(k?.netProfit, kp?.netProfit)} hint={t("dash.hintNet")}
             tone={Number(k?.netProfit) < 0 ? "bad" : undefined}
             onOpen={() => go("/reports?tab=profit")}
             detail={<>
               <Line label={t("rpt2.grossProfit")} value={money(k?.grossProfit)} />
               <Line label={t("rpt2.expenses")} value={`− ${money(k?.expenses)}`} />
               {Number(k?.inventoryLoss) > 0 &&
                 <Line label={t("rpt2.inventoryLoss")} value={`− ${money(k?.inventoryLoss)}`} tone="bad" />}
             </>} />
      </div>
    ),
    alerts: () => <Alerts key="alerts" alerts={alerts} loading={loadingSlow && loadingFast} onGo={go} />,
    pulse: () => <PulsePanel key="pulse" pulse={pulse} cmp={cmp} loading={loadingFast}
                             onCmp={(v) => patch({ c: v === "yesterday" ? null : v })} onGo={go} />,
    target: () => <TargetPanel key="target" pulse={pulse} onGo={go} />,
    changes: () => <ChangesPanel key="changes" analytics={analytics} loading={loadingSlow} onGo={go} />,
    plan: () => <PlanPanel key="plan" plan={plan} loading={canMoney ? loadingFast : loadingSlow}
                           canEdit={canMoney} onOpenAll={() => setPlanOpen(true)}
                           shopId={branchId} toast={toast}
                           /* ⚠ Vazifa qo'shilgach YENGIL so'rov qayta
                              yuboriladi: ro'yxatni mahalliy yangilash
                              serverdagi tartib va sanoqni takrorlashni
                              talab qilardi va ikkalasi vaqt o'tib
                              bir-biridan uzoqlashardi. */
                           onChanged={() => { loadPulse(true); reloadPlan(); }} />,
    live: () => <LivePanel key="live" pulse={pulse} loading={loadingFast} onGo={go} />,
    registers: () => <RegistersPanel key="registers" pulse={pulse} loading={loadingFast} onGo={go} />,
    branches: () => <BranchesPanel key="branches" pulse={pulse} loading={loadingFast} onGo={go} />,
    products: () => <ProductsPanel key="products" analytics={analytics} loading={loadingSlow} onGo={go} />,
    stock: () => <StockPanel key="stock" pulse={pulse} analytics={analytics} lowStock={lowStock}
                             loading={loadingSlow} canMoney={canMoney} onGo={go} />,
    payments: () => <PaymentsPanel key="payments" analytics={analytics} loading={loadingSlow} onGo={go} />,
    staff: () => <StaffPanel key="staff" analytics={analytics} loading={loadingSlow} onGo={go} />,
    people: () => <PeoplePanel key="people" analytics={analytics} loyalty={loyalty} loading={loadingSlow} onGo={go} />,
    opps: () => <OppsPanel key="opps" analytics={analytics} pulse={pulse} loading={loadingSlow} onGo={go} />,
    actions: () => <ActionsPanel key="actions" role={user?.role} onGo={go} />,
  };

  /* ⚠ Ikki ustunga tushadigan bloklar. Ular yonma-yon turganda
     ekranda joy tejaladi, lekin ro'yxat va grafik bir-birini
     siqmasligi kerak: keng bloklar (KPI, egri chiziq, kassirlar)
     BUTUN kenglikda qoladi. */
  const NARROW = new Set(["target", "changes", "plan", "live", "registers", "branches",
                          "payments", "people", "opps", "actions"]);

  const blocks = layout.filter((w) => w.on && RENDER[w.id]);

  /* Yonma-yon tushadigan qo'shni bloklarni bitta qatorga yig'amiz. */
  const rows = [];
  for (const w of blocks) {
    const last = rows[rows.length - 1];
    if (NARROW.has(w.id) && last?.narrow && last.items.length < 2) last.items.push(w);
    else rows.push({ narrow: NARROW.has(w.id), items: [w] });
  }

  return (
    <div className="dash">
      {/* ══ Boshqaruv qatori ══════════════════════════════════════════
          ⚠ Yopishib turadi (`sticky`): pastga tushganda ham davr va
          filial ko'rinib turishi kerak — aks holda «bu raqam qaysi
          davrniki?» degan savol tug'iladi. */}
      <div className="dash__bar">
        <div className="dash__left">
          <h2 className="page-title">{t("dash.title")}</h2>
          {canMoney && <span className="dash__period">{periodName}</span>}
        </div>

        <div className="dash__ctl">
          <button type="button" className="dash__search" onClick={() => setCmdOpen(true)}>
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <span>{t("dash.searchAll")}</span>
            <kbd>Ctrl</kbd><kbd>K</kbd>
          </button>

          {/* ⚠ Davr faqat DAVR TAHLILIGA ta'sir qiladi va uni omborchi
              so'ramaydi. Ishlamaydigan tugmani ko'rsatish «bosdim,
              hech narsa o'zgarmadi» degan taassurot berardi. */}
          {canMoney && (
          <div className="seg" role="group" aria-label={t("rpt2.period")}>
            {PERIODS.filter((x) => ["today", "week", "month"].includes(x)).map((x) => (
              <button key={x} type="button" aria-pressed={period === x}
                      className={`seg__b${period === x ? " is-on" : ""}`}
                      onClick={() => patch({ p: x === "today" ? null : x })}>
                {t(`rpt2.p.${x}`)}
              </button>
            ))}
          </div>
          )}

          {canMoney && <BranchSelector selectedId={branchId} onSelect={(id) => patch({ b: id })} />}

          {canMoney && (
            <button type="button" className="dash__icon" onClick={() => loadPulse(false)}
                    aria-label={t("dash.refresh")} title={t("dash.refresh")}>
              <i className="fa-solid fa-rotate" aria-hidden="true" />
            </button>
          )}
          <button type="button" className="dash__icon" onClick={() => setLayoutOpen(true)}
                  aria-label={t("dash.customize")} title={t("dash.customize")}>
            <i className="fa-solid fa-sliders" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Oxirgi yangilanish — raqamlar qachonlikini bilish shart. */}
      {at && (
        <div className="dash__at">
          <span className="live__dot" aria-hidden="true" />
          {t("dash.updatedAt", { v: time(at.toISOString()) })}
        </div>
      )}

      {canOnboard && <OnboardingCard toast={toast} />}

      {/* Omborchi va kassirga PUL bloklari umuman ko'rsatilmaydi —
          so'rov ham yuborilmagan. */}
      {!canMoney && (
        <div className="dash__role">
          <i className="fa-solid fa-circle-info" aria-hidden="true" />
          {t("dash.roleLimited")}
        </div>
      )}

      {rows.map((r, i) => (
        r.narrow && r.items.length > 1
          ? <div className="dash__two" key={i}>{r.items.map((w) => RENDER[w.id]())}</div>
          : <div key={i}>{r.items.map((w) => RENDER[w.id]())}</div>
      ))}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)}
                      role={user?.role} branchId={branchId} />
      <LayoutModal open={layoutOpen} onClose={() => setLayoutOpen(false)}
                   list={layout} setList={setLayout} />
      <PlannerModal open={planOpen} onClose={() => setPlanOpen(false)}
                    shopId={branchId} canEdit={canMoney} toast={toast}
                    onChanged={() => { loadPulse(true); reloadPlan(); }} />
    </div>
  );
}
