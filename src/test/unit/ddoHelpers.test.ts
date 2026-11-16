import { expect } from 'chai';
import { DDOManager } from '../../services/ddoManager.js';
import { DDOExampleV4, DDOExampleV5, deprecatedDDO } from '../data/ddo.js';

// Other suites mutate the shared fixtures, so every test works on a clone.
const clone = <T>(value: T): T => structuredClone(value);

describe('DDOManager helpers', () => {
  const V4_SERVICE_ID = DDOExampleV4.services[0].id;
  const V5_SERVICE_ID = DDOExampleV5.credentialSubject.services[0].id;

  describe('getService / getServiceIndex / getServiceByIndex', () => {
    it('finds a v4 service by id and index', () => {
      const ddo = clone(DDOExampleV4);
      const instance = DDOManager.getDDOClass(ddo);
      expect(instance.getService(V4_SERVICE_ID)).to.equal(ddo.services[0]);
      expect(instance.getServiceIndex(V4_SERVICE_ID)).to.equal(0);
      expect(instance.getServiceByIndex(0)).to.equal(ddo.services[0]);
    });

    it('finds a v5 service by id and index', () => {
      const ddo = clone(DDOExampleV5);
      const instance = DDOManager.getDDOClass(ddo);
      const service = ddo.credentialSubject.services[0];
      expect(instance.getService(V5_SERVICE_ID)).to.equal(service);
      expect(instance.getServiceIndex(V5_SERVICE_ID)).to.equal(0);
      expect(instance.getServiceByIndex(0)).to.equal(service);
    });

    it('returns undefined / -1 for an unknown id', () => {
      const instance = DDOManager.getDDOClass(clone(DDOExampleV5));
      expect(instance.getService('unknown')).to.equal(undefined);
      expect(instance.getServiceIndex('unknown')).to.equal(-1);
    });

    it('returns undefined for an out-of-range or non-integer index', () => {
      const instance = DDOManager.getDDOClass(clone(DDOExampleV5));
      expect(instance.getServiceByIndex(1)).to.equal(undefined);
      expect(instance.getServiceByIndex(-1)).to.equal(undefined);
      expect(instance.getServiceByIndex(0.5)).to.equal(undefined);
      expect(instance.getServiceByIndex(NaN)).to.equal(undefined);
    });

    it('does not match on a non-string id', () => {
      const ddo = clone(DDOExampleV5);
      delete (ddo.credentialSubject.services[0] as { id?: string }).id;
      const instance = DDOManager.getDDOClass(ddo);
      expect(instance.getService(undefined as unknown as string)).to.equal(
        undefined
      );
      expect(instance.getServiceIndex(undefined as unknown as string)).to.equal(
        -1
      );
    });

    it('does not throw when services are missing or malformed', () => {
      const deprecated = DDOManager.getDDOClass(clone(deprecatedDDO));
      expect(deprecated.getService(V4_SERVICE_ID)).to.equal(undefined);
      expect(deprecated.getServiceIndex(V4_SERVICE_ID)).to.equal(-1);
      expect(deprecated.getServiceByIndex(0)).to.equal(undefined);

      const noServices = clone(DDOExampleV5) as Record<string, any>;
      noServices.credentialSubject.services = 'not-an-array';
      expect(
        DDOManager.getDDOClass(noServices).getService(V5_SERVICE_ID)
      ).to.equal(undefined);

      const nullEntry = clone(DDOExampleV5) as Record<string, any>;
      nullEntry.credentialSubject.services.unshift(null);
      const instance = DDOManager.getDDOClass(nullEntry);
      expect(instance.getServiceByIndex(0)).to.equal(undefined);
      expect(instance.getServiceIndex(V5_SERVICE_ID)).to.equal(1);
    });
  });

  describe('getCredentials', () => {
    it('reads v5 asset and service credentials separately', () => {
      const ddo = clone(DDOExampleV5);
      const { asset, service } =
        DDOManager.getDDOClass(ddo).getCredentials(V5_SERVICE_ID);
      expect(asset).to.equal(ddo.credentialSubject.credentials);
      expect(service).to.equal(ddo.credentialSubject.services[0].credentials);
    });

    it('reads v4 asset and service credentials from the root paths', () => {
      const ddo = clone(DDOExampleV4) as Record<string, any>;
      const assetRules = {
        allow: [{ type: 'address', values: ['0xA'] }]
      };
      const serviceRules = {
        deny: [{ type: 'address', values: ['0xB'] }]
      };
      ddo.credentials = assetRules;
      ddo.services[0].credentials = serviceRules;
      const { asset, service } =
        DDOManager.getDDOClass(ddo).getCredentials(V4_SERVICE_ID);
      expect(asset).to.eql(assetRules);
      expect(service).to.eql(serviceRules);
    });

    it('returns only asset credentials when no service id is given', () => {
      const ddo = clone(DDOExampleV5);
      const { asset, service } = DDOManager.getDDOClass(ddo).getCredentials();
      expect(asset).to.equal(ddo.credentialSubject.credentials);
      expect(service).to.equal(undefined);
    });

    it('returns undefined when credentials or the service are absent', () => {
      const v4 = DDOManager.getDDOClass(clone(DDOExampleV4));
      expect(v4.getCredentials(V4_SERVICE_ID)).to.eql({
        asset: undefined,
        service: undefined
      });
      const v5 = DDOManager.getDDOClass(clone(DDOExampleV5));
      expect(v5.getCredentials('unknown').service).to.equal(undefined);
      const deprecated = DDOManager.getDDOClass(clone(deprecatedDDO));
      expect(deprecated.getCredentials(V4_SERVICE_ID)).to.eql({
        asset: undefined,
        service: undefined
      });
    });
  });

  describe('isOrderable', () => {
    const withState = (state: unknown) => {
      const ddo = clone(DDOExampleV5) as Record<string, any>;
      ddo.indexedMetadata.nft.state = state;
      return DDOManager.getDDOClass(ddo);
    };

    it('allows Active (0) and Unlisted (5)', () => {
      expect(withState(0).isOrderable()).to.equal(true);
      expect(withState(5).isOrderable()).to.equal(true);
    });

    it('blocks every other state', () => {
      for (const state of [1, 2, 3, 4]) {
        expect(withState(state).isOrderable(), `state ${state}`).to.equal(
          false
        );
      }
    });

    it('blocks a non-numeric state', () => {
      expect(withState('0').isOrderable()).to.equal(false);
      expect(withState(null).isOrderable()).to.equal(false);
    });

    it('returns false when indexedMetadata or nft is missing', () => {
      const noNft = clone(DDOExampleV5) as Record<string, any>;
      delete noNft.indexedMetadata.nft;
      expect(DDOManager.getDDOClass(noNft).isOrderable()).to.equal(false);

      const noIndexed = clone(DDOExampleV4) as Record<string, any>;
      delete noIndexed.indexedMetadata;
      expect(DDOManager.getDDOClass(noIndexed).isOrderable()).to.equal(false);
    });

    it('reads a deprecated DDO without mutating it', () => {
      const ddo = clone(deprecatedDDO);
      const before = clone(ddo);
      expect(DDOManager.getDDOClass(ddo).isOrderable()).to.equal(true);
      expect(ddo).to.eql(before);
    });
  });
});
