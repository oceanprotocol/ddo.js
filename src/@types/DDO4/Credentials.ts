export interface Credential {
  type: string;
  values: string[];
}

export interface Credentials {
  allow: Credential[];
  deny: Credential[];
}
