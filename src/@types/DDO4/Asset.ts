import { DDO } from './DDO.js';
import {
  AssetDatatoken,
  AssetLastEvent,
  AssetNft,
  Purgatory,
  Stats
} from '../AssetTypes.js';
export interface Asset extends DDO {
  /**
   * Contains information about the ERC721 NFT contract which represents the intellectual property of the publisher.
   * @type {string}
   */
  nft: AssetNft;

  /**
   * Contains information about the ERC20 Datatokens attached to asset services.
   * @type {string}
   */
  datatokens: AssetDatatoken[];

  /**
   * Contains information about the last transaction that created or updated the DDO.
   * @type {string}
   */
  event: AssetLastEvent;

  /**
   * The stats section contains different statistics fields. This section is added by Aquarius
   * @type {Stats}
   */
  stats: Stats;

  /**
   * Contains information about an asset's purgatory status defined in
   * [`list-purgatory`](https://github.com/oceanprotocol/list-purgatory).
   * Marketplace interfaces are encouraged to prevent certain user actions like downloading on assets in purgatory.
   * @type {Purgatory}
   */
  purgatory: Purgatory;
}
