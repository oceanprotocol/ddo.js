/**
 * DID Descriptor Object.
 * Contains metadata about the asset, and define access in at least one service.
 */
export interface DeprecatedDDO {
  /**
   * DID, descentralized ID.
   * Computed as sha256(address of NFT contract + chainId)
   * @type {string}
   */
  id: string;

  /**
   * Version information in SemVer notation
   * referring to the DDO spec version
   * @type {string}
   */
  version: string;

  /**
   * NFT contract address
   * @type {string}
   */
  nftAddress: string;

  /**
   * ChainId of the network the DDO was published to.
   * @type {number}
   */
  chainId: number;
}

export interface DeprecatedDDOFields {
  id: string;
  version: string;
  nftAddress: string;
  chainId: number;
}
