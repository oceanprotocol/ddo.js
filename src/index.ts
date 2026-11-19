export * from './services/index.js';
export * from './@types/index.js';
export * from './elasticMappings/index.js';
export * from './utils/compute.js';
export * from './utils/credentials.js';
export * from './utils/ddo.js';
export {
  DDO_HASH_ENCODINGS,
  hashSerializedDdo,
  matchesDdoHash
} from './utils/hash.js';
export type { DdoHashEncoding } from './utils/hash.js';
export {
  DID_PREFIX_V4,
  DID_PREFIX_V5,
  deriveDid,
  deriveDidCandidates,
  getDidPrefix,
  getDidVersion,
  matchesDid
} from './utils/did.js';
export type { DidVersion } from './utils/did.js';
