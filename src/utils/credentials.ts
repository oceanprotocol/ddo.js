import {
  Credential as CredentialV4,
  Credentials as CredentialsV4
} from '../@types/DDO4/Credentials.js';
import {
  Credential as CredentialV5,
  CredentialAddressObject,
  CredentialAddressValue,
  Credentials as CredentialsV5
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

/** One allow/deny rule of a v4 or v5 DDO. */
export type CredentialRule = CredentialV4 | CredentialV5;

/** The `credentials` object of a v4 or v5 DDO or service. */
export type CredentialRules = CredentialsV4 | CredentialsV5;

/**
 * Checks a rule that ddo.js cannot check itself, such as `accessList` (needs a
 * chain call) or `verifiableCredential`.
 * @returns `true` if the consumer matches, `false` if not, `null` when the rule
 * type is unknown or unsupported. Errors thrown by the resolver propagate.
 */
export type CredentialResolver = (
  credential: CredentialRule,
  consumerAddress: string
) => Promise<boolean | null> | boolean | null;

/**
 * Checks a consumer against an `address` rule, ignoring letter case.
 * A `*` entry matches everyone; a rule without addresses matches no one.
 */
export function matchesAddressCredential(
  credential: { values?: readonly CredentialAddressValue[] } | null | undefined,
  consumerAddress: string
): boolean {
  if (typeof consumerAddress !== 'string') return false;
  const addresses = getCredentialAddresses(credential).map((address) =>
    address.toLowerCase()
  );
  if (addresses.length === 0) return false;
  if (addresses.includes('*')) return true;
  return addresses.includes(consumerAddress.toLowerCase());
}

/**
 * Checks a consumer against one allow/deny rule. `address` rules (any letter
 * case of the type) are checked here; every other type goes to `resolve`.
 * @returns `true`/`false` for a match or no match, `null` for a malformed rule,
 * or an unknown type when no resolver handles it.
 */
export async function evaluateCredential(
  credential: CredentialRule,
  consumerAddress: string,
  resolve?: CredentialResolver
): Promise<boolean | null> {
  if (!credential || typeof credential.type !== 'string') return null;
  if (credential.type.toLowerCase() === 'address') {
    return matchesAddressCredential(
      credential as { values?: readonly CredentialAddressValue[] },
      consumerAddress
    );
  }
  if (!resolve) return null;
  return await resolve(credential, consumerAddress);
}

async function evaluateCredentialList(
  list: readonly CredentialRule[],
  consumerAddress: string,
  matchRule: 'any' | 'all',
  listType: 'allow' | 'deny',
  resolve?: CredentialResolver
): Promise<boolean> {
  const results: boolean[] = [];
  for (const credential of list) {
    const result = await evaluateCredential(
      credential,
      consumerAddress,
      resolve
    );
    if (result === null) {
      // Unknown type in an allow list with match_allow 'all' denies access.
      // Everywhere else unknown types are ignored.
      if (listType === 'allow' && matchRule === 'all') return false;
    } else {
      results.push(result);
    }
  }
  if (results.length === 0) return false;
  return matchRule === 'any'
    ? results.some((result) => result)
    : results.every((result) => result);
}

const isMatchRule = (value: unknown): value is 'any' | 'all' =>
  value === 'any' || value === 'all';

/**
 * Decides whether a consumer may access an asset or service, from its
 * `credentials` rules. Same rules as ocean-node's `checkCredentials`:
 * 1. No credentials: allow.
 * 2. Deny list first, `match_deny` defaults to `'any'`: a match denies.
 * 3. Allow list, `match_allow` defaults to `'all'`: the result decides.
 *    With `'all'`, an unknown rule type denies; with `'any'` it is ignored.
 * 4. No allow list: allow.
 * Unknown types in the deny list are ignored. A `credentials` value that is set
 * but is not a plain object (an array or a scalar) denies access, as does a
 * deny or allow list that is set but is not an array (`null` included), or a
 * `match_deny` / `match_allow` other than `'any'` or `'all'` (e.g. `'ANY'`).
 * @param consumerAddress - The consumer address.
 * @param credentials - The asset-level or service-level `credentials`.
 * @param resolve - Checks rule types other than `address`, e.g. `accessList`.
 * @throws TypeError when `consumerAddress` is not a string.
 */
export async function evaluateCredentials(
  consumerAddress: string,
  credentials: CredentialRules | null | undefined,
  resolve?: CredentialResolver
): Promise<boolean> {
  if (typeof consumerAddress !== 'string') {
    throw new TypeError('evaluateCredentials expects a consumer address');
  }
  if (credentials === undefined || credentials === null) return true;
  // A set credentials value that is not a plain object (an array, as v5's
  // published `Credential[]` type allows, or a scalar) cannot carry allow/deny
  // lists, so it is malformed and denies access rather than silently allowing.
  const container: unknown = credentials;
  if (typeof container !== 'object' || Array.isArray(container)) return false;
  const { allow, deny } = credentials;
  // Only an absent mode takes the default. Invalid supplied modes deny access.
  const matchDeny: unknown =
    credentials.match_deny === undefined ? 'any' : credentials.match_deny;
  const matchAllow: unknown =
    credentials.match_allow === undefined ? 'all' : credentials.match_allow;
  if (!isMatchRule(matchDeny) || !isMatchRule(matchAllow)) return false;

  // A list that is set but is not an array (including `null`) denies access; a
  // list that is absent (`undefined`) is treated as no restriction.
  if (deny !== undefined) {
    if (!Array.isArray(deny)) return false;
    if (
      deny.length > 0 &&
      (await evaluateCredentialList(
        deny,
        consumerAddress,
        matchDeny,
        'deny',
        resolve
      ))
    ) {
      return false;
    }
  }

  if (allow !== undefined) {
    if (!Array.isArray(allow)) return false;
    if (allow.length > 0) {
      return evaluateCredentialList(
        allow,
        consumerAddress,
        matchAllow,
        'allow',
        resolve
      );
    }
  }
  return true;
}

/**
 * Result of `DDOManager.isConsumerAllowed`. When access is refused, `level`
 * says which credentials refused it, and `reason` whether the consumer was
 * denied or the service does not exist.
 */
export type ConsumerAccess =
  | { allowed: true }
  | {
      allowed: false;
      level: 'asset' | 'service';
      reason: 'denied' | 'service-not-found';
    };
