<!--
Copyright 2024 Ocean Protocol Foundation
SPDX-License-Identifier: Apache-2.0
-->

<h1 align="center">ddo.js</h1>

<p align="center">
  <strong><code>@oceanprotocol/ddo-js</code></strong> — the TypeScript library for building,
  reading, versioning and validating Ocean Protocol <strong>DDOs</strong> (DID Documents /
  Decentralized Data Objects).
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@oceanprotocol/ddo-js"><img src="https://img.shields.io/npm/v/@oceanprotocol/ddo-js.svg" alt="npm"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22-blue.svg" alt="node >=22">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="Apache 2.0"></a>
</p>

---

## What it is

In Ocean Protocol, every published asset (a dataset or an algorithm) is described by a **DDO**
— a JSON document, identified by a **DID** (`did:op:…` / `did:ope:…`), that carries the asset's
metadata, its services (access / compute), pricing hints and credentials.

`ddo.js` is the single source of truth for that document's **shape and rules**. It is a small,
dependency-light library that:

- provides **typed models** for both the current **v5** DDO (a W3C Verifiable Credential) and
  the legacy **v4** DDO;
- picks the right model for any raw DDO via one **factory** (`DDOManager.getDDOClass`);
- **validates** a DDO against the official **SHACL** schema for its version and returns a
  structured list of errors;
- computes a DDO's **DID** deterministically from `(nftAddress, chainId)`;
- ships the **Elasticsearch mappings** used to index DDOs.

It is consumed by [ocean.js](https://github.com/oceanprotocol/ocean.js),
[ocean-node](https://github.com/oceanprotocol/ocean-node) (the indexer validates and stores
DDOs with it) and the [Ocean CLI](https://github.com/oceanprotocol/ocean-cli), so all three
agree on exactly what a valid DDO is.

> New to Ocean DDOs? Start with the [Ocean docs](https://docs.oceanprotocol.com/). This README
> assumes you already know what a DID, a data NFT and a datatoken are.

---

## Install

```bash
npm install @oceanprotocol/ddo-js
```

The package is **ESM + CommonJS + UMD** (`"type": "module"`, built with microbundle) and ships
its own TypeScript declarations. `ethers` is a regular dependency, so there is nothing else to
install.

```ts
// ESM / TypeScript
import { DDOManager } from '@oceanprotocol/ddo-js'
```

```js
// CommonJS
const { DDOManager } = require('@oceanprotocol/ddo-js')
```

---

## Quickstart

```ts
import { DDOManager, VersionedDDO } from '@oceanprotocol/ddo-js'

// `rawDdo` is any DDO object (e.g. fetched from a node, read from a file, or just built)
const ddo: VersionedDDO = DDOManager.getDDOClass(rawDdo)

// Which asset is this?
console.log(ddo.getDid())                 // did:op:... (v4) or did:ope:... (v5)
console.log(ddo.getDDOData().version)     // '4.1.0' | '5.0.0' | ...

// Validate against the SHACL schema for its version
const [isValid, errors] = await ddo.validate()
if (!isValid) {
  console.error('DDO is not valid:', errors)
  // errors: { "<field path>": ["message", ...], ... }
}
```

`getDDOClass()` inspects the DDO's `version` and `id` and returns the correct subclass:

| Raw DDO | Returned class |
|---|---|
| `version` starts with `4` and `id` starts with `did:op` | `V4DDO` |
| `version` starts with `5` and `id` starts with `did:ope` | `V5DDO` |
| `version === 'deprecated'` | `DeprecatedDDO` |
| anything else | throws `Unsupported DDO version` |

---

## Core concepts

### The `DDOManager` hierarchy

`DDOManager` is an abstract base class with three concrete implementations — **`V4DDO`**,
**`V5DDO`** and **`DeprecatedDDO`** — all exported, plus the union type
`VersionedDDO = V4DDO | V5DDO | DeprecatedDDO`. You normally never construct them directly;
you call the static factory and get the right one back.

```ts
import { DDOManager, V4DDO, V5DDO, DeprecatedDDO, VersionedDDO } from '@oceanprotocol/ddo-js'

const instance = DDOManager.getDDOClass(rawDdo)
if (instance instanceof V5DDO) {
  console.log(instance.getIssuer())   // V5-only: the credential issuer
}
```

### DID derivation

A DDO's DID is deterministic, derived from the data NFT address and the chain id — so the same
asset always resolves to the same DID:

```ts
const did = ddo.makeDid(nftAddress, chainId.toString())
// v4 → 'did:op:'  + sha256(nftAddress + chainId)
// v5 → 'did:ope:' + sha256(getAddress(nftAddress) + chainId)
```

`validate()` cross-checks that a DDO's stored `id` matches `makeDid(nftAddress, chainId)`, so a
DID that doesn't match its own NFT/chain is reported as invalid.

### v4 vs v5

- **v4** (`did:op:…`) — the classic Ocean DDO: top-level `metadata`, `services[]`, `nftAddress`,
  `chainId`, `datatokens`.
- **v5** (`did:ope:…`) — the DDO as a **W3C Verifiable Credential**: the asset content lives
  under `credentialSubject`, with top-level `issuer` and `proof`. `V5DDO` adds `getProof()` and
  `getIssuer()` on top of the shared API.

`CURRENT_VERSION` is **`5.0.0`**.

---

## API reference

### Static

| Method | Description |
|---|---|
| `DDOManager.getDDOClass(ddoData)` | Factory → `V4DDO \| V5DDO \| DeprecatedDDO`; throws on an unsupported version. |

### Instance (all subclasses)

| Method | Returns | Description |
|---|---|---|
| `getDDOData()` | `Record<string, any>` | The underlying raw DDO object. |
| `getDid()` | `string` | The DDO's `id` (its DID). |
| `getSchema(version?)` | `string` | The SHACL schema (Turtle) for a version; defaults to the DDO's own / `CURRENT_VERSION`. Throws on an unsupported version. |
| `makeDid(nftAddress, chainId)` | `string` | Deterministic DID for the given NFT + chain. |
| `validate()` | `Promise<[boolean, Record<string, string[]>]>` | SHACL-validate the DDO. Returns `[true, {}]` when it conforms, else `[false, errorsByField]`. |
| `getDDOFields()` | `DDOFields \| CredentialSubject` | The core fields of the DDO (v5 returns the `credentialSubject`). |
| `getAssetFields()` | `AssetFields` | Asset-level fields (name, metadata, services, …). |
| `updateFields(fields)` | `Record<string, any>` | Immutably-ish apply a set of `UpdateFields` (id, nftAddress, chainId, datatokens, services, indexedMetadata, and for v5 issuer/proof) and return the updated data. |
| `deleteIndexedMetadataIfExists(ddo)` | `Record<string, any>` | Strip the node-added `indexedMetadata` block (useful before re-validating or re-publishing). |

### v5-only (`V5DDO`)

| Method | Returns | Description |
|---|---|---|
| `getProof()` | `Proof` | The verifiable-credential proof. |
| `getIssuer()` | `string` | The credential issuer. |

---

## Supported versions & schemas

SHACL schemas ship with the package as Turtle files in [`schemas/`](./schemas) and are bundled
into the build by the `generate:schemas` script (run automatically on `prebuild`):

| Version | Schema file |
|---|---|
| `4.1.0` | `schemas/4.1.0.ttl` |
| `4.3.0` | `schemas/4.3.0.ttl` |
| `4.5.0` | `schemas/4.5.0.ttl` |
| `4.7.0` | `schemas/4.7.0.ttl` |
| `5.0.0` | `schemas/5.0.0.ttl` |
| `deprecated` | `schemas/deprecated.ttl` |

Validation uses [`rdf-validate-shacl`](https://github.com/zazuko/rdf-validate-shacl) over the
DDO expanded as JSON-LD (via `jsonld` / `n3`). The validator is lazy-loaded on first `validate()`.

---

## Types

All public DDO types are exported from the package root. v4 types keep their plain names; v5
types are exported with a `V5` suffix to avoid clashes:

- **v4** (`DDO4/`): `Asset`, `DDO`, `Metadata`, `Service`, `Credentials`, `ConsumerParameter`,
  `Event`.
- **v5** (`DDO5/`): `AssetV5`, `AlgorithmV5`, `MetadataV5`, `ServiceV5`, `EventV5`,
  `CredentialV5`, `CredentialSubject`, `Proof`, `State`, `Remote`, `VerifiableCredential`,
  plus the `Compute` types.
- shared: `AssetTypes`, `UpdateFields`, and the `VersionedDDO` union.

```ts
import type { Asset, MetadataV5, VersionedDDO } from '@oceanprotocol/ddo-js'
```

---

## Elasticsearch mappings

For indexers that store DDOs in Elasticsearch, the package exports ready-made mappings (one per
schema version) plus a combined array:

```ts
import { ddoElasticMappings, ddoMappingV5_0_0, ElasticsearchMapping } from '@oceanprotocol/ddo-js'
```

| Export | What it is |
|---|---|
| `ddoMappingV4_1_0` … `ddoMappingV4_7_0`, `ddoMappingV5_0_0` | Per-version `ElasticsearchMapping` (index + `body.mappings.properties`). |
| `ddoElasticMappings` | Array of all of the above. |
| `ElasticsearchMapping` | The mapping interface. |

---

## Development

Requires **Node 22** (see [`.nvmrc`](.nvmrc); run `nvm use`).

```bash
npm install

npm run build          # generate:schemas → microbundle (modern,esm,cjs,umd) → type declarations
npm run build:tsc      # plain tsc with sourcemaps
npm run generate:schemas  # regenerate the bundled SHACL schemas from schemas/*.ttl

npm run lint           # eslint
npm run lint:fix       # eslint --fix

npm run test:unit      # generate schemas → build tests → mocha over ./dist/test/**/*.test.js
```

Tests compile to `dist/test/` first and run with Mocha (config in `.mocharc.json`). The build
is produced by [microbundle](https://github.com/developit/microbundle); CJS type declarations
are derived from the ESM ones by `scripts/build-cjs-types.js`.

Releases are cut with `release-it` (tag `v${version}`); the actual npm publish is handled by
CI on the tag, mirroring the `@oceanprotocol/lib` flow.

---

## Related repositories

- [ocean.js](https://github.com/oceanprotocol/ocean.js) — the JS/TS client library; builds and
  consumes DDOs through this package.
- [ocean-node](https://github.com/oceanprotocol/ocean-node) — the Ocean Node backend; its
  indexer validates DDOs against these SHACL schemas and stores them using the Elasticsearch
  mappings.
- [ocean-cli](https://github.com/oceanprotocol/ocean-cli) — command-line publish/consume/compute.
- [contracts](https://github.com/oceanprotocol/contracts) — the on-chain data NFT / datatoken
  contracts a DDO describes.

---

## License

```text
Copyright 2024 Ocean Protocol Foundation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
