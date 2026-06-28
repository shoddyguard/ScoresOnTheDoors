"use client";

import { useState, useTransition } from "react";
import { setStartingScore } from "@/app/actions/admin";

interface StartingScoreFormProps {
  userId: string;
  currentScore: number;
}

export default function StartingScoreForm({ userId, currentScore }: StartingScoreFormProps) {
  const [value, setValue] = useState(currentScore);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      await setStartingScore(userId, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(parseInt(e.target.value) || 0)}
        className="w-20 text-center rounded border-gray-300 text-sm py-1"
      />
      <button onClick={handleSave} disabled={isPending || value === currentScore} className="btn-secondary text-xs py-1">
        {isPending ? "…" : saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
