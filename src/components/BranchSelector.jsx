import { useEffect, useState } from "react";
import { shopApi } from "../api";
import { useAuth } from "../hooks/useAuth";
import Select from "./ek/Select";
import { t } from "../lib/ek-i18n";

export default function BranchSelector({ selectedId, onSelect, style = {} }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  const isOwnerOrAdmin = user?.role === "OWNER" || user?.role === "SHOP_ADMIN" || user?.role === "ADMIN";

  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    setLoading(true);
    shopApi.getBranches()
      .then((res) => setBranches(res.data || []))
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
