import { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { qrSvg } from "../lib/ek-qr";
import { saveReceiptPdf } from "../lib/ek-receipt-pdf";
import { groupDigits } from "../lib/ek-format";
import { useRef } from "react";
import Overlay from "../components/ek/Overlay";

/* ══════════════════════════════════════════════════════════════════════════
   QARZ JURNALINING CHEKI (V61) — «QARZ OLINDI» va «QARZ TO'LANDI»

   ═══ NEGA XARID CHEKIDAN ALOHIDA FAYL ══════════════════════════════════

   `Receipt.jsx` ni shartlar bilan ikkiga bo'lish yo'li ham bor edi. Lekin
   ikkala chekning YARMI bir-biriga kerak emas: to'lovda tovar qatorlari,
   ball, fiskal belgi va shtrix YO'Q; xaridda esa «qolgan qarz» satri yo'q.
   Bitta faylga siqilsa, har satr `data.lines ? … : …` bo'lib, ikkalasini
   ham o'qib bo'lmas edi — va ikkalasidan biriga tegilganda ikkinchisi
   sinardi.

   ⚠ TASMANING KO'RINISHI esa BIR XIL sinflardan (`pt-tape`, `pt-hr`,
   `pt-tape__row`) yig'iladi: mijoz ikkala chekni bitta do'kondan olgan
   deb bilishi kerak.

   Chek UCH yo'l bilan ochiladi va ko'rinishi uchalasida bir xil:
     · KASSADA        — `data` to'g'ridan-to'g'ri uzatiladi (to'lov javobi);
     · QOG'OZDAGI QR  — `signedId` + `signature`, kalitsiz;
     · ILOVA/KABINET  — `id` + (`appToken` + `customerId`) yoki `token`.
   ══════════════════════════════════════════════════════════════════════════ */

/* ⚠ `groupDigits` — TIZIMNING YAGONA GURUHLAGICHI (02-DESIGN-SYSTEM.md).
   `Intl.NumberFormat("uz-UZ")` brauzerga qarab VERGUL qaytaradi va
   mijoz SMS da «500 000», chekda esa «500,000» ko'rib, ikkalasi bir xil
   summami deb o'ylardi. Xuddi shu xato mijoz ilovasida bir marta
   tuzatilgan edi — bu yerda uni takrorlamaymiz.

   ⚠ To'lov chekida MIQDOR YO'Q (faqat pul), shuning uchun `groupDigits`
   ning butunlashtirishi bu yerda xavfsiz. */
const money = (v) => groupDigits(v);

const PAY_LABEL = {
  CASH: "Naqd", CARD: "Karta", CLICK: "Click", PAYME: "Payme", TRANSFER: "O'tkazma",
};

const when = (v) =>
  new Date(v).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" });

export default function PaymentReceipt({
  data: given, token, appToken, customerId, id, signedId, signature, onClose,
}) {
  const [data, setData] = useState(given || null);
  const [error, setError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const tapeRef = useRef(null);

  useEffect(() => {
    /* Kassa chekni to'lov javobidan tayyor oladi — qayta so'rashning
       ma'nosi yo'q va u qo'shimcha kutish bo'lardi. */
    if (given) { setData(given); return; }

    let url;
    let headers = {};
    if (signedId) {
      url = `${API_BASE}/public/portal/payment/${signedId}?k=${encodeURIComponent(signature)}`;
    } else if (appToken) {
      url = `${API_BASE}/app/payments/${id}?c=${encodeURIComponent(customerId)}`;
      headers = { "X-App-Token": appToken };
    } else {
      url = `${API_BASE}/public/portal/payments/${id}`;
      headers = { "X-Portal-Token": token };
    }

    fetch(url, { headers })
      .then((r) => r.json())
      .then((j) => {
        if (j.success === false) throw new Error(j.message);
        setData(j.data);
      })
      .catch((e) => setError(e.message || "Chekni ochib bo'lmadi"));
  }, [given, id, token, appToken, customerId, signedId, signature]);

  const savePdf = async () => {
    setPdfError("");
    try {
      await saveReceiptPdf(tapeRef.current, data ? `Chek ${data.receiptNo}` : "Chek");
    } catch (e) {
      setPdfError(e.message || "Saqlab bo'lmadi");
    }
  };

  /* ⚠ IKKI HUJJAT, BITTA SHAKL. `kind` ni O'QIMASDAN chizib bo'lmaydi:
     shakli bir xil, ma'nosi TESKARI — birida pul do'konga kelgan,
     ikkinchisida tovar mijozga ketgan. Farq ko'rinmasa, qarz cheki
     to'lov cheki bo'lib o'qilardi va mijoz «to'lagandim» deb aynan shu
     qog'ozni ko'rsatardi.

     ⚠ Eski javoblarda `kind` bo'lmasligi mumkin — o'shanda TO'LOV deb
     hisoblanadi, chunki V62 gacha faqat to'lovning cheki bor edi. */
  const charge = data?.kind === "CHARGE";
  /* «Qarz yopildi» faqat TO'LOVDA ma'noga ega: qarz olib, qoldig'i nol
     bo'lishi mumkin emas. */
  const cleared = data && !charge && Number(data.balanceAfter) === 0;

  return (
    /* ⚠ `Overlay` SHART, qo'lda yozilgan `<div className="pt-modal">` EMAS.
       Oddiy `div` sahifa daraxtida qoladi, `Modal` esa portal orqali
       `body` OXIRIGA tushadi — natijada qarz oynasidan ochilgan chek
       uning ORQASIDA qolardi (do'kon egasi aynan shuni ko'rsatdi).
       `Overlay.jsx` izohi bu xatodan ogohlantirgan edi: «boshqa oynadan
       ochilgan oyna DOM da undan OLDIN turib qolishi mumkin».

       Esc ham shu yerdan: `Overlay` uni FAQAT eng ustidagi oynaga
       beradi, ya'ni Esc chekni yopadi-yu, ostidagi qarz oynasini
       ochiq qoldiradi. Qo'lda yozilgan ishlovchi ikkalasini birdan
       yopardi. */
    <Overlay className="pt-modal" onClick={onClose} onEscape={onClose}
             role="dialog" aria-modal="true">
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
              {/* ⚠ Sarlavha SHART: xarid cheki bilan bir xil tasmada
                  chiqadi va ularni ajratib turadigan yagona narsa shu
                  qator. Usiz mijoz to'lovni xarid deb o'ylardi. */}
              <div className="pt-tape__kind">{charge ? "QARZ OLINDI" : "QARZ TO'LOVI"}</div>
            </div>

            <div className="pt-hr" />

            <div className="pt-tape__row"><span>Chek</span><span>{data.receiptNo}</span></div>
            <div className="pt-tape__row"><span>Sana</span><span>{when(data.date)}</span></div>
            {data.customerName && (
              <div className="pt-tape__row"><span>Mijoz</span><span>{data.customerName}</span></div>
            )}
            {data.cashierName && (
              /* ⚠ Yorliq ham teskari: to'lovda pulni QABUL QILGAN,
                 qarzda esa qarzni BERGAN xodim. Bitta so'z qoldirilsa,
                 qarz chekida «qabul qildi» deb yozilib, mijoz pul
                 topshirgandek o'qilardi. */
              <div className="pt-tape__row">
                <span>{charge ? "Berdi" : "Qabul qildi"}</span><span>{data.cashierName}</span>
              </div>
            )}

            <div className="pt-hr" />

            <div className="pt-tape__row pt-total">
              <span>{charge ? "QARZGA OLINDI" : "TO'LANDI"}</span>
              <span>{money(data.amount)}</span>
            </div>
            {/* ⚠ Usul bo'sh bo'lishi mumkin (V61 dan oldingi to'lovlar) —
                o'shanda satr UMUMAN chiqmaydi. «—» yozib qo'yish
                mijozga «bu yerda nimadir yo'qolgan» degan taassurot
                berardi, aslida yozuv shunchaki eski. */}
            {data.method && !charge && (
              <div className="pt-tape__row">
                <span>To'lov turi</span><span>{PAY_LABEL[data.method] || data.method}</span>
              </div>
            )}

            <div className="pt-hr" />

            {data.balanceBefore != null && (
              <div className="pt-tape__row">
                <span>Qarz edi</span><span>{money(data.balanceBefore)}</span>
              </div>
            )}
            {data.balanceAfter != null && (
              /* ⚠ Chekning ENG MUHIM satri — mijoz aynan shuni qidiradi.
                 Nol ham yoziladi va yashil chiqadi: «qarzingiz qolmadi»
                 degan xabar qog'ozning butun ma'nosi. */
              <div className={`pt-tape__row pt-total ${cleared ? "pt-earn" : ""}`}>
                <span>{cleared ? "QARZ YOPILDI" : charge ? "JAMI QARZ" : "QOLDI"}</span>
                <span>{money(data.balanceAfter)}</span>
              </div>
            )}
            {data.reason && (
              <div className="pt-tape__row"><span>Izoh</span><span>{data.reason}</span></div>
            )}

            {/* ⚠ QR faqat KASSA javobida bo'ladi (`qrUrl`): mijoz o'z
                ekranida allaqachon chekning ichida va kod unga o'zini
                ko'rsatishdan boshqa hech narsa bermaydi. */}
            {data.qrUrl && (
              <>
                <div className="pt-hr" />
                <div className="pt-center"
                     dangerouslySetInnerHTML={{ __html: qrSvg(data.qrUrl, { size: 110, margin: 1 }) }} />
                <div className="pt-center pt-tape__no">Chekni telefonda ochish</div>
              </>
            )}

            <div className="pt-hr" />
            <div className="pt-center pt-tape__no">{data.receiptNo}</div>
            <div className="pt-center pt-thanks">Rahmat!</div>
            <div className="pt-center pt-tape__site">e-kassam.uz</div>
          </div>
        )}

        {/* ⚠ Tasmadan TASHQARIDA: PDF'ga `.pt-tape` nusxasi tushadi va
            ichidagi tugma qog'ozga chiqib qolardi. */}
        {data && (
          <div className="pt-actions">
            <button type="button" className="btn btn-primary" onClick={savePdf}>
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> PDF qilib saqlash
            </button>
            {pdfError && <div className="pt-actions__err">{pdfError}</div>}
          </div>
        )}
      </div>
    </Overlay>
  );
}
