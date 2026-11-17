/** A `publisherTrustedAlgorithms` entry of a v4 or v5 compute service. */
export interface TrustedAlgorithm {
  did: string;
  filesChecksum: string;
  containerSectionChecksum: string;
  serviceId?: string;
}

/** The checksums of an algorithm, as computed by the node from its DDO. */
export interface AlgorithmChecksums {
  /** The algorithm's file checksums, concatenated in service file order. */
  files: string;
  /** sha256 of `container.entrypoint + container.checksum`, unprefixed. */
  container: string;
  /** The algorithm's service id. */
  serviceId?: string;
}

/**
 * Returns the NFT address of a published algorithm's DDO, so the trust check
 * can match `publisherTrustedAlgorithmPublishers` without ddo.js fetching DDOs.
 * @returns The NFT address, or `null`/`undefined` when the DDO is not found.
 */
export type AlgorithmNftAddressResolver = (
  algorithmDid: string
) => Promise<string | null | undefined> | string | null | undefined;

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Checks whether a service is a compute service (`type === 'compute'`). */
export function isComputeService(service: unknown): boolean {
  return isRecord(service) && service.type === 'compute';
}

/** Returns the `compute` section of a compute service, or `undefined`. */
function getComputeSection(service: unknown): Record<string, any> | undefined {
  if (!isComputeService(service)) return undefined;
  const { compute } = service as Record<string, any>;
  return isRecord(compute) ? compute : undefined;
}

// A missing or non-string rule never matches, so an entry without a checksum
// is not trusted even when the checksum passed in is missing too.
const matches = (rule: unknown, value: unknown): boolean =>
  rule === '*' || (typeof rule === 'string' && rule === value);

/**
 * Decides whether an algorithm may run on a dataset service. Same rules as
 * ocean-node's `validateAlgoForDataset`:
 * - an `access` service allows any algorithm;
 * - a service that is not `compute`, or has no `compute` section, allows none;
 * - with no trusted algorithms and no trusted publishers, nothing is allowed;
 * - a published algorithm is allowed when it matches a trusted algorithm entry
 *   (did, files and container checksums, and serviceId when the entry has one;
 *   `*` matches anything, a missing value nothing), or when its NFT address is
 *   a trusted publisher (`*` trusts every publisher);
 * - a raw algorithm (no DID) is allowed only with `allowRawAlgorithm`.
 * When publishers are listed without `*` and the algorithm's DDO cannot be
 * resolved, the algorithm is refused, even if it matched a trusted entry.
 * @param datasetService - The dataset service, e.g. `ddo.getService(serviceId)`.
 * @param algorithmDid - The algorithm DID, empty or undefined for raw code.
 * @param checksums - The algorithm checksums computed by the node.
 * @param resolveNftAddress - Resolves the algorithm's NFT address.
 * @returns `true` if the algorithm is allowed. Never throws: a resolver error
 * refuses the algorithm.
 */
export async function evaluateAlgorithmTrust(
  datasetService: unknown,
  algorithmDid: string | null | undefined,
  checksums: AlgorithmChecksums,
  resolveNftAddress: AlgorithmNftAddressResolver
): Promise<boolean> {
  if (!isRecord(datasetService)) return false;
  if (datasetService.type === 'access') return true;
  const compute = getComputeSection(datasetService);
  if (!compute) return false;

  const publishers: unknown[] = Array.isArray(
    compute.publisherTrustedAlgorithmPublishers
  )
    ? compute.publisherTrustedAlgorithmPublishers
    : [];
  const algorithms: unknown[] = Array.isArray(
    compute.publisherTrustedAlgorithms
  )
    ? compute.publisherTrustedAlgorithms
    : [];
  if (publishers.length === 0 && algorithms.length === 0) return false;

  if (!algorithmDid) return !!compute.allowRawAlgorithm;

  const isAlgorithmTrusted = algorithms.some((entry) => {
    if (!isRecord(entry)) return false;
    const matched =
      matches(entry.did, algorithmDid) &&
      matches(entry.filesChecksum, checksums?.files) &&
      matches(entry.containerSectionChecksum, checksums?.container);
    if ('serviceId' in entry) {
      return matched && matches(entry.serviceId, checksums?.serviceId);
    }
    return matched;
  });

  let isPublisherTrusted = false;
  if (publishers.length > 0) {
    if (publishers.includes('*')) {
      isPublisherTrusted = true;
    } else {
      let nftAddress: string | null | undefined;
      try {
        nftAddress = await resolveNftAddress(algorithmDid);
      } catch {
        return false;
      }
      if (typeof nftAddress !== 'string') return false;
      const address = nftAddress.toLowerCase();
      isPublisherTrusted = publishers.some(
        (publisher) =>
          typeof publisher === 'string' && publisher.toLowerCase() === address
      );
    }
  }
  return isAlgorithmTrusted || isPublisherTrusted;
}

/**
 * Adds an algorithm to a compute service's `publisherTrustedAlgorithms`,
 * creating the list when missing. Existing entries with the same `did` and
 * `serviceId` are replaced by the new entry, at the position of the first one,
 * so duplicates left by older tools cannot keep an old checksum trusted.
 * Mutates the service.
 * @returns The updated list.
 * @throws TypeError when the service is not a compute service with a `compute`
 * section, or the entry has no string `did`.
 */
export function addTrustedAlgorithm(
  service: unknown,
  entry: TrustedAlgorithm
): TrustedAlgorithm[] {
  const compute = getComputeSection(service);
  if (!compute) {
    throw new TypeError('addTrustedAlgorithm expects a compute service');
  }
  if (!isRecord(entry) || typeof entry.did !== 'string') {
    throw new TypeError('addTrustedAlgorithm expects an entry with a did');
  }
  if (!Array.isArray(compute.publisherTrustedAlgorithms)) {
    compute.publisherTrustedAlgorithms = [];
  }
  const list: TrustedAlgorithm[] = compute.publisherTrustedAlgorithms;
  const isSame = (existing: unknown): boolean =>
    isRecord(existing) &&
    existing.did === entry.did &&
    existing.serviceId === entry.serviceId;
  const index = list.findIndex(isSame);
  if (index === -1) {
    list.push(entry);
    return list;
  }
  list[index] = entry;
  for (let i = list.length - 1; i > index; i--) {
    if (isSame(list[i])) list.splice(i, 1);
  }
  return list;
}

/**
 * Removes every entry for an algorithm DID from a compute service's
 * `publisherTrustedAlgorithms`. Mutates the service.
 * @returns The number of entries removed; 0 when there were none or the
 * service is not a compute service.
 */
export function removeTrustedAlgorithm(
  service: unknown,
  algorithmDid: string
): number {
  const compute = getComputeSection(service);
  if (!compute || !Array.isArray(compute.publisherTrustedAlgorithms)) return 0;
  const list: unknown[] = compute.publisherTrustedAlgorithms;
  let removed = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const entry = list[i];
    if (isRecord(entry) && entry.did === algorithmDid) {
      list.splice(i, 1);
      removed++;
    }
  }
  return removed;
}
