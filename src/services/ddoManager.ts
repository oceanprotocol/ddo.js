import formats from '@rdfjs/formats-common';
// @ts-ignore
import SHACLValidator from 'rdf-validate-shacl';
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { Readable } from 'stream'
import rdf from '@zazuko/env-node'
import { fromRdf } from 'rdf-literal'
import { getAddress } from 'ethers'
import { Metadata as MetadataV4 } from '../@types/DDO4/Metadata';
import { Metadata as MetadataV5 } from '../@types/DOO5/Metadata';
import { Service as ServiceV5 } from '../@types/DOO5/Service';
import { Service as ServiceV4 } from '../@types/DOO5/Service';

const CURRENT_VERSION = '5.0.0'
const ALLOWED_VERSIONS = ['4.1.0', '4.3.0', '4.5.0', '4.7.0', '5.0.0']

export abstract class DDOManager {
  private ddoData: Record<string, any>;

  public constructor(ddoData: Record<string, any>) {
    this.ddoData = ddoData;
  }

  abstract makeDid(nftAddress: string, chainId: string): string;

  abstract getServices(): ServiceV4[] | ServiceV5;
  abstract getMetadata(): MetadataV4 | MetadataV5;

  getDDOData(): Record<string, any> {
    return this.ddoData;
  }

  getSchema(version: string = CURRENT_VERSION): string {
    if (!ALLOWED_VERSIONS.includes(version)) {
      throw new Error(`Unsupported schema version: ${version}`);
    }
    const path = `../../schemas/${version}.ttl`
    const currentModulePath = fileURLToPath(import.meta.url);
    const currentDirectory = dirname(currentModulePath)
    return resolve(currentDirectory, path);
  }

  static getDDOClass(ddoData: Record<string, any>): V4DDO | V5DDO {
    const { version } = ddoData;
    if (version.startsWith('4')) {
      return new V4DDO(ddoData);
    } else if (version.startsWith('5')) {
      return new V5DDO(ddoData);
    }
    throw new Error(`Unsupported DDO version: ${version}`);
  }
}

// V4 DDO implementation
export class V4DDO extends DDOManager {
  public constructor(ddoData: Record<string, any>) {
    super(ddoData);
  }

  getServices(): ServiceV5[] {
    return this.getDDOData().services || null;
  }

  getMetadata(): MetadataV4 {
    return this.getDDOData().metadata || null;
  }

  makeDid(nftAddress: string, chainId: string): string {
    return (
      'did:op:' +
      createHash('sha256')
        .update(getAddress(nftAddress) + chainId)
        .digest('hex')
    )
  }

  async validate(chainId: number, nftAddress: string): Promise<[boolean, Record<string, string[]>]> {
    const ddoCopy = JSON.parse(JSON.stringify(this.getDDOData()))
    const extraErrors: Record<string, string[]> = {}
    ddoCopy['@type'] = 'DDO';
    ddoCopy['@context'] = {
      '@vocab': 'http://schema.org/'
    }
    if (!chainId) {
      if (!('chainId' in extraErrors)) extraErrors.chainId = []
      extraErrors.chainId.push('chainId is missing or invalid.')
    }

    try {
      getAddress(nftAddress)
    } catch (err) {
      if (!('nftAddress' in extraErrors)) extraErrors.nftAddress = []
      extraErrors.nftAddress.push('nftAddress is missing or invalid.')
    }

    if (!(this.makeDid(nftAddress, chainId.toString(10)) === ddoCopy.id)) {
      if (!('id' in extraErrors)) extraErrors.id = []
      extraErrors.id.push('did is not valid for chain Id and nft address')
    }
    const schemaFilePath = this.getSchema(ddoCopy.version);
    const shapes = await rdf.dataset().import(rdf.fromFile(schemaFilePath))
    const dataStream = Readable.from(JSON.stringify(ddoCopy))
    const output = formats.parsers.import('application/ld+json', dataStream)
    const data = await rdf.dataset().import(output)
    const validator = new SHACLValidator(shapes, { factory: rdf })
    const report = await validator.validate(data) as any
    if (report.conforms) {
      return [true, {}]
    }
    for (const result of report.results) {
      const key = result.path?.value.replace('http://schema.org/', '')
      if (key) {
        if (!(key in extraErrors)) extraErrors[key] = []
        extraErrors[key].push(fromRdf(result.message[0]))
      }
    }
    extraErrors.fullReport = await report.dataset.serialize({
      format: 'application/ld+json'
    })
    return [false, extraErrors]
  }
}

// V5 DDO implementation
export class V5DDO extends DDOManager {
  public constructor(ddoData: Record<string, any>) {
    super(ddoData);
  }

  makeDid(nftAddress: string, chainId: string): string {
    return (
      'did:ope:' +
      createHash('sha256')
        .update(getAddress(nftAddress) + chainId)
        .digest('hex')
    )
  }

  getServices(): ServiceV5[] {
    return this.getDDOData().credentialSubject?.services || null;
  }

  getMetadata(): MetadataV5 {
    return this.getDDOData().credentialSubject?.metadata || null;
  }

  async validate(chainId: number, nftAddress: string): Promise<[boolean, Record<string, string[]>]> {
    const ddoCopy = JSON.parse(JSON.stringify(this.getDDOData()));
    const extraErrors: Record<string, string[]> = {};
    ddoCopy['@type'] = 'VerifiableCredential'
    ddoCopy['@context'] = {
      '@vocab': 'https://www.w3.org/ns/credentials/v2/'
    }
    if (!ddoCopy.credentialSubject.chainId) {
      extraErrors.chainId = ['chainId is missing or invalid.'];
    }

    try {
      getAddress(nftAddress);
    } catch (err) {
      extraErrors.nftAddress = ['nftAddress is missing or invalid.'];
    }

    if (!(this.makeDid(nftAddress, chainId.toString(10)) === ddoCopy.credentialSubject.id)) {
      extraErrors.id = ['did is not valid for chainId and nft address'];
    }

    if (!ddoCopy.credentialSubject.metadata) {
      extraErrors.metadata = ["metadata is missing or invalid."];
    }

    if (!ddoCopy.credentialSubject.services) {
      extraErrors.services = ["services are missing or invalid."];
    }

    const schemaFilePath = this.getSchema(ddoCopy.version);

    const shapes = await rdf.dataset().import(rdf.fromFile(schemaFilePath));
    const dataStream = Readable.from(JSON.stringify(ddoCopy));
    const output = formats.parsers.import('application/ld+json', dataStream);
    const data = await rdf.dataset().import(output);
    const validator = new SHACLValidator(shapes, { factory: rdf });
    const report = await validator.validate(data) as any;

    if (report.conforms) {
      return [true, {}];
    }

    for (const result of report.results) {
      const key = result?.path?.value.replace('https://www.w3.org/ns/credentials/v2/', '');
      if (key) {
        if (!(key in extraErrors)) extraErrors[key] = [];
        extraErrors[key].push(result.message[0].value);
      }
    }

    extraErrors.fullReport = await report.dataset.serialize({
      format: 'application/ld+json'
    })
    return [false, extraErrors];
  }
}

export async function validateDDO(ddoData: Record<string, any>, chainId: number, nftAddress: string): Promise<[boolean, Record<string, string[]>]> {
  try {
    const ddoInstance = DDOManager.getDDOClass(ddoData);
    return await ddoInstance.validate(chainId, nftAddress);
  } catch (error: any) {
    return [false, { general: [`Validation failed: ${error.message}`] }];
  }
}
