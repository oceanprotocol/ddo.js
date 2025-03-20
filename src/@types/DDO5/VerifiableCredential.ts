/* eslint-disable no-use-before-define */
import { CredentialSubject } from './CredentialSubject.js';

export interface ServiceCredentials {
  verifiableCredential: EnvelopedVerifiableCredential[];
}

export interface EnvelopedVerifiableCredential {
  '@context': string;
  id: string; // Unique identifier
  type: 'EnvelopedVerifiableCredential';
}

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  credentialSubject: CredentialSubject;
  issuer: string;
  version: string;
  additionalDdos?: additionalVerifiableCredentials[];
}

export interface additionalVerifiableCredentials {
  type: string;
  data: any;
}
