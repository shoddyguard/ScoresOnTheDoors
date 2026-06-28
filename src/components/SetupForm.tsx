"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInitialAdmin } from "@/app/actions/setup";

export default function SetupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createInitialAdmin({ fullName, username, email: email || undefined, password });
        router.push("/login");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create administrator");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-green-800">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-3xl font-bold text-white">ScoresOnTheDoors</h1>
          <p className="text-blue-200 mt-1">Welcome! Let&apos;s set up the administrator account.</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Create admin account</h2>
          <p className="text-sm text-gray-500 mb-6">
            This is a one-time setup because no administrator exists yet.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="form-label">Full name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
                className="form-input"
                placeholder="e.g. Steve Brown"
                disabled={isPending}
              />
            </div>

            <div>
              <label htmlFor="username" className="form-label">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="form-input"
                placeholder="e.g. steve"
                disabled={isPending}
              />
            </div>

            <div>
              <label htmlFor="email" className="form-label">Email <span className="text-gray-400">(optional)</span></label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="form-input"
                placeholder="you@example.com"
                disabled={isPending}
              />
            </div>

            <div>
              <label htmlFor="password" className="form-label">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="form-input"
                placeholder="At least 8 characters"
                disabled={isPending}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" disabled={isPending} className="btn-primary w-full py-2.5">
              {isPending ? "Creating…" : "Create admin & continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
