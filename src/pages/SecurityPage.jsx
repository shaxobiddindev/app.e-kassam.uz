/* ══════════════════════════════════════════════════════════════════════════
   Xavfsizlik — bajiklar, tasdiqlar jurnali, siyosat, smenalar, obuna

   ⚠ BAJIK BO'LIMI FAQAT DO'KON EGASIGA ko'rinadi. Bu shunchaki UI qulayligi
   emas, talabning o'zi: bajikni xodim ilovadan ko'ra olmasligi kerak, aks
   holda uni ekrandan suratga olish nusxa yasashning eng oson yo'li bo'lardi.
   Server ham shu cheklovni qo'yadi (`/security/badges/**` → ROLE_OWNER) —
   bu yerdagi tekshiruv faqat ortiqcha tugmalarni yashiradi.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { securityApi } from "../api";
import { Modal } from "../components";
import { Empty } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useConfirm } from "../context/ConfirmProvider";
import { useBadge } from "../context/BadgeProvider";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { roleSet } from "../lib/ek-roles";
import { printBadge } from "../lib/ek-hardware";
import { isDesktop } from "../lib/ek-desktop";
import { useSuspiciousCount } from "../hooks/useSuspiciousCount";

const TABS = ["badges", "log", "policies", "shifts", "billing"];

/** Xodim faqat jurnal va smenalarni ko'radi — bajik, siyosat va obuna egasiniki. */
const visibleTabsFor = (isOwner) => TABS.filter((x) => isOwner || x === "log" || x === "shifts");

const ACTION_BADGE = {
  SALE_CANCEL:       "badge-red",
  INVENTORY_CORRECT: "badge-yellow",
  CART_ITEM_REMOVE:  "badge-yellow",
  DRAWER_OPEN:       "badge-green",
  STAFF_MANAGE:      "badge-red",
  PRICE_CHANGE:      "badge-yellow",
};

export default function SecurityPage({ toast }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { guard } = useBadge();
  const isOwner = roleSet(user?.role).has("OWNER");

  // «Jurnal» tabidagi belgi — yon menyudagi bilan ayni manba.
  const { count: suspicious, refresh: refreshSuspicious } = useSuspiciousCount(user);

  /* Bo'lim manzilda ham turadi: bosh sahifadagi «yopilmagan smena» satri
     shu yerga `?tab=shifts` bilan olib keladi. Ko'rinmaydigan bo'lim
     so'ralsa e'tiborsiz qoldiriladi — manzil orqali bajik ro'yxatini
     ochib bo'lmaydi. */
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const q = params.get("tab");
    return visibleTabsFor(isOwner).includes(q) ? q : (isOwner ? "badges" : "log");
  });

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [tab]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);

  const [badges, setBadges] = useState([]);
  const [log, setLog] = useState([]);
  const [onlySuspicious, setOnlySuspicious] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [billing, setBilling] = useState(null);
  const [issued, setIssued] = useState(null);   // {fullName, username, version, token}
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "badges" && isOwner) {
        // Ro'yxat TO'LIQ /security/badges dan: shopApi.getUsers joriy
        // foydalanuvchini chiqarib tashlaydi, ega esa O'ZIGA ham bajik
        // chiqarishi kerak (MANAGER tasdiqlarda ega bajigi skanerlanadi).
        setBadges((await securityApi.badges()).data || []);
      } else if (tab === "log") {
        setLog((await securityApi.log(onlySuspicious)).data || []);
      } else if (tab === "policies" && isOwner) {
        setPolicies((await securityApi.policies()).data || []);
      } else if (tab === "shifts") {
        setShifts((await securityApi.openShifts()).data || []);
      } else if (tab === "billing" && isOwner) {
        setBilling((await securityApi.billing()).data || null);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, onlySuspicious, isOwner]);

  useEffect(() => { load(); }, [load]);

  /* ── Bajik chiqarish ── */
  const handleIssue = async (u) => {
    if (u.hasBadge) {
      const ok = await confirm({
        title: t("badge.reissueTitle"),
        message: t("badge.reissueMsg"),
        type: "warning",
      });
      if (!ok) return;
    }
    setWorking(true);
    try {
      const res = await securityApi.issueBadge(u.userId);
      // Sir faqat SHU ONDA keladi — darhol chop etish oynasini ochamiz.
      setIssued(res.data);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const handlePrint = async () => {
    try {
      await printBadge({ ...issued, shopName: user?.shopName });
      toast.success(t("badge.printed"));
      setIssued(null);      // sir holatdan darhol o'chadi
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRevoke = async (u) => {
    const ok = await confirm({
      title: t("badge.revokeTitle"),
      message: t("badge.revokeMsg"),
      type: "danger",
    });
    if (!ok) return;
    try {
      await securityApi.revokeBadge(u.userId);
      toast.success(t("badge.revoked"));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAck = async (id) => {
    try {
      await securityApi.acknowledge(id);
      load();
      // Belgi DARHOL kamaysin: sahifadan chiqib-kirishni kutmasdan.
      refreshSuspicious();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handlePolicy = async (action, patch) => {
    try {
      await securityApi.setPolicy(action, patch);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const fmt = (iso) => {
    if (!iso) return "-";
    try { return new Date(iso).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }); }
    catch (_) { return iso; }
  };

  const visibleTabs = visibleTabsFor(isOwner);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t("sec.title")}</h2>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{t("sec.subtitle")}</p>
      </div>

      <div className="card">
        {/* ⚠ `justifyContent` ATAYLAB berilgan: `.card-header` standarti —
            `space-between` (sarlavha chapda, tugma o'ngda). Bu yerda esa
            beshta tab bor va ular butun kenglikka yoyilib, bir-biriga
            aloqasiz tugmalarga o'xshab qolardi. */}
        <div className="card-header" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-start" }}>
          {visibleTabs.map((x) => (
            <button key={x}
                    className={`btn btn-sm ${tab === x ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setTab(x)}>
              {t(`sec.tab.${x}`)}
              {/* ⚠ Yon menyudagi bilan AYNI son. Usiz egasi menyudagi qizil
                  raqamni ko'rib sahifaga kirardi-yu, keyin uchta tab
                  orasidan qay birida ekanini qidirishga majbur bo'lardi. */}
              {x === "log" && suspicious > 0 && (
                <span className="badge badge-red tab-badge">{suspicious}</span>
              )}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          {busy ? <SkeletonTable rows={6} cols={["wide", "text", "text", "text"]} /> : (
            <>
              {/* ══ BAJIKLAR ══ */}
              {tab === "badges" && isOwner && (
                badges.length === 0 ? <Empty text={t("staff.empty")} /> : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("staff.name")}</th>
                        <th>{t("staff.role")}</th>
                        <th>{t("badge.status")}</th>
                        <th>{t("badge.issuedAt")}</th>
                        <th className="text-end">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {badges.map((b) => (
                        <tr key={b.userId}>
                          <td className="fw-700">{b.fullName || b.username}</td>
                          {/* Xom enum ("STOREKEEPER") emas — lug'atdagi nomi */}
                          <td>{t(`enum.role.${b.role}`)}</td>
                          <td>
                            <span className={`badge ${b.hasBadge ? "badge-green" : "badge-red"}`}>
                              {b.hasBadge ? `v${b.version}` : t("badge.none")}
                            </span>
                          </td>
                          <td>{fmt(b.issuedAt)}</td>
                          <td className="text-end">
                            <button className="btn btn-primary btn-sm" disabled={working}
                                    onClick={() => handleIssue(b)}>
                              {working ? <Spinner /> : <i className="fa-solid fa-qrcode" />}{" "}
                              {b.hasBadge ? t("badge.reissue") : t("badge.issue")}
                            </button>{" "}
                            {b.hasBadge && (
                              <button className="btn btn-outline btn-sm" onClick={() => handleRevoke(b)}>
                                <i className="fa-solid fa-ban" /> {t("badge.revokeAction")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* ══ JURNAL ══ */}
              {tab === "log" && (
                <>
                  <div style={{ padding: "10px 16px" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={onlySuspicious}
                             onChange={(e) => setOnlySuspicious(e.target.checked)} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{t("sec.onlySuspicious")}</span>
                    </label>
                  </div>
                  {log.length === 0 ? <Empty text={t("sec.logEmpty")} /> : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("inv.histWhen")}</th>
                          <th>{t("sec.action")}</th>
                          <th>{t("sec.badgeUser")}</th>
                          <th>{t("sec.sessionUser")}</th>
                          <th>{t("sec.detail")}</th>
                          <th className="text-end">{t("common.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.map((c) => (
                          <tr key={c.id} style={c.suspicious && !c.acknowledgedAt
                            ? { background: "rgba(239,68,68,0.07)" } : undefined}>
                            <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmt(c.createdAt)}</td>
                            <td>
                              <span className={`badge ${ACTION_BADGE[c.action] || "badge-green"}`}>
                                {t(`act.${c.action}`)}
                              </span>
                            </td>
                            <td>
                              {c.badgeUserName}
                              {c.badgeVersion ? <span className="text-muted"> v{c.badgeVersion}</span> : null}
                            </td>
                            <td className={c.badgeUserName !== c.sessionUserName ? "fw-700" : ""}>
                              {c.sessionUserName}
                            </td>
                            <td style={{ maxWidth: 300 }}>
                              {c.suspicious && (
                                <div style={{ color: "var(--red, #dc2626)", fontWeight: 700, fontSize: 12.5 }}>
                                  <i className="fa-solid fa-triangle-exclamation" /> {c.suspicionReason}
                                </div>
                              )}
                              <div className="text-muted" style={{ fontSize: 12.5 }}>{c.note || "-"}</div>
                            </td>
                            <td className="text-end">
                              {c.suspicious && !c.acknowledgedAt && (
                                <button className="btn btn-outline btn-sm" onClick={() => handleAck(c.id)}>
                                  <i className="fa-solid fa-eye" /> {t("sec.ack")}
                                </button>
                              )}
                              {c.acknowledgedAt && (
                                <span className="text-muted" style={{ fontSize: 12 }}>{t("sec.acked")}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {/* ══ SIYOSAT ══ */}
              {tab === "policies" && isOwner && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("sec.action")}</th>
                      <th>{t("sec.whoConfirms")}</th>
                      <th>{t("sec.enabled")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((p) => (
                      <tr key={p.action}>
                        <td className="fw-700">{t(`act.${p.action}`)}</td>
                        <td>
                          <select className="form-input" style={{ maxWidth: 220 }}
                                  value={p.policy}
                                  onChange={(e) => handlePolicy(p.action, { policy: e.target.value })}>
                            <option value="SELF">{t("sec.policy.SELF")}</option>
                            <option value="MANAGER">{t("sec.policy.MANAGER")}</option>
                          </select>
                        </td>
                        <td>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <input type="checkbox" checked={p.enabled}
                                   onChange={(e) => handlePolicy(p.action, { enabled: e.target.checked })} />
                            <span className="text-muted" style={{ fontSize: 12.5 }}>
                              {p.enabled ? t("sec.guarded") : t("sec.notGuarded")}
                            </span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ══ SMENALAR ══ */}
              {tab === "shifts" && (
                shifts.length === 0 ? <Empty text={t("sec.noOpenShifts")} /> : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("staff.name")}</th>
                        <th>{t("sec.openedAt")}</th>
                        <th>{t("sec.terminal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map((s) => (
                        <tr key={s.id}>
                          <td className="fw-700">{s.fullName}</td>
                          <td>{fmt(s.openedAt)}</td>
                          <td className="mono text-muted" style={{ fontSize: 12 }}>{s.openedDeviceId || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* ══ OBUNA ══ */}
              {tab === "billing" && isOwner && billing && (
                <div style={{ padding: 18, display: "grid", gap: 14 }}>
                  <BillingRow label={t("bill.plan")} value={billing.plan || "—"} strong />
                  <BillingRow label={t("bill.expires")}
                              value={billing.planExpiresAt ? fmt(billing.planExpiresAt) : "—"} />
                  <BillingRow label={t("bill.daysLeft")}
                              value={billing.daysLeft == null ? "—" : `${billing.daysLeft}`}
                              danger={billing.expiringSoon} />
                  <BillingRow label={t("bill.staff")}
                              value={`${billing.staffUsed} / ${billing.staffLimit < 0 ? "∞" : billing.staffLimit}`} />
                  <BillingRow label={t("bill.branches")}
                              value={`${billing.branchesUsed} / ${billing.branchesLimit < 0 ? "∞" : billing.branchesLimit}`} />
                  {billing.expiringSoon && (
                    <div style={{
                      background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10,
                      padding: "10px 14px", fontSize: 13, color: "#92400e", lineHeight: 1.5,
                    }}>
                      ⚠️ {t("bill.warn")}
                    </div>
                  )}
                  <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                    {t("bill.howToPay")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ Chiqarilgan bajik — sir FAQAT SHU YERDA va FAQAT CHOP ETISH uchun ══ */}
      {issued && (
        <Modal
          title={t("badge.readyTitle")}
          onClose={() => setIssued(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setIssued(null)}>
                {t("common.close")}
              </button>
              <button className="btn btn-green btn-sm" onClick={handlePrint} disabled={!isDesktop()}>
                <i className="fa-solid fa-print" /> {t("badge.print")}
              </button>
            </>
          }
        >
          <div style={{
            background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10,
            padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#92400e", lineHeight: 1.55,
          }}>
            ⚠️ {t("badge.onceWarn")}
          </div>

          <div style={{ textAlign: "center", padding: "6px 0 10px" }}>
            <div className="fw-800" style={{ fontSize: 17 }}>{issued.fullName || issued.username}</div>
            <div className="text-muted" style={{ fontSize: 13 }}>
              @{issued.username} · {t("badge.version")} {issued.version}
            </div>
          </div>

          {!isDesktop() && (
            <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              {t("badge.desktopOnly")}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

function BillingRow({ label, value, strong, danger }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 16px", background: "var(--bg)", borderRadius: 10,
    }}>
      <span className="text-muted" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span className={strong ? "fw-800" : "fw-700"}
            style={{ fontSize: strong ? 16 : 14, color: danger ? "var(--red, #dc2626)" : undefined }}>
        {value}
      </span>
    </div>
  );
}
