type ToastType = "success" | "error" | "info";
type Listener = (msg: string, type: ToastType) => void;

const listeners = new Set<Listener>();

export function subscribeToast(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showToast(message: string, type: ToastType = "info") {
  listeners.forEach((l) => l(message, type));
}
