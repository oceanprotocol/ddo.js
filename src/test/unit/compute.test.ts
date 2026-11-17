import { expect } from 'chai';
import {
  addTrustedAlgorithm,
  AlgorithmChecksums,
  evaluateAlgorithmTrust,
  isComputeService,
  removeTrustedAlgorithm,
  TrustedAlgorithm
} from '../../utils/compute.js';

const ALGO_DID = 'did:op:' + 'a'.repeat(64);
const OTHER_DID = 'did:op:' + 'b'.repeat(64);
const ALGO_NFT = '0xBB1081DbF3227bbB233Db68f7117114baBb43656';
const CHECKSUMS: AlgorithmChecksums = {
  files: 'f1f2',
  container: 'c1',
  serviceId: 'algo-service'
};

const computeService = (compute: Record<string, any>): Record<string, any> => ({
  id: 'svc',
  type: 'compute',
  compute: {
    allowRawAlgorithm: false,
    allowNetworkAccess: false,
    publisherTrustedAlgorithmPublishers: [],
    publisherTrustedAlgorithms: [],
    ...compute
  }
});
const trusted = (entry: Partial<TrustedAlgorithm> = {}): TrustedAlgorithm => ({
  did: ALGO_DID,
  filesChecksum: CHECKSUMS.files,
  containerSectionChecksum: CHECKSUMS.container,
  ...entry
});

const resolveTo =
  (nftAddress: string | null) => async (): Promise<string | null> =>
    nftAddress;
const neverCalled = async (): Promise<string> => {
  throw new Error('resolver should not be called');
};

describe('isComputeService', () => {
  it('is true only for type compute', () => {
    expect(isComputeService({ type: 'compute' })).to.be.true;
    expect(isComputeService({ type: 'access' })).to.be.false;
    expect(isComputeService(undefined)).to.be.false;
    expect(isComputeService('compute')).to.be.false;
  });
});

describe('evaluateAlgorithmTrust', () => {
  it('allows any algorithm on an access service', async () => {
    expect(
      await evaluateAlgorithmTrust(
        { type: 'access' },
        ALGO_DID,
        CHECKSUMS,
        neverCalled
      )
    ).to.be.true;
  });

  it('refuses a missing service, another type, or no compute section', async () => {
    for (const service of [undefined, { type: 'wss' }, { type: 'compute' }]) {
      expect(
        await evaluateAlgorithmTrust(service, ALGO_DID, CHECKSUMS, neverCalled)
      ).to.be.false;
    }
  });

  it('refuses everything when nothing is trusted, even raw code', async () => {
    const service = computeService({ allowRawAlgorithm: true });
    expect(
      await evaluateAlgorithmTrust(service, ALGO_DID, CHECKSUMS, neverCalled)
    ).to.be.false;
    expect(await evaluateAlgorithmTrust(service, '', CHECKSUMS, neverCalled)).to
      .be.false;
  });

  it('allows raw code only with allowRawAlgorithm', async () => {
    const trustedList = { publisherTrustedAlgorithms: [trusted()] };
    expect(
      await evaluateAlgorithmTrust(
        computeService({ ...trustedList, allowRawAlgorithm: true }),
        undefined,
        CHECKSUMS,
        neverCalled
      )
    ).to.be.true;
    expect(
      await evaluateAlgorithmTrust(
        computeService(trustedList),
        undefined,
        CHECKSUMS,
        neverCalled
      )
    ).to.be.false;
  });

  it('allows a matching trusted entry and refuses a changed checksum', async () => {
    const service = computeService({ publisherTrustedAlgorithms: [trusted()] });
    expect(
      await evaluateAlgorithmTrust(service, ALGO_DID, CHECKSUMS, neverCalled)
    ).to.be.true;
    expect(
      await evaluateAlgorithmTrust(
        service,
        ALGO_DID,
        { ...CHECKSUMS, files: 'other' },
        neverCalled
      )
    ).to.be.false;
    expect(
      await evaluateAlgorithmTrust(
        service,
        ALGO_DID,
        { ...CHECKSUMS, container: 'other' },
        neverCalled
      )
    ).to.be.false;
    expect(
      await evaluateAlgorithmTrust(service, OTHER_DID, CHECKSUMS, neverCalled)
    ).to.be.false;
  });

  it('checks serviceId only when the entry has one, * matches anything', async () => {
    const withService = computeService({
      publisherTrustedAlgorithms: [trusted({ serviceId: 'other-service' })]
    });
    expect(
      await evaluateAlgorithmTrust(
        withService,
        ALGO_DID,
        CHECKSUMS,
        neverCalled
      )
    ).to.be.false;
    const wildcard = computeService({
      publisherTrustedAlgorithms: [
        {
          did: '*',
          filesChecksum: '*',
          containerSectionChecksum: '*',
          serviceId: '*'
        }
      ]
    });
    expect(
      await evaluateAlgorithmTrust(wildcard, OTHER_DID, CHECKSUMS, neverCalled)
    ).to.be.true;
  });

  it('trusts every publisher with *, without resolving', async () => {
    const service = computeService({
      publisherTrustedAlgorithmPublishers: ['*']
    });
    expect(
      await evaluateAlgorithmTrust(service, ALGO_DID, CHECKSUMS, neverCalled)
    ).to.be.true;
  });

  it('trusts a listed publisher, ignoring letter case', async () => {
    const service = computeService({
      publisherTrustedAlgorithmPublishers: [ALGO_NFT.toLowerCase()]
    });
    expect(
      await evaluateAlgorithmTrust(
        service,
        ALGO_DID,
        CHECKSUMS,
        resolveTo(ALGO_NFT)
      )
    ).to.be.true;
    expect(
      await evaluateAlgorithmTrust(
        service,
        ALGO_DID,
        CHECKSUMS,
        resolveTo('0x' + '1'.repeat(40))
      )
    ).to.be.false;
  });

  it('refuses when the publisher check cannot resolve the algorithm, even if trusted', async () => {
    const service = computeService({
      publisherTrustedAlgorithmPublishers: [ALGO_NFT],
      publisherTrustedAlgorithms: [trusted()]
    });
    expect(
      await evaluateAlgorithmTrust(
        service,
        ALGO_DID,
        CHECKSUMS,
        resolveTo(null)
      )
    ).to.be.false;
    expect(
      await evaluateAlgorithmTrust(service, ALGO_DID, CHECKSUMS, async () => {
        throw new Error('db down');
      })
    ).to.be.false;
  });

  it('does not trust an entry with missing checksums', async () => {
    const service = computeService({
      publisherTrustedAlgorithms: [{ did: ALGO_DID }]
    });
    for (const checksums of [{}, CHECKSUMS] as AlgorithmChecksums[]) {
      expect(
        await evaluateAlgorithmTrust(service, ALGO_DID, checksums, neverCalled)
      ).to.be.false;
    }
    const wildcard = computeService({
      publisherTrustedAlgorithms: [
        { did: ALGO_DID, filesChecksum: '*', containerSectionChecksum: '*' }
      ]
    });
    expect(
      await evaluateAlgorithmTrust(
        wildcard,
        ALGO_DID,
        {} as AlgorithmChecksums,
        neverCalled
      )
    ).to.be.true;
  });

  it('does not trust a null publisher entry when the NFT address is missing', async () => {
    const service = computeService({
      publisherTrustedAlgorithmPublishers: [null]
    });
    expect(
      await evaluateAlgorithmTrust(
        service,
        ALGO_DID,
        CHECKSUMS,
        async () => undefined
      )
    ).to.be.false;
  });
});

describe('addTrustedAlgorithm', () => {
  it('creates the list when missing and appends', () => {
    const service = computeService({});
    delete service.compute.publisherTrustedAlgorithms;
    const list = addTrustedAlgorithm(service, trusted());
    expect(list).to.deep.equal([trusted()]);
    expect(service.compute.publisherTrustedAlgorithms).to.equal(list);
  });

  it('replaces an entry with the same did and serviceId', () => {
    const service = computeService({
      publisherTrustedAlgorithms: [trusted({ serviceId: 's1' })]
    });
    addTrustedAlgorithm(
      service,
      trusted({ serviceId: 's1', filesChecksum: 'new' })
    );
    addTrustedAlgorithm(service, trusted({ serviceId: 's2' }));
    expect(service.compute.publisherTrustedAlgorithms).to.deep.equal([
      trusted({ serviceId: 's1', filesChecksum: 'new' }),
      trusted({ serviceId: 's2' })
    ]);
  });

  it('collapses older duplicates so the old checksum is no longer trusted', async () => {
    const old = trusted({ serviceId: 's1', filesChecksum: 'old' });
    const other = trusted({ serviceId: 's2' });
    const service = computeService({
      publisherTrustedAlgorithms: [{ ...old }, other, { ...old }]
    });
    addTrustedAlgorithm(
      service,
      trusted({ serviceId: 's1', filesChecksum: 'new' })
    );
    expect(service.compute.publisherTrustedAlgorithms).to.deep.equal([
      trusted({ serviceId: 's1', filesChecksum: 'new' }),
      other
    ]);
    expect(
      await evaluateAlgorithmTrust(
        service,
        ALGO_DID,
        { ...CHECKSUMS, files: 'old', serviceId: 's1' },
        neverCalled
      )
    ).to.be.false;
  });

  it('rejects a non-compute service or an entry without did', () => {
    expect(() =>
      addTrustedAlgorithm({ type: 'access', compute: {} }, trusted())
    ).to.throw(TypeError);
    expect(() => addTrustedAlgorithm({ type: 'compute' }, trusted())).to.throw(
      TypeError
    );
    expect(() =>
      addTrustedAlgorithm(computeService({}), { did: 1 } as any)
    ).to.throw(TypeError);
  });
});

describe('removeTrustedAlgorithm', () => {
  it('removes every entry for the did, in place', () => {
    const service = computeService({
      publisherTrustedAlgorithms: [
        trusted({ serviceId: 's1' }),
        trusted({ did: OTHER_DID }),
        trusted({ serviceId: 's2' })
      ]
    });
    const list = service.compute.publisherTrustedAlgorithms;
    expect(removeTrustedAlgorithm(service, ALGO_DID)).to.equal(2);
    expect(list).to.deep.equal([trusted({ did: OTHER_DID })]);
    expect(service.compute.publisherTrustedAlgorithms).to.equal(list);
  });

  it('returns 0 when nothing matches or the service is not compute', () => {
    expect(removeTrustedAlgorithm(computeService({}), ALGO_DID)).to.equal(0);
    expect(removeTrustedAlgorithm({ type: 'access' }, ALGO_DID)).to.equal(0);
    expect(removeTrustedAlgorithm(undefined, ALGO_DID)).to.equal(0);
  });
});
