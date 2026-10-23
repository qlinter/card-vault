"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
export function PendingSubmitButton({ children, className = "btn btn-secondary" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-busy={pending}>{children}</button>;
}
