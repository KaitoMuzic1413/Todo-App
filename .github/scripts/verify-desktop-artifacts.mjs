import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundleRoot = path.join(repositoryRoot, 'frontend/src-tauri/target/release/bundle');
const tauriConfig = JSON.parse(readFileSync(path.join(repositoryRoot, 'frontend/src-tauri/tauri.conf.json'), 'utf8'));
const target = process.argv[2];

const walk = (directory) => {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    return statSync(fullPath).isDirectory() ? walk(fullPath) : [fullPath];
  });
};

const files = walk(bundleRoot);
const basenames = files.map((file) => path.basename(file));
const requirements = target === 'linux'
  ? [
      ['Linux x64 AppImage', (name) => name.includes(tauriConfig.version) && name.endsWith('.AppImage') && /(?:amd64|x86_64|x64)/i.test(name)],
      ['Linux x64 Debian package', (name) => name.includes(tauriConfig.version) && name.endsWith('.deb') && /(?:amd64|x86_64|x64)/i.test(name)],
      ['Linux signed updater archive', (name) => name.includes(tauriConfig.version) && name.endsWith('.AppImage.tar.gz')],
    ]
  : target === 'windows'
    ? [
        ['Windows x64 installer', (name) => name.includes(tauriConfig.version) && name.endsWith('.exe') && /(?:x64|x86_64)/i.test(name)],
        ['Windows signed updater archive', (name) => name.includes(tauriConfig.version) && name.endsWith('.nsis.zip')],
      ]
    : [];

if (!requirements.length) {
  console.error('Usage: node verify-desktop-artifacts.mjs <linux|windows>');
  process.exit(2);
}

const missing = requirements.filter(([, matches]) => !basenames.some(matches)).map(([label]) => label);
const installableExtensions = ['.AppImage', '.deb', '.exe', '.msi'];
const staleInstallers = basenames.filter((name) => installableExtensions.some((extension) => name.endsWith(extension))
  && !name.includes(tauriConfig.version));
const updaterArchives = basenames.filter((name) => name.endsWith('.AppImage.tar.gz') || name.endsWith('.nsis.zip'));
const missingSignatures = updaterArchives.filter((name) => !basenames.includes(`${name}.sig`));

if (missing.length || missingSignatures.length || staleInstallers.length) {
  console.error('Desktop artifact validation failed.');
  if (missing.length) console.error(`Missing: ${missing.join(', ')}`);
  if (missingSignatures.length) console.error(`Missing updater signatures for: ${missingSignatures.join(', ')}`);
  if (staleInstallers.length) console.error(`Found installers from a different version than ${tauriConfig.version}: ${staleInstallers.join(', ')}`);
  process.exit(1);
}

console.log(`${target} desktop artifacts validated:`);
requirements.forEach(([label, matches]) => {
  console.log(`- ${label}: ${basenames.find(matches)}`);
});
