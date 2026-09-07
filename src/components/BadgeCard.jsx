import { forwardRef } from "react";
import { t } from "../lib/ek-i18n";
import { qrSvg } from "../lib/ek-qr";

/* ══════════════════════════════════════════════════════════════════════════
   BAJIK KARTOCHKASI (V110)

   Do'kon egasi: «bajikni fayl sifatida olish imkonini qilish kerak,
   chunki har doim ham printer bo'lmasligi mumkin».

   ═══ NEGA KERAK BO'LDI ═════════════════════════════════════════════════

   Bajik shu paytgacha FAQAT ish stoli ilovasidagi chek printeriga
   chiqardi. Brauzerda esa QR umuman chizilmasdi: oynada ism va
   «@login» turardi, sir (token) bir marta ko'rinib, «Yopish» bilan
   birga YO'QOLARDI.

   Ya'ni printersiz do'konda bajik chiqarib bo'lmasdi — chiqarilardi,
   lekin uni hech qayerga olib bo'lmasdi. Bu esa butun qo'riqlash
   tizimini (bajik so'raladigan amallar) ishlatib bo'lmaydigan qilib
   qo'yardi.

   ═══ ⚠ NEGA ICHKI USLUBLAR (inline) ════════════════════════════════════

   Kartochka faylga saqlanganda `outerHTML` sifatida NUSXALANADI va
   yangi hujjatga qo'yiladi — u yerda ilovaning `styles.css` i YO'Q.

   Uslublarni ikkinchi jadvalga ko'chirish mumkin edi, lekin aynan shu
   ikkilanish V109 da ikkita teshik bergan: chek ekranda bir xil,
   PDF da boshqacha ko'rinardi. Ichki uslublar nusxa bilan BIRGA
   ketadi va ular hech qachon ajralib qololmaydi.

   ⚠ Ranglar tokendan EMAS, qat'iy: hujjat oq qog'ozda chiqadi va
   ilovaning qorong'i temasi unga yetib bormasligi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

const S = {
  card: {
    width: 280, margin: "0 auto", padding: "18px 16px", textAlign: "center",
    background: "#ffffff", color: "#111111",
    border: "2px solid #111111", borderRadius: 12,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  title: { fontSize: 13, fontWeight: 800, letterSpacing: ".18em" },
  shop:  { fontSize: 12, marginTop: 2 },
  rule:  { borderTop: "1px solid #111111", margin: "10px 0" },
  name:  { fontSize: 17, fontWeight: 800, lineHeight: 1.3 },
  meta:  { fontSize: 12, marginTop: 3, color: "#444444" },
  qr:    { display: "flex", justifyContent: "center", margin: "12px 0 8px" },
  date:  { fontSize: 11, color: "#444444" },
  warn:  { fontSize: 10.5, lineHeight: 1.5, marginTop: 8, textAlign: "left" },
};

/**
 * @param badge  `{ fullName, username, version, token }` — serverdan
 *               chiqarilgan bajik. `token` FAQAT shu onda mavjud.
 * @param shopName do'kon nomi — qog'ozda kimning bajigi ekani ko'rinsin.
 */
const BadgeCard = forwardRef(function BadgeCard({ badge, shopName }, ref) {
  if (!badge) return null;
  return (
    /* ⚠ `data-badge-card` — SINF EMAS, BELGI: uslub bermaydi va
       shuning uchun uni CSS da qidirib ovora bo'lish shart emas.
       U faqat brauzer tekshiruviga (`check-badge.mjs`) kartochkani
       oynadagi boshqa ramkali qutilardan ajratib beradi. */
    <div ref={ref} data-badge-card style={S.card}>
      <div style={S.title}>{t("badge.printTitle")}</div>
      <div style={S.shop}>{shopName || "E-KASSAM.UZ"}</div>
      <div style={S.rule} />

      <div style={S.name}>{badge.fullName || badge.username || "-"}</div>
      <div style={S.meta}>
        @{badge.username || "-"} · {t("badge.version")} {badge.version ?? 1}
      </div>

      {/* ⚠ QR — KARTOCHKANING O'ZAGI. Ilgari u brauzerda umuman
          chizilmasdi va oynada faqat ism turardi: qog'ozsiz do'kon
          uchun bajik shunchaki mavjud emas edi.

          `margin: 1` — QR atrofidagi oq hoshiya. Usiz skaner
          kartochkaning qora ramkasini kodning bir qismi deb o'qib,
          ba'zan umuman tanimasdi. */}
      <div style={S.qr}
           dangerouslySetInnerHTML={{ __html: qrSvg(badge.token || "", { size: 150, margin: 1 }) }} />

      <div style={S.date}>{new Date().toLocaleString("uz-UZ")}</div>
      <div style={S.rule} />
      {/* Ogohlantirish qog'ozning O'ZIDA: bajikni topgan odam ham,
          egasi ham qoidani ko'rib turishi kerak. */}
      <div style={S.warn}>{t("badge.printWarn")}</div>
    </div>
  );
});

export default BadgeCard;
