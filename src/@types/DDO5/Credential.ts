/* eslint-disable no-use-before-define */

export type MATCH_RULES = 'any' | 'all';
export interface Credential {
  match_allow?: MATCH_RULES; // any =>  it's enough to have one rule matched, all => all allow rules should match, default: 'all'
  match_deny?: MATCH_RULES; // same pattern as above, default is 'any'
  allow?: (CredentialAddressBased | CredentialPolicyBased)[];
  deny?: (CredentialAddressBased | CredentialPolicyBased)[];
}

export interface CredentialAddressBased {
  type: 'address';
  values: string[];
}

export interface CredentialPolicyBased {
  type: 'verifiableCredential';
  requestCredentials: RequestCredential[];
}

export type RequestCredential = string | DetailedCredential;

export interface DetailedCredential {
  credential?: string;
  policies?: Policy[];
}

export type Policy = string | PolicyDetail;

export interface PolicyDetail {
  policy: string;
  args: PolicyArgs;
}

export interface PolicyArgs {
  type: string;
}
