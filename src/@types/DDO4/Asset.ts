import { DDO } from './DDO.js';
import {
  IndexedMetadata,
} from '../AssetTypes.js';
export interface Asset extends DDO {
  indexedMetadata?: IndexedMetadata
}
