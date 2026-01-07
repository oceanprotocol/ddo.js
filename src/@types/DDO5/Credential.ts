export type MATCH_RULES = 'any' | 'all';

export interface CredentialAddressBased {
  type: 'address';
  values: string[];
}

export interface CredentialAccessListBased {
  type: 'accessList';
  chainId: number;
  accessList: string;
}

export interface PolicyArgs {
  type: string;
}
export interface PolicyDetail {
  policy: string;
  args: PolicyArgs;
}

export type Policy = string | PolicyDetail;

export interface DetailedCredential {
  credential?: string;
  policies?: Policy[];
}
export type RequestCredential = string | DetailedCredential;

export interface CredentialPolicyBased {
  type: 'verifiableCredential';
  requestCredentials: RequestCredential[];
}

export type Credential =
  | CredentialAddressBased
  | CredentialAccessListBased
  | CredentialPolicyBased;

export interface Credentials {
  match_allow?: MATCH_RULES; // any =>  it's enough to have one rule matched, all => all allow rules should match, default: 'all'
  match_deny?: MATCH_RULES; // same pattern as above, default is 'any'
  allow?: Credential[];
  deny?: Credential[];
}
