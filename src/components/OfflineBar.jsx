import { useEffect, useState } from "react";
import * as queue from "../lib/ek-offline";

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

  let tone, icon, text, n;
  if (failed > 0) {
    tone = "offline"; icon = "fa-circle-exclamation";
    text = "sotuv yuborilmadi — qayta urinib ko'ring"; n = failed;
  } else if (!online) {
    tone = "offline"; icon = "fa-wifi";
    text = pending ? "sotuv navbatda" : "Oflayn rejim — sotuv davom etadi"; n = pending;
  } else if (pending > 0) {
    tone = "syncing"; icon = "fa-arrow-up-from-bracket";
    text = "sotuv yuborilmoqda…"; n = pending;
  } else {
    tone = "synced"; icon = "fa-check";
    text = "sotuv yuborildi"; n = justSynced;
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
        <span>
          {!online && !pending ? text : <>{n > 0 && <b className="ek-num">{n} ta </b>}{text}</>}
        </span>
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
                style={{ color: it.status === "failed" ? "var(--fg-danger)" : "var(--fg-tertiary)" }}
                aria-hidden="true"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {it.meta?.itemCount ?? it.payload?.items?.length ?? 0} ta tovar
                  {it.meta?.total != null && (
                    <> · <span className="ek-num">{it.meta.total.toLocaleString("uz-UZ")}</span></>
                  )}
                </div>
                <div className="ek-queue-row__key">
                  {new Date(it.createdAt).toLocaleTimeString("uz-UZ")} · {it.key.slice(0, 8)}
                  {it.lastError && ` · ${it.lastError}`}
                </div>
              </div>
              {it.status === "failed" && (
                <button className="btn btn-sm btn-outline" onClick={() => queue.retry(it.key)}>
                  Qayta urinish
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
