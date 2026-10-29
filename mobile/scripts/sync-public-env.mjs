import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../../.env.local', import.meta.url));
const targetPath = fileURLToPath(new URL('../.env', import.meta.url));
const source = await readFile(sourcePath, 'utf8');
const allowedNames = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'CLOUDFLARE_SITE_KEY',
]);
const values = new Map();

for (const line of source.split(/\r?\n/)) {
  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!match || !allowedNames.has(match[1])) continue;
  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  values.set(match[1], value);
}

const mappings = [
  ['EXPO_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
  ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
  ['EXPO_PUBLIC_TURNSTILE_SITE_KEY', 'CLOUDFLARE_SITE_KEY'],
];
const missing = mappings.filter(([, sourceName]) => !values.get(sourceName)).map(([, sourceName]) => sourceName);
if (missing.length) {
  throw new Error(`Missing required public values in the repository root .env.local: ${missing.join(', ')}`);
}

const output = mappings.map(([targetName, sourceName]) => `${targetName}=${values.get(sourceName)}`);
output.push('EXPO_PUBLIC_TURNSTILE_HOST=https://sahabaquest.com.ng');
await writeFile(targetPath, `${output.join('\n')}\n`, { mode: 0o600 });
console.log('Wrote mobile/.env using the website public keys. Private secrets were not copied.');
