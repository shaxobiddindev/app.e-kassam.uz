import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../config";
import { code128Svg } from "../lib/ek-barcode";
import { qrSvg } from "../lib/ek-qr";
import { saveReceiptPdf } from "../lib/ek-receipt-pdf";
import CodeZoom from "../components/CodeZoom";

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
 * Chek UCH yo'l bilan ochiladi — ko'rinishi uchalasida ham bir xil:
 *   · KABINETDAN (brauzer) — `token` + `id`;
 *   · TELEFON ILOVASIDAN — `appToken` + `id` + `customerId` (mijozning
 *     har do'konda alohida yozuvi bor, shuning uchun qaysi biri ekani
 *     ham aytiladi);
 *   · QOG'OZ CHEKDAGI QR dan — `signedId` + `signature`, kalitsiz.
 * Oxirgisi ataylab kalitsiz: chekni qo'lida ushlab turgan odam uni
 * allaqachon ko'rgan, imzo esa faqat SHU chekni ochadi.
 *
 * ⚠ Chek KO'RINISHI bitta faylda qoladi. Ilova uchun alohida nusxa
 * yozilsa, qog'oz chekka kiritilgan har o'zgarish ikki joyda qilinishi
 * kerak bo'lardi — va bittasi albatta unutilardi.
 */
export default function Receipt({ token, appToken, customerId, id, signedId, signature, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  /* Qaysi kod kattalashtirilgan: `null` · `"qr"` (fiskal) · `"bar"` (chek raqami) */
  const [zoom, setZoom] = useState(null);
  /* PDF chiqarishda ekrandagi tasmaning AYNAN O'ZI nusxalanadi — chek
     ko'rinishi ikkinchi marta yozilmasin (yuqoridagi izohga qarang). */
  const tapeRef = useRef(null);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    let url;
    let headers = {};
    if (signedId) {
      url = `${API_BASE}/public/portal/receipt/${signedId}?k=${encodeURIComponent(signature)}`;
    } else if (appToken) {
      url = `${API_BASE}/app/receipts/${id}?c=${encodeURIComponent(customerId)}`;
      headers = { "X-App-Token": appToken };
    } else {
      url = `${API_BASE}/public/portal/receipts/${id}`;
      headers = { "X-Portal-Token": token };
    }

    fetch(url, { headers })
      .then((r) => r.json())
      .then((j) => {
        if (j.success === false) throw new Error(j.message);
        setData(j.data);
      })
      .catch((e) => setError(e.message || "Chekni ochib bo'lmadi"));
  }, [id, token, appToken, customerId, signedId, signature]);

  const savePdf = async () => {
    setPdfError("");
    try {
      await saveReceiptPdf(tapeRef.current, data ? `Chek ${data.receiptNo}` : "Chek");
    } catch (e) {
      setPdfError(e.message || "Saqlab bo'lmadi");
    }
  };

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
          <div className="pt-tape ek-tear" ref={tapeRef}>
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
                {/* ⚠ QATOR CHEGIRMASI — QOG'OZ CHEK BILAN BIR XIL (V57).
                    Qog'ozda u allaqachon chiqardi (`buildReceipt`), bu
                    yerda esa yo'q edi: mijoz ikkalasini yonma-yon qo'yib
                    solishtiradi va farq ishonchni yo'qotadi. Undan ham
                    yomoni — chegirma ko'rinmasa, tushirilgan narx XATO
                    bo'lib tuyuladi: mijoz e'lon narxini eslaydi, chekda
                    esa boshqa raqam turadi. */}
                {Number(l.discount) > 0 && (
                  <div className="pt-tape__row pt-line__cut">
                    <span>Chegirma</span>
                    <span>−{money(l.discount)}</span>
                  </div>
                )}
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
                  /* Chekdagi kodlar ham bosiladi: fiskal QR ni soliq
                     ilovasi o'qiydi, chek shtrixini esa kassa skaneri —
                     ikkalasi ham kichkina chizilgan. */
                  <button type="button" className="pt-fiscalqr ek-code-btn"
                          onClick={() => setZoom("qr")} aria-label="Fiskal QR ni kattalashtirish"
                          dangerouslySetInnerHTML={{ __html: qrSvg(data.fiscalQrUrl, { size: 110, margin: 1 }) }} />
                )}
              </>
            )}

            <div className="pt-hr" />
            <button type="button" className="pt-center pt-barcode ek-code-btn"
                    onClick={() => setZoom("bar")} aria-label="Shtrix kodni kattalashtirish"
                    dangerouslySetInnerHTML={{ __html: code128Svg(`S-${String(data.id).padStart(6, "0")}`) }} />
            <div className="pt-center pt-tape__no">S-{String(data.id).padStart(6, "0")}</div>
            <div className="pt-center pt-thanks">Xarid uchun rahmat!</div>
            <div className="pt-center pt-tape__site">e-kassam.uz</div>
          </div>
        )}

        {/* ⚠ Tugma tasmadan TASHQARIDA: PDF'ga `.pt-tape` tugunining nusxasi
            tushadi va o'z ichidagi tugma qog'ozga chiqib qolardi. */}
        {data && (
          <div className="pt-actions">
            <button type="button" className="btn btn-primary" onClick={savePdf}>
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> PDF qilib saqlash
            </button>
            {pdfError && <div className="pt-actions__err">{pdfError}</div>}
          </div>
        )}

        {zoom && data && (
          <CodeZoom
            kind={zoom}
            value={zoom === "qr" ? data.fiscalQrUrl : `S-${String(data.id).padStart(6, "0")}`}
            caption={zoom === "bar" ? `S-${String(data.id).padStart(6, "0")}` : null}
            onClose={() => setZoom(null)} />
        )}
      </div>
    </div>
  );
}
