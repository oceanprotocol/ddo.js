import { expect } from 'chai';
import { DDOManager } from '../../services/ddoManager.js';
import {
  buildShortDdo,
  isDdoOwner,
  isShortDdo,
  stripLegacyNft
} from '../../utils/ddo.js';
import { DDOExampleV4, DDOExampleV5 } from '../data/ddo.js';

// Other suites mutate the shared fixtures, so every test works on a clone.
const clone = <T>(value: T): T => structuredClone(value);

const NFT = '0xBB1081DbF3227bbB233Db68f7117114baBb43656';

const v4 = (extra: Record<string, any> = {}): Record<string, any> => ({
  ...clone(DDOExampleV4),
  ...extra
});
const v5 = (extra: Record<string, any> = {}): Record<string, any> => {
  const ddo: Record<string, any> = clone(DDOExampleV5);
  ddo.credentialSubject = { ...ddo.credentialSubject, ...extra };
  return ddo;
};

describe('isShortDdo', () => {
  it('is false for an active DDO (state 0)', () => {
    expect(isShortDdo(v4({ indexedMetadata: { nft: { state: 0 } } }))).to.be
      .false;
  });

  it('is true for any other state', () => {
    expect(isShortDdo(v4({ indexedMetadata: { nft: { state: 4 } } }))).to.be
      .true;
    const ddoV5 = v5();
    ddoV5.indexedMetadata = { nft: { state: 1 } };
    expect(isShortDdo(ddoV5)).to.be.true;
  });

  it('matches validateDDO when indexedMetadata has no nft state', () => {
    expect(isShortDdo({ indexedMetadata: {} })).to.be.true;
    expect(isShortDdo({ indexedMetadata: null })).to.be.true;
    expect(isShortDdo({ indexedMetadata: { nft: {} } })).to.be.true;
  });

  it('is false without indexedMetadata or for bad input', () => {
    const ddo = v4();
    delete ddo.indexedMetadata;
    expect(isShortDdo(ddo)).to.be.false;
    expect(isShortDdo(null)).to.be.false;
    expect(isShortDdo('ddo')).to.be.false;
  });
});

describe('buildShortDdo', () => {
  it('builds the deprecated stub from a v4 DDO', () => {
    const ddo = v4({ nftAddress: NFT });
    expect(buildShortDdo(ddo, 8453, 4)).to.deep.equal({
      id: ddo.id,
      version: 'deprecated',
      chainId: 8453,
      nftAddress: NFT,
      indexedMetadata: { nft: { state: 4 } }
    });
  });

  it('reads the NFT address from credentialSubject for v5', () => {
    const ddo = v5({ nftAddress: NFT });
    delete ddo.nftAddress;
    expect(buildShortDdo(ddo, 8453, 1).nftAddress).to.equal(NFT);
  });

  it('builds a stub that DDOManager routes to DeprecatedDDO', () => {
    const stub = buildShortDdo(v4({ nftAddress: NFT }), 8453, 4);
    const instance = DDOManager.getDDOClass(stub);
    expect(instance.getDDOFields().version).to.equal('deprecated');
    expect(instance.getDDOFields().nftAddress).to.equal(NFT);
  });

  it('rejects a DDO without an id', () => {
    expect(() => buildShortDdo({ nftAddress: NFT }, 1, 1)).to.throw(TypeError);
    expect(() => buildShortDdo(null, 1, 1)).to.throw(TypeError);
  });
});

describe('stripLegacyNft', () => {
  it('removes the root nft when indexedMetadata.nft exists, without mutating', () => {
    const ddo = v4({
      nft: { state: 0 },
      indexedMetadata: { nft: { state: 0 } }
    });
    const stripped = stripLegacyNft(ddo);
    expect(stripped).to.not.have.property('nft');
    expect(stripped).to.have.property('indexedMetadata');
    expect(ddo).to.have.property('nft');
  });

  it('keeps the DDO as-is without indexedMetadata.nft or without a root nft', () => {
    const legacyOnly = v4({ nft: { state: 0 }, indexedMetadata: {} });
    expect(stripLegacyNft(legacyOnly)).to.equal(legacyOnly);
    const indexedOnly = v4({ indexedMetadata: { nft: { state: 0 } } });
    delete indexedOnly.nft;
    expect(stripLegacyNft(indexedOnly)).to.equal(indexedOnly);
  });
});

describe('DDOManager.updateFields with no indexedMetadata', () => {
  for (const [label, make] of [
    ['v4', () => v4()],
    ['v5', () => v5()]
  ] as const) {
    it(`creates indexedMetadata on ${label}`, () => {
      const ddo = make();
      delete ddo.indexedMetadata;
      const instance = DDOManager.getDDOClass(ddo);
      instance.updateFields({ indexedMetadata: {} });
      expect(instance.getDDOData().indexedMetadata).to.deep.equal({});
    });

    it(`sets stats without throwing on ${label}`, () => {
      const ddo = make();
      delete ddo.indexedMetadata;
      const instance = DDOManager.getDDOClass(ddo);
      instance.updateFields({ indexedMetadata: { stats: [] } });
      expect(instance.getDDOData().indexedMetadata.stats).to.deep.equal([]);
    });
  }

  it('keeps an existing indexedMetadata', () => {
    const ddo = v4({ indexedMetadata: { nft: { state: 0 } } });
    const instance = DDOManager.getDDOClass(ddo);
    instance.updateFields({ indexedMetadata: { stats: [] } });
    expect(instance.getDDOData().indexedMetadata).to.deep.equal({
      nft: { state: 0 },
      stats: []
    });
  });

  it('does not create indexedMetadata for unrelated updates', () => {
    const ddo = v4();
    delete ddo.indexedMetadata;
    const instance = DDOManager.getDDOClass(ddo);
    instance.updateFields({ chainId: 1 });
    expect(instance.getDDOData()).to.not.have.property('indexedMetadata');
  });
});

describe('isDdoOwner', () => {
  const OWNER = '0xAbC0000000000000000000000000000000000001';
  const withOwner = (owner: unknown): Record<string, any> =>
    v4({ indexedMetadata: { nft: { state: 0, owner } } });

  it('matches the indexed owner ignoring letter case', () => {
    expect(isDdoOwner(withOwner(OWNER), OWNER.toLowerCase())).to.be.true;
    expect(isDdoOwner(withOwner(OWNER.toLowerCase()), OWNER)).to.be.true;
  });

  it('is false for another address, a missing owner or bad input', () => {
    expect(isDdoOwner(withOwner(OWNER), '0x' + '2'.repeat(40))).to.be.false;
    expect(isDdoOwner(withOwner(undefined), OWNER)).to.be.false;
    expect(isDdoOwner(withOwner(''), '')).to.be.false;
    expect(isDdoOwner(v4({ indexedMetadata: {} }), OWNER)).to.be.false;
    expect(isDdoOwner(null, OWNER)).to.be.false;
    expect(isDdoOwner(withOwner(OWNER), undefined as any)).to.be.false;
  });
});
