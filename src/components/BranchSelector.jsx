import { useEffect, useState } from "react";
import { shopApi } from "../api";
import { useAuth } from "../hooks/useAuth";

export default function BranchSelector({ selectedId, onSelect, style = {} }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  const isOwnerOrAdmin = user?.role === "OWNER" || user?.role === "SHOP_ADMIN" || user?.role === "ADMIN";

  useEffect(() => {
    if (isOwnerOrAdmin) {
      setLoading(true);
      shopApi.getBranches()
        .then(res => setBranches(res.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOwnerOrAdmin]);

  if (!isOwnerOrAdmin) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, ...style }}>
      <i className="fa-solid fa-store text-muted" style={{ fontSize: 14 }} title="Filial" />
      <select 
        className="form-input" 
        style={{ width: "auto", minWidth: 180, height: 32, fontSize: 13, padding: "0 10px" }}
        value={selectedId || ""}
        onChange={(e) => onSelect(e.target.value || null)}
        disabled={loading}
      >
        <option value="">🏠 Asosiy do'kon</option>
        {branches.map(b => (
          <option key={b.id} value={b.id}>
            📍 {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
