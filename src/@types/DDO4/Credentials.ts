/* eslint-disable no-unused-vars */
export enum CREDENTIALS_TYPES {
  ADDRESS = 'address',
  ACCESS_LIST = 'accessList',
  POLICY_SERVER_SPECIFIC = 'PS-specific Type' // externally handled type
}

export const KNOWN_CREDENTIALS_TYPES = [
  CREDENTIALS_TYPES.ADDRESS,
  CREDENTIALS_TYPES.ACCESS_LIST
];

export interface Credential {
  type?: CREDENTIALS_TYPES;
  values?: string[];
}

export type MATCH_RULES = 'any' | 'all';

export interface Credentials {
  match_allow?: MATCH_RULES; // any =>  it's enough to have one rule matched, all => all allow rules should match, default: 'all'
  match_deny?: MATCH_RULES; // same pattern as above, default is 'any'
  allow?: Credential[];
  deny?: Credential[];
}
