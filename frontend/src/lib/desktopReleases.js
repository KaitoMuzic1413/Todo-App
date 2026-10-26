const DEFAULT_GITHUB_REPOSITORY = 'KaitoMuzic1413/Todo-App';

export const GITHUB_REPOSITORY = (import.meta.env.VITE_GITHUB_REPOSITORY || DEFAULT_GITHUB_REPOSITORY).trim();

const [repositoryOwner, repositoryName] = GITHUB_REPOSITORY.split('/');
const isValidRepository = /^[A-Za-z0-9_.-]+$/.test(repositoryOwner || '')
  && /^[A-Za-z0-9_.-]+$/.test(repositoryName || '')
  && GITHUB_REPOSITORY.split('/').length === 2;

export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPOSITORY}/releases`;

const RELEASES_API_URL = isValidRepository
  ? `https://api.github.com/repos/${encodeURIComponent(repositoryOwner)}/${encodeURIComponent(repositoryName)}/releases?per_page=30`
  : null;

const SUPPORTED_EXTENSIONS = new Set(['.exe', '.msi', '.appimage', '.deb', '.apk']);

const getAssetExtension = (name = '') => {
  const normalizedName = name.toLowerCase();
  return [...SUPPORTED_EXTENSIONS].find((extension) => normalizedName.endsWith(extension)) || null;
};

export const getDesktopAssets = (release) => (Array.isArray(release?.assets) ? release.assets : [])
  .filter((asset) => {
    if (!getAssetExtension(asset.name)) return false;

    try {
      const downloadUrl = new URL(asset.browser_download_url);
      return downloadUrl.protocol === 'https:'
        && downloadUrl.hostname === 'github.com'
        && downloadUrl.pathname.startsWith(`/${GITHUB_REPOSITORY}/releases/download/`);
    } catch {
      return false;
    }
  })
  .map((asset) => ({ ...asset, format: getAssetExtension(asset.name) }));

export const fetchDesktopReleases = async ({ signal } = {}) => {
  if (!RELEASES_API_URL) {
    throw new Error('VITE_GITHUB_REPOSITORY must use the owner/repository format.');
  }

  const response = await fetch(RELEASES_API_URL, {
    signal,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases request failed (${response.status}).`);
  }

  const releases = await response.json();
  if (!Array.isArray(releases)) {
    throw new Error('GitHub returned an invalid release list.');
  }

  const publishedReleases = releases
    .filter((release) => !release.draft)
    .sort((left, right) => Date.parse(right.published_at || '') - Date.parse(left.published_at || ''));
  const latestRelease = publishedReleases.find((release) => !release.prerelease) || null;

  return { latestRelease };
};
