/* ══════════════════════════════════════════════════════════════════════════
   BOSH SAHIFANING MIYASI (V74)

   ═══ NEGA ALOHIDA FAYL ══════════════════════════════════════════════════

   Bosh sahifa uchta savolga javob beradi va uchalasi ham HISOB:

     • nima yomon? — ogohlantirishlar, muhimlik darajasi bo'yicha
     • nima o'zgardi? — o'tgan davrga nisbatan sezilarli farqlar
     • nima qilsa bo'ladi? — imkoniyatlar

   Bu hisoblar JSX ichida turganda ularni tekshirib bo'lmasdi: har bir
   qoidani ko'rish uchun brauzer ochish, ma'lumot yaratish va ko'z bilan
   qarash kerak edi. Shu sababli mantiq shu yerda — sof funksiyalar,
   React ham, tarjima ham yo'q. Funksiyalar KALIT qaytaradi, matnni
   sahifaning o'zi qo'yadi.

   ⚠ HAR BIR CHEGARA SHU YERDA VA NOMLANGAN. «> 20%» degan son JSX
   ichida yotganda uni o'zgartirish uchun butun sahifani o'qish kerak
   bo'lardi.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Muhimlik darajalari ──────────────────────────────────────────────
   ATAYLAB uchtagina. Beshta daraja qilingan tizimlarda o'rtadagi
   ikkitasi hech qachon farqlanmaydi va ro'yxat rangli shovqinga
   aylanadi. */
export const SEVERITY = ["critical", "warning", "info"];

const RANK = { critical: 0, warning: 1, info: 2 };

/** Ogohlantirishlarni muhimlik, keyin PUL bo'yicha tartiblaydi. */
export function sortAlerts(list) {
  return [...list].sort((a, b) => {
    const r = (RANK[a.severity] ?? 9) - (RANK[b.severity] ?? 9);
    if (r) return r;
    return (Number(b.money) || 0) - (Number(a.money) || 0);
  });
}

/* ══════════════════════════════════════════════════════════════════════
   CHEGARALAR — hammasi bitta joyda
   ══════════════════════════════════════════════════════════════════════ */

export const T = {
  /** Tovar shuncha kun ichida tugasa — qizil. */
  stockoutCritical: 2,
  /** Tovar shuncha kun ichida tugasa — sariq. */
  stockoutWarn: 7,
  /** Filial salomatligi shundan past bo'lsa — ogohlantirish. */
  healthBad: 60,
  /** Marja shundan past bo'lsa — ogohlantirish (foizda). */
  marginLow: 10,
  /** Ish vaqtida shuncha daqiqa sotuv bo'lmasa — ogohlantirish. */
  quietMinutes: 90,
  /** Reja sur'atidan shuncha foiz orqada qolinsa — ogohlantirish. */
  paceBehind: 10,
  /** «Nima o'zgardi» ga tushish uchun eng kichik farq (foizda). */
  changeMin: 8,
  /** Qaytarish ulushi shundan oshsa — ogohlantirish (foizda). */
  returnShare: 10,
  /** Kalendar voqeasi shuncha kun qolganda ogohlantirishga tushadi. */
  eventSoon: 3,
};

/* ══════════════════════════════════════════════════════════════════════
   1. OGOHLANTIRISHLAR MARKAZI
   ══════════════════════════════════════════════════════════════════════ */

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const rows = (r) => (n(r?.count) > 0 ? r : null);

/**
 * Butun tizimdan kelgan signallarni BITTA tartiblangan ro'yxatga
 * yig'adi.
 *
 * Qaytadigan har bir satr: `{ id, severity, icon, key, args, money,
 * count, to }`. `key` va `args` — tarjima uchun; `to` — bosilganda
 * qayerga o'tish.
 *
 * ⚠ TARTIB PUL BO'YICHA, sana yoki alifbo bo'yicha emas. Egasi
 * ro'yxatni yuqoridan o'qiydi va birinchi ko'radigani eng qimmatga
 * tushadigani bo'lishi kerak.
 *
 * ⚠ HAR BIR SATR FAQAT HAQIQATDAN muammo bo'lsa chiqadi. «Bugun sotuv
 * yo'q» degan satr soat 8 da har kuni yonsa, bir haftada butun blok
 * e'tibordan chiqadi.
 */
export function buildAlerts({ signals = {}, pulse = null, lowStock = [],
                              hasSales = true, plan = null } = {}) {
  /* ⚠ `hasSales === null` — «BILMAYMIZ», «yo'q» EMAS. Omborchida
     savdo so'rovi umuman yuborilmaydi va uni `false` deb hisoblash
     unga har kuni «bugun sotuv bo'lmadi» degan yolg'on satr
     chiqarardi. Bilmaslikda hech narsa aytmaslik to'g'ri. */
  const out = [];
  const sig = signals || {};

  /* ── Pul yo'qolayotgan joylar ─────────────────────────────────── */
  if (rows(sig.cashShortage)) out.push({
    id: "cash", severity: "critical", icon: "fa-sack-dollar",
    key: "dash.sigCashShort", args: { n: sig.cashShortage.count, d: sig.shiftWindowDays },
    money: n(sig.cashShortage.amount), to: "/audit?action=SHIFT_CLOSE",
  });

  if (rows(sig.nonCashDiff)) out.push({
    id: "noncash", severity: "critical", icon: "fa-credit-card",
    key: "dash.sigNonCashDiff", args: { n: sig.nonCashDiff.count },
    money: n(sig.nonCashDiff.amount), to: "/audit?action=SHIFT_CLOSE",
  });

  if (rows(sig.stockShortage)) out.push({
    id: "stock", severity: "critical", icon: "fa-clipboard-list",
    key: "dash.sigStockShort", args: { n: sig.stockShortage.count, d: sig.stockWindowDays },
    money: n(sig.stockShortage.amount), to: "/stock-take",
  });

  if (n(sig.disputedDebts) > 0) out.push({
    id: "disputed", severity: "critical", icon: "fa-triangle-exclamation",
    key: "dash.sigDisputed", count: n(sig.disputedDebts), to: "/customers",
  });

  if (rows(sig.overdueDebt)) out.push({
    id: "overdue", severity: "critical", icon: "fa-clock",
    key: "dash.sigOverdueDebt", args: { n: sig.overdueDebt.count },
    money: n(sig.overdueDebt.amount), to: "/customers",
  });

  /* ── Ombor ────────────────────────────────────────────────────── */
  const out0 = lowStock.filter((i) => n(i.quantity) <= 0).length;
  const low0 = lowStock.filter((i) => n(i.quantity) > 0).length;

  if (out0) out.push({
    id: "outofstock", severity: "critical", icon: "fa-box-open",
    key: "dash.attOutOfStock", count: out0, to: "/inventory",
  });
  if (low0) out.push({
    id: "lowstock", severity: "warning", icon: "fa-triangle-exclamation",
    key: "dash.attLowStock", count: low0, to: "/inventory",
  });

  /* ── Tugash arafasidagi tovarlar (V74) ────────────────────────────
     ⚠ Bu «kam qoldi» dan BOSHQA narsa. «Kam qoldi» — qoldiq eng kam
     chegaradan past; bu esa SOTUV SUR'ATIGA qarab hisoblangan: kuniga
     ikkita sotiladigan tovarning oltitasi uch kunga yetadi, eng kam
     chegara esa bundan bexabar. Ro'yxat kuniga yo'qoladigan tushum
     bo'yicha tartiblangan — server tomonda. */
  const so = pulse?.stockouts || [];
  const urgent = so.filter((s) => n(s.daysLeft) <= T.stockoutCritical);
  const soon = so.filter((s) => n(s.daysLeft) > T.stockoutCritical
                             && n(s.daysLeft) <= T.stockoutWarn);
  if (urgent.length) out.push({
    id: "stockout-now", severity: "critical", icon: "fa-hourglass-end",
    key: "dash.alertStockoutNow", args: { n: urgent.length, d: T.stockoutCritical },
    money: urgent.reduce((a, s) => a + n(s.lostPerDay), 0), to: "/inventory",
  });
  if (soon.length) out.push({
    id: "stockout-soon", severity: "warning", icon: "fa-hourglass-half",
    key: "dash.alertStockoutSoon", args: { n: soon.length, d: T.stockoutWarn },
    money: soon.reduce((a, s) => a + n(s.lostPerDay), 0), to: "/inventory",
  });

  /* ── NARXI ESKIRGAN TOVARLAR (V99) ────────────────────────────────
     Kirim tan narxni sotuv yoki optom narxdan yuqoriga chiqarganda
     paydo bo'ladi. Kirim paytidagi tavsiya BIR MARTALIK: oyna
     yopilsa yo'qoladi va ertaga do'kon egasi «qaysi tovarni
     tuzatishim kerak edi?» degan savolga javob topa olmasdi.

     ⚠ MANZIL FILTR BILAN. Filtrsiz manzil egasini yuzta tovar
     orasiga tashlab ketardi va u kerakli qatorni qo'lda qidirishga
     majbur bo'lardi — signalning butun foydasi shunda yo'qolardi. */
  if (n(sig.pricedBelowCost) > 0) out.push({
    id: "below-cost", severity: "critical", icon: "fa-arrow-trend-down",
    key: "dash.sigBelowCost", count: n(sig.pricedBelowCost), to: "/products?below=1",
  });

  /* ── Smena va ko'chirish ──────────────────────────────────────── */
  if (n(sig.staleOpenShifts) > 0) out.push({
    id: "stale", severity: "warning", icon: "fa-clock",
    key: "dash.sigStaleShift", count: n(sig.staleOpenShifts), to: "/security?tab=shifts",
  });
  if (n(sig.staleTransfers) > 0) out.push({
    id: "transit", severity: "warning", icon: "fa-truck-fast",
    key: "dash.sigStaleTransfer", count: n(sig.staleTransfers), to: "/transfers",
  });

  /* ── Filial salomatligi (V74) ─────────────────────────────────── */
  const sick = (pulse?.branches || []).filter((b) => n(b.health) < T.healthBad);
  if (sick.length) out.push({
    id: "branch-health", severity: "warning", icon: "fa-store",
    key: "dash.alertBranchHealth", args: { n: sick.length, name: sick[0].name },
    to: "/branches",
  });

  /* ── Marja (V74) ──────────────────────────────────────────────────
     ⚠ Faqat savdo BOR kunda. Savdosiz kunda marja nolga teng va bu
     «marja tushdi» degani emas — savdo yo'qligi allaqachon pastda
     alohida satr bo'lib turadi. */
  const today = pulse?.today;
  if (today && n(today.netSales) > 0 && n(today.margin) < T.marginLow) {
    out.push({
      id: "margin", severity: "warning", icon: "fa-percent",
      key: "dash.alertLowMargin", args: { v: n(today.margin) }, to: "/reports?tab=profit",
    });
  }

  /* ── Qaytarishlar (V74) ───────────────────────────────────────── */
  if (today && n(today.netSales) > 0) {
    const share = (n(today.returnAmount) / Math.max(1, n(today.netSales))) * 100;
    if (share > T.returnShare) out.push({
      id: "returns", severity: "warning", icon: "fa-rotate-left",
      key: "dash.alertReturns", args: { n: n(today.returns), v: Math.round(share) },
      money: n(today.returnAmount), to: "/sales",
    });
  }

  /* ── Jimlik (V74) ─────────────────────────────────────────────────
     ⚠ Faqat savdo BOSHLANGAN bo'lsa. Do'kon hali ochilmagan bo'lsa
     «bir soatdan beri sotuv yo'q» degan xabar har kuni ertalab yonardi
     va hech qanday ma'no anglatmasdi. */
  const since = pulse?.velocity?.sinceLastSaleMin;
  if (since != null && since >= T.quietMinutes) out.push({
    id: "quiet", severity: "warning", icon: "fa-volume-xmark",
    key: "dash.alertQuiet", args: { n: since }, to: "/sale",
  });

  /* ── Ta'minotchi va nasiya ────────────────────────────────────── */
  if (rows(sig.supplierDebt)) out.push({
    id: "supplier", severity: "warning", icon: "fa-truck",
    key: "dash.sigSupplierDebt", args: { n: sig.supplierDebt.count },
    money: n(sig.supplierDebt.amount), to: "/supply",
  });
  if (rows(sig.customerDebt)) out.push({
    id: "credit", severity: "info", icon: "fa-hand-holding-dollar",
    key: "dash.sigCustomerDebt", args: { n: sig.customerDebt.count },
    money: n(sig.customerDebt.amount), to: "/customers",
  });

  /* ── Vazifalar (V72) ──────────────────────────────────────────────
     ⚠ KECHIKKAN vazifa — sariq, oddiy ochiq vazifa esa UMUMAN
     ogohlantirish emas. Har ochiq vazifa uchun satr chiqarilsa, blok
     ish rejasiga aylanardi va haqiqiy muammolar orasida yo'qolardi. */
  /* ⚠ `plan` ALOHIDA argument, `pulse` ning ichidan olinmaydi.
     Rahbarda u puls javobidan keladi (qo'shimcha so'rovsiz), pul
     ko'rmaydigan rolda esa alohida so'rovdan — chunki unga puls
     umuman yuborilmaydi. Ikkalasi bir manbadan o'qilganda omborchi
     o'ziga berilgan kechikkan vazifani hech qachon ko'rmasdi. */
  const tk = plan?.tasks;
  if (n(tk?.overdue) > 0) out.push({
    id: "task-overdue", severity: "warning", icon: "fa-list-check",
    key: "dash.alertTaskOverdue", count: n(tk.overdue), to: "/planner",
  });
  if (n(tk?.dueToday) > 0) out.push({
    id: "task-today", severity: "info", icon: "fa-list-check",
    key: "dash.alertTaskToday", count: n(tk.dueToday), to: "/planner",
  });

  /* ── Kalendar (V72) ───────────────────────────────────────────────
     ⚠ Faqat BUGUN boshlanadigan yoki juda yaqin voqealar. «Ikki
     haftadan keyin bayram» degan satr ogohlantirish emas — u
     kalendarning o'z ishi. */
  const near = (plan?.events || []).filter((e) => {
    const d = n(e.daysAway);
    /* Har voqeaning O'Z eslatish oynasi bor: ijara to'lovi besh kun
       oldin kerak, bayram esa faqat o'sha kuni. */
    const win = Math.max(T.eventSoon, n(e.remindDays));
    return e.active || (d >= 0 && d <= win);
  });
  if (near.length) out.push({
    id: "event-soon", severity: "info", icon: "fa-calendar-day",
    key: near[0].active ? "dash.alertEventToday" : "dash.alertEventSoon",
    args: { name: near[0].title, n: n(near[0].daysAway) },
    count: near.length > 1 ? near.length : null, to: "/planner",
  });

  /* ── Reja sur'ati (V74) ───────────────────────────────────────── */
  const tg = pulse?.target;
  if (tg && n(tg.monthly) > 0 && n(tg.pace) - n(tg.progress) > T.paceBehind) {
    out.push({
      id: "pace", severity: "info", icon: "fa-flag-checkered",
      key: "dash.alertPace", args: { v: Math.round(n(tg.pace) - n(tg.progress)) },
      to: "/reports?tab=home",
    });
  }

  if (hasSales === false) out.push({
    id: "nosale", severity: "info", icon: "fa-cash-register",
    key: "dash.noSales", to: "/sale",
  });

  return sortAlerts(out);
}

/** Ogohlantirishlar ichidagi jami «xavf ostidagi pul». */
export function moneyAtRisk(alerts = []) {
  return alerts
    .filter((a) => a.severity === "critical")
    .reduce((a, x) => a + n(x.money), 0);
}

/** Muhimlik bo'yicha sanoq — `{ critical, warning, info }`. */
export function countBySeverity(alerts = []) {
  const c = { critical: 0, warning: 0, info: 0 };
  for (const a of alerts) if (c[a.severity] != null) c[a.severity]++;
  return c;
}

/* ══════════════════════════════════════════════════════════════════════
   2. «NIMA O'ZGARDI?»
   ══════════════════════════════════════════════════════════════════════ */

/** Foizdagi o'zgarish. Baza nol bo'lsa — `null` (cheksizlikni ko'rsatmaymiz). */
export function pctChange(now, prev) {
  const a = n(now), b = n(prev);
  if (b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

/* Qaysi ko'rsatkich kuzatiladi va o'sishi YAXSHIMI.
   ⚠ `good` maydoni SHART: qaytarishning 40% o'sishi ham, tushumning
   40% o'sishi ham bir xil «+40%» bo'lib ko'rinadi, lekin biri falokat,
   ikkinchisi bayram. Rangni shu maydon hal qiladi. */
const METRICS = [
  { key: "netSales",   good: "up",   pick: (k) => k.netSales },
  { key: "receipts",   good: "up",   pick: (k) => k.receipts },
  { key: "avgReceipt", good: "up",   pick: (k) => k.avgReceipt },
  { key: "margin",     good: "up",   pick: (k) => k.margin, absolute: true },
  { key: "returns",    good: "down", pick: (k) => k.returns },
  { key: "discount",   good: "down", pick: (k) => k.discount },
  { key: "cancelled",  good: "down", pick: (k) => k.cancelledAmount },
];

/**
 * Ikki davrni taqqoslab, ENG SEZILARLI o'zgarishlarni qaytaradi.
 *
 * ⚠ ROSTDAN HAM O'ZGARGANLARI. Chegara ikki tomonlama: farq
 * `T.changeMin` foizdan katta bo'lishi VA baza nolga teng bo'lmasligi
 * kerak. Aks holda «qaytarish 0 dan 1 ga chiqdi = +∞%» degan satr har
 * kuni ro'yxatning boshida turardi.
 *
 * ⚠ Marja FOIZ, shuning uchun u foizning foizi bilan emas, PUNKT
 * farqi bilan o'lchanadi: 20% dan 22% ga chiqqani «+10%» emas,
 * «+2 punkt».
 */
export function changes(now, prev, limit = 3) {
  if (!now || !prev) return [];
  const out = [];
  for (const m of METRICS) {
    const a = n(m.pick(now)), b = n(m.pick(prev));
    if (a === b) continue;

    if (m.absolute) {
      const diff = a - b;
      if (Math.abs(diff) < 1) continue;
      out.push({ key: m.key, diff, pct: null, now: a, prev: b,
                 dir: diff > 0 ? "up" : "down",
                 tone: (diff > 0) === (m.good === "up") ? "good" : "bad",
                 weight: Math.abs(diff) });
      continue;
    }

    const p = pctChange(a, b);
    if (p == null || Math.abs(p) < T.changeMin) continue;
    out.push({ key: m.key, pct: p, diff: a - b, now: a, prev: b,
               dir: p > 0 ? "up" : "down",
               tone: (p > 0) === (m.good === "up") ? "good" : "bad",
               weight: Math.abs(p) });
  }
  out.sort((x, y) => y.weight - x.weight);
  return out.slice(0, limit);
}

/* ══════════════════════════════════════════════════════════════════════
   3. IMKONIYATLAR
   ══════════════════════════════════════════════════════════════════════ */

/**
 * «Nima qilsa bo'ladi» — ma'lumotdan chiqadigan taklif.
 *
 * ⚠ HAR BIR TAKLIF SONGA TAYANADI va son taklif matnida ko'rinadi.
 * «Savdoni oshiring» degan maslahat hech kimga kerak emas; «Choy
 * sotilganda 68% holatda shakar ham olinadi» esa ertaga qo'llansa
 * bo'ladigan gap.
 */
export function opportunities({ analytics = null, pulse = null } = {}, limit = 4) {
  const out = [];

  /* Birga sotiladiganlar — eng ishonchli juftlik. */
  const pair = (analytics?.basket || [])[0];
  if (pair && n(pair.confidence) >= 40) {
    out.push({ id: "basket", icon: "fa-layer-group", key: "dash.oppBasket",
               args: { a: pair.nameA, b: pair.nameB, v: Math.round(n(pair.confidence)) },
               to: "/reports?tab=products" });
  }

  /* Omborda qotib qolgan pul. */
  const slow = (analytics?.stock?.slowMoving || [])[0];
  if (slow && n(slow.stockValue) > 0) {
    out.push({ id: "slow", icon: "fa-box", key: "dash.oppSlow",
               args: { name: slow.name }, money: n(slow.stockValue),
               to: "/inventory" });
  }

  /* Tugab qolayotgan, lekin yaxshi sotiladigan tovar. */
  const so = (pulse?.stockouts || [])[0];
  if (so && n(so.lostPerDay) > 0) {
    out.push({ id: "reorder", icon: "fa-cart-plus", key: "dash.oppReorder",
               args: { name: so.name, d: n(so.daysLeft) }, money: n(so.lostPerDay),
               to: "/supply" });
  }

  /* Eng gavjum soat — xodim shu yerda kerak. */
  const hours = analytics?.hourly || [];
  if (hours.length) {
    const best = hours.reduce((a, b) => (n(b.netSales) > n(a.netSales) ? b : a));
    if (n(best.netSales) > 0) {
      out.push({ id: "peak", icon: "fa-user-clock", key: "dash.oppPeak",
                 args: { h: best.hour }, to: "/reports?tab=time" });
    }
  }

  /* Yo'qotilayotgan mijozlar. */
  const risk = n(analytics?.customers?.segments?.AT_RISK);
  if (risk > 0) {
    out.push({ id: "atrisk", icon: "fa-user-clock", key: "dash.oppAtRisk",
               args: { n: risk }, to: "/customers" });
  }

  return out.slice(0, limit);
}

/* ══════════════════════════════════════════════════════════════════════
   4. FILIAL SALOMATLIGI
   ══════════════════════════════════════════════════════════════════════ */

/** Ball → rang toifasi. Chegaralar bitta joyda. */
export function healthTone(score) {
  const s = n(score);
  if (s >= 80) return "good";
  if (s >= T.healthBad) return "warn";
  return "bad";
}

/* ══════════════════════════════════════════════════════════════════════
   5. VIDJETLAR — ko'rinishi, tartibi, rol
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Bosh sahifadagi bloklar ro'yxati.
 *
 * ⚠ `money: true` — blok PUL ko'rsatadi. Bunday bloklar faqat egasi va
 * do'kon administratoriga ochiq; serverda ham shunday (`/reports/**`).
 * Ro'yxatni ikki joyda saqlamaslik uchun ekran shu bayroqqa qaraydi:
 * omborchiga pul so'rovi umuman YUBORILMAYDI, 403 ni yutib yuborish
 * emas.
 */
/* ⚠ RO'YXATNING TARTIBI — EKRANNING TARTIBI. Yuqorida javob berish
   kerak bo'lgan savol turadi («ishlar qanday?», «nima yomon?»), pastda
   esa chuqurlashtiradigan kesimlar. */
export const WIDGETS = [
  { id: "kpi",       money: true,  key: "dash.wKpi" },
  { id: "alerts",    money: false, key: "dash.wAlerts" },
  { id: "pulse",     money: true,  key: "dash.wPulse" },
  { id: "target",    money: true,  key: "dash.wTarget" },
  { id: "changes",   money: true,  key: "dash.wChanges" },
  { id: "plan",      money: false, key: "dash.wPlan" },
  { id: "live",      money: true,  key: "dash.wLive" },
  { id: "registers", money: true,  key: "dash.wRegisters" },
  { id: "branches",  money: true,  key: "dash.wBranches" },
  { id: "products",  money: true,  key: "dash.wProducts" },
  { id: "stock",     money: false, key: "dash.wStock" },
  { id: "payments",  money: true,  key: "dash.wPayments" },
  { id: "staff",     money: true,  key: "dash.wStaff" },
  { id: "people",    money: true,  key: "dash.wPeople" },
  { id: "opps",      money: true,  key: "dash.wOpps" },
  { id: "actions",   money: false, key: "dash.wActions" },
];

/** Rolga ruxsat etilgan bloklar — pul ko'rsatadiganlari faqat rahbarga. */
export function allowedWidgets(canMoney) {
  return WIDGETS.filter((w) => canMoney || !w.money);
}

const LS_KEY = "ek.dash.layout.v1";

/**
 * Saqlangan tartib va ko'rinishni o'qiydi.
 *
 * ⚠ SAQLANGAN RO'YXAT HAQIQAT MANBAYI EMAS. Yangi versiyada blok
 * qo'shilsa, u eski ro'yxatda yo'q — shu sababli natija HAR DOIM
 * ruxsat etilganlar ro'yxatidan quriladi va saqlangan holat unga
 * faqat TARTIB va YASHIRISH sifatida qo'llanadi. Aks holda yangi blok
 * eski foydalanuvchida hech qachon ko'rinmasdi.
 */
export function readLayout(canMoney, raw) {
  const all = allowedWidgets(canMoney);
  let saved = null;
  try {
    saved = raw !== undefined ? raw
          : JSON.parse(localStorage.getItem(LS_KEY) || "null");
  } catch { saved = null; }

  const order = Array.isArray(saved?.order) ? saved.order : [];
  const hidden = new Set(Array.isArray(saved?.hidden) ? saved.hidden : []);

  const rank = new Map(order.map((id, i) => [id, i]));
  return all
    .map((w) => ({ ...w, on: !hidden.has(w.id) }))
    .sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
}

export function saveLayout(list) {
  const data = {
    order: list.map((w) => w.id),
    hidden: list.filter((w) => !w.on).map((w) => w.id),
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* xotira to'la */ }
  return data;
}

/** Blokni ro'yxatda bir pog'ona suradi. Chetdan chiqmaydi. */
export function move(list, id, dir) {
  const i = list.findIndex((w) => w.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function toggle(list, id) {
  return list.map((w) => (w.id === id ? { ...w, on: !w.on } : w));
}

/* ══════════════════════════════════════════════════════════════════════
   6. EGRI CHIZIQNI TAQQOSLASH
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Bugungi va taqqoslanadigan egri chiziqni BITTA grafikka tayyorlaydi.
 *
 * ⚠ Bugungi chiziq joriy soatda TUGAYDI, taqqoslanadigani esa 24
 * soatgacha davom etadi. Ikkalasini bir xil uzunlikka keltirish
 * («qolgan soatlarga nol qo'yish») bugungi chiziqni pastga qulatardi
 * va «savdo yiqildi» degan yolg'on rasm chizardi. Shuning uchun
 * yetishmagan nuqtalar `null` bo'lib qoladi — chiziq shunchaki
 * to'xtaydi.
 */
export function comparePoints(todayCurve = [], refCurve = []) {
  const byHour = new Map(refCurve.map((p) => [p.hour, n(p.netSales)]));
  const last = todayCurve.length ? todayCurve[todayCurve.length - 1].hour : -1;

  return Array.from({ length: 24 }, (_, h) => {
    const t = todayCurve.find((p) => p.hour === h);
    return {
      label: String(h).padStart(2, "0"),
      today: h <= last && t ? n(t.netSales) : null,
      ref: byHour.has(h) ? byHour.get(h) : null,
    };
  });
}
