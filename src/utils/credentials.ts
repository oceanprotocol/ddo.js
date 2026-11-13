import {
  CredentialAddressObject,
  CredentialAddressValue
} from '../@types/DDO5/Credential.js';

/**
 * Returns the addresses listed in an address-based allow/deny credential.
 * Accepts both entry formats: a plain address string, or an object `{ address }`.
 *
 * @param credential an address credential (`{ type: 'address', values: [...] }`)
 * @returns the address strings, or an empty array when there are none
 */
export function getCredentialAddresses(
  credential: { values?: readonly CredentialAddressValue[] } | null | undefined
): string[] {
  const values: unknown = credential?.values;
  if (!Array.isArray(values)) return [];
  return values.flatMap((value: unknown): string[] => {
    if (typeof value === 'string') return [value];
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as { address?: unknown }).address === 'string'
    ) {
      return [(value as CredentialAddressObject).address];
    }
    return [];
  });
}
