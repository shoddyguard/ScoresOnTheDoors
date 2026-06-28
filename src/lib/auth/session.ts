// getCurrentUser() is the single point of access for the logged-in user.
// All services and server actions use this abstraction - never session directly.
// This is the lever that makes swapping from Credentials to Entra ID low-churn:
// only this file and auth.ts need updating.

import { auth } from "./auth";
import type { UserRole } from "@/lib/domain/types";

export interface CurrentUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };
}

/** Throws if not authenticated. Use in server actions / route handlers. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/** Throws if not Admin. Use in admin server actions / route handlers. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "Admin") throw new Error("Not authorized");
  return user;
}
