import { Event } from './Event.js';
import { Metadata } from './Metadata.js';
import { Service } from './Service.js';

export interface CredentialSubject {
  id?: string; // DID:
  metadata: Metadata;
  version: string;
  services: Service[];
  credentials: Credential[];
  chainId: number;
  nftAddress: string;
  event?: Event;
}
