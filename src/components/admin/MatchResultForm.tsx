"use client";

import { useState, useTransition } from "react";
import { setManualResult } from "@/app/actions/admin";

interface MatchResultFormProps {
  matchId: string;
  stageKind: "Group" | "Knockout";
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  currentResult?: { homeGoals90: number; awayGoals90: number };
}

export default function MatchResultForm({
  matchId,
  stageKind,
  homeTeam,
  awayTeam,
  currentResult,
}: MatchResultFormProps) {
  const [open, setOpen] = useState(false);
  const [homeGoals, setHomeGoals] = useState(currentResult?.homeGoals90 ?? 0);
  const [awayGoals, setAwayGoals] = useState(currentResult?.awayGoals90 ?? 0);
  const [advancingTeamId, setAdvancingTeamId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = () => {
    startTransition(async () => {
      try {
        await setManualResult(matchId, homeGoals, awayGoals, stageKind === "Knockout" ? advancingTeamId || null : null);
        setMessage("Result saved and scores recomputed.");
        setOpen(false);
      } catch (e) {
        setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  };

  return open ? (
    <div className="space-y-2 w-full sm:w-auto">
      <div className="flex items-center gap-2">
        <input type="number" min={0} max={20} value={homeGoals} onChange={e => setHomeGoals(+e.target.value)} className="w-14 text-center rounded border-gray-300 text-sm py-1 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" />
        <span className="text-gray-400">–</span>
        <input type="number" min={0} max={20} value={awayGoals} onChange={e => setAwayGoals(+e.target.value)} className="w-14 text-center rounded border-gray-300 text-sm py-1 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" />
      </div>
      {stageKind === "Knockout" && (
        <select value={advancingTeamId} onChange={e => setAdvancingTeamId(e.target.value)} className="text-xs rounded border-gray-300 w-full">
          <option value="">- select advancing team -</option>
          {homeTeam && <option value={homeTeam.id}>{homeTeam.name}</option>}
          {awayTeam && <option value={awayTeam.id}>{awayTeam.name}</option>}
        </select>
      )}
      {message && <p className="text-xs text-gray-600">{message}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={isPending} className="btn-primary text-xs py-1 px-3">
          {isPending ? "Saving…" : "Save & Rescore"}
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
      </div>
    </div>
  ) : (
    <button onClick={() => setOpen(true)} className="btn-secondary text-xs py-1">
      Override Result
    </button>
  );
}
