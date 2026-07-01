import type { ReactNode } from "react";

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">{title}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 text-lg leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
