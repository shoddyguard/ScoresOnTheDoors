// Inline prediction entry form. Client component with optimistic UI.
"use client";

import { useActionState, useEffect, useState } from "react";
import { submitPrediction, type PredictionFormState } from "@/app/actions/predictions";
import { TeamName } from "@/components/TeamFlag";

interface PredictionFormProps {
  matchId: string;
  stageKind: "Group" | "Knockout";
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  existing?: {
    homeGoals: number;
    awayGoals: number;
    predictedAdvancingTeamId?: string | null;
  };
}

const initialState: PredictionFormState = { success: false };

export default function PredictionForm({
  matchId,
  stageKind,
  homeTeam,
  awayTeam,
  existing,
}: PredictionFormProps) {
  const [state, formAction, isPending] = useActionState(submitPrediction, initialState);
  const [homeGoals, setHomeGoals] = useState(existing?.homeGoals ?? 0);
  const [awayGoals, setAwayGoals] = useState(existing?.awayGoals ?? 0);
  const [advancingTeamId, setAdvancingTeamId] = useState(existing?.predictedAdvancingTeamId ?? "");

  // Knockout: auto-set advancing team when score is decisive
  const isKnockout = stageKind === "Knockout";
  const isDraw = homeGoals === awayGoals;
  const autoAdvancer = !isDraw
    ? (homeGoals > awayGoals ? homeTeam?.id : awayTeam?.id) ?? ""
    : advancingTeamId;

  useEffect(() => {
    if (isKnockout && !isDraw) {
      setAdvancingTeamId(homeGoals > awayGoals ? homeTeam?.id ?? "" : awayTeam?.id ?? "");
    }
  }, [homeGoals, awayGoals, isKnockout, isDraw, homeTeam?.id, awayTeam?.id]);

  const GoalInput = ({
    value,
    onChange,
  }: {
    value: number;
    onChange: (v: number) => void;
  }) => (
    <input
      type="number"
      min={0}
      max={20}
      value={value}
      onChange={(e) => onChange(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
      className="w-14 text-center rounded border-gray-300 text-sm py-1 focus:ring-blue-500 focus:border-blue-500 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
    />
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="homeGoals" value={homeGoals} />
      <input type="hidden" name="awayGoals" value={awayGoals} />
      {isKnockout && (
        <input type="hidden" name="predictedAdvancingTeamId" value={isDraw ? advancingTeamId : autoAdvancer} />
      )}

      {/* Score inputs */}
      <div className="flex items-center gap-2">
        <GoalInput value={homeGoals} onChange={setHomeGoals} />
        <span className="text-gray-400 text-sm font-medium">–</span>
        <GoalInput value={awayGoals} onChange={setAwayGoals} />
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary py-1 px-3 text-xs"
        >
          {isPending ? "…" : existing ? "Update" : "Save"}
        </button>
      </div>

      {/* Knockout advancing team selector (only shown when predicted score is a draw) */}
      {isKnockout && isDraw && homeTeam && awayTeam && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Advances:</span>
          <select
            value={advancingTeamId}
            onChange={(e) => setAdvancingTeamId(e.target.value)}
            className="rounded border-gray-300 text-xs py-0.5"
          >
            <option value="">- pick team -</option>
            <option value={homeTeam.id}>{homeTeam.name}</option>
            <option value={awayTeam.id}>{awayTeam.name}</option>
          </select>
        </div>
      )}

      {/* Knockout: show auto-set advancer when score is decisive */}
      {isKnockout && !isDraw && (
        <p className="text-xs text-gray-400">
          Advances: <TeamName name={homeGoals > awayGoals ? homeTeam?.name : awayTeam?.name} />
        </p>
      )}

      {/* Error / success feedback */}
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="text-xs text-green-600">Saved ✓</p>}
    </form>
  );
}
