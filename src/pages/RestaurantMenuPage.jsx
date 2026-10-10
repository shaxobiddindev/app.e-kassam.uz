import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import "../lib/ek-rest-words";
import { menuApi, recipeApi } from "../api";
import { money } from "../utils";
import { quantity, time } from "../lib/ek-format";
import { unitLabel } from "../lib/ek-labels";
import { asArray } from "../lib/ek-array";
import { hasRole } from "../lib/ek-roles";
import { useAuth } from "../hooks/useAuth";
import { Empty, SearchBar } from "../components/ui";
import { NumField } from "../components/ek/EkFields";
import { SkeletonCards, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import ExcelButton from "../components/ek/ExcelButton";
import { costTone, visibleDishes, initialOf, stationBg } from "../lib/ek-restaurant-menu";

/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN — «MENYU» (4-bosqich E3, 2026-10-10, V161)

   Do'konning «Tovarlar» ro'yxati o'rnida: taom kartalari (sex, vaqt, narx,
   tannarx ulushi, sotuvdami) va o'ngda tanlangan taomning texkartasi
   (masalliqlar, tannarx, qo'shimchalar, bugun nechta sotildi, masalliq
   necha porsiyaga yetadi), stop-list tugmasi.

   ⚠ TAOM FORMASI IKKINCHI MARTA YOZILMAYDI: «Taom qo'shish» va «Tahrirlash»
   `/products?edit=…&back=/menu` ni ochadi — 2000 qatorlik forma (fiskal kod,
   QQS, rasm, retsept) bitta joyda yashaydi va yopilgach shu yerga qaytadi.
   ⚠ YANGI CSS YO'Q (44/44) — mavjud klasslar va oddiy uslub.
   ⚠ Omborchi ko'radi (masalliqni u qabul qiladi), o'zgartirmaydi.
   ══════════════════════════════════════════════════════════════════════════ */
const TONE = {
  good: { ink: "var(--fg-success)", bg: "var(--bg-success-subtle)" },
  warn: { ink: "var(--fg-warning)", bg: "var(--bg-warning-subtle)" },
  bad:  { ink: "var(--fg-danger)",  bg: "var(--bg-danger-subtle)" },
};
const pct = (v) => String(v).replace(".", ",");

export default function RestaurantMenuPage({ toast }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = hasRole(user?.role, ["ADMIN", "SHOP_ADMIN", "OWNER"]);
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [section, setSection] = useState("all");
  const [query, setQuery] = useState("");
  const [stopOnly, setStopOnly] = useState(false);
  const [selId, setSelId] = useState(null);
  const [recipe, setRecipe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [card, setCard] = useState({ cook: "", portion: "" });

  const load = useCallback(() => {
    setLoading(true);
    return menuApi.board()
      .then((r) => setB(r?.data || null))
      .catch((e) => toast?.error(e.message))
      .finally(() => setLoading(false));
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const dishes = asArray(b?.dishes);
  const sections = asArray(b?.sections);
  const stations = useMemo(() => [...new Set(dishes.map((d) => d.station).filter(Boolean))], [dishes]);
  const shown = visibleDishes(dishes, { section, query, stopOnly });
  const sel = dishes.find((d) => d.id === selId) || shown[0] || null;
  const noSection = dishes.filter((d) => d.categoryId == null).length;

  /* Texkarta — tanlangan taomniki, alohida so'rov (ro'yxat javobi yengil qoladi). */
  useEffect(() => {
    setRecipe(null);
    if (!sel?.hasRecipe) return undefined;
    let alive = true;
    recipeApi.get(sel.id).then((r) => { if (alive) setRecipe(r?.data || null); }).catch(() => {});
    return () => { alive = false; };
  }, [sel?.id, sel?.hasRecipe]);
  useEffect(() => { setCard({ cook: sel?.cookMinutes ?? "", portion: sel?.portion ?? "" }); }, [sel?.id, sel?.cookMinutes, sel?.portion]);

  const toggleStop = async () => {
    if (!sel) return;
    setSaving(true);
    try {
      const r = await menuApi.stop(sel.id, !sel.stopListed);
      toast?.success(r?.message || t("common.saved"));
      await load();
    } catch (e) { toast?.error(e.message); }
    finally { setSaving(false); }
  };

  const saveCard = async () => {
    if (!sel) return;
    setSaving(true);
    try {
      await menuApi.card(sel.id, { cookMinutes: card.cook === "" ? null : Number(card.cook), portion: card.portion });
      toast?.success(t("common.saved"));
      await load();
    } catch (e) { toast?.error(e.message); }
    finally { setSaving(false); }
  };
  const cardDirty = sel && (String(card.cook ?? "") !== String(sel.cookMinutes ?? "") || (card.portion || "") !== (sel.portion || ""));

  const sheets = () => [{ name: t("rnav.menu"), rows: [
    [t("rmenu.dish"), t("rmenu.section"), t("rmenu.station"), t("rmenu.price"), t("rmenu.cost"), t("rmenu.share"),
     t("rmenu.cook"), t("rmenu.portionLabel"), t("rmenu.status"), t("rmenu.todayQty"), t("rmenu.todayRev"), t("rmenu.portions")]
      .map((v) => ({ v, bold: true })),
    ...dishes.map((d) => [d.name, d.categoryName || "", d.station || "", Number(d.price) || 0, Number(d.cost) || 0,
      d.costPct ?? "", d.cookMinutes ?? "", d.portion || "", t(d.stopListed ? "rmenu.inStop" : "rmenu.onSale"),
      Number(d.todayQty) || 0, Number(d.todayRevenue) || 0, d.portionsLeft ?? ""]),
  ] }];

  const tab = (on) => ({ minHeight: 44, padding: "0 14px", borderRadius: 12, fontWeight: 700,
    ...(on ? { background: "var(--bg-brand)", color: "var(--fg-on-brand)", borderColor: "transparent" } : {}) });
  const thumb = (d, big) => ({ width: big ? 64 : 56, height: big ? 64 : 56, flex: "none", borderRadius: 14, overflow: "hidden",
    background: stationBg(d.station, stations), display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 800, fontSize: big ? 26 : 22, color: "var(--fg-secondary)" });
  const Thumb = ({ d, big }) => (
    <span style={thumb(d, big)} aria-hidden="true">
      {d.thumbUrl ? <img src={d.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initialOf(d.name)}
    </span>
  );

  const costLine = (d) => {
    const c = costTone(d.costPct);
    if (!c) return <span className="text-muted" style={{ fontSize: 12 }}>{t("rmenu.noCost")}</span>;
    return <span style={{ fontSize: 12, fontWeight: 600, color: TONE[c.tone].ink }}>
      {t("rmenu.costLine", { sum: money(d.cost), p: pct(d.costPct), word: t(`rmenu.fc.${c.word}`) })}
    </span>;
  };

  const leftText = (d) => d.portionsLeft == null ? t("rmenu.leftNone")
    : d.portionsLeft <= 0 ? t("rmenu.leftZero", { name: d.limitName })
      : t("rmenu.left", { name: d.limitName, n: d.portionsLeft });

  return (
    <div className="rpt">
      <div className="rpt-bar">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 className="page-title" style={{ margin: 0 }}>{t("rnav.menu")}</h2>
          {b && <span className="text-muted">{t("rmenu.countLine", { n: b.dishCount, s: sections.length })}</span>}
        </div>
        <div className="rpt-bar__tools">
          <SearchBar value={query} onChange={setQuery} placeholder={t("rmenu.search")} style={{ minWidth: 220 }} />
          <button type="button" className="btn btn-outline btn-sm" aria-pressed={stopOnly} onClick={() => setStopOnly((v) => !v)}
                  style={{ minHeight: 44, fontWeight: 700, color: "var(--fg-warning)", borderColor: "var(--border-warning)",
                           background: stopOnly ? "var(--bg-warning-subtle)" : undefined }}>
            <i className="fa-solid fa-ban" aria-hidden="true" /> {t("rmenu.stopList")} · <span className="ek-num">{b?.stopCount ?? 0}</span>
          </button>
          <ExcelButton name="menyu" sheets={sheets} toast={toast} disabled={!b} />
          {canEdit && (
            <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 44 }}
                    onClick={() => navigate("/products?new=1&back=/menu")}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> {t("rmenu.add")}
            </button>
          )}
        </div>
      </div>

      <div role="tablist" aria-label={t("rnav.sections")} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[{ id: "all", name: t("rmenu.all"), count: dishes.length },
          ...sections.map((s) => ({ id: s.id, name: s.name, count: s.count })),
          ...(noSection ? [{ id: "none", name: t("rmenu.noSection"), count: noSection }] : [])].map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={String(section) === String(s.id)}
                  className="btn btn-outline btn-sm" style={tab(String(section) === String(s.id))}
                  onClick={() => setSection(s.id)}>
            {s.name} <span className="ek-num" style={{ fontWeight: 700 }}>{s.count}</span>
          </button>
        ))}
      </div>

      {busy || !b ? <SkeletonCards count={6} className="kpi-grid" /> : dishes.length === 0 ? (
        <Empty icon="fa-bowl-food" text={t("rmenu.empty")} />
      ) : (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <section aria-label={t("rnav.dishes")}
                   style={{ flex: "999 1 480px", minWidth: 0, display: "grid", gap: 12,
                            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {shown.length === 0 && <Empty icon="fa-magnifying-glass" text={t("rmenu.nothing")} />}
            {shown.map((d) => {
              const on = sel?.id === d.id;
              return (
                <button key={d.id} type="button" aria-pressed={on} onClick={() => setSelId(d.id)}
                        style={{ display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left", padding: 12, borderRadius: 16,
                                 font: "inherit", color: "var(--fg-primary)", cursor: "pointer", minHeight: 120,
                                 background: d.stopListed ? "var(--bg-warning-subtle)" : "var(--bg-surface)",
                                 border: on ? "2px solid var(--border-brand)" : "1px solid var(--border-subtle)" }}>
                  <Thumb d={d} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 0" }}>
                    <span style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      {[d.station, d.cookMinutes ? t("rmenu.cookN", { n: d.cookMinutes }) : null].filter(Boolean).join(" · ") || "—"}
                    </span>
                    <span className="ek-num" style={{ fontWeight: 700, fontSize: 16 }}>{money(d.price)}</span>
                    {costLine(d)}
                    <span style={{ fontSize: 12, fontWeight: 700, color: d.stopListed ? "var(--fg-warning)" : "var(--fg-success)" }}>
                      <i className={`fa-solid ${d.stopListed ? "fa-ban" : "fa-check"}`} aria-hidden="true" /> {t(d.stopListed ? "rmenu.inStop" : "rmenu.onSale")}
                    </span>
                  </span>
                </button>
              );
            })}
          </section>

          <aside aria-label={t("rmenu.card")} className="card"
                 style={{ flex: "1 1 340px", maxWidth: 440, minWidth: 0, padding: 16, display: "flex", flexDirection: "column", gap: 12,
                          position: "sticky", top: 12 }}>
            {!sel ? <p className="text-muted" style={{ margin: 0 }}>{t("rmenu.pick")}</p> : (
              <>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Thumb d={sel} big />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 0", minWidth: 0 }}>
                    <span className="text-muted" style={{ fontSize: 12, fontWeight: 600 }}>
                      {t("rmenu.card")}{sel.portion ? ` · ${sel.portion}` : ""}
                    </span>
                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: 20 }}>{sel.name}</h3>
                    <span className="text-muted" style={{ fontSize: 13 }}>
                      {[sel.station, sel.categoryName, sel.cookMinutes ? t("rmenu.cookN", { n: sel.cookMinutes }) : null].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </div>

                {sel.hasRecipe ? (
                  <table className="table" style={{ fontSize: 14 }}>
                    <thead><tr><th>{t("rmenu.ingredient")}</th><th style={{ textAlign: "right" }}>{t("rmenu.qty")}</th><th style={{ textAlign: "right" }}>{t("rmenu.cost")}</th></tr></thead>
                    <tbody>
                      {recipe == null ? <tr><td colSpan={3}><Spinner /></td></tr> : asArray(recipe.lines).map((l) => (
                        <tr key={l.ingredientId}>
                          <td>{l.name}</td>
                          <td className="ek-num" style={{ textAlign: "right" }}>{quantity(l.quantity, l.unitDecimals)} {unitLabel(l.unit)}</td>
                          <td className="ek-num" style={{ textAlign: "right" }}>{l.lineCost != null ? money(l.lineCost) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>{t("rmenu.noRecipe")}</p>}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {[[t("rmenu.cost"), money(sel.cost), null], [t("rmenu.price"), money(sel.price), null],
                    [t("rmenu.share"), sel.costPct != null ? `${pct(sel.costPct)}%` : "—", costTone(sel.costPct)]]
                    .map(([label, value, c]) => (
                      <div key={label} style={{ borderRadius: 12, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2,
                                                background: c ? TONE[c.tone].bg : "var(--bg-sunken)", color: c ? TONE[c.tone].ink : undefined }}>
                        <span style={{ fontSize: 12, color: c ? undefined : "var(--fg-secondary)" }}>{label}</span>
                        <span className="ek-num" style={{ fontWeight: 700 }}>{value}</span>
                        {c && <span style={{ fontSize: 12, fontWeight: 700 }}>{t(`rmenu.fc.${c.word}`)}</span>}
                      </div>
                    ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="text-muted" style={{ fontSize: 12, fontWeight: 600 }}>{t("rmenu.mods")}</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(sel.modifiers?.length ? sel.modifiers : [t("rmenu.noMods")]).map((m) => (
                      <span key={m} style={{ padding: "6px 10px", borderRadius: 999, background: "var(--bg-brand-subtle)", color: "var(--fg-brand)", fontSize: 13, fontWeight: 600 }}>{m}</span>
                    ))}
                  </div>
                </div>

                <div style={{ padding: "10px 12px", borderRadius: 12, background: "var(--bg-sunken)", fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span><b>{t("rmenu.today")}</b>{" "}
                    {Number(sel.todayQty) > 0
                      ? <span className="ek-num">{t("rmenu.todayLine", { n: quantity(sel.todayQty), sum: money(sel.todayRevenue) })}</span>
                      : t("rmenu.todayNone")}
                  </span>
                  <span style={{ color: sel.portionsLeft != null && sel.portionsLeft <= 5 ? "var(--fg-warning)" : "var(--fg-secondary)", fontWeight: sel.portionsLeft != null && sel.portionsLeft <= 5 ? 700 : 400 }}>
                    {leftText(sel)}
                  </span>
                  {sel.stopListed && sel.stopListedBy && (
                    <span style={{ color: "var(--fg-warning)" }}>{t("rmenu.stopBy", { who: sel.stopListedBy, time: sel.stopListedAt ? time(sel.stopListedAt) : "" })}</span>
                  )}
                </div>

                {canEdit && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 110px", fontSize: 12, color: "var(--fg-secondary)" }}>
                      {t("rmenu.cookLabel")}
                      <NumField kind="int" max={600} value={card.cook} onChange={(e) => setCard((c) => ({ ...c, cook: e.target.value }))} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 130px", fontSize: 12, color: "var(--fg-secondary)" }}>
                      {t("rmenu.portionLabel")}
                      <input className="form-input" maxLength={24} value={card.portion} placeholder={t("rmenu.portionHint")}
                             onChange={(e) => setCard((c) => ({ ...c, portion: e.target.value }))} />
                    </label>
                    {cardDirty && (
                      <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 44 }} disabled={saving} onClick={saveCard}>
                        {t("common.save")}
                      </button>
                    )}
                  </div>
                )}

                {canEdit && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" disabled={saving} onClick={toggleStop} className="btn btn-sm"
                            style={{ flex: "1 1 0", minHeight: 48, fontWeight: 700,
                                     ...(sel.stopListed
                                       ? { background: "var(--bg-success)", color: "var(--fg-on-brand)", border: 0 }
                                       : { background: "var(--bg-warning-subtle)", color: "var(--fg-warning)", border: "1px solid var(--border-warning)" }) }}>
                      {saving ? <Spinner /> : <i className={`fa-solid ${sel.stopListed ? "fa-rotate-left" : "fa-ban"}`} aria-hidden="true" />}{" "}
                      {t(sel.stopListed ? "rmenu.stopBack" : "rmenu.stopPut")}
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" style={{ flex: "1 1 0", minHeight: 48, fontWeight: 700 }}
                            onClick={() => navigate(`/products?edit=${sel.id}&back=/menu`)}>
                      <i className="fa-solid fa-pen" aria-hidden="true" /> {t("rmenu.edit")}
                    </button>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
