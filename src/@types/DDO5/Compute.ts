/* eslint-disable no-use-before-define */
export interface Compute {
  allowRawAlgorithm: boolean;
  allowNetworkAccess: boolean;
  publisherTrustedAlgorithmPublishers: string[];
  publisherTrustedAlgorithms: PublisherTrustedAlgorithms[];
}

export interface PublisherTrustedAlgorithms {
  did: string;
  serviceId: string;
  filesChecksum: string;
  containerSectionChecksum: string;
}
