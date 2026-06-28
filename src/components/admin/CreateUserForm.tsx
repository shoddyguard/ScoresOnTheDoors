"use client";

import { useState, useTransition } from "react";
import { createUser } from "@/app/actions/admin";

export default function CreateUserForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createUser({
          username: fd.get("username") as string,
          email: (fd.get("email") as string) || undefined,
          fullName: fd.get("fullName") as string,
          role: fd.get("role") as string,
          password: fd.get("password") as string,
        });
        setMessage("User created successfully.");
        (e.target as HTMLFormElement).reset();
        setOpen(false);
      } catch (err) {
        setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  };

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-primary">
          + Create User
        </button>
      ) : (
        <div className="card p-5">
          <h3 className="mb-4">Create New User</h3>
          <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
            <div>
              <label className="form-label">Full name</label>
              <input name="fullName" required className="form-input" />
            </div>
            <div>
              <label className="form-label">Username</label>
              <input name="username" required className="form-input" pattern="[a-z0-9_]+" title="Lowercase letters, numbers and underscores only" />
            </div>
            <div>
              <label className="form-label">Email (optional)</label>
              <input name="email" type="email" className="form-input" />
            </div>
            <div>
              <label className="form-label">Role</label>
              <select name="role" className="form-input">
                <option value="Player">Player</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="form-label">Initial password</label>
              <input name="password" type="password" required minLength={8} className="form-input" />
            </div>
            {message && <p className="text-sm text-green-700">{message}</p>}
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending ? "Creating…" : "Create"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
