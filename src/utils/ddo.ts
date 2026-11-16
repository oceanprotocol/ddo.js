/** DDO versions that have a SHACL schema. */
export const SUPPORTED_VERSIONS = [
  '4.1.0',
  '4.3.0',
  '4.5.0',
  '4.7.0',
  '5.0.0',
  'deprecated'
] as const;

export type SupportedVersion = (typeof SUPPORTED_VERSIONS)[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Type guard for a version that has a SHACL schema.
 */
export function isSupportedDdoVersion(
  version: unknown
): version is SupportedVersion {
  return (
    typeof version === 'string' &&
    (SUPPORTED_VERSIONS as readonly string[]).includes(version)
  );
}

/**
 * Returns the version of a raw DDO when it is one of `SUPPORTED_VERSIONS`.
 * Unlike `DDOManager.getDDOClass`, which routes on the major digit, this only
 * accepts exact schema versions.
 * @returns The version, or `undefined` when missing or unsupported.
 */
export function getDdoVersion(ddo: unknown): SupportedVersion | undefined {
  if (!isRecord(ddo)) return undefined;
  return isSupportedDdoVersion(ddo.version) ? ddo.version : undefined;
}

/**
 * Reads a field that v4 DDOs keep at the root and v5 DDOs keep under
 * `credentialSubject`. Without a version string, the root wins.
 */
function readDdoField(ddo: unknown, key: string): unknown {
  if (!isRecord(ddo)) return undefined;
  const subject = isRecord(ddo.credentialSubject)
    ? ddo.credentialSubject
    : undefined;
  if (typeof ddo.version === 'string') {
    return ddo.version.startsWith('5') ? subject?.[key] : ddo[key];
  }
  return ddo[key] ?? subject?.[key];
}

/**
 * Returns the chain id of a raw v4, v5 or deprecated DDO, without building a
 * `DDOManager` instance.
 * @returns The chain id, or `undefined` when missing or not a number/string.
 */
export function getDdoChainId(ddo: unknown): number | string | undefined {
  const chainId = readDdoField(ddo, 'chainId');
  return typeof chainId === 'number' || typeof chainId === 'string'
    ? chainId
    : undefined;
}

/**
 * Returns the NFT address of a raw v4, v5 or deprecated DDO, without building a
 * `DDOManager` instance.
 * @returns The NFT address, or `undefined` when missing or not a string.
 */
export function getDdoNftAddress(ddo: unknown): string | undefined {
  const nftAddress = readDdoField(ddo, 'nftAddress');
  return typeof nftAddress === 'string' ? nftAddress : undefined;
}

/**
 * Checks whether a DDO is stored as a short DDO: it has `indexedMetadata` and
 * its `indexedMetadata.nft.state` is not 0 (active). Same rule as ocean-node's
 * `validateDDO` and database schema selection.
 */
export function isShortDdo(ddo: unknown): boolean {
  if (!isRecord(ddo) || !('indexedMetadata' in ddo)) return false;
  const indexedMetadata = isRecord(ddo.indexedMetadata)
    ? ddo.indexedMetadata
    : undefined;
  const nft = isRecord(indexedMetadata?.nft) ? indexedMetadata.nft : undefined;
  return nft?.state !== 0;
}

/** The stub stored in place of a DDO whose NFT is no longer active. */
export interface ShortDdo {
  id: string;
  version: 'deprecated';
  chainId: number;
  nftAddress: string | undefined;
  indexedMetadata: { nft: { state: number } };
}

/**
 * Builds the short DDO stored when an asset's metadata state leaves active.
 * Reads the NFT address from the root for v4 and from `credentialSubject` for v5.
 * @param ddo - The full DDO.
 * @param chainId - The chain the state change was indexed on.
 * @param state - The new metadata state.
 * @throws TypeError when `ddo` has no string `id`.
 */
export function buildShortDdo(
  ddo: unknown,
  chainId: number,
  state: number
): ShortDdo {
  if (!isRecord(ddo) || typeof ddo.id !== 'string') {
    throw new TypeError('buildShortDdo expects a DDO with an id');
  }
  return {
    id: ddo.id,
    version: 'deprecated',
    chainId,
    nftAddress: getDdoNftAddress(ddo),
    indexedMetadata: { nft: { state } }
  };
}

/**
 * Returns a copy of the DDO without the legacy root `nft`, when the DDO already
 * carries `indexedMetadata.nft`. Otherwise returns the DDO itself. Never mutates
 * the input.
 */
export function stripLegacyNft<T extends Record<string, any>>(
  ddo: T
): Omit<T, 'nft'> | T {
  if (!isRecord(ddo) || !('nft' in ddo)) return ddo;
  const indexedMetadata = isRecord(ddo.indexedMetadata)
    ? ddo.indexedMetadata
    : undefined;
  if (!indexedMetadata?.nft) return ddo;
  const copy: Record<string, any> = { ...ddo };
  delete copy.nft;
  return copy as Omit<T, 'nft'>;
}

/**
 * Checks whether an address owns the asset's NFT, per the indexed
 * `indexedMetadata.nft.owner`, ignoring letter case.
 * `indexedMetadata` is written by the indexer, so only a DDO read from a
 * trusted indexer gives a trustworthy answer.
 * @returns `false` when the owner is missing or `address` is not a string.
 */
export function isDdoOwner(ddo: unknown, address: string): boolean {
  if (!isRecord(ddo) || typeof address !== 'string') return false;
  const indexedMetadata = isRecord(ddo.indexedMetadata)
    ? ddo.indexedMetadata
    : undefined;
  const nft = isRecord(indexedMetadata?.nft) ? indexedMetadata.nft : undefined;
  const owner = nft?.owner;
  return (
    typeof owner === 'string' &&
    owner.length > 0 &&
    owner.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Returns a copy of the DDO without `indexedMetadata`, or the DDO itself when it
 * has none.
 */
export function stripIndexedMetadata<T extends Record<string, any>>(
  ddo: T
): Omit<T, 'indexedMetadata'> {
  const ddoCopy: T = structuredClone(ddo);
  if ('indexedMetadata' in ddoCopy) {
    delete ddoCopy.indexedMetadata;
    return ddoCopy;
  }
  return ddo;
}
