import { useCallback, useEffect, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { labelApi, productApi } from "../../api";
import { asArray } from "../../lib/ek-array";
import Modal from "../Modal";
import { SkeletonList } from "./Loading";
import LabelQueue from "./LabelQueue";

/* ══════════════════════════════════════════════════════════════════════════
   TEZ CHOP ETISH (F5)

   ⚠ IKKINCHI YO'L EMAS, O'SHA YO'LNING QISQA KIRISHI. Tovarlar
   sahifasidan «yorliq» bosilganda ham AYNAN chop etish navbati
   ochiladi: o'sha joylashtiruvchi, o'sha chizuvchi, o'sha
   «chiqarildi» yozuvi. Ilgari bu ikkita alohida oyna edi va ular
   boshqa-boshqa ishlardi — javondagi yorliq qaysi biridan
   chiqqaniga qarab boshqacha ko'rinardi.

   ⚠ NAVBAT HAQIQIY: bu oyna yopilib qolsa ham ish yo'qolmaydi,
   «Yorliqlar» bo'limida o'sha navbat turaveradi.
   ══════════════════════════════════════════════════════════════════════════ */
export default function LabelPrintModal({ productIds = [], onClose, toast }) {
  const [job, setJob]     = useState(null);
  const [templates, setTemplates] = useState([]);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        labelApi.templates("SHELF"),
        productApi.getAll(),
      ]);
      const tpl = asArray(tRes.data);
      setTemplates(tpl);
      setProducts(asArray(pRes.data));

      const created = await labelApi.newJob({
        templateId: tpl.find((x) => x.isDefault)?.id ?? tpl[0]?.id ?? null,
        startPosition: 1,
      });
      const added = await labelApi.addToJob(created.data.id, {
        source: "PRODUCTS", productIds, quantityRule: "ONE",
      });
      setJob(added.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [productIds]);

  useEffect(() => { boot(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title={t("lbl.printTitle")} onClose={onClose} maxWidth={860}>
      {loading ? <SkeletonList rows={3} avatar={false} />
        : error ? <div className="form-hint form-hint--warn">{error}</div>
        : (
          <LabelQueue
            job={job} templates={templates} products={products}
            toast={toast} compact onChange={setJob}
          />
        )}
    </Modal>
  );
}
