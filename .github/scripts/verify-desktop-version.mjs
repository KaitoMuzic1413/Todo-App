import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frontendPackage = JSON.parse(readFileSync(path.join(repositoryRoot, 'frontend/package.json'), 'utf8'));
const tauriConfig = JSON.parse(readFileSync(path.join(repositoryRoot, 'frontend/src-tauri/tauri.conf.json'), 'utf8'));
const cargoManifest = readFileSync(path.join(repositoryRoot, 'frontend/src-tauri/Cargo.toml'), 'utf8');
const cargoVersion = cargoManifest.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const versions = {
  'frontend/package.json': frontendPackage.version,
  'frontend/src-tauri/tauri.conf.json': tauriConfig.version,
  'frontend/src-tauri/Cargo.toml': cargoVersion,
};

if (Object.values(versions).some((version) => !version) || new Set(Object.values(versions)).size !== 1) {
  console.error('Desktop version mismatch:', versions);
  process.exit(1);
}

const tag = (process.argv[2] || (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : ''))?.trim();
if (tag) {
  const tagVersion = tag.replace(/^v/i, '');
  if (tagVersion !== frontendPackage.version) {
    console.error(`Tag ${tag} does not match desktop version ${frontendPackage.version}.`);
    process.exit(1);
  }
}

console.log(`Desktop version ${frontendPackage.version} is synchronized${tag ? ` with ${tag}` : ''}.`);
