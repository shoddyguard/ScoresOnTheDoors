"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTournament } from "@/app/actions/admin";

const DEFAULT_FEED =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

export default function CreateTournamentForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("FIFA World Cup 2026");
  const [openFootballUrl, setOpenFootballUrl] = useState(DEFAULT_FEED);
  const [timeZoneId, setTimeZoneId] = useState("Europe/London");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createTournament({ name, openFootballUrl, timeZoneId });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create tournament");
      }
    });
  };

  return (
    <div className="card p-5 space-y-4 max-w-lg">
      <div>
        <h3>Create tournament</h3>
        <p className="text-sm text-gray-500 mt-1">
          Sets up the tournament and its Group and Knockout stages. After this, run a
          Sync to pull in teams, fixtures, and results.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="t-name" className="form-label">Name</label>
          <input
            id="t-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="form-input"
            placeholder="e.g. FIFA World Cup 2026"
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor="t-feed" className="form-label">
            OpenFootball feed URL <span className="text-gray-400">(used by Sync)</span>
          </label>
          <input
            id="t-feed"
            type="url"
            value={openFootballUrl}
            onChange={(e) => setOpenFootballUrl(e.target.value)}
            className="form-input"
            placeholder={DEFAULT_FEED}
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor="t-tz" className="form-label">Time zone</label>
          <input
            id="t-tz"
            type="text"
            value={timeZoneId}
            onChange={(e) => setTimeZoneId(e.target.value)}
            className="form-input"
            placeholder="Europe/London"
            disabled={isPending}
          />
          <p className="text-xs text-gray-400 mt-1">IANA time zone, used to compute local kickoff dates.</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Creating…" : "Create tournament"}
        </button>
      </form>
    </div>
  );
}
