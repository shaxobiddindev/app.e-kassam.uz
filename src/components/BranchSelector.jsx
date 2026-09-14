import { useEffect, useState } from "react";
import { shopApi } from "../api";
import { useAuth } from "../hooks/useAuth";
import Select from "./ek/Select";
import { t } from "../lib/ek-i18n";
import { asArray } from "../lib/ek-array";
import { hasRole } from "../lib/ek-roles";

export default function BranchSelector({ selectedId, onSelect, style = {} }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ⚠ `hasRole`, ANIQ TENGLIK EMAS. Sessiyada rol bir NECHTA bo'lishi
     mumkin va vergul bilan saqlanadi (`"OWNER,CASHIER"`), ba'zi kirish
     yo'llari esa `ROLE_` prefiksi bilan yozadi. Aniq tenglik ikkala
     holatda ham YOLG'ON beradi va butun boshqaruv tugmalari jimgina
     yo'qolardi — do'kon egasi «maxsulot kiritish yo'q» deb qolardi
     (2026-09-14, jonli serverda o'lchandi).

     ⚠ `OWNER` ro'yxatga yozilmaydi: `hasRole` uni o'zi o'tkazadi. */
  const isOwnerOrAdmin = hasRole(user?.role, ["SHOP_ADMIN", "ADMIN"]);

  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    setLoading(true);
    shopApi.getBranches()
      .then((res) => setBranches(asArray(res.data)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOwnerOrAdmin]);

  if (!isOwnerOrAdmin) return null;

  const options = [
    { value: "", label: "Asosiy do'kon", icon: "fa-store" },
    ...branches.map((b) => ({ value: String(b.id), label: b.name, icon: "fa-code-branch" })),
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", ...style }}>
      <Select
        /* Filiallar ham MA'LUMOT ro'yxati — o'sib boradi. */
        searchable
        value={selectedId ? String(selectedId) : ""}
        onChange={(v) => onSelect(v || null)}
        options={options}
        disabled={loading}
        ariaLabel={t("branch.label")}
        className="branch-select"
      />
    </div>
  );
}
