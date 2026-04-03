import { createContext, useContext, useState, useCallback } from "react";
import ConfirmModal from "../components/ConfirmModal";

const ConfirmContext = createContext();

export function ConfirmProvider({ children }) {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    resolve: null,
    type: "info", // info, danger, warning
  });

  const confirm = useCallback(({ title, message, type = "info" }) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        resolve,
        type,
      });
    });
  }, []);

  const handleClose = useCallback((result) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [confirmState]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {confirmState.isOpen && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          type={confirmState.type}
          onConfirm={() => handleClose(true)}
          onCancel={() => handleClose(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}
