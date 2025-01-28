import { MetadataAlgorithm } from '../DDO4/Metadata.js';
import { LanguageValueObject, RemoteObject } from './Remote.js';

export interface Metadata {
  created: string;
  updated: string;
  description: LanguageValueObject;
  copyrightHolder: string;
  name: string;
  //symbol: string;
  displayTitle?: LanguageValueObject;
  type: string;
  author?: string;
  providedBy: string;
  license?: License;
  links?: Record<string, string>;
  attachments?: RemoteObject[];
  tags?: string[];
  categories?: string[];
  additionalInformation?: Record<string, string | number | boolean>;
  // Required if asset type is algorithm
  algorithm?: MetadataAlgorithm;
}

export interface License {
  name: string;
  // To be defined
  ODRL?: unknown;
  licenseDocuments?: RemoteObject[];
}
