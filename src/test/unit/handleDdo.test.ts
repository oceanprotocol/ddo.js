import { expect } from 'chai';
import { DDOManager, V4DDO, V5DDO } from '../../services/ddoManager.js';
import { DDOExampleV4, DDOExampleV5 } from '../data/ddo.js';

describe('DDOManager Method Tests', () => {
  describe('V4 DDO Tests', () => {
    let ddoInstance: V4DDO;

    beforeEach(() => {
      ddoInstance = DDOManager.getDDOClass(DDOExampleV4) as V4DDO;
    });

    it('should return a valid DID for V4 DDO', () => {
      const did = ddoInstance.getDid();
      expect(did).to.equal(DDOExampleV4.id);
    });

    it('should return valid services for V4 DDO', () => {
      const services = ddoInstance.getServices();
      expect(services).to.eql(DDOExampleV4.services);
    });

    it('should return valid metadata for V4 DDO', () => {
      const metadata = ddoInstance.getMetadata();
      expect(metadata).to.eql(DDOExampleV4.metadata);
    });

    it('should return valid asset fields for V4 DDO', () => {
      const assetFields = ddoInstance.getAssetFields();
      expect(assetFields).to.eql({
        stats: DDOExampleV4.stats,
        purgatory: DDOExampleV4.purgatory,
        event: DDOExampleV4.event,
        datatokens: DDOExampleV4.datatokens,
        nft: DDOExampleV4.nft,
      });
    });
  });

  describe('V5 DDO Tests', () => {
    let ddoInstance: V5DDO;

    beforeEach(() => {
      ddoInstance = DDOManager.getDDOClass(DDOExampleV5) as V5DDO;
    });

    it('should return a valid DID for V5 DDO', () => {
      const did = ddoInstance.getDid();
      expect(did).to.equal(DDOExampleV5.credentialSubject.id);
    });

    it('should return valid services for V5 DDO', () => {
      const services = ddoInstance.getServices();
      expect(services).to.eql(DDOExampleV5.credentialSubject.services);
    });

    it('should return valid metadata for V5 DDO', () => {
      const metadata = ddoInstance.getMetadata();
      expect(metadata).to.eql(DDOExampleV5.credentialSubject.metadata);
    });

    it('should return valid asset fields for V5 DDO', () => {
      const assetFields = ddoInstance.getAssetFields();
      expect(assetFields).to.eql({
        stats: DDOExampleV5.credentialSubject.stats,
        purgatory: DDOExampleV5.credentialSubject.purgatory,
        event: DDOExampleV5.credentialSubject.event,
        datatokens: DDOExampleV5.credentialSubject.datatokens,
        nft: DDOExampleV5.credentialSubject.nft,
      });
    });
  });
});
