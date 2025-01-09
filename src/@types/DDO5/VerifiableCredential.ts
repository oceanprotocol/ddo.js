import { CredentialSubject } from "./CredentialSubject";
import { Proof } from "./Proof";

export interface ServiceCredentials {
  verifiableCredential: EnvelopedVerifiableCredential[];
}

export interface EnvelopedVerifiableCredential {
  "@context": string;
  id: string; // Unique identifier
  type: "EnvelopedVerifiableCredential";
}

export interface VerifiableCredential {
  "@context": string[];
  id?: string;
  type: string[];
  credentialSubject: CredentialSubject;
  issuer: string;
  version: string;
  proof: Proof
  additionalDdos?: additionalVerifiableCredentials[]
}

export interface additionalVerifiableCredentials {
  type: string,
  data: any
}