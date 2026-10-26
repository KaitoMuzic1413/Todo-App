import { useEffect, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { fetchDesktopReleases, getDesktopAssets, GITHUB_RELEASES_URL } from '@/lib/desktopReleases';
import { promptInstall, getInstallPromptAvailable } from '@/lib/pwaInstall';
import { useLanguage } from '@/lib/i18n';

const formatBytes = (bytes, language) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;

  return new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'unit',
    unit: 'megabyte',
    unitDisplay: 'narrow',
    maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024));
};

const DownloadAsset = ({ asset, language, t }) => (
  <div className='flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-950/60 sm:flex-row sm:items-center sm:justify-between'>
    <div className='min-w-0'>
      <p className='break-all text-sm font-semibold text-slate-900 dark:text-white'>{asset.name}</p>
      <div className='mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400'>
        <span>{t.desktopDownloadFormat}: {asset.format}</span>
        {formatBytes(asset.size, language) ? <span>{t.desktopDownloadSize}: {formatBytes(asset.size, language)}</span> : null}
      </div>
    </div>
    <a
      className='inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500'
      href={asset.browser_download_url}
      target='_blank'
      rel='noopener noreferrer'
    >
      <Download className='h-4 w-4' aria-hidden='true' />
      {t.desktopDownloadButton}
    </a>
  </div>
);

const PlatformCard = ({ assets, Icon, title, description, language, noAssetMessage, recommended, t }) => (
  <section className='rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/30 sm:p-5'>
    <div className='mb-4 flex items-center gap-3'>
      <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'>
        <Icon className='h-5 w-5' aria-hidden='true' />
      </span>
      <div className='min-w-0'>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='font-semibold text-slate-900 dark:text-white'>{title}</h3>
          {recommended ? <span className='rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200'>{t.downloadAppRecommended}</span> : null}
        </div>
        <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{description}</p>
      </div>
    </div>

    {assets.length ? (
      <div className='space-y-3'>
        {assets.map((asset) => <DownloadAsset key={asset.id || asset.name} asset={asset} language={language} t={t} />)}
      </div>
    ) : (
      <p className='rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400'>
        {noAssetMessage}
      </p>
    )}
  </section>
);

export default function DesktopAppDownloads({ className = '', recommendedPlatform = null }) {
  const { language, t } = useLanguage();
  const [releaseData, setReleaseData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchDesktopReleases({ signal: controller.signal })
      .then(setReleaseData)
      .catch((error) => {
        if (error.name !== 'AbortError') setHasLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  const latestRelease = releaseData?.latestRelease || null;
  const desktopAssets = getDesktopAssets(latestRelease);
  const windowsAssets = desktopAssets.filter((asset) => ['.exe', '.msi'].includes(asset.format));
  const linuxAssets = desktopAssets.filter((asset) => ['.appimage', '.deb'].includes(asset.format));

  const recommendedAsset = recommendedPlatform === 'windows'
    ? windowsAssets.find((asset) => ['.exe', '.msi'].includes(asset.format))
    : recommendedPlatform === 'linux'
      ? linuxAssets.find((asset) => ['.appimage', '.deb'].includes(asset.format))
      : null;

  const handleDownload = async () => {
    if (recommendedPlatform === 'android') {
      if (getInstallPromptAvailable()) {
        await promptInstall();
      } else {
        setInstallHelp(true);
      }
      return;
    }

    if (recommendedAsset?.browser_download_url) {
      window.location.assign(recommendedAsset.browser_download_url);
      return;
    }

    window.open(GITHUB_RELEASES_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/75 ${className}`}>
      <div className='flex min-w-0 items-center gap-3'>
        <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'>
          <Download className='h-4 w-4' aria-hidden='true' />
        </span>
        <div className='min-w-0'>
          <h2 className='text-sm font-semibold text-slate-900 dark:text-white'>{t.desktopDownloadTitle}</h2>
          <p className='mt-0.5 text-xs text-slate-500 dark:text-slate-400'>
            {recommendedPlatform === 'android'
              ? t.installAppDescription
              : recommendedAsset
                ? `${recommendedAsset.name} · ${formatBytes(recommendedAsset.size, language) || recommendedAsset.format}`
                : isLoading
                  ? t.desktopDownloadLoading
                  : t.desktopDownloadSubtitle}
          </p>
          {installHelp ? <p className='mt-1 text-xs text-amber-700 dark:text-amber-300'>{t.installAppInstructions}</p> : null}
          {hasLoadError && recommendedPlatform !== 'android' ? <p className='mt-1 text-xs text-amber-700 dark:text-amber-300'>{t.desktopDownloadLoadError}</p> : null}
        </div>
      </div>
      <button
        type='button'
        onClick={() => void handleDownload()}
        disabled={isLoading && recommendedPlatform !== 'android'}
        className='inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60'
      >
        {isLoading && recommendedPlatform !== 'android'
          ? <LoaderCircle className='h-4 w-4 animate-spin' aria-hidden='true' />
          : <Download className='h-4 w-4' aria-hidden='true' />}
        {recommendedPlatform === 'android' ? t.install : t.desktopDownloadButton}
      </button>
    </section>
  );
}
