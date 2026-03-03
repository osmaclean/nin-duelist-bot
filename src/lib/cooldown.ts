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

/** Clears all cooldowns. Useful for testing. */
export function clearAllCooldowns(): void {
  cooldowns.clear();
}
