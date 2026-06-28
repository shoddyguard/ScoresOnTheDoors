"use client";

import { useState, useTransition } from "react";
import { triggerSync } from "@/app/actions/admin";
import { useRouter } from "next/navigation";

interface SyncButtonProps {
  tournamentId: string;
}

export default function SyncButton({ tournamentId }: SyncButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleSync = () => {
    startTransition(async () => {
      try {
        const { logId } = await triggerSync(tournamentId);
        setMessage(`Sync triggered (log: ${logId}). Refreshing in 3 s…`);
        setTimeout(() => router.refresh(), 3000);
      } catch (e: unknown) {
        setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  };

  return (
    <div className="space-y-3">
      <button onClick={handleSync} disabled={isPending} className="btn-primary">
        {isPending ? "Syncing…" : "🔄 Sync Now"}
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
