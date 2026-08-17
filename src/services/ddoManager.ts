import { getAddress, sha256, toUtf8Bytes } from 'ethers';
import { fromRdf } from 'rdf-literal';
import { Parser as N3Parser, Store } from 'n3';
import jsonld from 'jsonld';
import { AssetFields } from '../@types/AssetTypes.js';
import { Service as ServiceV4 } from '../@types/DDO4/Service.js';
import { Service as ServiceV5 } from '../@types/DDO5/Service.js';
import {
  CredentialSubject,
  DDOFields,
  Proof,
  UpdateFields,
  VersionedDDO
} from '../@types/index.js';
import { getSHACLValidator } from '../utils/importUtils.js';
import { SCHEMAS } from '../schemas/index.js';

const CURRENT_VERSION = '5.0.0';
const ALLOWED_VERSIONS = [
  '4.1.0',
  '4.3.0',
  '4.5.0',
  '4.7.0',
  '5.0.0',
  'deprecated'
];

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
   * Abstract method to update multiple fields.
   * @param fields - Partial object containing fields to update.
   * @returns The updated DDO data.
   */
  abstract updateFields(fields: UpdateFields): Record<string, any>;

  /**
   * Retrieves the DDO data.
   * @returns The DDO data as a record.
   */
  public getDDOData(): Record<string, any> {
    return this.ddoData;
  }

  /**
   * Method to retrieve the DID.
   * @returns The DID of ddo.
   */
  public getDid(): string {
    return this.getDDOData().id || null;
  }

  public deleteIndexedMetadataIfExists(
    ddo: Record<string, any>
  ): Record<string, any> {
    const ddoCopy: Record<string, any> = structuredClone(ddo);
    if ('indexedMetadata' in ddoCopy) {
      delete ddoCopy.indexedMetadata;
      return ddoCopy;
    }
    return ddo;
  }

  /**
   * Returns the SHACL schema content for a given version.
   * @param version - The schema version (default: CURRENT_VERSION).
   * @returns The schema content as a string.
   * @throws An error if the version is not supported.
   */
  public getSchema(version: string = CURRENT_VERSION): string {
    if (!ALLOWED_VERSIONS.includes(version)) {
      throw new Error(`Unsupported schema version: ${version}`);
    }
    const schema = SCHEMAS[version];
    if (!schema) {
      throw new Error(`Schema not found for version: ${version}`);
    }
    return schema;
  }

  /**
   * Parses schema and data, runs SHACL validation.
   * @returns Validation report or null if parsing failed (errors added to extraErrors).
   */
  protected async runShaclValidation(
    ddoCopy: Record<string, any>,
    extraErrors: Record<string, string[]>
  ): Promise<{ conforms: boolean; results: any[]; dataset: any } | null> {
    const SHACLValidator = await getSHACLValidator();

    // Parse Turtle schema with n3
    const schemaContent = this.getSchema(ddoCopy.version);
    const shapes = new Store(new N3Parser().parse(schemaContent));

    // Parse JSON-LD data: convert to N-Quads, then parse with n3
    let nquads;
    try {
      nquads = await jsonld.toRDF(ddoCopy, { format: 'application/n-quads' });
    } catch (error) {
      extraErrors.general = [`Failed to convert DDO to RDF: ${error}`];
      return null;
    }
    const data = new Store(new N3Parser().parse(nquads as string));

    // A near-empty graph means JSON-LD expansion dropped the DDO vocabulary
    // (e.g. an unmapped `@context` such as the raw Verifiable Credentials v2
    // context). SHACL would then find no target nodes and "conform" vacuously,
    // so a broken DDO would validate as true. Treat that as a hard failure
    // instead of silently passing.
    if (data.size === 0) {
      extraErrors.general = [
        'DDO could not be expanded into RDF; no statements were produced.'
      ];
      return null;
    }

    const validator = new SHACLValidator(shapes);
    return validator.validate(data);
  }

  /**
   * Recursively collects SHACL violations into field-level errors.
   *
   * rdf-validate-shacl reports a failed `sh:node` constraint as a generic
   * "Value does not have shape X" on the *parent* path, and nests the real,
   * per-field violation under `result.detail`. Walking into `detail` lets us
   * key the error by the actual failing field (e.g. `name`, `timeout`) rather
   * than the opaque parent shape, which is essential for the deeply nested v5
   * `credentialSubject` structure.
   *
   * @param results - SHACL validation results (or a nested `detail` array).
   * @param extraErrors - Accumulator keyed by field name.
   * @param vocab - Namespace IRI to strip from result paths to get the key.
   */
  protected collectShaclViolations(
    results: any[],
    extraErrors: Record<string, string[]>,
    vocab: string
  ): void {
    for (const result of results) {
      if (Array.isArray(result?.detail) && result.detail.length > 0) {
        this.collectShaclViolations(result.detail, extraErrors, vocab);
        continue;
      }
      const rawPath = result?.path?.value;
      const key = rawPath ? rawPath.replace(vocab, '') : '';
      if (!key) continue;
      const term = result?.message?.[0];
      let message: string;
      if (term == null) message = 'Invalid value';
      else if (typeof term === 'string') message = term;
      else if (typeof term.value === 'string') message = term.value;
      else message = String(fromRdf(term));
      if (!(key in extraErrors)) extraErrors[key] = [];
      if (!extraErrors[key].includes(message)) extraErrors[key].push(message);
    }
  }

  /**
   * Factory method to get a DDO class instance based on version.
   * @param ddoData - The DDO data object.
   * @returns An instance of `V4DDO` or `V5DDO` or `DeprecatedDDO`.
   * @throws An error if the version is not supported.
   */
  public static getDDOClass(ddoData: Record<string, any>): VersionedDDO {
    const { version, id } = ddoData;
    if (version.startsWith('4') && id.startsWith('did:op')) {
      return new V4DDO(ddoData);
    } else if (version.startsWith('5') && id.startsWith('did:ope')) {
      return new V5DDO(ddoData);
    } else if (version === 'deprecated') {
      return new DeprecatedDDO(ddoData);
    }
    throw new Error(`Unsupported DDO version: ${version}`);
  }
}

// V4 DDO implementation
export class V4DDO extends DDOManager {
  public constructor(ddoData: Record<string, any>) {
    super(ddoData);
  }

  makeDid(nftAddress: string, chainId: string): string {
    return (
      'did:op:' + sha256(toUtf8Bytes(getAddress(nftAddress) + chainId)).slice(2)
    );
  }

  getDDOFields(): DDOFields {
    const data = this.getDDOData();
    return {
      id: data.id || null,
      version: data.version || null,
      metadata: data.metadata || null,
      services: data.services || null,
      chainId: data.chainId || null,
      credentials: data.credentials || null,
      nftAddress: data.nftAddress || null
    };
  }

  getAssetFields(): AssetFields {
    return {
      indexedMetadata: this.getDDOData().indexedMetadata,
      datatokens: this.getDDOData().datatokens
    };
  }

  updateFields(fields: UpdateFields): Record<string, any> {
    if (fields.id) this.getDDOData().id = fields.id;
    if (fields.nftAddress) this.getDDOData().nftAddress = fields.nftAddress;
    if (fields.chainId) this.getDDOData().chainId = fields.chainId;
    if (fields.datatokens) this.getDDOData().datatokens = fields.datatokens;
    if (fields.indexedMetadata?.nft)
      this.getDDOData().indexedMetadata.nft = fields.indexedMetadata.nft;
    if (fields.indexedMetadata?.event)
      this.getDDOData().indexedMetadata.event = fields.indexedMetadata.event;
    if (fields.indexedMetadata?.purgatory)
      this.getDDOData().indexedMetadata.purgatory =
        fields.indexedMetadata.purgatory;
    if (fields.services)
      this.getDDOData().services = fields.services as ServiceV4[];
    if (fields.indexedMetadata?.stats)
      this.getDDOData().indexedMetadata.stats = fields.indexedMetadata.stats;
    return this.getDDOData();
  }

  async validate(): Promise<[boolean, Record<string, string[]>]> {
    const updatedDdo = this.deleteIndexedMetadataIfExists(this.getDDOData());
    const ddoCopy = JSON.parse(JSON.stringify(updatedDdo));
    const { chainId, nftAddress } = ddoCopy;
    const extraErrors: Record<string, string[]> = {};
    const SCHEMA_VOCAB = 'http://schema.org/';

    ddoCopy['@type'] = 'DDO';
    ddoCopy['@context'] = { '@vocab': SCHEMA_VOCAB };

    if (!chainId) {
      extraErrors.chainId = ['chainId is missing or invalid.'];
    }

    let validAddress = false;
    try {
      getAddress(nftAddress);
      validAddress = true;
    } catch {
      extraErrors.nftAddress = ['nftAddress is missing or invalid.'];
    }

    // Only derive the DID when the inputs makeDid needs are present. A missing
    // chainId or an empty/invalid nftAddress would otherwise make ethers'
    // getAddress() throw a raw TypeError; we surface a clean field error above.
    if (validAddress && chainId) {
      try {
        if (this.makeDid(nftAddress, chainId.toString(10)) !== ddoCopy.id) {
          extraErrors.id = ['did is not valid for chain Id and nft address'];
        }
      } catch {
        extraErrors.id = [
          'did could not be derived from chain Id and nft address'
        ];
      }
    }

    const report = await this.runShaclValidation(ddoCopy, extraErrors);
    if (!report) return [false, extraErrors];

    if (report.conforms) return [true, {}];

    this.collectShaclViolations(report.results, extraErrors, SCHEMA_VOCAB);
    extraErrors.fullReport = report.dataset.toString();
    return [false, extraErrors];
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
      sha256(toUtf8Bytes(getAddress(nftAddress) + chainId)).slice(2)
    );
  }

  getDDOFields(): CredentialSubject {
    const data = this.getDDOData();
    return {
      id: data?.id || null,
      version: data?.version || null,
      metadata: data.credentialSubject?.metadata || null,
      services: data.credentialSubject?.services || null,
      chainId: data.credentialSubject?.chainId || null,
      credentials: data.credentialSubject?.credentials || null,
      nftAddress: data.credentialSubject?.nftAddress || null
    };
  }

  getAssetFields(): AssetFields {
    return {
      indexedMetadata: this.getDDOData()?.indexedMetadata,
      datatokens: this.getDDOData().credentialSubject?.datatokens
    };
  }

  getProof(): Proof {
    return this.getDDOData().proof;
  }

  getIssuer(): string {
    return this.getDDOData().issuer;
  }

  updateFields(fields: UpdateFields): Record<string, any> {
    const credentialSubject = this.getDDOData().credentialSubject || {};
    if (fields.id) this.getDDOData().id = fields.id;
    if (fields.nftAddress) credentialSubject.nftAddress = fields.nftAddress;
    if (fields.chainId) credentialSubject.chainId = fields.chainId;
    if (fields.datatokens) credentialSubject.datatokens = fields.datatokens;
    if (fields.indexedMetadata?.nft)
      this.getDDOData().indexedMetadata.nft = fields.indexedMetadata.nft;
    if (fields.indexedMetadata?.event)
      this.getDDOData().indexedMetadata.event = fields.indexedMetadata.event;
    if (fields.indexedMetadata?.purgatory)
      this.getDDOData().indexedMetadata.purgatory =
        fields.indexedMetadata.purgatory;
    if (fields.services)
      credentialSubject.services = fields.services as ServiceV5[];
    if (fields.indexedMetadata?.stats)
      this.getDDOData().indexedMetadata.stats = fields.indexedMetadata.stats;
    if (fields.issuer) this.getDDOData().issuer = fields.issuer;
    if (fields.proof) this.getDDOData().proof = fields.proof;
    this.getDDOData().credentialSubject = credentialSubject;
    return this.getDDOData();
  }

  async validate(): Promise<[boolean, Record<string, string[]>]> {
    const updatedDdo = this.deleteIndexedMetadataIfExists(this.getDDOData());
    const ddoCopy = JSON.parse(JSON.stringify(updatedDdo));
    const extraErrors: Record<string, string[]> = {};
    // The v5 SHACL shape (schemas/5.0.0.ttl) declares
    // `@prefix schema: <https://www.w3.org/ns/credentials/v2/>`, so its
    // property IRIs live in that namespace. Setting the DDO's `@context` to a
    // matching `@vocab` maps every DDO / credentialSubject term
    // (metadata, services, nftAddress, ...) onto those exact IRIs during
    // JSON-LD expansion. Without this, the document's own VC v2 `@context`
    // does not define the Ocean vocabulary, so `toRDF` would drop all those
    // terms and SHACL would have nothing to validate.
    const VC_VOCAB = 'https://www.w3.org/ns/credentials/v2/';

    // A VerifiableCredential DDO carries its real payload under
    // `credentialSubject`; without it there is nothing to validate.
    const { credentialSubject } = ddoCopy;
    if (!credentialSubject || typeof credentialSubject !== 'object') {
      extraErrors.credentialSubject = [
        'credentialSubject is missing or invalid.'
      ];
      return [false, extraErrors];
    }

    const { chainId, nftAddress } = credentialSubject;

    ddoCopy['@type'] = 'VerifiableCredential';
    ddoCopy['@context'] = { '@vocab': VC_VOCAB };

    if (!chainId) {
      extraErrors.chainId = ['chainId is missing or invalid.'];
    }

    let validAddress = false;
    try {
      getAddress(nftAddress);
      validAddress = true;
    } catch {
      extraErrors.nftAddress = ['nftAddress is missing or invalid.'];
    }

    if (!credentialSubject.metadata) {
      extraErrors.metadata = ['metadata is missing or invalid.'];
    }

    if (!credentialSubject.services) {
      extraErrors.services = ['services are missing or invalid.'];
    }

    // Only derive the DID when the inputs makeDid needs are present. A missing
    // chainId or an empty/invalid nftAddress would otherwise make ethers'
    // getAddress() throw a raw TypeError; we surface a clean field error above.
    if (validAddress && chainId) {
      try {
        if (this.makeDid(nftAddress, chainId.toString(10)) !== ddoCopy.id) {
          extraErrors.id = ['did is not valid for chainId and nft address'];
        }
      } catch {
        extraErrors.id = [
          'did could not be derived from chainId and nft address'
        ];
      }
    }

    const report = await this.runShaclValidation(ddoCopy, extraErrors);
    if (!report) return [false, extraErrors];

    if (report.conforms) return [true, {}];

    this.collectShaclViolations(report.results, extraErrors, VC_VOCAB);
    extraErrors.fullReport = report.dataset.toString();
    return [false, extraErrors];
  }
}

// Deprecated DDO implementation
export class DeprecatedDDO extends DDOManager {
  public constructor(ddoData: Record<string, any>) {
    super(ddoData);
  }

  makeDid(nftAddress: string, chainId: string): string {
    return (
      'did:op:' + sha256(toUtf8Bytes(getAddress(nftAddress) + chainId)).slice(2)
    );
  }

  getDDOFields(): DDOFields {
    const data = this.getDDOData();
    return {
      id: data?.id || null,
      version: 'deprecated',
      chainId: data?.chainId || null,
      nftAddress: data?.nftAddress || null,
      metadata: null,
      services: null,
      credentials: null
    };
  }

  getAssetFields(): AssetFields {
    const { indexedMetadata } = this.getDDOData();
    indexedMetadata.event = null;
    indexedMetadata.purgatory = null;
    indexedMetadata.stats = null;
    indexedMetadata.nft = {
      state: this.getDDOData().indexedMetadata.nft.state,
      address: null,
      name: null,
      symbol: null,
      owner: null,
      created: null,
      tokenURI: null
    };
    return {
      indexedMetadata,
      datatokens: null
    };
  }

  updateFields(fields: UpdateFields): Record<string, any> {
    const ddo = this.getDDOData() || {};
    if (fields.id) ddo.id = fields.id;
    if (fields.nftAddress) ddo.nftAddress = fields.nftAddress;
    if (fields.chainId) ddo.chainId = fields.chainId;
    if (fields.indexedMetadata?.nft?.state)
      ddo.indexedMetadata.nft.state = fields.indexedMetadata.nft.state;
    return ddo;
  }

  async validate(): Promise<[boolean, Record<string, string[]>]> {
    const updatedDdo = this.deleteIndexedMetadataIfExists(this.getDDOData());
    const ddoCopy = JSON.parse(JSON.stringify(updatedDdo));
    const { chainId, nftAddress } = ddoCopy;
    const extraErrors: Record<string, string[]> = {};

    ddoCopy['@type'] = 'DDO';
    ddoCopy['@context'] = { '@vocab': 'http://schema.org/' };

    if (!chainId) {
      extraErrors.chainId = ['chainId is missing or invalid.'];
    }

    try {
      getAddress(nftAddress);
    } catch {
      extraErrors.nftAddress = ['nftAddress is missing or invalid.'];
    }

    if (this.makeDid(nftAddress, chainId.toString(10)) !== ddoCopy.id) {
      extraErrors.id = ['did is not valid for chain Id and nft address'];
    }

    const report = await this.runShaclValidation(ddoCopy, extraErrors);
    if (!report) return [false, extraErrors];

    if (report.conforms) return [true, {}];

    for (const result of report.results) {
      const key = result.path?.value.replace('http://schema.org/', '');
      if (key) {
        if (!(key in extraErrors)) extraErrors[key] = [];
        extraErrors[key].push(fromRdf(result.message[0]));
      }
    }
    extraErrors.fullReport = report.dataset.toString();
    return [false, extraErrors];
  }
}

export async function validateDDO(
  ddoData: Record<string, unknown>
): Promise<[boolean, Record<string, string[]>]> {
  try {
    const ddoInstance = DDOManager.getDDOClass(ddoData);
    return await ddoInstance.validate();
  } catch (error) {
    return [false, { general: [`Validation failed: ${error}`] }];
  }
}
