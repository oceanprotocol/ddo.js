#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dirname, '..', 'schemas');
const outputFile = join(__dirname, '..', 'src', 'schemas', 'index.ts');

const schemaFiles = readdirSync(schemasDir).filter(f => f.endsWith('.ttl'));

if (schemaFiles.length === 0) {
  console.error('Error: No .ttl files found in', schemasDir);
  process.exit(1);
}

let output = `// Auto-generated - DO NOT EDIT
// Run 'npm run generate:schemas' to regenerate from .ttl files

export const SCHEMAS: Record<string, string> = {\n`;

for (const file of schemaFiles) {
  const version = file.replace('.ttl', '');
  const content = readFileSync(join(schemasDir, file), 'utf-8');
  // Escape for template literal: backslashes first, then backticks and ${
  const escaped = content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');
  output += `  '${version}': \`${escaped}\`,\n\n`;
}

output += `};\n`;

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, output);
console.log(`Generated ${outputFile} with ${schemaFiles.length} schemas`);
