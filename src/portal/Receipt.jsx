import { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { code128Svg } from "../lib/ek-barcode";
import { qrSvg } from "../lib/ek-qr";

/* ══════════════════════════════════════════════════════════════════════════
   ELEKTRON CHEK — QOG'OZ CHEKNING AYNAN O'ZI

   Mijoz ikkalasini yonma-yon qo'yib solishtiradi: agar elektron chek
   boshqacha ko'rinsa yoki biror satr yetishmasa, u «bu haqiqiy chek emas»
   deb o'ylaydi. Shuning uchun bu yerda dizayn EMAS, TAQLID qilinadi:

     · 58 mm tasma kengligi (`--pt-tape`), o'zgarmas
     · monospace shrift va `tabular-nums` — raqamlar ustma-ust tushadi
     · punktir ajratgichlar (printer chizig'ining o'zi)
     · pastda yirtilgan qirra (`.ek-tear` — landing va kirish ekranida ham
       ishlatiladigan brend detali)
     · Code128 shtrix + fiskal QR — qog'ozdagi bilan bir xil joyda

   ⚠ Raqamlar SERVERDAN keladi va bu yerda QAYTA HISOBLANMAYDI. Aks holda
   yaxlitlash farqi tufayli elektron chekdagi summa qog'ozdagidan bir-ikki
   so'mga farq qilishi mumkin edi — mijoz uchun bu «aldash» ko'rinadi.
   ══════════════════════════════════════════════════════════════════════════ */

const money = (v) =>
  new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 }).format(Number(v || 0));

const PAY_LABEL = {
  CASH: "Naqd",
  CARD: "Karta",
  MIXED: "Aralash",
  CREDIT: "Nasiya",
  CLICK: "Click",
  PAYME: "Payme",
  TRANSFER: "O'tkazma",
};

const UNIT_LABEL = {
  DONA: "dona", KG: "kg", GRAM: "g", LITR: "l", METR: "m", QUTI: "quti", UPAK: "upak",
};

/**
 * Chek ikki yo'l bilan ochiladi:
 *   · KABINETDAN — `token` + `id` (mijoz o'z cheklari ro'yxatidan);
 *   · QOG'OZ CHEKDAGI QR dan — `signedId` + `signature`, kalitsiz.
 * Ikkinchisi ataylab kalitsiz: chekni qo'lida ushlab turgan odam uni
 * allaqachon ko'rgan, imzo esa faqat SHU chekni ochadi.
 */
export default function Receipt({ token, id, signedId, signature, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = signedId
      ? `${API_BASE}/public/portal/receipt/${signedId}?k=${encodeURIComponent(signature)}`
      : `${API_BASE}/public/portal/receipts/${id}`;
    const headers = signedId ? {} : { "X-Portal-Token": token };

    fetch(url, { headers })
      .then((r) => r.json())
      .then((j) => {
        if (j.success === false) throw new Error(j.message);
        setData(j.data);
      })
      .catch((e) => setError(e.message || "Chekni ochib bo'lmadi"));
  }, [id, token, signedId, signature]);

  // Esc bilan yopish — telefonda ham, brauzerda ham kutiladigan xatti-harakat
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pt-modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pt-modal__inner" onClick={(e) => e.stopPropagation()}>
        <button className="pt-close" onClick={onClose} aria-label="Yopish">
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>

        {error && <div className="pt-tape pt-center">{error}</div>}
        {!data && !error && <div className="pt-tape pt-center">Yuklanmoqda…</div>}

        {data && (
          <div className="pt-tape ek-tear">
            <div className="pt-tape__head">
              <div className="pt-tape__shop">{data.shopName}</div>
              {data.shopAddress && <div>{data.shopAddress}</div>}
              {data.shopPhone && <div>{data.shopPhone}</div>}
            </div>

            <div className="pt-hr" />

            <div className="pt-tape__row"><span>Chek</span><span>{data.receiptNo}</span></div>
            <div className="pt-tape__row">
              <span>Sana</span>
              <span>{new Date(data.date).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
            {data.cashierName && (
              <div className="pt-tape__row"><span>Kassir</span><span>{data.cashierName}</span></div>
            )}

            <div className="pt-hr" />

            {/* Qatorlar: nom alohida satrda — uzun nom kesilmasin */}
            {data.lines.map((l, i) => (
              <div className="pt-line" key={i}>
                <div className="pt-line__name">{l.name}</div>
                <div className="pt-tape__row">
                  <span>
                    {money(l.quantity)} {UNIT_LABEL[l.unit] || ""} × {money(l.price)}
                  </span>
                  <span>{money(l.sum)}</span>
                </div>
              </div>
            ))}

            <div className="pt-hr" />

            {Number(data.discount) > 0 && (
              <div className="pt-tape__row"><span>Chegirma</span><span>−{money(data.discount)}</span></div>
            )}
            {Number(data.loyaltyDiscount) > 0 && (
              <div className="pt-tape__row">
                <span>{data.loyaltyTierName || "Sodiqlik"}</span>
                <span>−{money(data.loyaltyDiscount)}</span>
              </div>
            )}
            {Number(data.bonusUsed) > 0 && (
              <div className="pt-tape__row"><span>Ball ishlatildi</span><span>−{money(data.bonusUsed)}</span></div>
            )}

            <div className="pt-tape__row pt-total">
              <span>JAMI</span><span>{money(data.total)}</span>
            </div>
            <div className="pt-tape__row">
              <span>To'lov</span><span>{PAY_LABEL[data.paymentType] || data.paymentType || "—"}</span>
            </div>

            {Number(data.bonusEarned) > 0 && (
              <>
                <div className="pt-hr" />
                <div className="pt-tape__row pt-earn">
                  <span>Ball yig'ildi</span><span>+{money(data.bonusEarned)}</span>
                </div>
              </>
            )}

            {data.returned && (
              <div className="pt-returned">QAYTARILGAN</div>
            )}

            {/* Fiskal blok — faqat HAQIQATAN fiskallashgan bo'lsa
                (qog'oz chekda ham aynan shu shart). */}
            {data.fiscalSign && (
              <>
                <div className="pt-hr" />
                <div className="pt-tape__row"><span>Fiskal belgi</span><span>{data.fiscalSign}</span></div>
                {data.fiscalQrUrl && (
                  <div className="pt-fiscalqr"
                       dangerouslySetInnerHTML={{ __html: qrSvg(data.fiscalQrUrl, { size: 110, margin: 1 }) }} />
                )}
              </>
            )}

            <div className="pt-hr" />
            <div className="pt-center pt-barcode"
                 dangerouslySetInnerHTML={{ __html: code128Svg(`S-${String(data.id).padStart(6, "0")}`) }} />
            <div className="pt-center pt-tape__no">S-{String(data.id).padStart(6, "0")}</div>
            <div className="pt-center pt-thanks">Xarid uchun rahmat!</div>
            <div className="pt-center pt-tape__site">e-kassam.uz</div>
          </div>
        )}
      </div>
    </div>
  );
}
