import {
  AssetDatatoken,
  AssetLastEvent,
  AssetNft,
  Purgatory,
  Stats
} from './AssetTypes.js';
import { Service as ServiceV4 } from './DDO4/Service.js';
import { Service as ServiceV5 } from './DDO5/Service.js';

export interface UpdateFields {
  id?: string;
  nftAddress?: string;
  chainId?: number;
  datatokens?: AssetDatatoken[];
  nft?: AssetNft;
  event?: AssetLastEvent;
  purgatory?: Purgatory;
  services?: ServiceV4[] | ServiceV5[];
  stats?: Stats;
}
