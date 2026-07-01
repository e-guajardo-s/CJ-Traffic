import { useEffect, useState } from "react";
import { subscribeToast } from "./toast";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

const STYLES = {
  success: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  error: "border-red-500/50 bg-red-500/10 text-red-300",
  info: "border-amber-500/50 bg-amber-500/10 text-amber-300",
};

let seq = 0;

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToast((message, type) => {
      const id = seq++;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    });
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80">
      {toasts.map((t) => (
        <div key={t.id} className={`text-sm px-4 py-3 rounded-lg border shadow-lg ${STYLES[t.type]}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
