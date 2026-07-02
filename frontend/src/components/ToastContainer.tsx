import { useEffect, useState } from "react";
import { subscribeToast } from "./toast";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

const STYLES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-amber-200 bg-amber-50 text-amber-700",
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
