import { expect } from 'chai';
import {
  DDOManager,
  DeprecatedDDO,
  V4DDO,
  V5DDO,
  validateDDO
} from '../../services/ddoManager.js';
import {
  DDOExampleV4,
  DDOExampleV4Compute,
  DDOExampleV5,
  deprecatedDDO,
  invalidDDOV4,
  invalidDDOV5,
  invalidDeprecatedDDO
} from '../data/ddo.js';

describe('DDOManager Validation Tests', () => {
  it('should validate a valid V4 DDO successfully', async () => {
    const validationResult = await validateDDO(DDOExampleV4);
    expect(validationResult[0]).to.eql(true);
    expect(validationResult[1]).to.eql({});
  });

  it('should fail V4 DDO validation due to missing metadata', async () => {
    const invalidCopy = JSON.parse(JSON.stringify(invalidDDOV4));
    const validationResult = await validateDDO(invalidCopy);
    expect(validationResult[0]).to.eql(false);
    expect(validationResult[1].metadata).to.include('Less than 1 values');
  });

  it('should validate a valid compute V4 DDO successfully', async () => {
    const validationResult = await validateDDO(DDOExampleV4Compute);
    expect(validationResult[0]).to.eql(true);
    expect(validationResult[1]).to.eql({});
  });

  it('should fail Deprecated DDO validation due to extra fields', async () => {
    const invalidCopy = JSON.parse(JSON.stringify(invalidDeprecatedDDO));
    const validationResult = await validateDDO(invalidCopy);
    expect(validationResult[0]).to.eql(false);
    console.log('validation fails: ', JSON.stringify(validationResult[1]));
    expect(JSON.stringify(validationResult[1].general)).to.include(
      '["Validation failed: Error: Expected entity but got eof on line 35."]'
    );
  });

  it('should validate a valid V5 DDO successfully (Verifiable Credential)', async () => {
    const validationResult = await validateDDO(DDOExampleV5);
    expect(validationResult[0]).to.eql(true);
    expect(validationResult[1]).to.eql({});
  });

  it('should fail V5 DDO validation due to missing credentialSubject metadata', async () => {
    const invalidCopy = JSON.parse(JSON.stringify(invalidDDOV5));
    const validationResult = await validateDDO(invalidCopy);
    expect(validationResult[0]).to.eql(false);
    expect(validationResult[1]).to.have.property('metadata');
    expect(validationResult[1].metadata).to.include(
      'metadata is missing or invalid.'
    );
  });

  it('should fail V5 DDO validation due to missing credentialSubject services', async () => {
    const invalidCopy = JSON.parse(JSON.stringify(DDOExampleV5));
    delete invalidCopy.credentialSubject.services;
    const validationResult = await validateDDO(invalidCopy);
    expect(validationResult[0]).to.eql(false);
    expect(validationResult[1]).to.have.property('services');
    expect(validationResult[1].services).to.include(
      'services are missing or invalid.'
    );
  });

  it('should return a valid DID for V4 DDO', () => {
    const ddoInstance = new V4DDO(DDOExampleV4);
    const did = ddoInstance.makeDid(DDOExampleV4.nftAddress, '137');
    expect(did).to.match(/^did:op:/);
  });

  it('should return a valid DID for V5 DDO', () => {
    const ddoInstance = new V5DDO(DDOExampleV5);
    const did = ddoInstance.makeDid(
      DDOExampleV5.credentialSubject.nftAddress,
      '137'
    );
    expect(did).to.match(/^did:ope:/);
  });

  it('should return a valid DID for Deprecated DDO', () => {
    const ddoInstance = new DeprecatedDDO(deprecatedDDO);
    const did = ddoInstance.makeDid(deprecatedDDO.nftAddress, '137');
    expect(did).to.match(/^did:op:/);
  });

  it('should throw an error for unsupported DDO versions', () => {
    const unsupportedDDO = { ...DDOExampleV4, version: '3.0.0' };
    expect(() => DDOManager.getDDOClass(unsupportedDDO)).to.throw(
      'Unsupported DDO version: 3.0.0'
    );
  });
});
