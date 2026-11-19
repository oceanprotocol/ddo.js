import { expect } from 'chai';
import { getCredentialAddresses } from '../../utils/credentials.js';

describe('getCredentialAddresses', () => {
  const A = '0x1111111111111111111111111111111111111111';
  const B = '0xABCDEFabcdef0000000000000000000000000000';

  it('reads plain string entries', () => {
    expect(getCredentialAddresses({ values: [A, B] })).to.eql([A, B]);
  });

  it('reads { address } object entries', () => {
    expect(
      getCredentialAddresses({ values: [{ address: A }, { address: B }] })
    ).to.eql([A, B]);
  });

  it('reads a list mixing both formats, keeping order and case', () => {
    expect(getCredentialAddresses({ values: [A, { address: B }, '*'] })).to.eql(
      [A, B, '*']
    );
  });

  it('skips entries in any other shape', () => {
    const values = [A, null, 42, {}, { address: 7 }, ['x'], { address: B }];
    expect(getCredentialAddresses({ values: values as any })).to.eql([A, B]);
  });

  it('returns [] when values are missing or not an array', () => {
    expect(getCredentialAddresses(undefined)).to.eql([]);
    expect(getCredentialAddresses(null)).to.eql([]);
    expect(getCredentialAddresses({})).to.eql([]);
    expect(getCredentialAddresses({ values: 'nope' as any })).to.eql([]);
  });
});
