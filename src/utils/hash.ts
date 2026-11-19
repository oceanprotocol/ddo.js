import { hexlify, sha256, toUtf8Bytes } from 'ethers';

/**
 * How a serialized DDO is turned into the metadata hash stored on chain.
 * - `json-utf8`: sha256 of the UTF-8 bytes of the JSON text. Used when the DDO
 *   is encrypted, and by the node's DDO validation signature.
 * - `hex-json-text`: sha256 of the UTF-8 bytes of the `0x`-prefixed lowercase hex
 *   string of the JSON's UTF-8 bytes. Used when the DDO is published unencrypted.
 */
export type DdoHashEncoding = 'json-utf8' | 'hex-json-text';

/** All encodings, for callers that accept either one. */
export const DDO_HASH_ENCODINGS: readonly DdoHashEncoding[] = [
  'json-utf8',
  'hex-json-text'
];

/**
 * Returns the sha256 of the UTF-8 bytes of `text`, `0x`-prefixed and lowercase.
 * Same output as ocean-node's `create256Hash`. Internal: not exported from the
 * package root, because it is not specific to DDOs.
 * @throws TypeError when `text` is not a string.
 */
export function sha256Utf8(text: string): string {
  if (typeof text !== 'string') {
    throw new TypeError('sha256Utf8 expects a string');
  }
  return sha256(toUtf8Bytes(text));
}

/**
 * Hashes the exact JSON text of a DDO with a named encoding. The text is never
 * re-serialized: pass the same string that was published or decrypted.
 * @returns The `0x`-prefixed lowercase hash.
 * @throws TypeError when `json` is not a string or `encoding` is unknown.
 */
export function hashSerializedDdo(
  json: string,
  encoding: DdoHashEncoding
): string {
  if (typeof json !== 'string') {
    throw new TypeError('hashSerializedDdo expects the DDO as a JSON string');
  }
  if (encoding === 'json-utf8') return sha256Utf8(json);
  if (encoding === 'hex-json-text') {
    return sha256Utf8(hexlify(toUtf8Bytes(json)));
  }
  throw new TypeError(`Unsupported DDO hash encoding: ${String(encoding)}`);
}

/**
 * Checks a DDO's JSON text against a metadata hash, trying each accepted
 * encoding. Letter case of `hash` is ignored. Never throws.
 * @param json - The exact JSON text that was hashed.
 * @param hash - The `0x`-prefixed hash, e.g. from the MetadataCreated event.
 * @param accepted - The encodings this caller accepts.
 * @returns `false` for a non-string input, an empty `accepted` or a mismatch.
 */
export function matchesDdoHash(
  json: string,
  hash: string,
  accepted: readonly DdoHashEncoding[]
): boolean {
  if (typeof json !== 'string' || typeof hash !== 'string') return false;
  if (!Array.isArray(accepted)) return false;
  const expected = hash.toLowerCase();
  return accepted.some((encoding) => {
    try {
      return hashSerializedDdo(json, encoding) === expected;
    } catch {
      return false;
    }
  });
}
