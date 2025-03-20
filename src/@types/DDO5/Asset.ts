import { IndexedMetadata } from '../AssetTypes.js';
import { CredentialSubject } from './CredentialSubject.js';
import { Proof } from './Proof.js';
import { VerifiableCredential } from './VerifiableCredential.js';

export interface AssetCredentialSubject extends CredentialSubject {
  indexedMetadata?: IndexedMetadata;
  /**
   * The header and signature of this ddo
   * @type {Proof}
   */
  proof: Proof;
}

export interface Asset extends VerifiableCredential {
  credentialSubject: AssetCredentialSubject;
}
