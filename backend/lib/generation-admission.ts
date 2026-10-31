export const GENERATION_WINDOW_MS = 20 * 60 * 1000;
const MAX_CALLS_PER_WINDOW = 4;
const MAX_TRACKED_CLIENTS = 2000;

export type GenerationLimiter = (request: Request) => boolean;

export function createInMemoryGenerationLimiter(
  now: () => number = Date.now,
): GenerationLimiter {
  const callsByClient = new Map<string, { count: number; resetAt: number }>();

  return function takeGenerationSlot(request: Request): boolean {
    // These headers are safe to use only when the hosting proxy overwrites them.
    // This per-process limit is a backstop for local/single-instance runs, not a deployment quota.
    const forwarded = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();
    const clientKey = (
      forwarded ||
      request.headers.get("x-real-ip") ||
      "local"
    ).slice(0, 64);
    const currentTime = now();
    const current = callsByClient.get(clientKey);

    if (callsByClient.size >= MAX_TRACKED_CLIENTS && !current) {
      for (const [key, entry] of callsByClient) {
        if (entry.resetAt <= currentTime) callsByClient.delete(key);
      }
      if (callsByClient.size >= MAX_TRACKED_CLIENTS) return false;
    }

    if (!current || current.resetAt <= currentTime) {
      callsByClient.set(clientKey, {
        count: 1,
        resetAt: currentTime + GENERATION_WINDOW_MS,
      });
      return true;
    }
    if (current.count >= MAX_CALLS_PER_WINDOW) return false;
    current.count += 1;
    return true;
  };
}
