import { useCallback, useEffect, useState } from "react";
import { useT } from "../lib/ek-i18n";
import { telegramApi } from "../api";
import { useConfirm } from "../context/ConfirmProvider";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   Telegram hisobot boti (V32) — Sozlamalar kartasi. Faqat rahbarga.

   «Ulash» bosilganda server 10 daqiqalik BIR MARTALIK kod beradi va biz
   `t.me/<bot>?start=<kod>` ni yangi oynada ochamiz — ega Telegramda
   «Start» bosadi, bot chatni do'konga bog'laydi. Kodsiz ulanish yo'li
   ATAYLAB yo'q: bo'lmasa istalgan odam istalgan do'konning kunlik pul
   hisobotiga obuna bo'lardi.
   ══════════════════════════════════════════════════════════════════════════ */

export default function TelegramPanel({ toast }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    telegramApi.status().then((r) => setSt(r.data)).catch(() => setSt(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!st) return null;

  const connect = async () => {
    setBusy(true);
    try {
      const r = await telegramApi.bindCode();
      window.open(r.data.link, "_blank", "noopener");
      toast?.success(t("tg.linkOpened"));
    } catch (e) {
      toast?.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (chat) => {
    const ok = await confirm({
      title: t("tg.disconnectTitle"),
      message: t("tg.disconnectMsg", { title: chat.title }),
      type: "danger",
    });
    if (!ok) return;
    try {
      await telegramApi.disconnect(chat.id);
      toast?.success(t("common.saved"));
      load();
    } catch (e) {
      toast?.error(e.message);
    }
  };

  return (
    <div className="card set-card">
      <div className="card-header">
        <span className="card-title">
          <i className="fa-brands fa-telegram" aria-hidden="true" /> {t("tg.title")}
        </span>
      </div>
      <p className="set-card__hint">{t("tg.hint")}</p>
      <div className="set-list">
        {!st.configured ? (
          <div className="set-row">
            <div className="set-row__text">
              <div className="set-row__label">{t("tg.notConfigured")}</div>
              <div className="set-row__hint">{t("tg.notConfiguredHint")}</div>
            </div>
          </div>
        ) : (
          <>
            {(st.chats || []).filter((c) => c.enabled).map((c) => (
              <div className="set-row" key={c.id}>
                <div className="set-row__text">
                  <div className="set-row__label">
                    <i className="fa-solid fa-circle-check" style={{ color: "var(--ek-green-700)", marginRight: 6 }} aria-hidden="true" />
                    {c.title}
                  </div>
                  <div className="set-row__hint">{t("tg.connectedHint")}</div>
                </div>
                <div className="set-row__control">
                  <button className="btn btn-outline btn-sm" onClick={() => disconnect(c)}>
                    {t("tg.disconnect")}
                  </button>
                </div>
              </div>
            ))}
            <div className="set-row">
              <div className="set-row__text">
                <div className="set-row__label">{t("tg.connectLabel")}</div>
                <div className="set-row__hint">{t("tg.connectHint")}</div>
              </div>
              <div className="set-row__control" style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={connect} disabled={busy}>
                  {busy ? <Spinner /> : <i className="fa-brands fa-telegram" aria-hidden="true" />}
                  {t("tg.connect")}
                </button>
                {/* Telegramda «Start» bosilgach ro'yxat shu tugma bilan yangilanadi */}
                <button className="btn btn-outline btn-sm" onClick={load} aria-label={t("common.refresh")}>
                  <i className="fa-solid fa-rotate" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
