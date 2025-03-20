/* eslint-disable no-use-before-define */
export interface RemoteObject {
  name: string;
  displayName?: LanguageValueObject;
  description?: LanguageValueObject;
  fileType: string;
  sha256: string;
  mirrors: RemoteSource[];
  additionalInformation?: Record<string, string | number | boolean>;
}

export interface RemoteSource {
  type: string;
  url?: string;
  method?: string;
  headers?: string | Record<string, string | number | boolean>;
  ipfsCid?: string;
}

export interface LanguageValueObject {
  '@value': string;
  '@language': string;
  '@direction': string;
}
