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
        indexedMetadata: DDOExampleV5.indexedMetadata,
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

    it('should update some indexedMetadata fields for V5 DDO', () => {
      const ddo = ddoInstance.updateFields({
        indexedMetadata: {
          nft: {
            address: '0xBB1081DbF3227bbB233Db68f7117114baBb43656',
            name: 'Ocean Data NFT',
            symbol: 'OCEAN-NFT',
            state: 5,
            tokenURI:
              'data:application/json;base64,eyJuYW1lIjoiT2NlYW4gRGF0YSBORlQiLCJzeW1ib2wiOiJPQ0VBTi1ORlQiLCJkZXNjcmlwdGlvbiI6IlRoaXMgTkZUIHJlcHJlc2VudHMgYW4gYXNzZXQgaW4gdGhlIE9jZWFuIFByb3RvY29sIHY0IGVjb3N5c3RlbS5cblxuVmlldyBvbiBPY2VhbiBNYXJrZXQ6IGh0dHBzOi8vbWFya2V0Lm9jZWFucHJvdG9jb2wuY29tL2Fzc2V0L2RpZDpvcDpmYTBlOGZhOTU1MGU4ZWIxMzM5MmQ2ZWViOWJhOWY4MTExODAxYjMzMmM4ZDIzNDViMzUwYjNiYzY2YjM3OWQ1IiwiZXh0ZXJuYWxfdXJsIjoiaHR0cHM6Ly9tYXJrZXQub2NlYW5wcm90b2NvbC5jb20vYXNzZXQvZGlkOm9wOmZhMGU4ZmE5NTUwZThlYjEzMzkyZDZlZWI5YmE5ZjgxMTE4MDFiMzMyYzhkMjM0NWIzNTBiM2JjNjZiMzc5ZDUiLCJiYWNrZ3JvdW5kX2NvbG9yIjoiMTQxNDE0IiwiaW1hZ2VfZGF0YSI6ImRhdGE6aW1hZ2Uvc3ZnK3htbCwlM0Nzdmcgdmlld0JveD0nMCAwIDk5IDk5JyBmaWxsPSd1bmRlZmluZWQnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyclM0UlM0NwYXRoIGZpbGw9JyUyM2ZmNDA5Mjc3JyBkPSdNMCw5OUwwLDIzQzEzLDIwIDI3LDE4IDM3LDE4QzQ2LDE3IDUyLDE4IDYyLDIwQzcxLDIxIDg1LDI0IDk5LDI3TDk5LDk5WicvJTNFJTNDcGF0aCBmaWxsPSclMjNmZjQwOTJiYicgZD0nTTAsOTlMMCw1MkMxMSw0OCAyMyw0NCAzMyw0NEM0Miw0MyA1MCw0NSA2MSw0OEM3MSw1MCA4NSw1MiA5OSw1NUw5OSw5OVonJTNFJTNDL3BhdGglM0UlM0NwYXRoIGZpbGw9JyUyM2ZmNDA5MmZmJyBkPSdNMCw5OUwwLDcyQzgsNzMgMTcsNzUgMjksNzZDNDAsNzYgNTMsNzYgNjYsNzdDNzgsNzcgODgsNzcgOTksNzhMOTksOTlaJyUzRSUzQy9wYXRoJTNFJTNDL3N2ZyUzRSJ9',
            owner: '0x0DB823218e337a6817e6D7740eb17635DEAdafAF',
            created: '2022-12-30T08:40:43'
          },
          purgatory: {
            state: true
          }
        }
      });
      expect(ddo.indexedMetadata.nft.state).to.eql(5);
      expect(ddo.indexedMetadata.purgatory.state).to.eql(true);
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
