"use client";

import { useState, useTransition } from "react";
import { recomputeAllScores } from "@/app/actions/admin";

interface RecomputeButtonProps {
  tournamentId: string;
}

export default function RecomputeButton({ tournamentId }: RecomputeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const handleRecompute = () => {
    startTransition(async () => {
      try {
        const { count } = await recomputeAllScores(tournamentId);
        setResult(`Recomputed ${count} predictions successfully.`);
      } catch (e: unknown) {
        setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  };

  return (
    <div className="space-y-3">
      <button onClick={handleRecompute} disabled={isPending} className="btn-danger">
        {isPending ? "Recomputing…" : "⚠️ Recompute All Scores"}
      </button>
      {result && <p className="mt-3 text-sm text-gray-700">{result}</p>}
    </div>
  );
}
