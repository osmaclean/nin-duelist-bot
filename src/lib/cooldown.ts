const cooldowns = new Map<string, number>();

/**
 * Checks if a user action is allowed based on cooldown.
 * Returns true if allowed (and records the usage), false if on cooldown.
 */
export function checkCooldown(key: string, cooldownMs: number): boolean {
  const now = Date.now();
  const lastUsage = cooldowns.get(key);

  if (lastUsage && now - lastUsage < cooldownMs) {
    return false;
  }

  cooldowns.set(key, now);
  return true;
}

/**
 * Returns remaining cooldown time in seconds, or 0 if not on cooldown.
 */
export function getRemainingCooldown(key: string, cooldownMs: number): number {
  const now = Date.now();
  const lastUsage = cooldowns.get(key);

  if (!lastUsage) return 0;

  const remaining = cooldownMs - (now - lastUsage);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/** Max age before an entry is eligible for cleanup (1 hour) */
const MAX_ENTRY_AGE_MS = 60 * 60 * 1000;

/** Interval between cleanup sweeps (10 minutes) */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/** Removes entries older than MAX_ENTRY_AGE_MS to prevent unbounded growth. */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let removed = 0;
  for (const [key, timestamp] of cooldowns) {
    if (now - timestamp > MAX_ENTRY_AGE_MS) {
      cooldowns.delete(key);
      removed++;
    }
  }
  return removed;
}

/** Starts periodic cleanup. Returns the timer ref for shutdown. */
export function startCooldownCleanup(): ReturnType<typeof setInterval> {
  return setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

/** Clears all cooldowns. Useful for testing. */
export function clearAllCooldowns(): void {
  cooldowns.clear();
}
