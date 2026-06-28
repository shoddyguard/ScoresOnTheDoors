// HTTP client for the OpenFootball JSON feed.
// Free, public-domain data - no API key required.
// Treats failures as non-fatal (returns null on error so the caller can log and continue).

import { FeedSchema, type Feed } from "./feedSchema";

const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchFeed(url: string): Promise<Feed> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ScoresOnTheDoors/1.0 (family prediction app)" },
      // Disable Next.js caching - we always want fresh data
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`OpenFootball feed returned HTTP ${response.status} for ${url}`);
  }

  const raw = await response.json();

  const parsed = FeedSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Feed schema validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}
