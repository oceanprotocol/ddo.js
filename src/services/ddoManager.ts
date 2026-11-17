import { getAddress } from 'ethers';
import { fromRdf } from 'rdf-literal';
import { Parser as N3Parser, Store } from 'n3';
import jsonld from 'jsonld';
import { AssetFields } from '../@types/AssetTypes.js';
import { Credentials as CredentialsV4 } from '../@types/DDO4/Credentials.js';
import { Service as ServiceV4 } from '../@types/DDO4/Service.js';
import { Credentials as CredentialsV5 } from '../@types/DDO5/Credential.js';
import { Service as ServiceV5 } from '../@types/DDO5/Service.js';
import { State } from '../@types/DDO5/State.js';
import {
  CredentialSubject,
  DDOFields,
  Proof,
  UpdateFields,
  VersionedDDO
} from '../@types/index.js';
import { getSHACLValidator } from '../utils/importUtils.js';
import { stripIndexedMetadata, SUPPORTED_VERSIONS } from '../utils/ddo.js';
import {
  ConsumerAccess,
  CredentialResolver,
  evaluateCredentials
} from '../utils/credentials.js';
import {
  DID_PREFIX_V4,
  DID_PREFIX_V5,
  hashDid,
  matchesDid
} from '../utils/did.js';
import { SCHEMAS } from '../schemas/index.js';

const CURRENT_VERSION = '5.0.0';

/**
 * Creates an empty `indexedMetadata` when an update writes to it and the DDO
 * has none, so `updateFields({ indexedMetadata: {} })` initialises it.
 */
function ensureIndexedMetadata(
  data: Record<string, any>,
  fields: UpdateFields
): void {
  if (
    fields.indexedMetadata &&
    typeof fields.indexedMetadata === 'object' &&
    (typeof data.indexedMetadata !== 'object' || data.indexedMetadata === null)
  ) {
    data.indexedMetadata = {};
  }
}

const ALLOWED_VERSIONS: readonly string[] = SUPPORTED_VERSIONS;

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
   * Reads the raw asset-level credentials from the right v4/v5 path, without
   * the `|| null` normalization of `getDDOFields()`, so malformed falsy values
   * (`false`, `0`, `""`) reach the credential evaluator and are refused.
   * A deprecated DDO has no credentials.
   */
  protected getRawAssetCredentials(): unknown {
    return undefined;
  }

  /**
   * Method to retrieve the DID.
   * @returns The DID of ddo.
   */
  public getDid(): string {
    return this.getDDOData().id || null;
  }

  /**
   * Returns the services of the DDO, or an empty array when there are none.
   */
  private getServiceList(): (ServiceV4 | ServiceV5)[] {
    const services: unknown = this.getDDOFields()?.services;
    return Array.isArray(services) ? services : [];
  }

  /**
   * Finds a service by its id.
   * @param id - The service id.
   * @returns The service, or `undefined` when not found.
   */
  public getService(id: string): ServiceV4 | ServiceV5 | undefined {
    if (typeof id !== 'string') return undefined;
    return this.getServiceList().find((service) => service?.id === id);
  }

  /**
   * Finds the position of a service by its id.
   * @param id - The service id.
   * @returns The index of the service, or `-1` when not found.
   */
  public getServiceIndex(id: string): number {
    if (typeof id !== 'string') return -1;
    return this.getServiceList().findIndex((service) => service?.id === id);
  }

  /**
   * Returns the service at a given position.
   * @param index - The service index.
   * @returns The service, or `undefined` when the index is out of range.
   */
  public getServiceByIndex(index: number): ServiceV4 | ServiceV5 | undefined {
    if (!Number.isInteger(index) || index < 0) return undefined;
    return this.getServiceList()[index] ?? undefined;
  }

  /**
   * Finds the first service whose datatoken address matches, ignoring letter case.
   * @param datatokenAddress - The datatoken address.
   * @returns The service, or `undefined` when not found.
   */
  public getServiceByDatatoken(
    datatokenAddress: string
  ): ServiceV4 | ServiceV5 | undefined {
    if (typeof datatokenAddress !== 'string') return undefined;
    const address = datatokenAddress.toLowerCase();
    return this.getServiceList().find(
      (service) =>
        typeof service?.datatokenAddress === 'string' &&
        service.datatokenAddress.toLowerCase() === address
    );
  }

  /**
   * Returns the asset-level and service-level credentials, read from the right
   * v4/v5 path. The two are returned separately and never merged: how they
   * combine is an access rule left to the caller.
   * The returned objects belong to the DDO; do not mutate them.
   * @param serviceId - The service id. When omitted, `service` is `undefined`.
   * @returns `asset` and `service` credentials, `undefined` when absent.
   */
  public getCredentials(serviceId?: string): {
    asset: CredentialsV4 | CredentialsV5 | undefined;
    service: CredentialsV4 | CredentialsV5 | undefined;
  } {
    // Malformed values are returned as they are, so the evaluator refuses them.
    const asset = (this.getRawAssetCredentials() ?? undefined) as
      CredentialsV4 | CredentialsV5 | undefined;
    const service = (serviceId === undefined
      ? undefined
      : (this.getService(serviceId)?.credentials ?? undefined)) as unknown as
      CredentialsV4 | CredentialsV5 | undefined;
    return { asset, service };
  }

  /**
   * Decides whether a consumer may access the asset and, when `serviceId` is
   * given, that service: the asset-level credentials are checked first, then the
   * service-level ones. Both must allow. Missing credentials allow.
   * Same order as ocean-node's download and compute handlers.
   * @param consumerAddress - The consumer address.
   * @param serviceId - The service id. Omit for an asset-level check only.
   * @param resolve - Checks rule types other than `address`, e.g. `accessList`.
   * @returns `{ allowed: true }`, or the level and reason of the refusal.
   * @throws TypeError when `consumerAddress` is not a string. Resolver errors
   * propagate.
   */
  public async isConsumerAllowed(
    consumerAddress: string,
    serviceId?: string,
    resolve?: CredentialResolver
  ): Promise<ConsumerAccess> {
    if (typeof consumerAddress !== 'string') {
      throw new TypeError('isConsumerAllowed expects a consumer address');
    }
    const { asset } = this.getCredentials();
    if (!(await evaluateCredentials(consumerAddress, asset, resolve))) {
      return { allowed: false, level: 'asset', reason: 'denied' };
    }
    if (serviceId === undefined) return { allowed: true };

    if (!this.getService(serviceId)) {
      return { allowed: false, level: 'service', reason: 'service-not-found' };
    }
    const { service } = this.getCredentials(serviceId);
    if (!(await evaluateCredentials(consumerAddress, service, resolve))) {
      return { allowed: false, level: 'service', reason: 'denied' };
    }
    return { allowed: true };
  }

  /**
   * Checks whether the NFT state allows ordering: Active (0) or Unlisted (5).
   * Returns `false` when `indexedMetadata.nft.state` is missing.
   *
   * `indexedMetadata` is written by the indexer, not the publisher. A DDO handed
   * in by a client can claim any state, so only a DDO read from a trusted
   * indexer gives a trustworthy answer.
   * @returns `true` if the asset can be ordered.
   */
  public isOrderable(): boolean {
    // Read the raw data: DeprecatedDDO.getAssetFields() mutates indexedMetadata.
    const state: unknown = this.getDDOData()?.indexedMetadata?.nft?.state;
    return state === State.Active || state === State.AssetUnlisted;
  }

  public deleteIndexedMetadataIfExists(
    ddo: Record<string, any>
  ): Record<string, any> {
    return stripIndexedMetadata(ddo);
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
    return hashDid(DID_PREFIX_V4, nftAddress, chainId);
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

  protected getRawAssetCredentials(): unknown {
    return this.getDDOData().credentials;
  }

  getAssetFields(): AssetFields {
    return {
      indexedMetadata: this.getDDOData().indexedMetadata,
      datatokens: this.getDDOData().datatokens
    };
  }

  updateFields(fields: UpdateFields): Record<string, any> {
    ensureIndexedMetadata(this.getDDOData(), fields);
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

    // The checks above (chainId, nftAddress, id) count even when SHACL conforms.
    if (!report.conforms) {
      this.collectShaclViolations(report.results, extraErrors, SCHEMA_VOCAB);
      extraErrors.fullReport = report.dataset.toString();
    }
    if (Object.keys(extraErrors).length > 0) return [false, extraErrors];
    return [true, {}];
  }
}

// V5 DDO implementation
export class V5DDO extends DDOManager {
  public constructor(ddoData: Record<string, any>) {
    super(ddoData);
  }

  makeDid(nftAddress: string, chainId: string): string {
    return hashDid(DID_PREFIX_V5, nftAddress, chainId);
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

  protected getRawAssetCredentials(): unknown {
    return this.getDDOData().credentialSubject?.credentials;
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
    ensureIndexedMetadata(this.getDDOData(), fields);
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

    // The checks above (chainId, nftAddress, id) count even when SHACL conforms.
    if (!report.conforms) {
      this.collectShaclViolations(report.results, extraErrors, VC_VOCAB);
      extraErrors.fullReport = report.dataset.toString();
    }
    if (Object.keys(extraErrors).length > 0) return [false, extraErrors];
    return [true, {}];
  }
}

// Deprecated DDO implementation
export class DeprecatedDDO extends DDOManager {
  public constructor(ddoData: Record<string, any>) {
    super(ddoData);
  }

  makeDid(nftAddress: string, chainId: string): string {
    return hashDid(DID_PREFIX_V4, nftAddress, chainId);
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
    const SCHEMA_VOCAB = 'http://schema.org/';

    ddoCopy['@type'] = 'DDO';
    ddoCopy['@context'] = { '@vocab': SCHEMA_VOCAB };

    if (!chainId) {
      extraErrors.chainId = ['chainId is missing or invalid.'];
    }

    try {
      getAddress(nftAddress);
    } catch {
      extraErrors.nftAddress = ['nftAddress is missing or invalid.'];
    }

    // A short DDO keeps the id of the asset it replaces: did:op: for v4,
    // did:ope: for v5 (see buildShortDdo). The id prefix picks the formula.
    if (!matchesDid(ddoCopy.id, nftAddress, chainId)) {
      extraErrors.id = ['did is not valid for chain Id and nft address'];
    }

    const report = await this.runShaclValidation(ddoCopy, extraErrors);
    if (!report) return [false, extraErrors];

    if (!report.conforms) {
      this.collectShaclViolations(report.results, extraErrors, SCHEMA_VOCAB);
      extraErrors.fullReport = report.dataset.toString();
    }
    if (Object.keys(extraErrors).length > 0) return [false, extraErrors];
    return [true, {}];
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
