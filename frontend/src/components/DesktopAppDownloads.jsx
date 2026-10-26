import { useEffect, useState } from 'react';
import { CalendarDays, CircleAlert, Download, ExternalLink, Laptop2, LoaderCircle, Smartphone, Terminal } from 'lucide-react';
import { fetchDesktopReleases, getDesktopAssets, GITHUB_RELEASES_URL } from '@/lib/desktopReleases';
import { useLanguage } from '@/lib/i18n';

const formatBytes = (bytes, language) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  return new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'unit', unit: 'megabyte', unitDisplay: 'narrow', maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024));
};

const formatDate = (value, language) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium' }).format(date);
};

const PlatformCard = ({ asset, Icon, title, description, language, noAssetMessage, recommended, t }) => (
  <section className='rounded-2xl border border-violet-200/80 bg-violet-50/50 p-4 dark:border-violet-500/20 dark:bg-violet-500/5 sm:p-5'>
    <div className='flex items-center gap-3'>
      <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'><Icon className='h-5 w-5' aria-hidden='true' /></span>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'><h3 className='font-semibold text-slate-900 dark:text-white'>{title}</h3>{recommended ? <span className='rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200'>{t.downloadAppRecommended}</span> : null}</div>
        <p className='mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400'>{description}</p>
      </div>
    </div>
    {asset ? (
      <div className='mt-4 flex flex-col gap-3 rounded-xl border border-violet-200/70 bg-white/80 p-3 dark:border-violet-500/20 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0'><p className='break-all text-sm font-semibold text-slate-900 dark:text-white'>{asset.name}</p><div className='mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400'><span>{t.desktopDownloadFormat}: {asset.format}</span>{formatBytes(asset.size, language) ? <span>{t.desktopDownloadSize}: {formatBytes(asset.size, language)}</span> : null}</div></div>
        <a className='inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500' href={asset.browser_download_url} target='_blank' rel='noopener noreferrer'><Download className='h-4 w-4' aria-hidden='true' />{t.desktopDownloadButton}</a>
      </div>
    ) : <p className='mt-4 rounded-xl border border-dashed border-violet-300/80 bg-white/60 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-violet-500/30 dark:bg-slate-950/30 dark:text-slate-300'>{noAssetMessage}</p>}
  </section>
);

export default function DesktopAppDownloads({ className = '', selectedPlatform = null, recommendedPlatform = null }) {
  const { language, t } = useLanguage();
  const [releaseData, setReleaseData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchDesktopReleases({ signal: controller.signal }).then(setReleaseData).catch((error) => { if (error.name !== 'AbortError') setHasLoadError(true); }).finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, []);

  const latestRelease = releaseData?.latestRelease || null;
  const assets = getDesktopAssets(latestRelease);
  const pickAsset = (formats) => assets.find((asset) => formats.includes(asset.format)) || null;
  const windowsAsset = pickAsset(['.exe', '.msi']);
  const linuxAsset = pickAsset(['.appimage', '.deb']);
  const androidAsset = pickAsset(['.apk']);
  const publishedDate = formatDate(latestRelease?.published_at, language);
  const noReleaseMessage = latestRelease ? t.desktopDownloadNoPlatformAsset : t.desktopDownloadNoRelease;
  const showWindows = selectedPlatform ? selectedPlatform === 'windows' : true;
  const showLinux = selectedPlatform ? selectedPlatform === 'linux' : true;
  const showAndroid = selectedPlatform === 'android';

  return (
    <section className={`rounded-3xl border border-violet-200/70 bg-white/85 p-5 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-violet-500/15 dark:bg-slate-900/75 sm:p-6 ${className}`}>
      <div className='flex items-center gap-3'><span className='flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'><Download className='h-5 w-5' aria-hidden='true' /></span><div className='min-w-0'><h2 className='text-lg font-semibold text-slate-900 dark:text-white'>{showAndroid ? (t.desktopDownloadAndroid || 'Android') : t.desktopDownloadTitle}</h2><p className='mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300'>{showAndroid ? t.installAppDescription : t.desktopDownloadSubtitle}</p></div></div>
      {isLoading ? <div className='mt-5 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400' role='status'><LoaderCircle className='h-4 w-4 animate-spin' aria-hidden='true' />{t.desktopDownloadLoading}</div> : null}
      {!isLoading && hasLoadError ? <div className='mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-500/10 dark:text-amber-100' role='alert'><CircleAlert className='mt-0.5 h-5 w-5 shrink-0' aria-hidden='true' /><span>{t.desktopDownloadLoadError}</span></div> : null}
      {!isLoading && !hasLoadError && latestRelease && assets.length > 0 ? <div className='mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-sm text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100'><span className='font-semibold'>{t.desktopDownloadLatest}: {latestRelease.name || latestRelease.tag_name}</span><span>{t.desktopDownloadVersion}: {latestRelease.tag_name}</span>{publishedDate ? <span className='inline-flex items-center gap-1.5'><CalendarDays className='h-4 w-4' aria-hidden='true' />{publishedDate}</span> : null}</div> : null}
      {!isLoading && !hasLoadError ? <div className='mt-5 grid gap-3'>
        {showWindows ? <PlatformCard asset={windowsAsset} Icon={Laptop2} title={t.desktopDownloadWindows} description={t.downloadAppWindowsDescription} language={language} noAssetMessage={noReleaseMessage} recommended={recommendedPlatform === 'windows'} t={t} /> : null}
        {showLinux ? <PlatformCard asset={linuxAsset} Icon={Terminal} title={t.desktopDownloadLinux} description={t.downloadAppLinuxDescription} language={language} noAssetMessage={noReleaseMessage} recommended={recommendedPlatform === 'linux'} t={t} /> : null}
        {showAndroid ? <PlatformCard asset={androidAsset} Icon={Smartphone} title={t.desktopDownloadAndroid || 'Android'} description={t.installAppInstructions} language={language} noAssetMessage={t.desktopDownloadAndroidFallback || t.desktopDownloadMobile} recommended={recommendedPlatform === 'android'} t={t} /> : null}
        {showAndroid && !androidAsset ? <a href='/' className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500'><Smartphone className='h-4 w-4' aria-hidden='true' />{t.installApp}</a> : null}
      </div> : null}
      <a className='mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100' href={GITHUB_RELEASES_URL} target='_blank' rel='noopener noreferrer'>{t.desktopDownloadAllReleases}<ExternalLink className='h-4 w-4' aria-hidden='true' /></a>
      {latestRelease && assets.length > 0 ? <div className='mt-5 border-t border-slate-200 pt-4 dark:border-slate-800'><h3 className='text-sm font-semibold text-slate-900 dark:text-white'>{t.desktopDownloadNotes}</h3><div className='mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300'>{latestRelease.body?.trim() || t.desktopDownloadNotesEmpty}</div></div> : null}
    </section>
  );
}
