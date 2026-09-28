import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "../components/Modal";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const resolver = useRef(null);

  const toast = useCallback((message, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setConfirmState(typeof opts === "string" ? { message: opts } : opts);
  }), []);

  const close = (value) => {
    resolver.current?.(value);
    setConfirmState(null);
  };

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
      {confirmState && (
        <Modal
          title={confirmState.title || "Konfirmasi"}
          onClose={() => close(false)}
          footer={<>
            <button className="btn" onClick={() => close(false)}>Batal</button>
            <button className={`btn ${confirmState.danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)} autoFocus>
              {confirmState.confirmText || "Ya, lanjutkan"}
            </button>
          </>}
        >
          <p style={{ margin: 0 }}>{confirmState.message}</p>
        </Modal>
      )}
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);
