const detectPlatform = () => {
  if (typeof navigator === 'undefined') return null;

  const userAgent = navigator.userAgent || '';
  const platform = navigator.userAgentData?.platform || navigator.platform || '';

  if (/Android/i.test(userAgent) || /Android/i.test(platform)) return 'android';
  if (/Windows|Win32|Win64/i.test(platform) || /Windows NT/i.test(userAgent)) return 'windows';
  if (/Linux/i.test(platform) || (/Linux/i.test(userAgent) && !/Android/i.test(userAgent))) return 'linux';
  return null;
};

// Evaluated once when the app bundle loads; no network request or expensive scan.
export const detectedDownloadPlatform = detectPlatform();
export const detectDownloadPlatform = () => detectedDownloadPlatform;
