import { AssetDatatoken, AssetNft } from "./AssetTypes";

export interface UpdateFields {
  nftAddress?: string;
  chainId?: number;
  datatokens?: AssetDatatoken[];
  nft?: AssetNft;
}