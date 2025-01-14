import { expect } from 'chai';
import { DDOManager, V4DDO, V5DDO } from '../../services/ddoManager.js';
import { DDOExampleV4, DDOExampleV5 } from '../data/ddo.js';

describe('DDOManager', () => {
  describe('V4 DDO get fields Tests', () => {
    let ddoInstance: V4DDO;

    beforeEach(() => {
      ddoInstance = DDOManager.getDDOClass(DDOExampleV4) as V4DDO;
    });

    it('should return a valid DID for V4 DDO', () => {
      const did = ddoInstance.getDid();
      expect(did).to.equal(DDOExampleV4.id);
    });

    it('should return valid DDO fields for V4 DDO', () => {
      const ddoFields = ddoInstance.getDDOFields();
      expect(ddoFields).to.eql({
        id: DDOExampleV4.id,
        metadata: DDOExampleV4.metadata,
        services: DDOExampleV4.services,
        chainId: DDOExampleV4.chainId,
        nftAddress: DDOExampleV4.nftAddress,
        credentials: DDOExampleV4.credentials || null
      });
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

  describe('V5 DDO get fields Tests', () => {
    let ddoInstance: V5DDO;

    beforeEach(() => {
      ddoInstance = DDOManager.getDDOClass(DDOExampleV5) as V5DDO;
    });

    it('should return a valid DID for V5 DDO', () => {
      const did = ddoInstance.getDid();
      expect(did).to.equal(DDOExampleV5.credentialSubject.id);
    });

    it('should return valid DDO fields for V5 DDO', () => {
      const ddoFields = ddoInstance.getDDOFields();
      expect(ddoFields).to.eql({
        id: DDOExampleV5.credentialSubject.id,
        metadata: DDOExampleV5.credentialSubject.metadata,
        services: DDOExampleV5.credentialSubject.services,
        credentials: DDOExampleV5.credentialSubject.credentials,
        chainId: DDOExampleV5.credentialSubject.chainId,
        nftAddress: DDOExampleV5.credentialSubject.nftAddress,
      });
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
