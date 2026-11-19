import { getAddress, sha256, toUtf8Bytes } from 'ethers';

/** DID prefix of v4 and deprecated DDOs. */
export const DID_PREFIX_V4 = 'did:op:';
/** DID prefix of v5 DDOs. */
export const DID_PREFIX_V5 = 'did:ope:';

/** DDO family a DID is derived for. `deprecated` uses the v4 prefix. */
export type DidVersion = '4' | '5' | 'deprecated';

const DID_PATTERN = /^did:(op|ope):[0-9a-f]{64}$/;

/**
 * Hashes the checksummed NFT address followed by the chain id, as given.
 * Shared by `deriveDid` and `DDOManager.makeDid`.
 */
export function hashDid(
  prefix: string,
  nftAddress: string,
  chainId: string
): string {
  return (
    prefix + sha256(toUtf8Bytes(getAddress(nftAddress) + chainId)).slice(2)
  );
}

/**
 * Returns the DID prefix used by a DDO family.
 * @param version - `'4'`, `'5'` or `'deprecated'`.
 */
export function getDidPrefix(version: DidVersion): string {
  if (version === '5') return DID_PREFIX_V5;
  if (version === '4' || version === 'deprecated') return DID_PREFIX_V4;
  throw new TypeError(`Unsupported DID version: ${String(version)}`);
}

/**
 * Converts a chain id to the decimal string hashed into the DID.
 * Accepts a positive safe integer, a bigint, or a decimal string.
 * @throws TypeError for anything else (0, negative, fractional, hex, empty).
 */
function chainIdToDecimal(chainId: string | number | bigint): string {
  if (typeof chainId === 'number') {
    if (Number.isSafeInteger(chainId) && chainId > 0)
      return chainId.toString(10);
  } else if (typeof chainId === 'bigint') {
    if (chainId > 0n) return chainId.toString(10);
  } else if (typeof chainId === 'string') {
    if (/^[1-9][0-9]*$/.test(chainId)) return chainId;
  }
  throw new TypeError(`Invalid chainId: ${String(chainId)}`);
}

/**
 * Derives the DID of an asset from its NFT address and chain id:
 * `prefix + sha256(utf8(checksumAddress + decimalChainId))`.
 * @param nftAddress - The NFT address, any letter case.
 * @param chainId - The chain id.
 * @param version - Selects the prefix: `did:op:` for v4/deprecated, `did:ope:` for v5.
 * @returns The DID.
 * @throws TypeError on an invalid address, chain id or version.
 */
export function deriveDid(
  nftAddress: string,
  chainId: string | number | bigint,
  version: DidVersion
): string {
  return hashDid(getDidPrefix(version), nftAddress, chainIdToDecimal(chainId));
}

/**
 * Returns the DDO family of a well-formed Ocean DID: `did:op:` + 64 lowercase
 * hex chars is `'4'`, `did:ope:` + 64 lowercase hex chars is `'5'`.
 * @returns The version, or `undefined` when `did` is not a well-formed Ocean DID.
 */
export function getDidVersion(did: unknown): '4' | '5' | undefined {
  if (typeof did !== 'string') return undefined;
  const match = DID_PATTERN.exec(did);
  if (!match) return undefined;
  return match[1] === 'ope' ? '5' : '4';
}

/**
 * Checks that a DID was derived from the NFT address and chain id. The prefix of
 * `did` picks the formula, so v4 and v5 DIDs both work without knowing the version.
 * Never throws.
 * @returns `false` for a malformed DID, address or chain id, or a mismatch.
 */
export function matchesDid(
  did: string,
  nftAddress: string,
  chainId: string | number | bigint
): boolean {
  const version = getDidVersion(did);
  if (!version) return false;
  try {
    return deriveDid(nftAddress, chainId, version) === did;
  } catch {
    return false;
  }
}

/**
 * Returns both DIDs an NFT may be indexed under, v4 first then v5. For callers
 * that only know the NFT address and chain id (e.g. contract events) and must
 * look the DDO up without knowing its version.
 * @throws TypeError on an invalid address or chain id.
 */
export function deriveDidCandidates(
  nftAddress: string,
  chainId: string | number | bigint
): [string, string] {
  return [
    deriveDid(nftAddress, chainId, '4'),
    deriveDid(nftAddress, chainId, '5')
  ];
}
