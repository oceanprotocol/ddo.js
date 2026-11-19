import { expect } from 'chai';
import { DDOManager } from '../../services/ddoManager.js';
import {
  DID_PREFIX_V4,
  DID_PREFIX_V5,
  deriveDid,
  deriveDidCandidates,
  getDidPrefix,
  getDidVersion,
  matchesDid
} from '../../utils/did.js';
import {
  getDdoChainId,
  getDdoNftAddress,
  getDdoVersion,
  isSupportedDdoVersion,
  stripIndexedMetadata,
  SUPPORTED_VERSIONS
} from '../../utils/ddo.js';
import { DDOExampleV4, DDOExampleV5, deprecatedDDO } from '../data/ddo.js';

// Other suites mutate the shared fixtures, so every test works on a clone.
const clone = <T>(value: T): T => structuredClone(value);

// Expected values computed with ocean-node's current formula:
// 'did:op:' + createHash('sha256').update(getAddress(nft) + chainId.toString(10)).digest('hex')
const NFT = '0xBB1081DbF3227bbB233Db68f7117114baBb43656';
const HASH_137 =
  'fa0e8fa9550e8eb13392d6eeb9ba9f8111801b332c8d2345b350b3bc66b379d5';
const HASH_8453 =
  '3fe3acf224c77fa13ee35ea73fcf44d04071d71fec4900f08e86e6829c7251e3';
const NFT_SEPOLIA = '0xea615374949a2405c3ee555053eca4d74ec4c2f0';
const HASH_SEPOLIA =
  '16aa53e3d2941ae91733503aa01cf1c75d4c91b518020a4433d03d62083d6401';

describe('DID helpers', () => {
  describe('deriveDid', () => {
    it('matches the ocean-node formula for every version', () => {
      expect(deriveDid(NFT, 137, '4')).to.equal(`did:op:${HASH_137}`);
      expect(deriveDid(NFT, 137, 'deprecated')).to.equal(`did:op:${HASH_137}`);
      expect(deriveDid(NFT, 137, '5')).to.equal(`did:ope:${HASH_137}`);
      expect(deriveDid(NFT, 8453, '4')).to.equal(`did:op:${HASH_8453}`);
      expect(deriveDid(NFT_SEPOLIA, 11155111, '4')).to.equal(
        `did:op:${HASH_SEPOLIA}`
      );
    });

    it('ignores the letter case of the NFT address', () => {
      expect(deriveDid(NFT.toLowerCase(), 137, '4')).to.equal(
        `did:op:${HASH_137}`
      );
    });

    it('accepts the chain id as a number, a bigint or a decimal string', () => {
      const expected = `did:op:${HASH_137}`;
      expect(deriveDid(NFT, '137', '4')).to.equal(expected);
      expect(deriveDid(NFT, 137n, '4')).to.equal(expected);
    });

    it('rejects an invalid chain id', () => {
      for (const chainId of [
        0,
        -1,
        1.5,
        NaN,
        '',
        '0',
        '0x89',
        ' 137',
        '01',
        0n
      ]) {
        expect(
          () => deriveDid(NFT, chainId as never, '4'),
          String(chainId)
        ).to.throw(TypeError);
      }
    });

    it('rejects an invalid address or a bad checksum', () => {
      expect(() => deriveDid('0x1234', 137, '4')).to.throw();
      expect(() =>
        deriveDid('0xBB1081DBF3227bbB233Db68f7117114baBb43656', 137, '4')
      ).to.throw();
    });

    it('rejects an unknown version', () => {
      expect(() => deriveDid(NFT, 137, '6' as never)).to.throw(TypeError);
    });
  });

  describe('makeDid', () => {
    it('keeps the output of every DDO class unchanged', () => {
      const v4 = DDOManager.getDDOClass(clone(DDOExampleV4));
      const v5 = DDOManager.getDDOClass(clone(DDOExampleV5));
      const deprecated = DDOManager.getDDOClass(clone(deprecatedDDO));
      expect(v4.makeDid(NFT, '137')).to.equal(`did:op:${HASH_137}`);
      expect(v5.makeDid(NFT, '137')).to.equal(`did:ope:${HASH_137}`);
      expect(deprecated.makeDid(NFT, '137')).to.equal(`did:op:${HASH_137}`);
    });

    it('matches the DID a DDO is validated against', () => {
      const v5 = clone(DDOExampleV5);
      const instance = DDOManager.getDDOClass(v5);
      const { nftAddress, chainId } = v5.credentialSubject;
      expect(instance.makeDid(nftAddress, String(chainId))).to.equal(
        deriveDid(nftAddress, chainId, '5')
      );
    });
  });

  describe('getDidPrefix / getDidVersion', () => {
    it('maps versions to prefixes', () => {
      expect(getDidPrefix('4')).to.equal(DID_PREFIX_V4);
      expect(getDidPrefix('deprecated')).to.equal(DID_PREFIX_V4);
      expect(getDidPrefix('5')).to.equal(DID_PREFIX_V5);
    });

    it('reads the version of a well-formed DID', () => {
      expect(getDidVersion(`did:op:${HASH_137}`)).to.equal('4');
      expect(getDidVersion(`did:ope:${HASH_137}`)).to.equal('5');
    });

    it('returns undefined for a malformed DID', () => {
      for (const did of [
        undefined,
        null,
        42,
        '',
        'did:op:',
        'did:opgarbage',
        `did:op:${HASH_137.toUpperCase()}`,
        `did:op:${HASH_137}0`,
        `did:opx:${HASH_137}`,
        `did:op:${HASH_137} `
      ]) {
        expect(getDidVersion(did), String(did)).to.equal(undefined);
      }
    });
  });

  describe('matchesDid', () => {
    it('matches v4 and v5 DIDs from the prefix', () => {
      expect(matchesDid(`did:op:${HASH_137}`, NFT, 137)).to.equal(true);
      expect(matchesDid(`did:ope:${HASH_137}`, NFT, 137)).to.equal(true);
      expect(
        matchesDid(`did:ope:${HASH_137}`, NFT.toLowerCase(), '137')
      ).to.equal(true);
    });

    it('rejects another chain or NFT', () => {
      expect(matchesDid(`did:op:${HASH_137}`, NFT, 8453)).to.equal(false);
      expect(matchesDid(`did:op:${HASH_137}`, NFT_SEPOLIA, 137)).to.equal(
        false
      );
    });

    it('returns false instead of throwing on bad input', () => {
      expect(matchesDid('did:op:abc', NFT, 137)).to.equal(false);
      expect(matchesDid(`did:op:${HASH_137}`, '0x1234', 137)).to.equal(false);
      expect(matchesDid(`did:op:${HASH_137}`, NFT, 0)).to.equal(false);
      expect(matchesDid(undefined as unknown as string, NFT, 137)).to.equal(
        false
      );
    });
  });

  describe('deriveDidCandidates', () => {
    it('returns the v4 DID then the v5 DID', () => {
      expect(deriveDidCandidates(NFT, 137)).to.eql([
        `did:op:${HASH_137}`,
        `did:ope:${HASH_137}`
      ]);
    });
  });
});

describe('Raw DDO helpers', () => {
  describe('getDdoVersion / isSupportedDdoVersion', () => {
    it('returns exact supported versions', () => {
      expect(getDdoVersion(clone(DDOExampleV4))).to.equal(DDOExampleV4.version);
      expect(getDdoVersion(clone(DDOExampleV5))).to.equal('5.0.0');
      expect(getDdoVersion(clone(deprecatedDDO))).to.equal('deprecated');
      for (const version of SUPPORTED_VERSIONS) {
        expect(isSupportedDdoVersion(version)).to.equal(true);
      }
    });

    it('returns undefined for an unsupported or missing version', () => {
      expect(getDdoVersion({ version: '4.0.0' })).to.equal(undefined);
      expect(getDdoVersion({ version: '5' })).to.equal(undefined);
      expect(getDdoVersion({})).to.equal(undefined);
      expect(getDdoVersion(null)).to.equal(undefined);
      expect(getDdoVersion('5.0.0')).to.equal(undefined);
      expect(isSupportedDdoVersion(5)).to.equal(false);
    });
  });

  describe('getDdoChainId / getDdoNftAddress', () => {
    it('reads v4 and deprecated fields from the root', () => {
      const v4 = { ...clone(DDOExampleV4), chainId: 137, nftAddress: NFT };
      expect(getDdoChainId(v4)).to.equal(137);
      expect(getDdoNftAddress(v4)).to.equal(NFT);
      const deprecated = { ...clone(deprecatedDDO), chainId: 8453 };
      expect(getDdoChainId(deprecated)).to.equal(8453);
    });

    it('reads v5 fields from credentialSubject', () => {
      const ddo = clone(DDOExampleV5);
      expect(getDdoChainId(ddo)).to.equal(ddo.credentialSubject.chainId);
      expect(getDdoNftAddress(ddo)).to.equal(ddo.credentialSubject.nftAddress);
    });

    it('ignores root fields on a v5 DDO', () => {
      const ddo = clone(DDOExampleV5) as Record<string, any>;
      ddo.credentialSubject.chainId = 137;
      ddo.credentialSubject.nftAddress = NFT;
      ddo.chainId = 1;
      ddo.nftAddress = NFT_SEPOLIA;
      expect(getDdoChainId(ddo)).to.equal(137);
      expect(getDdoNftAddress(ddo)).to.equal(NFT);
    });

    it('falls back to credentialSubject when the version is missing', () => {
      expect(getDdoChainId({ chainId: 1 })).to.equal(1);
      expect(getDdoChainId({ credentialSubject: { chainId: 8453 } })).to.equal(
        8453
      );
      expect(
        getDdoNftAddress({ credentialSubject: { nftAddress: NFT } })
      ).to.equal(NFT);
    });

    it('returns undefined for missing or malformed values', () => {
      expect(getDdoChainId(null)).to.equal(undefined);
      expect(getDdoChainId({ version: '5.0.0' })).to.equal(undefined);
      expect(getDdoChainId({ version: '4.1.0', chainId: {} })).to.equal(
        undefined
      );
      expect(getDdoNftAddress({ version: '4.1.0', nftAddress: 1 })).to.equal(
        undefined
      );
      expect(getDdoNftAddress([])).to.equal(undefined);
    });
  });

  describe('stripIndexedMetadata', () => {
    it('returns a copy without indexedMetadata', () => {
      const ddo = clone(DDOExampleV5);
      const stripped = stripIndexedMetadata(ddo);
      expect(stripped).to.not.equal(ddo);
      expect('indexedMetadata' in stripped).to.equal(false);
      expect(ddo.indexedMetadata).to.not.equal(undefined);
    });

    it('returns the same object when there is no indexedMetadata', () => {
      const ddo = clone(DDOExampleV4) as Record<string, any>;
      delete ddo.indexedMetadata;
      expect(stripIndexedMetadata(ddo)).to.equal(ddo);
    });

    it('matches DDOManager.deleteIndexedMetadataIfExists', () => {
      const ddo = clone(DDOExampleV4);
      const instance = DDOManager.getDDOClass(ddo);
      expect(instance.deleteIndexedMetadataIfExists(ddo)).to.eql(
        stripIndexedMetadata(ddo)
      );
    });
  });
});

describe('DDOManager.getServiceByDatatoken', () => {
  it('finds a v4 and a v5 service ignoring letter case', () => {
    const v4 = clone(DDOExampleV4);
    const v4Address = v4.services[0].datatokenAddress;
    expect(
      DDOManager.getDDOClass(v4).getServiceByDatatoken(v4Address.toUpperCase())
    ).to.equal(v4.services[0]);

    const v5 = clone(DDOExampleV5);
    const v5Address = v5.credentialSubject.services[0].datatokenAddress;
    expect(
      DDOManager.getDDOClass(v5).getServiceByDatatoken(v5Address.toLowerCase())
    ).to.equal(v5.credentialSubject.services[0]);
  });

  it('returns undefined when no service matches', () => {
    const instance = DDOManager.getDDOClass(clone(DDOExampleV5));
    expect(instance.getServiceByDatatoken(NFT_SEPOLIA)).to.equal(undefined);
    expect(
      instance.getServiceByDatatoken(undefined as unknown as string)
    ).to.equal(undefined);
  });

  it('skips services without a datatoken address', () => {
    const ddo = clone(DDOExampleV5) as Record<string, any>;
    const service = ddo.credentialSubject.services[0];
    ddo.credentialSubject.services.unshift(null, { id: 'no-datatoken' });
    expect(
      DDOManager.getDDOClass(ddo).getServiceByDatatoken(
        service.datatokenAddress
      )
    ).to.equal(service);
  });

  it('returns undefined for a deprecated DDO', () => {
    const instance = DDOManager.getDDOClass(clone(deprecatedDDO));
    expect(instance.getServiceByDatatoken(NFT)).to.equal(undefined);
  });
});
