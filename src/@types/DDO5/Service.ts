import { ConsumerParameter } from './Algorithm.js';
import { Compute } from './Compute.js';
import { LanguageValueObject, RemoteObject } from './Remote.js';
import { State } from './State.js';

export interface Service {
  id: string;
  type: string;
  name: string;
  displayName?: LanguageValueObject;
  description?: LanguageValueObject;
  datatokenAddress: string;
  serviceEndpoint: string;
  files: string;
  timeout: number;
  // required for type compute
  compute?: Compute;
  consumerParameters?: ConsumerParameter[];
  additionalInformation?: Record<string, string | number | boolean>;
  state: State;
  credentials: Credential[];
  // Required if type asset
  dataSchema?: RemoteObject;
  // Required if type algorithm
  inputSchema?: RemoteObject;
  // Required if type algorithm
  outputSchema?: RemoteObject;
}

export enum ServiceType {
  Access = 'access',
  Compute = 'compute'
}
