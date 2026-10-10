"use client";

import { LucideProvider } from "lucide-react";

export function IconProvider({ children }: { children: React.ReactNode }) {
  return (
    <LucideProvider size={18} strokeWidth={1.75}>
      {children}
    </LucideProvider>
  );
}
