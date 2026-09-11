import { useState, useEffect, useCallback } from "react";
import { t } from "../lib/ek-i18n";
import { shopApi, cashRegisterApi } from "../api";
import { getDeviceId } from "../config";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   FISKAL REKVIZITLAR VA KASSALAR (V81) — do'kon egasi uchun

   ⚠ NEGA `FiscalPanel` DAN ALOHIDA. U — HOLAT paneli: navbatda nechta
   chek turibdi, qaysi biri o'tmadi. Bu esa SOZLASH: chek kimning
   nomidan va qaysi kassadan chiqishini belgilaydi. Ularni bitta
   kartaga tiqish egani «nega bu yerda xatolar ro'yxati bor?» degan
   savolga olib kelardi.

   ⚠ PANEL FAQAT FISKAL YO'LGA KIRGAN DO'KONGA CHIZILADI
   (`SettingsPage` dagi shart). Fiskalizatsiyani xohlamagan do'kon
   uchun bu bo'lim umuman mavjud emas — bir piksel ham qo'shilmaydi.

   ⚠ YOQISH TUGMASI BU YERDA YO'Q va bo'lmaydi ham. Fiskal rejimni
   faqat superadmin yoqadi (`SecurityConfig`): rekvizitsiz yoqilgan
   do'konning kassasi to'xtaydi va bu tugmani do'kon egasiga berish —
   unga o'z kassasini bilmasdan o'chirish imkonini berish demakdir.
   Bu yerda holat faqat KO'RSATILADI.
   ══════════════════════════════════════════════════════════════════════════ */

const EMPTY_REGISTER = {
  name: "", virtualCashRegisterSerial: "", fiscalModuleNumber: "", terminalId: "",
};

export default function FiscalSetupPanel({ profile, toast, onSaved }) {
  /* ── Rekvizitlar ──────────────────────────────────────────────── */
  const [tin, setTin] = useState("");
  const [tinType, setTinType] = useState("LEGAL");
  const [address, setAddress] = useState("");
  const [agentTin, setAgentTin] = useState("");
  const [saving, setSaving] = useState(false);
  /* Zanjir buzilganda sotuv to'xtasinmi (V85). Standart — yo'q. */
  const [chainBlock, setChainBlock] = useState(false);

  /* ── Kassalar ─────────────────────────────────────────────────── */
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(null);      // null — forma yopiq
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setTin(profile?.tin || "");
    /* ⚠ `tinType` bo'sh bo'lsa `LEGAL` — bu «tanlanmagan» emas,
       STANDART: do'konlarning aksariyati yuridik shaxs yoki YaTT va
       bo'sh tanlov bilan boshlash egani ortiqcha qarorga majbur
       qilardi. Saqlanmaguncha serverda hech narsa o'zgarmaydi. */
    setTinType(profile?.tinType || "LEGAL");
    setAddress(profile?.fiscalAddress || "");
    setAgentTin(profile?.commissionAgentTin || "");
    setChainBlock(Boolean(profile?.blockOnChainBreak));
  }, [profile]);

  const loadRegisters = useCallback(async () => {
    setLoading(true);
    try {
      const r = await cashRegisterApi.list();
      /* ⚠ MASSIVLIGI TEKSHIRILADI, `|| []` YETARLI EMAS. `{}` ham,
         `null` ham «yolg'on» emas — ya'ni `|| []` ularni o'tkazib
         yuboradi va keyingi `.map` BUTUN SAHIFANI yiqitadi
         (ErrorBoundary). Eski server, xato javob shakli yoki
         proksining oraliq javobi — hammasi shu holatga olib keladi.
         Kassalar bo'limi ishlamasligi mumkin, lekin Sozlamalar
         sahifasi ochilishi SHART. */
      setRegisters(Array.isArray(r?.data) ? r.data : []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadRegisters(); }, [loadRegisters]);

  /* ⚠ Kalit DARHOL saqlanadi, «Saqlash» tugmasini kutmaydi: u
     rekvizit emas, ALOHIDA qaror va uni boshqa maydonlar bilan
     birga yuborish «manzilni tuzatdim, zanjir bloklashini ham
     yoqib yubordim» degan holatga olib kelardi. */
  const toggleChainBlock = async () => {
    const next = !chainBlock;
    try {
      await shopApi.setChainBlock(next);
      setChainBlock(next);
      toast.success(t("common.saved"));
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveRequisites = async () => {
    setSaving(true);
    try {
      await shopApi.setFiscalRequisites({
        tin, tinType, fiscalAddress: address, commissionAgentTin: agentTin,
      });
      toast.success(t("common.saved"));
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveRegister = async () => {
    if (!draft?.name?.trim()) { toast.error(t("fiscalSetup.nameRequired")); return; }
    setBusyId("draft");
    try {
      if (draft.id) await cashRegisterApi.update(draft.id, draft);
      else await cashRegisterApi.create(draft);
      toast.success(t("common.saved"));
      setDraft(null);
      loadRegisters();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (r) => {
    setBusyId(r.id);
    try {
      await cashRegisterApi.setStatus(r.id, r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      loadRegisters();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  /* ⚠ SHU QURILMANING IDENTIFIKATORI oldindan qo'yiladi. Uni qo'lda
     ko'chirish deyarli imkonsiz: `X-Device-Id` — uzun tasodifiy satr
     va u hech qayerda ekranda ko'rinmaydi. Egadan uni topib yozishni
     so'rash kassani sozlashning eng ko'p xato qilinadigan qadamiga
     aylanardi. */
  const thisDevice = getDeviceId();

  const ready = Boolean(tin && tinType && address);

  return (
    <div className="card set-card">
      <div className="card-header">
        <span className="card-title">
          <i className="fa-solid fa-building-columns" aria-hidden="true" />{" "}
          {t("fiscalSetup.title")}
        </span>
        <span className={`badge ${profile?.fiscalEnabled ? "badge-green" : "badge-gray"}`}>
          {profile?.fiscalEnabled ? t("fiscalSetup.on") : t("fiscalSetup.off")}
        </span>
      </div>

      <p className="set-card__hint">{t("fiscalSetup.hint")}</p>

      <div className="set-list">
        <div className="set-row">
          <div className="set-row__text">
            <div className="set-row__label">{t("fiscalSetup.tinType")}</div>
            <div className="set-row__hint">{t("fiscalSetup.tinTypeHint")}</div>
          </div>
          <div className="set-row__control">
            <select className="input" value={tinType} aria-label={t("fiscalSetup.tinType")}
                    onChange={(e) => setTinType(e.target.value)}>
              <option value="LEGAL">{t("fiscalSetup.legal")}</option>
              <option value="INDIVIDUAL">{t("fiscalSetup.individual")}</option>
            </select>
          </div>
        </div>

        <div className="set-row">
          <div className="set-row__text">
            <div className="set-row__label">
              {tinType === "LEGAL" ? t("fiscalSetup.tin") : t("fiscalSetup.pinfl")}
            </div>
            <div className="set-row__hint">
              {tinType === "LEGAL" ? t("fiscalSetup.tin9") : t("fiscalSetup.tin14")}
            </div>
          </div>
          <div className="set-row__control">
            <input className="input ek-num" inputMode="numeric" value={tin}
                   maxLength={tinType === "LEGAL" ? 9 : 14}
                   aria-label={t("fiscalSetup.tin")}
                   /* Faqat raqam: server ham tozalaydi, lekin maydonda
                      harf turishi egani «saqlanmadi» deb o'ylatardi. */
                   onChange={(e) => setTin(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        <div className="set-row">
          <div className="set-row__text">
            <div className="set-row__label">{t("fiscalSetup.address")}</div>
            <div className="set-row__hint">{t("fiscalSetup.addressHint")}</div>
          </div>
          <div className="set-row__control">
            <input className="input" value={address} aria-label={t("fiscalSetup.address")}
                   onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>

        <div className="set-row">
          <div className="set-row__text">
            <div className="set-row__label">{t("fiscalSetup.agentTin")}</div>
            <div className="set-row__hint">{t("fiscalSetup.agentTinHint")}</div>
          </div>
          <div className="set-row__control">
            <input className="input ek-num" inputMode="numeric" value={agentTin} maxLength={14}
                   aria-label={t("fiscalSetup.agentTin")}
                   onChange={(e) => setAgentTin(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        {/* ══ ZANJIR BUZILGANDA BLOKLASH (V85) ═══════════════════════
            ⚠ STANDART — O'CHIQ va bu ongli qaror. Zanjir uzilishi har
            doim ham yomon niyat emas: migratsiya, qo'lda tuzatish yoki
            qo'llab-quvvatlash ishi ham uni uzadi. Standart holatda
            do'kon OGOHLANTIRISH oladi va ishlayveradi.

            Yoqilsa — sotuv to'xtaydi. Shuning uchun izohda oqibat
            ochiq yozilgan: kalitni bosayotgan odam nima bo'lishini
            bilishi kerak. */}
        <div className="set-row">
          <div className="set-row__text">
            <div className="set-row__label">{t("fiscalSetup.chainBlock")}</div>
            <div className="set-row__hint">{t("fiscalSetup.chainBlockHint")}</div>
          </div>
          <div className="set-row__control">
            <button
              type="button"
              role="switch"
              aria-checked={chainBlock}
              className={`ek-switch ${chainBlock ? "on" : ""}`}
              onClick={toggleChainBlock}
            >
              <span className="ek-switch__knob" />
              <span className="ek-switch__text">
                {chainBlock ? t("common.yes") : t("common.no")}
              </span>
            </button>
          </div>
        </div>

        <div className="set-row">
          <div className="set-row__text">
            <div className="set-row__label">{t("common.save")}</div>
            {!ready && <div className="set-row__hint">{t("fiscalSetup.incomplete")}</div>}
          </div>
          <div className="set-row__control">
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={saveRequisites}>
              {saving ? <Spinner /> : <i className="fa-solid fa-floppy-disk" />} {t("common.save")}
            </button>
          </div>
        </div>
      </div>

      {/* ══ KASSALAR ══════════════════════════════════════════════════ */}
      <div className="card-header" style={{ marginTop: 6 }}>
        <span className="card-title">
          <i className="fa-solid fa-cash-register" aria-hidden="true" /> {t("fiscalSetup.registers")}
        </span>
        {!draft && (
          <button className="btn btn-outline btn-sm"
                  onClick={() => setDraft({ ...EMPTY_REGISTER, terminalId: thisDevice })}>
            <i className="fa-solid fa-plus" /> {t("common.add")}
          </button>
        )}
      </div>
      <p className="set-card__hint">{t("fiscalSetup.registersHint")}</p>

      <div style={{ padding: "0 14px 14px" }}>
        {draft && (
          <div className="ek-note" style={{ display: "block", marginBottom: 12 }}>
            <div className="form-row">
              <label>
                {t("fiscalSetup.regName")}
                <input className="input" value={draft.name} autoFocus
                       onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label>
                {t("fiscalSetup.serial")}
                <input className="input ek-num" value={draft.virtualCashRegisterSerial || ""}
                       onChange={(e) => setDraft({ ...draft, virtualCashRegisterSerial: e.target.value })} />
              </label>
              <label>
                {t("fiscalSetup.moduleNo")}
                <input className="input ek-num" value={draft.fiscalModuleNumber || ""}
                       onChange={(e) => setDraft({ ...draft, fiscalModuleNumber: e.target.value })} />
              </label>
              <label>
                {t("fiscalSetup.device")}
                <input className="input ek-num" value={draft.terminalId || ""}
                       onChange={(e) => setDraft({ ...draft, terminalId: e.target.value })} />
              </label>
            </div>
            <div className="form-hint" style={{ marginTop: 6 }}>{t("fiscalSetup.deviceHint")}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" disabled={busyId === "draft"}
                      onClick={saveRegister}>
                {busyId === "draft" ? <Spinner /> : <i className="fa-solid fa-floppy-disk" />}
                {t("common.save")}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setDraft(null)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {loading ? <Spinner />
          : registers.length === 0 ? (
            <div className="form-hint">{t("fiscalSetup.noRegisters")}</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("fiscalSetup.regName")}</th>
                    <th>{t("fiscalSetup.serial")}</th>
                    <th>{t("fiscalSetup.moduleNo")}</th>
                    <th>{t("fiscalSetup.device")}</th>
                    <th>{t("common.status")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {registers.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="ek-num">{r.virtualCashRegisterSerial || "—"}</td>
                      <td className="ek-num">{r.fiscalModuleNumber || "—"}</td>
                      <td className="ek-num" style={{ fontSize: 12 }}>{r.terminalId || "—"}</td>
                      <td>
                        {/* ⚠ Ikkita alohida belgi: «ishlayapti» va «fiskal
                            raqamlari to'liq». Ular bir xil emas va ularni
                            birlashtirish egani chalg'itardi: yoqilgan, lekin
                            raqamsiz kassadan chek chiqmaydi. */}
                        <span className={`badge ${r.status === "ACTIVE" ? "badge-green" : "badge-gray"}`}>
                          {r.status === "ACTIVE" ? t("fiscalSetup.active") : t("fiscalSetup.inactive")}
                        </span>
                        {!r.fiscalReady && (
                          <div className="form-hint" style={{ color: "var(--fg-warning)" }}>
                            {t("fiscalSetup.notReady")}
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setDraft({ ...r })}>
                          <i className="fa-solid fa-pen" />
                        </button>{" "}
                        <button className="btn btn-outline btn-sm" disabled={busyId === r.id}
                                onClick={() => toggle(r)}
                                title={r.status === "ACTIVE"
                                  ? t("fiscalSetup.inactive") : t("fiscalSetup.active")}>
                          {busyId === r.id ? <Spinner />
                            : <i className={`fa-solid ${r.status === "ACTIVE"
                                ? "fa-toggle-on" : "fa-toggle-off"}`} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
