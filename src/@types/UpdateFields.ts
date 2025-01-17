import { AssetDatatoken, AssetLastEvent, AssetNft, Purgatory, Stats } from "./AssetTypes";
import { Service as ServiceV4 } from "./DDO4/Service";
import { Service as ServiceV5 } from "./DDO5/Service";

export interface UpdateFields {
  id?: string;
  nftAddress?: string;
  chainId?: number;
  datatokens?: AssetDatatoken[];
  nft?: AssetNft;
  event?: AssetLastEvent;
  purgatory?: Purgatory;
  services?: ServiceV4[] | ServiceV5[]
  stats?: Stats
}