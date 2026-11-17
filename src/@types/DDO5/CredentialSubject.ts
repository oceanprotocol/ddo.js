import { Event } from './Event.js';
import { Metadata } from './Metadata.js';
import { Service } from './Service.js';
import { Credentials } from './Credential.js';

export interface CredentialSubject {
  id?: string; // DID:
  metadata: Metadata;
  version: string;
  services: Service[];
  credentials: Credentials;
  chainId: number;
  nftAddress: string;
  event?: Event;
}
