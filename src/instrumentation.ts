// Next.js instrumentation hook - runs once when the server starts.
// Used to:
//  1. Enable SQLite WAL mode for better concurrent read performance.
//  2. Start the background OpenFootball sync scheduler.

export async function register() {
  // Only run in the Node.js runtime (not the Edge runtime)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/db/prisma");

  // WAL mode gives SQLite concurrent reads while one writer is active
  try {
    await prisma.$queryRaw`PRAGMA journal_mode=WAL`;
  } catch (err) {
    console.warn("[instrumentation] Could not set WAL mode:", err);
  }

  // Start the background sync scheduler (skip in tests)
  if (process.env.DISABLE_SYNC !== "true") {
    try {
      const { startSyncScheduler } = await import("@/lib/services/syncService");
      startSyncScheduler();
    } catch (err) {
      console.warn("[instrumentation] Could not start sync scheduler:", err);
    }
  }
}
