import { Metadata } from "./Metadata";
import { Service } from "./Service";

export interface CredentialSubject {
  id: string //DID:
  metadata: Metadata;
  services: Service[];
  credentials: Credential[];
  chainId: number;
  nftAddress: string;
  event?: Event
}
