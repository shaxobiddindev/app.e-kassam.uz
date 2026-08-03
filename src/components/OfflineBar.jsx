import { useT } from "../lib/ek-i18n";
import { useEffect, useState } from "react";
import * as queue from "../lib/ek-offline";
import { money, time } from "../lib/ek-format";

/**
 * Oflayn / sinxronizatsiya tasmasi.
 * 01-ARCHITECTURE.md: "UI'da doimiy indikator. Yashiringan holat bo'lmaydi."
 *
 * Uch holat:
 *   oflayn   → sariq   "Oflayn · 3 ta sotuv navbatda"
 *   yuborish → ko'k    "3 ta sotuv yuborilmoqda…"
 *   yuborildi→ yashil  "3 ta sotuv yuborildi ✓" (4 soniyadan keyin yo'qoladi)
 *
 * Rang yolg'iz signal emas (CLAUDE.md #6) — har holatda matn va ikonka bor.
 */
export default function OfflineBar() {
  const { t } = useT();
  const [state, setState] = useState({ online: true, pending: 0, failed: 0, items: [] });
  const [justSynced, setJustSynced] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let prevPending = 0;
    return queue.subscribe((s) => {
      // Navbat bo'shadi va oldin to'la edi → "yuborildi" holatini ko'rsatamiz
      if (prevPending > 0 && s.pending === 0 && s.online) {
        setJustSynced(prevPending);
        setTimeout(() => setJustSynced(0), 4000);
      }
      prevPending = s.pending;
      setState(s);
    });
  }, []);

  const { online, pending, failed, items } = state;
  const visible = !online || pending > 0 || failed > 0 || justSynced > 0;
  if (!visible) return null;

  // ⚠ Matn BO'LAKLARDAN yig'ilmaydi. Ilgari "{n} ta " + "sotuv navbatda"
  // ko'rinishida edi — bu tuzilma o'zbekchaga bog'langan va rus/ingliz
  // tilida so'z tartibi boshqacha. Endi har bir holat TO'LIQ jumla.
  let tone, icon, text;
  if (failed > 0) {
    tone = "offline"; icon = "fa-circle-exclamation";
    text = t("offline.failed", { n: failed });
  } else if (!online) {
    tone = "offline"; icon = "fa-wifi";
    text = pending ? t("offline.queued", { n: pending }) : t("offline.mode");
  } else if (pending > 0) {
    tone = "syncing"; icon = "fa-arrow-up-from-bracket";
    text = t("offline.sending", { n: pending });
  } else {
    tone = "synced"; icon = "fa-check";
    text = t("offline.synced", { n: justSynced });
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        className="ek-status-bar ek-offline-bar"
        data-tone={tone}
        aria-live="polite"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
        <span>{text}</span>
        {items.length > 0 && (
          <span className="ek-status-bar__count">
            <i className={`fa-solid fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
          </span>
        )}
      </button>

      {open && items.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          {items.map((it) => (
            <div className="ek-queue-row" key={it.key}>
              <i
                className={`fa-solid ${it.status === "failed" ? "fa-circle-exclamation" : "fa-clock"}`}
                style={{ color: it.status === "failed" ? "var(--fg-danger)" : "var(--fg-secondary)" }}
                aria-hidden="true"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {t("offline.items", { n: it.meta?.itemCount ?? it.payload?.items?.length ?? 0 })}
                  {it.meta?.total != null && (
                    /* `toLocaleString("uz-UZ")` brauzerga qarab vergul ham,
                       nuqta ham qaytaradi — `ek-format` yagona ajratgich beradi. */
                    <> · <span className="ek-num">{money(it.meta.total)}</span></>
                  )}
                </div>
                <div className="ek-queue-row__key">
                  {time(it.createdAt)} · {it.key.slice(0, 8)}
                  {it.lastError && ` · ${it.lastError}`}
                </div>
              </div>
              {it.status === "failed" && (
                <button className="btn btn-sm btn-outline" onClick={() => queue.retry(it.key)}>
                  {t("common.retry")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
