import { hash, verify } from '@node-rs/argon2';

const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB (OWASP minimum recommendation for Argon2id)
  timeCost: 2,
  parallelism: 1,
};

// Precomputed dummy hash so login attempts for non-existent emails take the exact same CPU time
let cachedDummyHash: string | null = null;

export async function hashUserPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyUserPassword(
  passwordHash: string,
  candidatePassword: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, candidatePassword);
  } catch {
    return false;
  }
}

export async function verifyDummyPasswordForTimingProtection(
  candidatePassword: string,
): Promise<void> {
  if (!cachedDummyHash) {
    cachedDummyHash = await hash('wave-records-dummy-timing-password-2026', ARGON2_OPTIONS);
  }
  await verify(cachedDummyHash, candidatePassword).catch(() => false);
}
