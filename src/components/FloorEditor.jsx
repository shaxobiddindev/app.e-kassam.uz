import { useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import { tableApi } from "../api";
import { asArray } from "../lib/ek-array";
import { PLANE, SHAPES, autoPlace, clampPos, sizeOf } from "../lib/ek-floor";
import { Modal } from "./index";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   ZAL REJASINI TAHRIRLASH (3-bosqich D2)

   Rahbar stollarni sudrab joylaydi va shaklini tanlaydi. Joy 1000 × 640
   tekislikda saqlanadi — kassa uni har qanday ekranga cho'zadi.

   ⚠ SICHQONCHASIZ HAM ISHLAYDI: stolni tanlab, strelkalar bilan suriladi
   (Shift — katta qadam). Faqat sudrash bilan ishlaydigan muharrir sensorli
   bo'lmagan monitorda ham, klaviaturada ham ko'r nuqta bo'lardi.

   ⚠ Saqlash tugmasigacha serverga hech narsa ketmaydi.
   ══════════════════════════════════════════════════════════════════════════ */
const SHAPE_ICON = { SQUARE: "fa-square", ROUND: "fa-circle", LONG: "fa-grip-lines" };

export default function FloorEditor({ hall, onClose, onSaved, toast }) {
  const [items, setItems] = useState(() => autoPlace(asArray(hall.tables).map((x) => ({ ...x, shape: x.shape || "SQUARE" }))));
  const [sel, setSel] = useState(items[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const planeRef = useRef(null);
  const drag = useRef(null);

  const patch = (id, fn) => setItems((list) => list.map((x) => (x.id === id ? { ...x, ...fn(x), auto: false } : x)));
  const move = (id, dx, dy) => patch(id, (x) => clampPos(x.x + dx, x.y + dy, x.shape));

  const onDown = (e, item) => {
    setSel(item.id);
    const rect = planeRef.current.getBoundingClientRect();
    drag.current = { id: item.id, sx: e.clientX, sy: e.clientY, x: item.x, y: item.y,
                     kx: PLANE.w / rect.width, ky: PLANE.h / rect.height };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const it = items.find((x) => x.id === d.id);
    const p = clampPos(d.x + (e.clientX - d.sx) * d.kx, d.y + (e.clientY - d.sy) * d.ky, it?.shape);
    /* 4 birlikli to'r — stollar bir chiziqqa oson tushadi. */
    patch(d.id, () => ({ x: Math.round(p.x / 4) * 4, y: Math.round(p.y / 4) * 4 }));
  };
  const onUp = () => { drag.current = null; };

  const onKey = (e, item) => {
    const step = e.shiftKey ? 40 : 8;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!map[e.key]) return;
    e.preventDefault();
    move(item.id, ...map[e.key]);
  };

  const current = items.find((x) => x.id === sel) || null;
  const save = async () => {
    setSaving(true);
    try {
      await tableApi.saveLayout(hall.id, items.map((x) => ({ id: x.id, x: x.x, y: x.y, shape: x.shape })));
      toast?.success(t("common.saved"));
      onSaved?.();
      onClose();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t("fe.title", { name: hall.name })} onClose={onClose} maxWidth={1100}
           footer={
             <>
               <span className="fe-hint">{t("fe.hint")}</span>
               <button className="btn btn-outline btn-sm" onClick={onClose}>{t("common.cancel")}</button>
               <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                 {saving ? <Spinner /> : <i className="fa-solid fa-check" aria-hidden="true" />} {t("common.save")}
               </button>
             </>
           }>
      <div className="fe-bar" role="group" aria-label={t("fe.shape")}>
        <span className="fe-bar__label">{current ? current.name : t("fe.pick")}</span>
        {SHAPES.map((sh) => (
          <button key={sh} type="button" disabled={!current}
                  className={`btn btn-sm ${current?.shape === sh ? "btn-primary" : "btn-outline"}`}
                  aria-pressed={current?.shape === sh}
                  onClick={() => current && patch(current.id, (x) => ({ shape: sh, ...clampPos(x.x, x.y, sh) }))}>
            <i className={`fa-solid ${SHAPE_ICON[sh]}`} aria-hidden="true" /> {t(`fe.shape.${sh}`)}
          </button>
        ))}
      </div>
      <div className="fe-plane" ref={planeRef} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {items.map((x) => {
          const s = sizeOf(x.shape);
          return (
            <button key={x.id} type="button"
                    className={`fe-table rf-shape--${x.shape.toLowerCase()}${x.id === sel ? " is-sel" : ""}${x.auto ? " is-auto" : ""}`}
                    style={{ left: `${(x.x / PLANE.w) * 100}%`, top: `${(x.y / PLANE.h) * 100}%`,
                             width: `${(s.w / PLANE.w) * 100}%`, height: `${(s.h / PLANE.h) * 100}%` }}
                    onPointerDown={(e) => onDown(e, x)}
                    onFocus={() => setSel(x.id)}
                    onKeyDown={(e) => onKey(e, x)}
                    aria-label={t("fe.tableAria", { name: x.name })}>
              {x.name}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
