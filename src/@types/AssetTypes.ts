export interface AssetNft {
  /**
   * Contract address of the deployed ERC721 NFT contract.
   * @type {string}
   */
  address: string;

  /**
   * Name of NFT set in contract.
   * @type {string}
   */
  name: string;

  /**
   * Symbol of NFT set in contract.
   * @type {string}
   */
  symbol: string;

  /**
   * ETH account address of the NFT owner.
   * @type {string}
   */
  owner: string;

  /**
   * State of the asset reflecting the NFT contract value.
   * 0	Active.
   * 1	End-of-life.
   * 2	Deprecated (by another asset).
   * 3	Revoked by publisher.
   * 4	Ordering is temporary disabled.
   * 5  Unlisted in markets.
   * @type {number}
   */
  state: 0 | 1 | 2 | 3 | 4 | 5;

  /**
   * Contains the date of NFT creation.
   * @type {string}
   */
  created: string;

  /**
   * NFT token URI.
   * @type {string}
   */
  tokenURI: string;
}

export interface Purgatory {
  /**
   * If `true`, asset is in purgatory.
   * @type {boolean}
   */
  state: boolean;

  /**
   * If asset is in purgatory, contains the reason for being there as defined in `list-purgatory`.
   * @type {string}
   */
  reason?: string;
}

export interface AssetDatatoken {
  /**
   * Contract address of the deployed Datatoken contract.
   * @type {string}
   */
  address: string;

  /**
   * Name of NFT set in contract.
   * @type {string}
   */
  name: string;

  /**
   * Symbol of NFT set in contract.
   * @type {string}
   */
  symbol: string;

  /**
   * ID of the service the datatoken is attached to.
   * @type {string}
   */
  serviceId: string;
}

export type PriceType = 'fixedrate' | 'dispenser';

export interface AssetPrice {
  type: PriceType;
  price: string;
  contract: string;
  token?: string;
  exchangeId?: string;
}

export interface Stats {
  datatokenAddress: string;
  name: string;
  symbol: string;
  serviceId: string;
  orders?: number;
  prices?: AssetPrice[];
}
export interface AssetLastEvent {
  txid: string;
  block: number;
  from: string;
  contract: string;
  datetime: string;
}

export interface IndexedMetadata {
  nft?: AssetNft;
  event?: AssetLastEvent;
  purgatory?: Purgatory;
  stats?: Stats[];
}

export interface AssetFields {
  datatokens?: AssetDatatoken[];
  indexedMetadata?: IndexedMetadata;
}
