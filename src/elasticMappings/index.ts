export interface ElasticsearchMapping {
  index: string;
  body: {
    mappings: {
      properties: Record<string, any>;
    };
  };
}

const v4ServiceProperties = {
  id: { type: 'keyword' },
  type: { type: 'keyword' },
  name: {
    type: 'text',
    fields: { keyword: { type: 'keyword', ignore_above: 256 } }
  },
  description: { type: 'text' },
  files: { type: 'keyword', index: false },
  datatokenAddress: { type: 'keyword' },
  serviceEndpoint: { type: 'keyword' },
  timeout: { type: 'long' },
  compute: {
    type: 'object',
    properties: {
      allowRawAlgorithm: { type: 'boolean' },
      allowNetworkAccess: { type: 'boolean' },
      publisherTrustedAlgorithmPublishers: { type: 'keyword' },
      publisherTrustedAlgorithms: {
        type: 'nested',
        properties: {
          did: { type: 'keyword' },
          serviceId: { type: 'keyword' },
          filesChecksum: { type: 'keyword' },
          containerSectionChecksum: { type: 'keyword' }
        }
      }
    }
  },
  credentials: {
    type: 'object',
    properties: {
      allow: {
        type: 'nested',
        properties: {
          type: { type: 'keyword' },
          values: { type: 'keyword' }
        }
      },
      deny: {
        type: 'nested',
        properties: {
          type: { type: 'keyword' },
          values: { type: 'keyword' }
        }
      }
    }
  },
  consumerParameters: { type: 'object', enabled: false },
  additionalInformation: { type: 'object', enabled: false }
};

// v4.1.0 → v4.7.0 differ only in SHACL length constraints and a couple of
// optional fields (4.7 adds `serviceId` on TrustedAlgo, `credentials` on
// Service). ES doesn't enforce constraints, and unused fields stay empty in
// older docs — so all v4 versions share the same mapping body and differ
// only in index name.
const v4MappingProperties = {
  '@context': { type: 'keyword' },
  id: { type: 'keyword' },
  version: { type: 'keyword' },
  nftAddress: { type: 'keyword' },
  chainId: { type: 'long' },
  metadata: {
    type: 'object',
    properties: {
      created: { type: 'date' },
      updated: { type: 'date' },
      name: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } }
      },
      description: { type: 'text' },
      type: { type: 'keyword' },
      author: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } }
      },
      license: { type: 'keyword' },
      links: { type: 'keyword' },
      tags: { type: 'keyword' },
      categories: { type: 'keyword' },
      copyrightHolder: { type: 'keyword' },
      contentLanguage: { type: 'keyword' },
      algorithm: {
        type: 'object',
        properties: {
          language: { type: 'keyword' },
          version: { type: 'keyword' },
          container: {
            type: 'object',
            properties: {
              entrypoint: { type: 'keyword' },
              image: { type: 'keyword' },
              tag: { type: 'keyword' },
              checksum: { type: 'keyword' }
            }
          },
          consumerParameters: { type: 'object', enabled: false }
        }
      },
      additionalInformation: { type: 'object', enabled: false }
    }
  },
  services: { type: 'nested', properties: v4ServiceProperties },
  credentials: {
    type: 'object',
    properties: {
      allow: {
        type: 'nested',
        properties: {
          type: { type: 'keyword' },
          values: { type: 'keyword' }
        }
      },
      deny: {
        type: 'nested',
        properties: {
          type: { type: 'keyword' },
          values: { type: 'keyword' }
        }
      }
    }
  }
};

export const ddoMappingV4_1_0: ElasticsearchMapping = {
  index: 'op_ddo_v4.1.0',
  body: { mappings: { properties: v4MappingProperties } }
};

export const ddoMappingV4_3_0: ElasticsearchMapping = {
  index: 'op_ddo_v4.3.0',
  body: { mappings: { properties: v4MappingProperties } }
};

export const ddoMappingV4_5_0: ElasticsearchMapping = {
  index: 'op_ddo_v4.5.0',
  body: { mappings: { properties: v4MappingProperties } }
};

export const ddoMappingV4_7_0: ElasticsearchMapping = {
  index: 'op_ddo_v4.7.0',
  body: { mappings: { properties: v4MappingProperties } }
};

const v5ServiceProperties = {
  id: { type: 'keyword' },
  type: { type: 'keyword' },
  name: {
    type: 'text',
    fields: { keyword: { type: 'keyword', ignore_above: 256 } }
  },
  displayName: {
    type: 'object',
    properties: {
      value: { type: 'text' },
      language: { type: 'keyword' },
      direction: { type: 'keyword' }
    }
  },
  description: {
    type: 'object',
    properties: {
      value: { type: 'text' },
      language: { type: 'keyword' },
      direction: { type: 'keyword' }
    }
  },
  datatokenAddress: { type: 'keyword' },
  serviceEndpoint: { type: 'keyword' },
  files: { type: 'keyword', index: false },
  timeout: { type: 'long' },
  state: { type: 'keyword' },
  compute: { type: 'object', enabled: false },
  consumerParameters: { type: 'object', enabled: false },
  credentials: { type: 'object', enabled: false },
  dataSchema: { type: 'object', enabled: false },
  inputSchema: { type: 'object', enabled: false },
  outputSchema: { type: 'object', enabled: false },
  additionalInformation: { type: 'object', enabled: false }
};

export const ddoMappingV5_0_0: ElasticsearchMapping = {
  index: 'op_ddo_v5.0.0',
  body: {
    mappings: {
      properties: {
        '@context': { type: 'keyword' },
        id: { type: 'keyword' },
        type: { type: 'keyword' },
        issuer: { type: 'keyword' },
        version: { type: 'keyword' },
        credentialSubject: {
          type: 'object',
          properties: {
            id: { type: 'keyword' },
            version: { type: 'keyword' },
            chainId: { type: 'long' },
            nftAddress: { type: 'keyword' },
            metadata: {
              type: 'object',
              properties: {
                created: { type: 'date' },
                updated: { type: 'date' },
                name: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword', ignore_above: 256 } }
                },
                description: {
                  type: 'object',
                  properties: {
                    value: { type: 'text' },
                    language: { type: 'keyword' },
                    direction: { type: 'keyword' }
                  }
                },
                displayTitle: {
                  type: 'object',
                  properties: {
                    value: { type: 'text' },
                    language: { type: 'keyword' },
                    direction: { type: 'keyword' }
                  }
                },
                type: { type: 'keyword' },
                author: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword', ignore_above: 256 } }
                },
                providedBy: { type: 'keyword' },
                copyrightHolder: { type: 'keyword' },
                license: { type: 'object', enabled: false },
                links: { type: 'object', enabled: false },
                attachments: { type: 'object', enabled: false },
                tags: { type: 'keyword' },
                categories: { type: 'keyword' },
                algorithm: { type: 'object', enabled: false },
                additionalInformation: { type: 'object', enabled: false }
              }
            },
            services: { type: 'nested', properties: v5ServiceProperties },
            credentials: { type: 'object', enabled: false },
            event: {
              type: 'object',
              properties: {
                txid: { type: 'keyword' },
                block: { type: 'long' },
                from: { type: 'keyword' },
                contract: { type: 'keyword' },
                datetime: { type: 'date' }
              }
            }
          }
        },
        additionalDdos: {
          type: 'nested',
          properties: {
            type: { type: 'keyword' },
            data: { type: 'object', enabled: false }
          }
        }
      }
    }
  }
};

export const ddoElasticMappings: ElasticsearchMapping[] = [
  ddoMappingV4_1_0,
  ddoMappingV4_3_0,
  ddoMappingV4_5_0,
  ddoMappingV4_7_0,
  ddoMappingV5_0_0
];
