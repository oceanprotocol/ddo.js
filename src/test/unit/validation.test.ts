import { expect } from 'chai';
import { DDOManager, V4DDO, V5DDO, validateDDO } from '../../services/ddoManager.js';
import { DDOExampleV4, DDOExampleV5, invalidDDOV4, invalidDDOV5 } from '../data/ddo.js';

describe('DDOManager Validation Tests', () => {
  it('should validate a valid V4 DDO successfully', async () => {
    const validationResult = await validateDDO(DDOExampleV4, 137, DDOExampleV4.nftAddress);
    expect(validationResult[0]).to.eql(true);
    expect(validationResult[1]).to.eql({});
  });

  it('should fail V4 DDO validation due to missing metadata', async () => {
    const invalidCopy = JSON.parse(JSON.stringify(invalidDDOV4));
    const validationResult = await validateDDO(invalidCopy, 137, invalidCopy.nftAddress);
    expect(validationResult[0]).to.eql(false);
    expect(validationResult[1].metadata).to.include('Less than 1 values');
  });

  it('should validate a valid V5 DDO successfully (Verifiable Credential)', async () => {
    const validationResult = await validateDDO(DDOExampleV5, 137, DDOExampleV5.credentialSubject.nftAddress);
    expect(validationResult[0]).to.eql(true);
    expect(validationResult[1]).to.eql({});
  });

  it('should fail V5 DDO validation due to missing credentialSubject metadata', async () => {
    const invalidCopy = JSON.parse(JSON.stringify(invalidDDOV5));
    const validationResult = await validateDDO(invalidCopy, 137, invalidCopy.credentialSubject.nftAddress);
    expect(validationResult[0]).to.eql(false);
    expect(validationResult[1]).to.have.property('metadata');
    expect(validationResult[1].metadata).to.include('metadata is missing or invalid.');
  });

  it('should fail V5 DDO validation due to missing credentialSubject services', async () => {
    const invalidCopy = JSON.parse(JSON.stringify(DDOExampleV5));
    delete invalidCopy.credentialSubject.services
    const validationResult = await validateDDO(invalidCopy, 137, invalidCopy.credentialSubject.nftAddress);
    expect(validationResult[0]).to.eql(false);
    expect(validationResult[1]).to.have.property('services');
    expect(validationResult[1].services).to.include('services are missing or invalid.');
  });

  it('should return a valid DID for V4 DDO', () => {
    const ddoInstance = new V4DDO(DDOExampleV4);
    const did = ddoInstance.makeDid(DDOExampleV4.nftAddress, '137');
    expect(did).to.match(/^did:op:/);
  });

  it('should return a valid DID for V5 DDO', () => {
    const ddoInstance = new V5DDO(DDOExampleV5);
    const did = ddoInstance.makeDid(DDOExampleV5.credentialSubject.nftAddress, '137');
    expect(did).to.match(/^did:ope:/);
  });

  it('should throw an error for unsupported DDO versions', () => {
    const unsupportedDDO = { ...DDOExampleV4, version: '3.0.0' };
    expect(() => DDOManager.getDDOClass(unsupportedDDO)).to.throw('Unsupported DDO version: 3.0.0');
  });
});
