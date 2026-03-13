import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';

export async function requestContactsPermission(): Promise<'granted' | 'denied'> {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/**
 * Normalize a raw phone number to E.164 format.
 * Handles US numbers only (10 digits or 11 digits starting with 1).
 * Returns null for numbers that can't be safely normalized.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return null;
}

export async function hashPhone(normalized: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
}

/**
 * Reads device contacts, normalizes and hashes all phone numbers.
 * Never sends raw numbers anywhere — only hashes are returned.
 */
export async function getContactHashes(): Promise<string[]> {
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  const hashSet = new Set<string>();
  await Promise.all(
    (data ?? []).map(async (contact) => {
      for (const pn of contact.phoneNumbers ?? []) {
        const normalized = normalizePhone(pn.number ?? '');
        if (!normalized) continue;
        const h = await hashPhone(normalized);
        hashSet.add(h);
      }
    }),
  );

  return Array.from(hashSet);
}
