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
import { Metadata as MetadataV5 } from '../@types/DDO5/Metadata';
import { Asset as AssetV5 } from '../@types/DDO5/Asset';
import { Asset as AssetV4 } from '../@types/DDO4/Asset';
import { AssetFields } from '../@types/AssetTypes';
import { CredentialSubject, DDOFields } from '../@types/index';

const CURRENT_VERSION = '5.0.0';
const ALLOWED_VERSIONS = ['4.1.0', '4.3.0', '4.5.0', '4.7.0', '5.0.0'];

export abstract class DDOManager {
  private ddoData: Record<string, any>;

  /**
   * Constructor for DDOManager.
   * @param ddoData - The data object representing the DDO.
   */
  public constructor(ddoData: Record<string, any>) {
    this.ddoData = ddoData;
  }

  /**
   * Abstract method to generate a DID (Decentralized Identifier).
   * @param nftAddress - The NFT address.
   * @param chainId - The chain ID.
   * @returns A string representing the DID.
   */
  abstract makeDid(nftAddress: string, chainId: string): string;

  /**
   * Abstract method to retrieve the DID.
   * @returns The DID of ddo.
   */
  abstract getDid(): string;

  /**
   * Abstract method to retrieve DDO fields.
   * `DDOFields` or `CredentialSubject` contains the following structure:
   * - **id**: The Decentralized Identifier (DID) of the asset.
   * - **metadata**: The metadata describing the asset.
   * - **services**: An array of services associated with the asset.
   * - **credentials**: An array of verifiable credentials.
   * - **chainId**: The blockchain chain ID where the asset is registered.
   * - **nftAddress**: The address of the NFT representing the asset.
   * - **event** (optional): The last event related to the asset.
   * 
   * @returns The DDO fields as `DDOFields` or `CredentialSubject`.
   */
  abstract getDDOFields(): DDOFields | CredentialSubject;

  /**
   * Abstract method to retrieve asset fields.
   * `AssetFields` contains the following structure:
   * - **datatokens** (optional): The datatokens associated with the asset.
   * - **event** (optional): The last event related to the asset.
   * - **nft** (optional): Information about the NFT representing the asset.
   * - **purgatory** (optional): Purgatory status of the asset, if applicable.
   * - **stats** (optional): Statistical information about the asset (e.g., usage, views).
   * 
   * @returns The asset fields as `AssetFields`.
   */
  abstract getAssetFields(): AssetFields;

  /**
   * Retrieves the asset data from the Aquarius endpoint.
   * @param did - The DID of the asset.
   * @param nodeUrl - The Aquarius node URL.
   * @param txid - (Optional) Transaction ID for filtering.
   * @param signal - (Optional) Abort signal to cancel the request.
   * @returns The asset as `AssetV5` or `AssetV4` or `null` if not found.
   */
  public async getAsset(
    did: string,
    nodeUrl: string,
    txid?: string,
    signal?: AbortSignal): Promise<AssetV5 | AssetV4 | null> {
    let tries = 0
    do {
      try {
        const path = nodeUrl + '/api/aquarius/assets/ddo/' + did
        const response = await fetch(path, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal
        })
        if (response.ok) {
          const ddo = await response.json()
          if (txid) {
            if (ddo.event && ddo.event.txid === txid) {
              if (ddo.version.startsWith('5')) {
                return ddo;
              }
              return ddo as AssetV4;
            }
          } else {
            if (ddo.version.startsWith('5')) {
              return ddo as AssetV5;
            }
            return ddo as AssetV4;
          }
        }
      } catch (e) {
        throw new Error('getAsset failed: ' + e)
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 1500)
      })
      tries++
    } while (tries < 100)
    return null
  }

  /**
   * Retrieves metadata of an asset.
   * @param did - The DID of the asset.
   * @param nodeUrl - The Aquarius node URL.
   * @param signal - (Optional) Abort signal to cancel the request.
   * @returns The metadata.
   * @throws An error if metadata retrieval fails.
   */
  public async getAssetMetadata(did: string, nodeUrl: string, signal?: AbortSignal): Promise<MetadataV4 | MetadataV5> {
    const path = nodeUrl + '/api/aquarius/assets/metadata/' + did

    try {
      const response = await fetch(path, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal
      })

      if (response.ok) {
        return response.json()
      } else {
        throw new Error(
          'getAssetMetadata failed: ' + response.status + response.statusText
        )
      }
    } catch (error) {
      throw new Error('Error getting metadata: ' + error)
    }
  }

  /**
   * Retrieves the DDO data.
   * @returns The DDO data as a record.
   */
  public getDDOData(): Record<string, any> {
    return this.ddoData;
  }

  /**
   * Resolves the schema file path for a given version.
   * @param version - The schema version (default: CURRENT_VERSION).
   * @returns The resolved schema file path.
   * @throws An error if the version is not supported.
   */
  public getSchema(version: string = CURRENT_VERSION): string {
    if (!ALLOWED_VERSIONS.includes(version)) {
      throw new Error(`Unsupported schema version: ${version}`);
    }
    const path = `../../schemas/${version}.ttl`
    const currentModulePath = fileURLToPath(import.meta.url);
    const currentDirectory = dirname(currentModulePath)
    return resolve(currentDirectory, path);
  }

  /**
   * Factory method to get a DDO class instance based on version.
   * @param ddoData - The DDO data object.
   * @returns An instance of `V4DDO` or `V5DDO`.
   * @throws An error if the version is not supported.
   */
  public static getDDOClass(ddoData: Record<string, any>): V4DDO | V5DDO {
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

  getDid(): string {
    return this.getDDOData().id || null;
  }

  getDDOFields(): DDOFields {
    const data = this.getDDOData();
    return {
      id: data.id || null,
      metadata: data.metadata || null,
      services: data.services || null,
      chainId: data.chainId || null,
      credentials: data.credentials || null,
      nftAddress: data.nftAddress || null,
    };
  }

  getAssetFields(): AssetFields {
    return {
      stats: this.getDDOData().stats,
      purgatory: this.getDDOData().purgatory,
      event: this.getDDOData().event,
      datatokens: this.getDDOData().datatokens,
      nft: this.getDDOData().nft,
    };
  }

  makeDid(nftAddress: string, chainId: string): string {
    return (
      'did:op:' +
      createHash('sha256')
        .update(getAddress(nftAddress) + chainId)
        .digest('hex')
    )
  }

  async validate(): Promise<[boolean, Record<string, string[]>]> {
    const ddoCopy = JSON.parse(JSON.stringify(this.getDDOData()))
    const { chainId, nftAddress } = ddoCopy
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

  getDid(): string {
    return this.getDDOData().credentialSubject?.id || null;
  }

  getDDOFields(): CredentialSubject {
    const data = this.getDDOData();
    return {
      id: data.credentialSubject?.id || null,
      metadata: data.credentialSubject?.metadata || null,
      services: data.credentialSubject?.services || null,
      chainId: data.credentialSubject?.chainId || null,
      credentials: data.credentialSubject?.credentials || null,
      nftAddress: data.credentialSubject?.nftAddress || null,
    };
  }

  getAssetFields(): AssetFields {
    return {
      stats: this.getDDOData().credentialSubject?.stats,
      purgatory: this.getDDOData().credentialSubject?.purgatory,
      event: this.getDDOData().credentialSubject?.event,
      datatokens: this.getDDOData().credentialSubject?.datatokens,
      nft: this.getDDOData().credentialSubject?.nft,
    };
  }

  async validate(): Promise<[boolean, Record<string, string[]>]> {
    const ddoCopy = JSON.parse(JSON.stringify(this.getDDOData()));
    const { chainId, nftAddress } = ddoCopy.credentialSubject
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

export async function validateDDO(ddoData: Record<string, any>): Promise<[boolean, Record<string, string[]>]> {
  try {
    const ddoInstance = DDOManager.getDDOClass(ddoData);
    return await ddoInstance.validate();
  } catch (error: any) {
    return [false, { general: [`Validation failed: ${error.message}`] }];
  }
}
