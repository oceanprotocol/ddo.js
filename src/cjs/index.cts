// CommonJS type entry point for the "require" condition of package.json#exports.
//
// The package is "type": "module", so dist/types/index.d.ts is read as an ESM
// declaration file. dist/ddo.cjs is CommonJS, and describing it with ESM types is the
// "masquerading as ESM" problem that publint and @arethetypeswrong report. Compiling
// this .cts file makes tsc emit a real .d.cts declaration for that condition.
export * from '../index.js';
