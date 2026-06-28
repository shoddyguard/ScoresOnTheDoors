"use client";

import { useState, useTransition } from "react";
import { createLockOverride } from "@/app/actions/admin";

interface CreateLockOverrideFormProps {
  tournamentId: string;
  users: { id: string; name: string }[];
  matches: { id: string; label: string }[];
}

export default function CreateLockOverrideForm({ tournamentId, users, matches }: CreateLockOverrideFormProps) {
  const [scope, setScope] = useState("Global");
  const [userId, setUserId] = useState("");
  const [matchId, setMatchId] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleCreate = () => {
    startTransition(async () => {
      try {
        await createLockOverride({
          tournamentId,
          scope,
          userId: scope === "User" || scope === "UserMatch" ? userId || undefined : undefined,
          matchId: scope === "Match" || scope === "UserMatch" ? matchId || undefined : undefined,
          reason: reason || undefined,
        });
        setMessage("Override created.");
        setReason("");
      } catch (e) {
        setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  };

  return (
    <div className="card p-5 space-y-4 max-w-lg">
      <h3>Create Override</h3>
      <div>
        <label className="form-label">Scope</label>
        <select value={scope} onChange={e => setScope(e.target.value)} className="form-input">
          <option value="Global">Global (all matches, all users)</option>
          <option value="Match">Match (all users for one match)</option>
          <option value="User">User (all matches for one user)</option>
          <option value="UserMatch">UserMatch (one user, one match)</option>
        </select>
      </div>
      {(scope === "User" || scope === "UserMatch") && (
        <div>
          <label className="form-label">User</label>
          <select value={userId} onChange={e => setUserId(e.target.value)} className="form-input">
            <option value="">- select user -</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}
      {(scope === "Match" || scope === "UserMatch") && (
        <div>
          <label className="form-label">Match</label>
          <select value={matchId} onChange={e => setMatchId(e.target.value)} className="form-input">
            <option value="">- select match -</option>
            {matches.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="form-label">Reason (optional)</label>
        <input value={reason} onChange={e => setReason(e.target.value)} className="form-input" placeholder="e.g. Back-entry for late joiners" />
      </div>
      {message && <p className="text-sm text-green-700">{message}</p>}
      <button onClick={handleCreate} disabled={isPending} className="btn-primary">
        {isPending ? "Creating…" : "Create Override"}
      </button>
    </div>
  );
}
