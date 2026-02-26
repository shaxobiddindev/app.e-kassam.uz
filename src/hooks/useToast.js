import { useState, useCallback } from "react";

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => showToast(msg, "success"),
    error:   (msg) => showToast(msg, "error"),
    info:    (msg) => showToast(msg, "info"),
    warning: (msg) => showToast(msg, "warning"),
  };

  return { toasts, toast, dismiss };
}
