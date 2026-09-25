"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type Toast = { id: number; text: string; tone: "error" | "info" };
let push: ((t: Omit<Toast, "id">) => void) | null = null;

export const toast = {
  error: (text: string) => push?.({ text, tone: "error" }),
  info: (text: string) => push?.({ text, tone: "info" }),
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let id = 0;
    push = (t) => {
      const toast = { ...t, id: ++id };
      setToasts((all) => [...all.slice(-2), toast]);
      setTimeout(() => setToasts((all) => all.filter((x) => x.id !== toast.id)), 3500);
    };
    return () => {
      push = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            role="status"
            className={`rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur ${
              t.tone === "error"
                ? "border-red-400/30 bg-red-950/80 text-red-100"
                : "border-gold/30 bg-panel/90 text-gold-soft"
            }`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
