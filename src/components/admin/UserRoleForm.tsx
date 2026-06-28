"use client";

import { useState, useTransition } from "react";
import { setUserRole } from "@/app/actions/admin";

interface UserRoleFormProps {
  userId: string;
  currentRole: string;
  isSelf: boolean;
}

export default function UserRoleForm({ userId, currentRole, isSelf }: UserRoleFormProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticRole, setOptimisticRole] = useState(currentRole);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (isSelf) {
    return <span className="text-xs text-gray-400 italic">You</span>;
  }

  const targetRole = optimisticRole === "Admin" ? "Player" : "Admin";
  const label = optimisticRole === "Admin" ? "Make Player" : "Make Admin";

  const handleClick = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setUserRole(userId, targetRole);
        setOptimisticRole(targetRole);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to update role");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="btn-secondary text-xs py-1 px-2"
      >
        {isPending ? "…" : saved ? "Saved ✓" : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
