import { expect } from 'chai';
import {
  CredentialResolver,
  CredentialRule,
  evaluateCredential,
  evaluateCredentials,
  matchesAddressCredential
} from '../../utils/credentials.js';

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
