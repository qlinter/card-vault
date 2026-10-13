"use client";

import { PageRecovery } from "@/components/page-recovery";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageRecovery reset={reset} />;
}
