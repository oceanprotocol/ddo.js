import { expect } from 'chai';
import { DDOManager } from '../../services/ddoManager.js';
import {
  CredentialResolver,
  CredentialRule,
  evaluateCredential,
  evaluateCredentials,
  matchesAddressCredential
} from '../../utils/credentials.js';
import { DDOExampleV4, DDOExampleV5, deprecatedDDO } from '../data/ddo.js';

const ALICE = '0xAbC0000000000000000000000000000000000001';
const BOB = '0x0000000000000000000000000000000000000002';
const LIST = '0x00000000000000000000000000000000000000AA';

const address = (...values: any[]): CredentialRule =>
  ({ type: 'address', values }) as CredentialRule;
const accessList = (list = LIST): CredentialRule =>
  ({ type: 'accessList', chainId: 8453, accessList: list }) as CredentialRule;
const vc = (): CredentialRule =>
  ({ type: 'verifiableCredential', requestCredentials: [] }) as CredentialRule;

// Fake on-chain check: ALICE holds a token on LIST.
const resolver: CredentialResolver = (credential, consumer) => {
  if (credential.type === 'accessList') {
    return consumer.toLowerCase() === ALICE.toLowerCase();
  }
  return null;
};

describe('matchesAddressCredential', () => {
  it('matches ignoring letter case, plain strings and { address } objects', () => {
    expect(matchesAddressCredential({ values: [ALICE] }, ALICE.toLowerCase()))
      .to.be.true;
    expect(
      matchesAddressCredential(
        { values: [{ address: ALICE.toUpperCase() }] },
        ALICE
      )
    ).to.be.true;
    expect(matchesAddressCredential({ values: [ALICE] }, BOB)).to.be.false;
  });

  it('matches everyone with *, no one with no addresses', () => {
    expect(matchesAddressCredential({ values: ['*'] }, BOB)).to.be.true;
    expect(matchesAddressCredential({ values: [] }, BOB)).to.be.false;
    expect(matchesAddressCredential({ values: [5 as any] }, BOB)).to.be.false;
    expect(matchesAddressCredential(undefined, BOB)).to.be.false;
    expect(matchesAddressCredential({ values: ['*'] }, undefined as any)).to.be
      .false;
  });
});

describe('evaluateCredential', () => {
  it('checks address rules itself, any letter case of the type', async () => {
    expect(await evaluateCredential(address(ALICE), ALICE)).to.be.true;
    expect(
      await evaluateCredential(
        { type: 'Address', values: [ALICE] } as any,
        ALICE
      )
    ).to.be.true;
  });

  it('sends other types to the resolver, null without one', async () => {
    expect(await evaluateCredential(accessList(), ALICE, resolver)).to.be.true;
    expect(await evaluateCredential(accessList(), BOB, resolver)).to.be.false;
    expect(await evaluateCredential(accessList(), ALICE)).to.equal(null);
    expect(await evaluateCredential(vc(), ALICE, resolver)).to.equal(null);
  });

  it('returns null for a malformed rule', async () => {
    expect(await evaluateCredential(null as any, ALICE)).to.equal(null);
    expect(await evaluateCredential({ values: [] } as any, ALICE)).to.equal(
      null
    );
  });

  it('lets resolver errors propagate', async () => {
    const failing: CredentialResolver = () => {
      throw new Error('rpc down');
    };
    let error: Error | undefined;
    try {
      await evaluateCredential(accessList(), ALICE, failing);
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.equal('rpc down');
  });
});

describe('evaluateCredentials', () => {
  it('allows without credentials or with empty lists', async () => {
    expect(await evaluateCredentials(BOB, undefined)).to.be.true;
    expect(await evaluateCredentials(BOB, null)).to.be.true;
    expect(await evaluateCredentials(BOB, {})).to.be.true;
    expect(await evaluateCredentials(BOB, { allow: [], deny: [] })).to.be.true;
  });

  it('checks deny before allow', async () => {
    const credentials = { allow: [address(ALICE)], deny: [address(ALICE)] };
    expect(await evaluateCredentials(ALICE, credentials)).to.be.false;
  });

  it('match_deny defaults to any, all needs every rule to match', async () => {
    const deny = [address(ALICE), address(BOB)];
    expect(await evaluateCredentials(ALICE, { deny })).to.be.false;
    expect(await evaluateCredentials(ALICE, { deny, match_deny: 'all' })).to.be
      .true;
    expect(
      await evaluateCredentials(ALICE, {
        deny: [address(ALICE), address('*')],
        match_deny: 'all'
      })
    ).to.be.false;
  });

  it('denies a match mode other than any or all, keeps the default when unset', async () => {
    // With 'ANY' mapped to every(), ALICE matching one of two deny rules would
    // not be blocked and the allow list would grant access.
    const deny = [address(ALICE), address(BOB)];
    const allow = [address('*')];
    for (const mode of ['ANY', 'All', 'some', 1, true]) {
      expect(
        await evaluateCredentials(ALICE, {
          deny,
          allow,
          match_deny: mode
        } as any),
        `match_deny ${mode}`
      ).to.be.false;
      expect(
        await evaluateCredentials(ALICE, { allow, match_allow: mode } as any),
        `match_allow ${mode}`
      ).to.be.false;
    }
    for (const unset of [undefined, null, '']) {
      expect(
        await evaluateCredentials(BOB, {
          deny: [address(ALICE)],
          allow,
          match_deny: unset,
          match_allow: unset
        } as any),
        `unset ${unset}`
      ).to.be.true;
    }
  });

  it('match_allow defaults to all, any needs one rule to match', async () => {
    const allow = [address(ALICE), address(BOB)];
    expect(await evaluateCredentials(ALICE, { allow })).to.be.false;
    expect(await evaluateCredentials(ALICE, { allow, match_allow: 'any' })).to
      .be.true;
    expect(await evaluateCredentials(BOB, { allow: [address(ALICE)] })).to.be
      .false;
  });

  it('denies an unknown type in an allow list with match_allow all', async () => {
    expect(await evaluateCredentials(ALICE, { allow: [address(ALICE), vc()] }))
      .to.be.false;
  });

  it('ignores an unknown type with match_allow any, and in deny lists', async () => {
    expect(
      await evaluateCredentials(ALICE, {
        allow: [vc(), address(ALICE)],
        match_allow: 'any'
      })
    ).to.be.true;
    expect(await evaluateCredentials(ALICE, { deny: [vc()] })).to.be.true;
    expect(
      await evaluateCredentials(ALICE, {
        deny: [vc(), address(ALICE)],
        match_deny: 'all'
      })
    ).to.be.false;
  });

  it('denies when an allow list has only unknown types', async () => {
    expect(
      await evaluateCredentials(ALICE, { allow: [vc()], match_allow: 'any' })
    ).to.be.false;
  });

  it('uses the resolver for accessList rules', async () => {
    const credentials = { allow: [accessList()] };
    expect(await evaluateCredentials(ALICE, credentials, resolver)).to.be.true;
    expect(await evaluateCredentials(BOB, credentials, resolver)).to.be.false;
    // Without a resolver accessList is unknown: denied with match_allow all.
    expect(await evaluateCredentials(ALICE, credentials)).to.be.false;
    expect(await evaluateCredentials(ALICE, { deny: [accessList()] }, resolver))
      .to.be.false;
  });

  it('denies when a list is set but is not an array', async () => {
    expect(await evaluateCredentials(ALICE, { allow: {} as any })).to.be.false;
    expect(await evaluateCredentials(ALICE, { deny: 'x' as any })).to.be.false;
  });

  it('rejects a consumer address that is not a string', async () => {
    let error: Error | undefined;
    try {
      await evaluateCredentials(undefined as any, {});
    } catch (e) {
      error = e as Error;
    }
    expect(error).to.be.instanceOf(TypeError);
  });
});

describe('DDOManager.isConsumerAllowed', () => {
  const v4 = (
    assetCredentials: any,
    serviceCredentials?: any
  ): Record<string, any> => {
    const ddo: Record<string, any> = structuredClone(DDOExampleV4);
    ddo.credentials = assetCredentials;
    ddo.services = [
      { ...ddo.services[0], id: 'svc', credentials: serviceCredentials }
    ];
    return ddo;
  };
  const v5 = (
    assetCredentials: any,
    serviceCredentials?: any
  ): Record<string, any> => {
    const ddo: Record<string, any> = structuredClone(DDOExampleV5);
    ddo.credentialSubject.credentials = assetCredentials;
    ddo.credentialSubject.services = [
      {
        ...ddo.credentialSubject.services[0],
        id: 'svc',
        credentials: serviceCredentials
      }
    ];
    // Root fields are ignored for v5.
    ddo.credentials = { deny: [address('*')] };
    return ddo;
  };

  for (const [label, make] of [
    ['v4', v4],
    ['v5', v5]
  ] as const) {
    it(`allows without credentials (${label})`, async () => {
      const ddo = DDOManager.getDDOClass(make(undefined, undefined));
      expect(await ddo.isConsumerAllowed(BOB, 'svc')).to.deep.equal({
        allowed: true
      });
    });

    it(`refuses at asset level first (${label})`, async () => {
      const ddo = DDOManager.getDDOClass(
        make({ deny: [address(BOB)] }, { allow: [address(BOB)] })
      );
      expect(await ddo.isConsumerAllowed(BOB, 'svc')).to.deep.equal({
        allowed: false,
        level: 'asset',
        reason: 'denied'
      });
    });

    it(`refuses at service level (${label})`, async () => {
      const ddo = DDOManager.getDDOClass(
        make({ allow: [address('*')] }, { allow: [address(ALICE)] })
      );
      expect(await ddo.isConsumerAllowed(BOB, 'svc')).to.deep.equal({
        allowed: false,
        level: 'service',
        reason: 'denied'
      });
      expect(await ddo.isConsumerAllowed(ALICE, 'svc')).to.deep.equal({
        allowed: true
      });
    });

    it(`checks only the asset without a serviceId (${label})`, async () => {
      const ddo = DDOManager.getDDOClass(
        make({ allow: [address(BOB)] }, { deny: [address(BOB)] })
      );
      expect(await ddo.isConsumerAllowed(BOB)).to.deep.equal({
        allowed: true
      });
    });

    it(`refuses falsy malformed credentials (${label})`, async () => {
      for (const malformed of [false, 0, '']) {
        expect(
          await DDOManager.getDDOClass(
            make(malformed, undefined)
          ).isConsumerAllowed(BOB, 'svc')
        ).to.deep.equal({ allowed: false, level: 'asset', reason: 'denied' });
        expect(
          await DDOManager.getDDOClass(
            make(undefined, malformed)
          ).isConsumerAllowed(BOB, 'svc')
        ).to.deep.equal({
          allowed: false,
          level: 'service',
          reason: 'denied'
        });
      }
    });

    it(`allows null credentials (${label})`, async () => {
      const ddo = DDOManager.getDDOClass(make(null, null));
      expect(await ddo.isConsumerAllowed(BOB, 'svc')).to.deep.equal({
        allowed: true
      });
    });

    it(`reports an unknown service (${label})`, async () => {
      const ddo = DDOManager.getDDOClass(make(undefined, undefined));
      expect(await ddo.isConsumerAllowed(BOB, 'missing')).to.deep.equal({
        allowed: false,
        level: 'service',
        reason: 'service-not-found'
      });
    });

    it(`passes the resolver to both levels (${label})`, async () => {
      const ddo = DDOManager.getDDOClass(
        make({ allow: [accessList()] }, { allow: [accessList()] })
      );
      expect(await ddo.isConsumerAllowed(ALICE, 'svc', resolver)).to.deep.equal(
        { allowed: true }
      );
      expect(await ddo.isConsumerAllowed(BOB, 'svc', resolver)).to.deep.equal({
        allowed: false,
        level: 'asset',
        reason: 'denied'
      });
    });
  }

  it('refuses any service of a deprecated DDO, which has none', async () => {
    const ddo = DDOManager.getDDOClass(structuredClone(deprecatedDDO));
    expect(await ddo.isConsumerAllowed(BOB)).to.deep.equal({ allowed: true });
    expect(await ddo.isConsumerAllowed(BOB, 'svc')).to.deep.equal({
      allowed: false,
      level: 'service',
      reason: 'service-not-found'
    });
  });

  it('rejects a consumer address that is not a string', async () => {
    const ddo = DDOManager.getDDOClass(v4(undefined));
    let error: Error | undefined;
    try {
      await ddo.isConsumerAllowed(undefined as any, 'svc');
    } catch (e) {
      error = e as Error;
    }
    expect(error).to.be.instanceOf(TypeError);
  });
});
