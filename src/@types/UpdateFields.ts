import {
  AssetDatatoken,
  IndexedMetadata,
} from './AssetTypes.js';
import { Service as ServiceV4 } from './DDO4/Service.js';
import { Proof } from './DDO5/Proof.js';
import { Service as ServiceV5 } from './DDO5/Service.js';

export interface UpdateFields {
  id?: string;
  nftAddress?: string;
  chainId?: number;
  datatokens?: AssetDatatoken[];
  indexedMetadata?: IndexedMetadata
  services?: ServiceV4[] | ServiceV5[];
  issuer?: string;
  proof?: Proof;
}
