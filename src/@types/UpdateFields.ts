import { AssetDatatoken, AssetLastEvent, AssetNft, Purgatory, Stats } from "./AssetTypes";

export interface UpdateFields {
  nftAddress?: string;
  chainId?: number;
  datatokens?: AssetDatatoken[];
  nft?: AssetNft;
  event?: AssetLastEvent;
  purgatory?: Purgatory;
  stats?: Stats
}