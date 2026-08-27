import { money, quantity as fmtQty } from "../utils";
import { unitLabel } from "../lib/ek-labels";
import { mediaApi } from "../api";
import { t } from "../lib/ek-i18n";

/* ══════════════════════════════════════════════════════════════════════════
   Kassa katakchasi.

   IKKI KO'RINISH, bittasi emas:

     tiles — rasm bilan, katta. Kiyim, kosmetika, xizmat: tovarni KO'RIB
             tanishadi, nomlari esa uzun va bir-biriga o'xshash.
     list  — zich, rasmsiz. Oziq-ovqat: 40 ta tovar bir ekranga sig'ishi
             kerak va tanlash baribir barkod bilan bo'ladi.

   Nega tanlov kassirda: rasm katakchani kattalashtiradi va ekranga
   sig'adigan tovar sonini kamaytiradi. Bir do'kon uchun foyda, boshqasi
   uchun zarar — shuning uchun standart faoliyat turidan olinadi, lekin
   oxirgi so'z kassirda qoladi (tanlov qurilmada saqlanadi).

   RASM YO'Q BO'LSA — rangli plastinka va bosh harflar (Loyverse uslubi).
   Bo'sh kulrang kvadrat to'rni "teshik" qilib ko'rsatadi va tovarni
   ajratishga hech narsa bermaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Rangni token nomidan olamiz — kodda hech qachon `#rrggbb` yozilmaydi. */
const COLOR_VAR = {
  brand: "var(--bg-brand)",
  success: "var(--fg-success)",
  danger: "var(--fg-danger)",
  amber: "var(--fg-warning)",
  secondary: "var(--fg-secondary)",
};

function initialsOf(name) {
  const words = (name || "?").trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]).join("").toUpperCase();
}

/**
 * `available` — SAVATNI hisobga olgan qoldiq (KassaPage beradi).
 *
 * ⚠ Nega alohida prop, nega `product.stockQuantity` ga yozilmagan: bosilganda
 * `onPick(p)` AYNAN shu obyektni uzatadi va qoldiq nazorati o'sha yerda
 * ishlaydi. Kamaytirilgan qiymatni obyektga yozib yuborsak, savat ikki
 * marta ayirilardi va kassir hali bori bor tovarni qo'sha olmay qolardi.
 */
export default function ProductTile({ product, view = "tiles", onPick, available }) {
  const p = product;
  const tracks = p.stockQuantity != null;
  const shown = available != null ? available : p.stockQuantity;
  const out = tracks && Number(shown) <= 0;
  const noPrice = p.salePrice == null;
  const color = COLOR_VAR[p.color] || "var(--bg-brand)";
  const thumb = mediaApi.url(p.thumbUrl);

  // Tugma o'chirilmaydi, faqat belgilanadi: kassir "bor edi, tugabdi" deb
  // ayta olishi kerak. Bosilganda esa aniq xabar chiqadi (KassaPage da).
  const cls = [
    "product-card",
    view === "tiles" ? "product-card--tile" : "product-card--list",
    out || noPrice ? "is-dim" : "",
  ].filter(Boolean).join(" ");

  return (
    <button type="button" className={cls} onClick={() => onPick(p)}
            title={p.name}>
      {view === "tiles" && (
        <span className="product-thumb" style={{ background: thumb ? "var(--bg-sunken)" : color }}>
          {thumb
            ? <img src={thumb} alt="" loading="lazy" decoding="async" />
            : <span className="product-thumb__letters">{initialsOf(p.name)}</span>}
        </span>
      )}

      <span className="product-body">
        <span className="product-name">{p.name}</span>

        {p.attributes && <span className="product-attrs">{attrText(p.attributes)}</span>}

        <span className="product-meta">
          {noPrice
            ? <span className="product-noprice">{t("products.noPrice")}</span>
            : <span className="product-price ek-num">{money(p.salePrice)}</span>}

          {tracks && (
            <span className={`product-stock ek-num ${out ? "is-out" : ""}`}>
              {out ? t("kassa.outOfStock")
                   : `${fmtQty(shown, p.unitDecimals)} ${unitLabel(p.unit)}`}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** `{"o'lcham":"M","rang":"qora"}` → `M · qora` */
function attrText(json) {
  try {
    const obj = JSON.parse(json);
    return Object.values(obj).filter(Boolean).join(" · ");
  } catch (_) {
    return null;
  }
}
