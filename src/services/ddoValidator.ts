import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { Readable } from 'stream'
import rdf from 'rdf-ext';
import SHACLValidator from 'rdf-validate-shacl'
import formats from '@rdfjs/formats-common'
import { getAddress } from 'ethers'
import { VerifiableCredential } from './../@types/DOO5/VerifiableCredential';
import { DDO } from '../@types/DDO4/DDO.js';

const CURRENT_VERSION = '5.0.0'
const ALLOWED_VERSIONS = ['4.1.0', '4.3.0', '4.5.0', '4.7.0', '5.0.0']

export abstract class DDOManager {
  private ddoData: VerifiableCredential | DDO;

  public constructor(ddoData: VerifiableCredential | DDO) {
    this.ddoData = ddoData;
  }

  abstract validate(): Promise<[boolean, Record<string, string[]>]>;

  loadSchema(schemaPath: string): rdf.DatasetCore {
    try {
      const shapes = rdf.dataset().import(rdf.fromFile(schemaPath));
      return shapes;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to load schema from path ${schemaPath}: ${err.message}`);
    }
  }

  validateSchema(ddoData: any, schema: rdf.DatasetCore): boolean {
    try {
      const dataStream = Readable.from(JSON.stringify(ddoData));
      const output = formats.parsers.import('application/ld+json', dataStream);
      const data = rdf.dataset().import(output);

      const validator = new SHACLValidator(schema, { factory: rdf });
      const report = validator.validate(data);

      if (report.conforms) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      const err = error as Error;
      throw new Error(`Validation failed: ${err.message}`);
    }
  }

  getDDOData(): VerifiableCredential | DDO {
    return this.ddoData;
  }

  makeDid(nftAddress: string, chainId: string): string {
    return (
      'did:op:' +
      createHash('sha256')
        .update(getAddress(nftAddress) + chainId)
        .digest('hex')
    )
  }

  getSchema(version: string = CURRENT_VERSION): string {
    if (!ALLOWED_VERSIONS.includes(version)) {
      return ''
    }
    const path = `../../../../schemas/${version}.ttl`
    // Use fileURLToPath to convert the URL to a file path
    const currentModulePath = fileURLToPath(import.meta.url)

    // Use dirname to get the directory name
    const currentDirectory = dirname(currentModulePath)
    const schemaFilePath = resolve(currentDirectory, path)
    if (!schemaFilePath) {
      return ''
    }
    return schemaFilePath
  }

  static getDDOClass(ddoData: VerifiableCredential | DDO): V4DDO | V5DDO {
    const { version } = ddoData;

    if (version.startsWith('4')) {
      return new V4DDO(ddoData as DDO);
    } else if (version.startsWith('5')) {
      return new V5DDO(ddoData as VerifiableCredential);
    } else {
      throw new Error(`Unsupported DDO version: ${version}`);
    }
  }
}

// V4 DDO implementation
export class V4DDO extends DDOManager {
  public constructor(ddoData: DDO) {
    super(ddoData);
  }

  async validate(): Promise<[boolean, Record<string, string[]>]> {
    try {
      const schema = this.loadSchema('v4-shacl-schema');
      const isValid = this.validateSchema(this.getDDOData(), schema);
      if (!isValid) {
        return [false, { general: ['Validation failed against SHACL schema for version 4'] }];
      }
      return [true, {}];
    } catch (error) {
      const err = error as Error;
      return [false, { general: [`Error during validation: ${err.message}`] }];
    }
  }
}

// V5 DDO implementation
export class V5DDO extends DDOManager {
  public constructor(ddoData: VerifiableCredential) {
    super(ddoData);
  }

  async validate(): Promise<[boolean, Record<string, string[]>]> {
    const ddoCopy = JSON.parse(JSON.stringify(this.getDDOData()));
    const version = ddoCopy.version;
    const extraErrors: Record<string, string[]> = {};

    if (!ddoCopy.chainId) {
      extraErrors.chainId = ['chainId is missing or invalid.'];
    }

    try {
      getAddress(ddoCopy.nftAddress);
    } catch (err) {
      extraErrors.nftAddress = ['nftAddress is missing or invalid.'];
    }

    if (!(this.makeDid(ddoCopy.nftAddress, ddoCopy.chainId.toString(10)) === ddoCopy.id)) {
      extraErrors.id = ['did is not valid for chainId and nft address'];
    }

    const schemaFilePath = this.getSchema(version);

    const shapes = await rdf.dataset().import(rdf.fromFile(schemaFilePath));
    const dataStream = Readable.from(JSON.stringify(ddoCopy));
    const output = formats.parsers.import('application/ld+json', dataStream);
    const data = await rdf.dataset().import(output);
    const validator = new SHACLValidator(shapes, { factory: rdf });
    const report = await validator.validate(data);

    if (report.conforms) {
      return [true, {}];
    }

    for (const result of report.results) {
      const key = result?.path?.value.replace('http://schema.org/', '');
      if (key) {
        if (!(key in extraErrors)) extraErrors[key] = [];
        extraErrors[key].push(result.message[0].value);
      }
    }

    extraErrors.fullReport = [await report.dataset.toString()];
    return [false, extraErrors];
  }
}

// Utility function for validation
export async function validateDDO(ddoData: VerifiableCredential): Promise<[boolean, Record<string, string[]>]> {
  try {
    const ddoInstance = DDOManager.getDDOClass(ddoData);
    return await ddoInstance.validate();
  } catch (error: any) {
    return [false, { general: [`Validation failed: ${error.message}`] }];
  }
}
