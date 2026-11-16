import { expect } from 'chai';
import {
  DDO_HASH_ENCODINGS,
  DdoHashEncoding,
  hashSerializedDdo,
  matchesDdoHash,
  sha256Utf8
} from '../../utils/hash.js';

// Expected values computed outside ethers, with ocean-node's
// create256Hash (node:crypto) and ocean.js's crypto-js SHA256. Both agree.
const JSON_TEXT = JSON.stringify({
  '@context': ['https://w3id.org/did/v1'],
  id: 'did:op:abc',
  version: '4.1.0',
  chainId: 8453,
  metadata: { name: 'Café ☕ 𝔘', tags: ['a'] }
});
const HASH_JSON_UTF8 =
  '0x613a00e7dffa8b823d6b0f971ebbe4e7ee80df2348a454b91689ead5a6fee1c1';
const HASH_HEX_JSON_TEXT =
  '0x979ccf16760e7125dfc5b45f806a357b536c2ba0ba76dd08636e1a2d60d85a52';
const HASH_EMPTY =
  '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('sha256Utf8', () => {
  it('matches create256Hash, including non-ASCII text', () => {
    expect(sha256Utf8(JSON_TEXT)).to.equal(HASH_JSON_UTF8);
    expect(sha256Utf8('')).to.equal(HASH_EMPTY);
  });

  it('rejects non-strings', () => {
    expect(() => sha256Utf8(undefined as any)).to.throw(TypeError);
    expect(() => sha256Utf8({} as any)).to.throw(TypeError);
  });
});

describe('hashSerializedDdo', () => {
  it('hashes the JSON text for json-utf8', () => {
    expect(hashSerializedDdo(JSON_TEXT, 'json-utf8')).to.equal(HASH_JSON_UTF8);
  });

  it('hashes the hex string of the JSON for hex-json-text', () => {
    expect(hashSerializedDdo(JSON_TEXT, 'hex-json-text')).to.equal(
      HASH_HEX_JSON_TEXT
    );
  });

  it('does not re-serialize the input', () => {
    const pretty = JSON.stringify(JSON.parse(JSON_TEXT), null, 2);
    expect(hashSerializedDdo(pretty, 'json-utf8')).to.not.equal(HASH_JSON_UTF8);
  });

  it('rejects an object or an unknown encoding', () => {
    expect(() =>
      hashSerializedDdo(JSON.parse(JSON_TEXT), 'json-utf8')
    ).to.throw(TypeError);
    expect(() =>
      hashSerializedDdo(JSON_TEXT, 'sha3' as DdoHashEncoding)
    ).to.throw(TypeError);
  });
});

describe('matchesDdoHash', () => {
  it('accepts only the listed encodings', () => {
    expect(matchesDdoHash(JSON_TEXT, HASH_HEX_JSON_TEXT, ['hex-json-text'])).to
      .be.true;
    expect(matchesDdoHash(JSON_TEXT, HASH_JSON_UTF8, ['hex-json-text'])).to.be
      .false;
    expect(matchesDdoHash(JSON_TEXT, HASH_JSON_UTF8, ['json-utf8'])).to.be.true;
    expect(matchesDdoHash(JSON_TEXT, HASH_HEX_JSON_TEXT, ['json-utf8'])).to.be
      .false;
  });

  it('accepts both encodings when both are listed', () => {
    expect(matchesDdoHash(JSON_TEXT, HASH_JSON_UTF8, DDO_HASH_ENCODINGS)).to.be
      .true;
    expect(matchesDdoHash(JSON_TEXT, HASH_HEX_JSON_TEXT, DDO_HASH_ENCODINGS)).to
      .be.true;
  });

  it('ignores the letter case of the hash', () => {
    expect(
      matchesDdoHash(JSON_TEXT, '0x' + HASH_JSON_UTF8.slice(2).toUpperCase(), [
        'json-utf8'
      ])
    ).to.be.true;
  });

  it('returns false for a changed document or bad input, never throws', () => {
    expect(matchesDdoHash(JSON_TEXT + ' ', HASH_JSON_UTF8, DDO_HASH_ENCODINGS))
      .to.be.false;
    expect(matchesDdoHash(JSON_TEXT, HASH_JSON_UTF8, [])).to.be.false;
    expect(matchesDdoHash(JSON_TEXT, HASH_JSON_UTF8.slice(2), ['json-utf8'])).to
      .be.false;
    expect(matchesDdoHash(JSON_TEXT, undefined as any, ['json-utf8'])).to.be
      .false;
    expect(matchesDdoHash({} as any, HASH_JSON_UTF8, ['json-utf8'])).to.be
      .false;
    expect(matchesDdoHash(JSON_TEXT, HASH_JSON_UTF8, undefined as any)).to.be
      .false;
    expect(
      matchesDdoHash(JSON_TEXT, HASH_JSON_UTF8, ['sha3' as DdoHashEncoding])
    ).to.be.false;
  });
});
