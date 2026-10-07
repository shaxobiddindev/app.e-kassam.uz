/* ══════════════════════════════════════════════════════════════════════════
   TAOM QO'SHIMCHALARI — KASSA TOMONI (R2, V149, docs/22-RESTORAN.md)

   «Piyozsiz», «katta porsiya», «+ sous 3 000». Guruhlar serverdan bir marta
   keladi (`/modifiers`, oflaynda katalog bilan birga), har guruhda
   `productIds` — qaysi taomlarga tegishli.

   ═══ QATOR KALITI ══════════════════════════════════════════════════════
   Savat qatori ilgari faqat TOVAR ID si bilan topilardi: bir xil tovar
   ikkinchi marta bosilsa miqdor oshadi. Qo'shimchali taomda bu XATO:
   «Burger + pishloq» va «Burger, piyozsiz» — ikki xil buyurtma, oshxona
   ularni ikki xil tayyorlaydi. Shuning uchun qo'shimchali qatorda
   `_key = "<id>~<qo'shimcha id lari>"`.

   ⚠ QO'SHIMCHASIZ QATORDA `_key` YO'Q va `keyOf` ID ni qaytaradi — ya'ni
   oddiy do'konning savati bitta ham belgisi o'zgarmasdan ishlaydi
   (`check-cart`: ikki bosish → «suv×2»).

   ═══ NARX ═══════════════════════════════════════════════════════════════
   Qator `salePrice` = taom + qo'shimchalar. Server ham aynan shunday
   hisoblaydi (`sale_items.price`) va kassadagi hamma pul funksiyasi
   (`ek-money`, `ek-discount`, chek, mijoz ekrani) `salePrice` ni o'qiydi —
   qo'shimcha alohida tursa ularning har biri uni bilishi kerak bo'lardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Savat qatorining kaliti: qo'shimchali qatorda `_key`, aks holda tovar ID. */
export const keyOf = (line) => line?._key ?? line?.id;

/** Shu taomga biriktirilgan guruhlar (qo'shimchasi bor guruhlargina). */
export function groupsFor(groups, productId) {
  if (!Array.isArray(groups) || productId == null) return [];
  return groups.filter((g) => Array.isArray(g.productIds)
    && g.productIds.some((id) => String(id) === String(productId))
    && Array.isArray(g.options) && g.options.length > 0);
}

/** Guruh qoidasi: bittadan ko'p tanlab bo'lmasa — radio kabi ishlaydi. */
export const isSingle = (group) => Number(group?.maxSelect) === 1;

/**
 * Tanlovga bitta qo'shimchani qo'shadi yoki olib tashlaydi.
 *
 * @param picked {Object<groupId, id[]>}
 * @return yangi obyekt (eski o'zgarmaydi — React holati)
 */
export function toggle(picked, group, optionId) {
  const cur = picked?.[group.id] || [];
  let next;
  if (cur.includes(optionId)) next = cur.filter((id) => id !== optionId);
  else if (isSingle(group)) next = [optionId];
  else {
    const max = Number(group.maxSelect) || Infinity;
    /* ⚠ Chegaraga yetganda YANGISI QO'SHILMAYDI (eskisi surib
       chiqarilmaydi): kassir nima tanlaganini o'zi ko'rib turadi,
       tanlov uning bilmasidan o'zgarmasligi kerak. */
    next = cur.length >= max ? cur : [...cur, optionId];
  }
  return { ...picked, [group.id]: next };
}

/** Majburiy guruhlar to'ldirilmagan bo'lsa — o'sha guruhlar. */
export function missing(groups, picked) {
  return (groups || []).filter((g) => (picked?.[g.id]?.length || 0) < (Number(g.minSelect) || 0));
}

/** Tanlangan qo'shimchalar — guruh tartibida, obyekt ko'rinishida. */
export function chosen(groups, picked) {
  const out = [];
  for (const g of groups || []) {
    const ids = picked?.[g.id] || [];
    for (const o of g.options || []) if (ids.includes(o.id)) out.push(o);
  }
  return out;
}

/** Qo'shimchalar yig'indisi (bir dona uchun). */
export const extraOf = (mods) =>
  (mods || []).reduce((s, m) => s + (Number(m?.price) || 0), 0);

/**
 * Savatga tushadigan qator: taom + tanlangan qo'shimchalar.
 *
 * ⚠ QO'SHIMCHA TANLANMAGAN BO'LSA TOVARNING O'ZI qaytadi (kalitsiz) —
 * u oddiy qator bilan birlashadi: ixtiyoriy guruhi bor ichimlikni
 * qo'shimchasiz ikki marta olgan kassir bitta «×2» qatorni ko'radi.
 *
 * ⚠ `minPrice` ham qo'shimcha qadar ko'tariladi: chegirma chegarasi
 * taomning o'zi uchun hisoblangan, qo'shimchani esa chegirma bilan
 * «yeb qo'yish» kerak emas. Optom narx olib tashlanadi — u taomning
 * O'ZI narxi va qo'shimchali qatorga qo'llansa qo'shimcha bepul bo'lib
 * qolardi.
 */
export function lineFor(product, mods) {
  if (!mods || mods.length === 0) return product;
  const ids = mods.map((m) => Number(m.id)).sort((a, b) => a - b);
  const extra = extraOf(mods);
  return {
    ...product,
    _key: `${product.id}~${ids.join(".")}`,
    basePrice: product.salePrice,
    salePrice: Number(product.salePrice) + extra,
    minPrice: product.minPrice == null ? product.minPrice : Number(product.minPrice) + extra,
    wholesalePrice: null,
    modifiers: mods.map((m) => ({ id: m.id, name: m.name, price: Number(m.price) || 0 })),
  };
}

/** Chek va ekran uchun qisqa matn: «Pishloq, Piyozsiz». */
export const modsText = (line) => (line?.modifiers || []).map((m) => m.name).join(", ");
