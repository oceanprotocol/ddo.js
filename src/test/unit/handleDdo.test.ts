import { expect } from 'chai';
import {
  DDOManager,
  V4DDO,
  V5DDO,
  DeprecatedDDO
} from '../../services/ddoManager.js';
import { DDOExampleV4, DDOExampleV5, deprecatedDDO } from '../data/ddo.js';

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
        version: DDOExampleV4.version,
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
        indexedMetadata: DDOExampleV4.indexedMetadata,
        datatokens: DDOExampleV4.datatokens
      });
    });

    it('should update DDO fields for V4 DDO', () => {
      const ddo = ddoInstance.updateFields({
        nftAddress: '0x282d8efce846a88b159800bd4130ad77443fa1a1'
      });
      expect(ddo.nftAddress).to.eql(
        '0x282d8efce846a88b159800bd4130ad77443fa1a1'
      );
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
        version: DDOExampleV5.version,
        metadata: DDOExampleV5.credentialSubject.metadata,
        services: DDOExampleV5.credentialSubject.services,
        credentials: DDOExampleV5.credentialSubject.credentials,
        chainId: DDOExampleV5.credentialSubject.chainId,
        nftAddress: DDOExampleV5.credentialSubject.nftAddress
      });
    });

    it('should return valid asset fields for V5 DDO', () => {
      const assetFields = ddoInstance.getAssetFields();
      expect(assetFields).to.eql({
        indexedMetadata: DDOExampleV5.credentialSubject.indexedMetadata,
        datatokens: DDOExampleV5.credentialSubject.datatokens
      });
    });

    it('should update DDO fields for V5 DDO', () => {
      const ddo = ddoInstance.updateFields({
        nftAddress: '0x282d8efce846a88b159800bd4130ad77443fa1a1'
      });
      expect(ddo.credentialSubject.nftAddress).to.eql(
        '0x282d8efce846a88b159800bd4130ad77443fa1a1'
      );
    });

    it('should update Proof field for V5 DDO and the get it', () => {
      ddoInstance.updateFields({
        proof: { header: 'header', signature: 'abcd' }
      });
      const proof = ddoInstance.getProof();
      expect(proof).to.eql({ header: 'header', signature: 'abcd' });
    });
  });

  describe('Deprecated DDO get fields Tests', () => {
    let ddoInstance: DeprecatedDDO;

    beforeEach(() => {
      ddoInstance = DDOManager.getDDOClass(deprecatedDDO) as DeprecatedDDO;
    });

    it('should return a valid DID for Deprecated DDO', () => {
      const did = ddoInstance.getDid();
      expect(did).to.equal(DDOExampleV4.id);
    });

    it('should return valid DDO fields for Deprecated DDO', () => {
      const ddoFields = ddoInstance.getDDOFields();
      expect(ddoFields).to.eql({
        id: deprecatedDDO.id,
        services: null,
        metadata: null,
        credentials: null,
        version: deprecatedDDO.version,
        chainId: deprecatedDDO.chainId,
        nftAddress: deprecatedDDO.nftAddress
      });
    });

    it('should return valid asset fields for Deprecated DDO', () => {
      const assetFields = ddoInstance.getAssetFields();
      const expectedIndexedMetadata = {
        ...deprecatedDDO.indexedMetadata,
        event: null,
        purgatory: null,
        stats: null,
        nft: {
          state: assetFields.indexedMetadata.nft.state,
          name: null,
          symbol: null,
          address: null,
          created: null,
          tokenURI: null,
          owner: null
        }
      };

      expect(assetFields).to.eql({
        indexedMetadata: expectedIndexedMetadata,
        datatokens: null
      });
    });

    it('should update DDO fields for V4 DDO', () => {
      const ddo = ddoInstance.updateFields({
        nftAddress: '0x282d8efce846a88b159800bd4130ad77443fa1a1'
      });
      expect(ddo.nftAddress).to.eql(
        '0x282d8efce846a88b159800bd4130ad77443fa1a1'
      );
    });
  });
});
