import { useEffect, useState } from 'react';
import { CalendarDays, CircleAlert, Download, ExternalLink, Laptop2, LoaderCircle, Terminal } from 'lucide-react';
import Header from '@/components/Header';
import { LayoutShell } from '@/components/LayoutShell';
import { fetchDesktopReleases, getDesktopAssets, GITHUB_RELEASES_URL } from '@/lib/desktopReleases';
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

const formatDate = (value, language) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
  }).format(date);
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
      className='hidden shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 md:inline-flex'
      href={asset.browser_download_url}
      target='_blank'
      rel='noopener noreferrer'
    >
      <Download className='h-4 w-4' aria-hidden='true' />
      {t.desktopDownloadButton}
    </a>
  </div>
);

const PlatformCard = ({ assets, Icon, title, language, noAssetMessage, t }) => (
  <section className='rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-6'>
    <div className='mb-5 flex items-center gap-3'>
      <span className='flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'>
        <Icon className='h-5 w-5' aria-hidden='true' />
      </span>
      <div>
        <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>{title}</h2>
      </div>
    </div>

    {assets.length ? (
      <div className='space-y-3'>
        {assets.map((asset) => <DownloadAsset key={asset.id || asset.name} asset={asset} language={language} t={t} />)}
      </div>
    ) : (
      <p className='rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400'>
        {noAssetMessage}
      </p>
    )}
  </section>
);

const DownloadPage = () => {
  const { language, t } = useLanguage();
  const [releaseData, setReleaseData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

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
  const publishedDate = formatDate(latestRelease?.published_at, language);
  const noAssetMessage = latestRelease
    ? t.desktopDownloadNoPlatformAsset
    : t.desktopDownloadNoRelease;

  return (
    <LayoutShell>
      <div className='space-y-7'>
        <Header />

        <section className='overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-8'>
          <div className='relative isolate'>
            <div aria-hidden='true' className='pointer-events-none absolute -right-12 -top-20 -z-10 h-56 w-56 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-700/20' />
            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300'>{t.desktopDownloadNav}</p>
            <h1 className='mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl'>{t.desktopDownloadTitle}</h1>
            <p className='mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base'>{t.desktopDownloadSubtitle}</p>

            {isLoading ? (
              <div className='mt-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400' role='status'>
                <LoaderCircle className='h-4 w-4 animate-spin' aria-hidden='true' />
                {t.desktopDownloadLoading}
              </div>
            ) : hasLoadError ? (
              <div className='mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-500/10 dark:text-amber-100' role='alert'>
                <CircleAlert className='mt-0.5 h-5 w-5 shrink-0' aria-hidden='true' />
                <span>{t.desktopDownloadLoadError}</span>
              </div>
            ) : latestRelease && desktopAssets.length > 0 ? (
              <div className='mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-500/10 dark:text-emerald-100'>
                <span className='font-semibold'>{t.desktopDownloadLatest}: {latestRelease.name || latestRelease.tag_name}</span>
                <span>{t.desktopDownloadVersion}: {latestRelease.tag_name}</span>
                {publishedDate ? <span className='inline-flex items-center gap-1.5'><CalendarDays className='h-4 w-4' aria-hidden='true' />{publishedDate}</span> : null}
              </div>
            ) : latestRelease ? (
              <div className='mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200' role='status'>
                {t.desktopDownloadNoAssets}
              </div>
            ) : (
              <div className='mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200' role='status'>
                {t.desktopDownloadNoRelease}
              </div>
            )}

            <a className='mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100' href={GITHUB_RELEASES_URL} target='_blank' rel='noopener noreferrer'>
              {t.desktopDownloadAllReleases}
              <ExternalLink className='h-4 w-4' aria-hidden='true' />
            </a>
          </div>
        </section>

        <p className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 md:hidden'>
          {t.desktopDownloadMobile}
        </p>

        {!isLoading && !hasLoadError ? (
          <div className='grid gap-5 lg:grid-cols-2'>
            <PlatformCard assets={windowsAssets} Icon={Laptop2} title={t.desktopDownloadWindows} language={language} noAssetMessage={noAssetMessage} t={t} />
            <PlatformCard assets={linuxAssets} Icon={Terminal} title={t.desktopDownloadLinux} language={language} noAssetMessage={noAssetMessage} t={t} />
          </div>
        ) : null}

        {latestRelease && desktopAssets.length > 0 ? (
          <section className='rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-6'>
            <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>{t.desktopDownloadNotes}</h2>
            <div className='mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600 dark:text-slate-300'>
              {latestRelease.body?.trim() || t.desktopDownloadNotesEmpty}
            </div>
          </section>
        ) : null}

      </div>
    </LayoutShell>
  );
};

export default DownloadPage;
