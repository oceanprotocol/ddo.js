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
      const indexedMetadata = {
        stats: DDOExampleV4.stats,
        purgatory: DDOExampleV4.purgatory,
        event: DDOExampleV4.event,
        nft: DDOExampleV4.nft 
      }
      expect(assetFields).to.eql({
        indexedMetadata: indexedMetadata,
        datatokens: DDOExampleV4.datatokens,
      });
    });

    it('should update DDO fields for V4 DDO', () => {
      const ddo = ddoInstance.updateFields({ nftAddress: "0x282d8efce846a88b159800bd4130ad77443fa1a1" });
      expect(ddo.nftAddress).to.eql("0x282d8efce846a88b159800bd4130ad77443fa1a1");
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
        nftAddress: DDOExampleV5.credentialSubject.nftAddress
      });
    });

    it('should return valid asset fields for V5 DDO', () => {
      const assetFields = ddoInstance.getAssetFields();
      const indexedMetadata = {
        stats: DDOExampleV5.credentialSubject.stats,
        purgatory: DDOExampleV5.credentialSubject.purgatory,
        event: DDOExampleV5.credentialSubject.event,
        nft: DDOExampleV5.credentialSubject.nft 
      }
      expect(assetFields).to.eql({
        indexedMetadata: indexedMetadata,
        datatokens: DDOExampleV5.credentialSubject.datatokens,
      });
    });

    it('should update DDO fields for V5 DDO', () => {
      const ddo = ddoInstance.updateFields({ nftAddress: "0x282d8efce846a88b159800bd4130ad77443fa1a1" });
      expect(ddo.credentialSubject.nftAddress).to.eql("0x282d8efce846a88b159800bd4130ad77443fa1a1");
    });

    it('should update Proof field for V5 DDO and the get it', () => {
      ddoInstance.updateFields({ proof: { header: "header", signature: "abcd" } });
      const proof = ddoInstance.getProof()
      expect(proof).to.eql({ header: "header", signature: "abcd" })
    });
  });
});
