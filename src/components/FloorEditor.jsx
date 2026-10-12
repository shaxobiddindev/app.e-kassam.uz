import { useMemo, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import "../lib/ek-rest-words";
import { tableApi } from "../api";
import { asArray } from "../lib/ek-array";
import {
  PLANE, CHAIR, GRID, MAX_TABLES, PRESETS, SEAT_RANGE,
  autoPlace, clampPos, sizeOf, bodyOf, chairsOf, fits, nearestFree, nextName, seatsOf,
} from "../lib/ek-floor";
import { Modal } from "./index";
import { Spinner } from "./ek/Loading";
import { useConfirm } from "../context/ConfirmProvider";

/* ══════════════════════════════════════════════════════════════════════════
   ZAL REJASI — VIZUAL MUHARRIR (D2 → V164)

   Egasi: «stollarni raqam kiritib emas, zalning o'zida yasay olsin —
   shakllarni harakatga keltirsin; murakkab bo'lib ketmasin; juda yopishib
   ketmasin».

     · QO'SHISH — yuqoridagi 4 ta shakldan birini bosish (bo'sh joyga
       tushadi) yoki rejaga sudrab tashlash;
     · SURISH — sudrash (8 birlik to'r) yoki strelka (Shift — katta qadam);
     · O'RINLAR — tanlangan stol ustidagi −/+ : stol kattalashadi, stul
       qo'shiladi. Raqam yozilmaydi;
     · BURISH (uzun stol) va O'CHIRISH — o'sha joyda.

   ⚠ STOLLAR UST-USTIGA TUSHMAYDI: sudralganda qo'shnisiga `GAP` dan
   yaqinlashsa, stol oxirgi bo'sh joyda to'xtaydi; kattalashtirilganda
   joy yetmasa — eng yaqin bo'sh joyga suriladi. Shuning uchun zal
   ekranida reja siqilganda ham stollar orasida yo'l qoladi.

   ⚠ HAMMASI BITTA SAQLASHDA (`PUT /tables/halls/{id}/plan`): yangi,
   o'zgargan va o'chirilgan stollar bir tranzaksiyada. Ochiq buyurtmali
   stolni o'chirish tugmasi o'chiq — server ham rad etadi.
   ══════════════════════════════════════════════════════════════════════════ */

const pct = (v, of) => `${(v / of) * 100}%`;
const snap = (v) => Math.round(v / GRID) * GRID;

/** Palitradagi kichik namuna — shakl va stullar ko'rinadi, matn emas. */
function PresetIcon({ shape, seats }) {
  const s = sizeOf(shape, seats);
  const b = bodyOf(shape, seats);
  return (
    <svg viewBox={`0 0 ${s.w} ${s.h}`} width="40" height="28" aria-hidden="true" focusable="false">
      {chairsOf(shape, seats).map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={c.round ? c.w / 2 : 4} fill="currentColor" opacity=".45" />
      ))}
      <rect x={CHAIR} y={CHAIR} width={b.w} height={b.h} rx={shape === "ROUND" ? b.w / 2 : 10}
            fill="none" stroke="currentColor" strokeWidth="8" />
    </svg>
  );
}

export default function FloorEditor({ hall, onClose, onSaved, toast }) {
  const confirm = useConfirm();
  const initial = useMemo(() => autoPlace(asArray(hall.tables).map((x) => ({
    id: x.id, name: x.name, shape: x.shape || "SQUARE", seats: seatsOf(x.shape, x.seats),
    vertical: !!x.vertical, x: x.x, y: x.y, busy: !!x.order,
  }))), [hall]);
  const [items, setItems] = useState(initial);
  const [removed, setRemoved] = useState([]);
  const [sel, setSel] = useState(null);
  const [ghost, setGhost] = useState(null);       // palitradan sudralayotgan shakl
  const [blocked, setBlocked] = useState(null);   // sudrashda to'xtagan stol (qo'shnisi bor)
  const [renaming, setRenaming] = useState(null); // {id, text}
  const [saving, setSaving] = useState(false);
  const planeRef = useRef(null);
  const drag = useRef(null);
  const seq = useRef(0);

  /* Avtomatik joy (`auto`) — saqlanmagan joy: rahbar saqlasa, haqiqiyga aylanadi. */
  const dirty = removed.length > 0 || items.some((x) => x.auto) || JSON.stringify(items.map(strip)) !== JSON.stringify(initial.map(strip));
  const current = items.find((x) => x.id === sel) || null;

  /* Tekislik birligi: ekran pikselidan 1000 × 640 ga. */
  const toPlane = (e) => {
    const r = planeRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PLANE.w, y: ((e.clientY - r.top) / r.height) * PLANE.h,
             inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
  };

  const update = (id, fn) => setItems((list) => list.map((x) => (x.id === id ? { ...x, ...fn(x), auto: false } : x)));

  /** O'lcham o'zgarganda (o'rin, burish): joy yetmasa — eng yaqin bo'sh joy, u ham bo'lmasa — rad. */
  const reshape = (item, patch) => {
    const next = { ...item, ...patch };
    const c = { ...next, ...clampPos(next.x, next.y, next.shape, next.seats, next.vertical) };
    const p = fits(c, items) ? c : nearestFree(c, items);
    if (!p) { toast?.error(t("fp.noRoom")); return; }
    update(item.id, () => ({ ...patch, x: p.x, y: p.y }));
  };

  const add = (preset, at) => {
    if (items.length >= MAX_TABLES) { toast?.error(t("fp.tooMany", { n: MAX_TABLES })); return; }
    const id = `n${++seq.current}`;
    const base = { id, shape: preset.shape, seats: preset.seats, vertical: false, isNew: true };
    const s = sizeOf(base.shape, base.seats);
    const start = at ? { x: at.x - s.w / 2, y: at.y - s.h / 2 } : { x: 24, y: 24 };
    const p = nearestFree({ ...base, ...start }, items);
    if (!p) { toast?.error(t("fp.noRoom")); return; }
    const name = nextName([...items, ...asArray(hall.tables)], t("tbl.defaultPrefix"));
    setItems((list) => [...list, { ...base, ...p, name }]);
    setSel(id);
  };

  const remove = (item) => {
    if (item.busy) return;
    setItems((list) => list.filter((x) => x.id !== item.id));
    if (!item.isNew) setRemoved((r) => [...r, item.id]);
    setSel(null);
  };

  /* ── Sudrash: stol ───────────────────────────────────────────────── */
  const onDown = (e, item) => {
    if (e.button > 0) return;
    setSel(item.id);
    setRenaming(null);
    const p = toPlane(e);
    drag.current = { id: item.id, dx: p.x - item.x, dy: p.y - item.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const it = items.find((x) => x.id === d.id);
    if (!it) return;
    const p = toPlane(e);
    const c = { ...it, ...clampPos(snap(p.x - d.dx), snap(p.y - d.dy), it.shape, it.seats, it.vertical) };
    if (c.x === it.x && c.y === it.y) return;
    /* ⚠ Qo'shnisiga tegsa — oxirgi bo'sh joyda to'xtaydi (sakramaydi):
       stol barmoq ostidan qochib ketsa, rahbar uni yo'qotib qo'yardi. */
    if (fits(c, items)) { update(it.id, () => ({ x: c.x, y: c.y })); setBlocked(null); }
    else setBlocked(it.id);
  };
  const onUp = () => { drag.current = null; setBlocked(null); };

  /* ── Sudrash: palitradan yangi shakl ─────────────────────────────── */
  const onPresetDown = (e, preset) => {
    if (e.button > 0) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      moved = true;
      const p = toPlane(ev);
      setGhost(p.inside ? { preset, x: p.x, y: p.y } : null);
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      if (!moved) { add(preset); return; }
      const p = toPlane(ev);
      if (p.inside) add(preset, p);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ── Klaviatura ──────────────────────────────────────────────────── */
  const onKey = (e, item) => {
    if (renaming) return;
    const step = e.shiftKey ? 40 : GRID;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (map[e.key]) {
      e.preventDefault();
      const [dx, dy] = map[e.key];
      const c = { ...item, ...clampPos(item.x + dx, item.y + dy, item.shape, item.seats, item.vertical) };
      if (fits(c, items)) update(item.id, () => ({ x: c.x, y: c.y }));
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(item); }
    else if (e.key === "+" || e.key === "=") reshape(item, { seats: seatsOf(item.shape, item.seats + 1) });
    else if (e.key === "-") reshape(item, { seats: seatsOf(item.shape, item.seats - 1) });
    else if ((e.key === "r" || e.key === "R") && item.shape === "LONG") reshape(item, { vertical: !item.vertical });
  };

  const close = async () => {
    if (dirty && !(await confirm({ title: t("fp.discardTitle"), message: t("fp.discard"), confirmText: t("fp.discardYes"), type: "danger" }))) return;
    onClose();
  };

  const save = async () => {
    setSaving(true);
    try {
      await tableApi.savePlan(hall.id, {
        items: items.map((x) => ({ id: x.isNew ? null : x.id, name: x.name, x: x.x, y: x.y,
                                   shape: x.shape, seats: x.seats, vertical: x.vertical })),
        removed,
      });
      toast?.success(t("common.saved"));
      onSaved?.();
      onClose();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const commitName = () => {
    const v = String(renaming?.text || "").trim().slice(0, 30);
    if (v) update(renaming.id, () => ({ name: v }));
    setRenaming(null);
  };

  /* Tanlangan stol ustidagi asboblar paneli — stol tepasida, joy bo'lmasa pastida. */
  const bar = current && (() => {
    const s = sizeOf(current.shape, current.seats, current.vertical);
    const below = current.y < 90;
    const [lo, hi] = SEAT_RANGE[current.shape];
    return (
      <div role="toolbar" aria-label={t("fp.toolbar", { name: current.name })}
           onPointerDown={(e) => e.stopPropagation()}
           style={{
             position: "absolute", zIndex: 3, left: pct(Math.max(0, Math.min(current.x, PLANE.w - 330)), PLANE.w),
             top: below ? pct(current.y + s.h + 6, PLANE.h) : undefined,
             bottom: below ? undefined : pct(PLANE.h - current.y + 6, PLANE.h),
             display: "flex", alignItems: "center", gap: 4, padding: 4, borderRadius: 12,
             background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--sh-md)",
           }}>
        {renaming?.id === current.id ? (
          <input autoFocus className="form-input" style={{ width: 130, minHeight: 44 }} maxLength={30}
                 aria-label={t("common.name")} value={renaming.text}
                 onChange={(e) => setRenaming({ ...renaming, text: e.target.value })}
                 onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setRenaming(null); }}
                 onBlur={commitName} />
        ) : (
          <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 44 }}
                  title={t("fp.rename")} onClick={() => setRenaming({ id: current.id, text: current.name })}>
            <i className="fa-solid fa-pen" aria-hidden="true" /> {current.name}
          </button>
        )}
        <button type="button" className="btn btn-outline btn-sm" style={{ minWidth: 44, minHeight: 44 }}
                aria-label={t("fp.seatsLess")} disabled={current.seats <= lo}
                onClick={() => reshape(current, { seats: current.seats - 1 })}>
          <i className="fa-solid fa-minus" aria-hidden="true" />
        </button>
        <span className="ek-num" style={{ minWidth: 56, textAlign: "center", fontWeight: 700 }}
              aria-live="polite">
          <i className="fa-solid fa-chair" aria-hidden="true" /> {current.seats}
        </span>
        <button type="button" className="btn btn-outline btn-sm" style={{ minWidth: 44, minHeight: 44 }}
                aria-label={t("fp.seatsMore")} disabled={current.seats >= hi}
                onClick={() => reshape(current, { seats: current.seats + 1 })}>
          <i className="fa-solid fa-plus" aria-hidden="true" />
        </button>
        {current.shape === "LONG" && (
          <button type="button" className="btn btn-outline btn-sm" style={{ minWidth: 44, minHeight: 44 }}
                  aria-label={t("fp.rotate")} title={t("fp.rotate")}
                  onClick={() => reshape(current, { vertical: !current.vertical })}>
            <i className="fa-solid fa-rotate" aria-hidden="true" />
          </button>
        )}
        <button type="button" className="btn btn-outline btn-sm danger" style={{ minWidth: 44, minHeight: 44 }}
                aria-label={current.busy ? t("fp.busyNoDelete") : t("fp.remove")}
                title={current.busy ? t("fp.busyNoDelete") : t("fp.remove")}
                disabled={current.busy} onClick={() => remove(current)}>
          <i className="fa-solid fa-trash" aria-hidden="true" />
        </button>
      </div>
    );
  })();

  const ghostBox = ghost && (() => {
    const s = sizeOf(ghost.preset.shape, ghost.preset.seats);
    const c = { id: "ghost", shape: ghost.preset.shape, seats: ghost.preset.seats,
                ...clampPos(ghost.x - s.w / 2, ghost.y - s.h / 2, ghost.preset.shape, ghost.preset.seats) };
    return { ...c, ...s, ok: fits(c, items) || !!nearestFree(c, items) };
  })();

  return (
    <Modal title={t("fe.title", { name: hall.name })} onClose={close} maxWidth={1200}
           footer={
             <>
               <span className="fe-hint">
                 <span className="ek-num">{items.length} / {MAX_TABLES}</span> · {t("fp.hint")}
               </span>
               <button className="btn btn-outline btn-sm" onClick={close}>{t("common.cancel")}</button>
               <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
                 {saving ? <Spinner /> : <i className="fa-solid fa-check" aria-hidden="true" />} {t("common.save")}
               </button>
             </>
           }>
      <div className="fe-bar" role="group" aria-label={t("fp.palette")}>
        <span className="fe-bar__label">{t("fp.add")}</span>
        {PRESETS.map((p) => (
          <button key={p.key} type="button" className="btn btn-outline" style={{ minHeight: 52, touchAction: "none", gap: 8 }}
                  onPointerDown={(e) => onPresetDown(e, p)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); add(p); } }}
                  aria-label={t("fp.addAria", { name: t(`fp.preset.${p.key}`) })}>
            <PresetIcon shape={p.shape} seats={p.seats} />
            <span>{t(`fp.preset.${p.key}`)}</span>
          </button>
        ))}
      </div>

      {/* ⚠ Bo'yi oynaga sig'sin: keng monitorda 1000 × 640 nisbatdagi reja
          oyna balandligidan oshib, pastdagi stollar va «Saqlash» tugmasi
          ko'rinmay qolardi (birinchi skrinshotda shunday bo'ldi). */}
      <div className="fe-plane" ref={planeRef} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
           style={{ width: `min(100%, calc((100dvh - 290px) * ${PLANE.w / PLANE.h}))`, marginInline: "auto" }}
           /* Bo'sh joyga bosish — tanlovni bekor qiladi (oynani yopmaydi). */
           onPointerDown={(e) => { if (!e.target.closest(".fe-table, [role=toolbar]")) { setSel(null); setRenaming(null); } }}>
        {items.length === 0 && !ghost && (
          <p style={{ position: "absolute", inset: 0, margin: "auto", height: "fit-content", textAlign: "center",
                      color: "var(--fg-secondary)", padding: 24, pointerEvents: "none" }}>
            {t("fp.empty")}
          </p>
        )}

        {items.map((x) => {
          const s = sizeOf(x.shape, x.seats, x.vertical);
          const b = bodyOf(x.shape, x.seats, x.vertical);
          const on = x.id === sel;
          const tone = blocked === x.id ? "var(--fg-danger)" : on ? "var(--border-brand)" : "var(--border-strong)";
          return (
            <button key={x.id} type="button"
                    className={`fe-table rf-shape--${x.shape.toLowerCase()}${on ? " is-sel" : ""}${x.auto ? " is-auto" : ""}`}
                    style={{ left: pct(x.x, PLANE.w), top: pct(x.y, PLANE.h), width: pct(s.w, PLANE.w), height: pct(s.h, PLANE.h),
                             border: "none", background: "transparent", boxShadow: "none", borderRadius: 0, padding: 0,
                             zIndex: on ? 2 : 1, touchAction: "none" }}
                    onPointerDown={(e) => onDown(e, x)}
                    onDoubleClick={() => setRenaming({ id: x.id, text: x.name })}
                    onFocus={() => setSel(x.id)}
                    onKeyDown={(e) => onKey(e, x)}
                    aria-label={t("fp.tableAria", { name: x.name, n: x.seats })}>
              {chairsOf(x.shape, x.seats, x.vertical).map((c, i) => (
                <span key={i} aria-hidden="true" style={{
                  position: "absolute", left: pct(c.x, s.w), top: pct(c.y, s.h), width: pct(c.w, s.w), height: pct(c.h, s.h),
                  borderRadius: c.round ? "50%" : 4, background: tone, opacity: on ? 0.8 : 0.45,
                }} />
              ))}
              <span style={{
                position: "absolute", left: pct(CHAIR, s.w), top: pct(CHAIR, s.h), width: pct(b.w, s.w), height: pct(b.h, s.h),
                boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                borderRadius: x.shape === "ROUND" ? "50%" : 10, border: `2px ${x.auto ? "dashed" : "solid"} ${tone}`,
                background: "var(--bg-surface)", boxShadow: on ? "0 0 0 3px var(--bg-brand-soft)" : "none",
                overflow: "hidden", whiteSpace: "nowrap", padding: "0 4px",
              }}>
                {x.busy && <i className="fa-solid fa-utensils" style={{ color: "var(--fg-brand)" }} aria-hidden="true" />}
                {x.name}
              </span>
            </button>
          );
        })}

        {ghostBox && (
          <span aria-hidden="true" style={{
            position: "absolute", left: pct(ghostBox.x, PLANE.w), top: pct(ghostBox.y, PLANE.h),
            width: pct(ghostBox.w, PLANE.w), height: pct(ghostBox.h, PLANE.h), pointerEvents: "none",
            border: `2px dashed ${ghostBox.ok ? "var(--border-brand)" : "var(--fg-danger)"}`,
            borderRadius: ghost.preset.shape === "ROUND" ? "50%" : 12, background: "var(--bg-brand-soft)", opacity: 0.7,
          }} />
        )}

        {bar}
      </div>
    </Modal>
  );
}

/** Taqqoslash uchun: faqat saqlanadigan maydonlar. */
function strip(x) {
  return [x.id, x.name, x.shape, x.seats, x.vertical, x.x, x.y];
}
