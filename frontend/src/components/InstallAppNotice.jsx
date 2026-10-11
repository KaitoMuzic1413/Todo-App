import { useEffect, useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { clearInstallPrompt, saveInstallPrompt } from '@/lib/pwaInstall';

export default function InstallAppNotice() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handlePrompt = (event) => {
      event.preventDefault();
      saveInstallPrompt(event);
    };
    const updateOnline = () => setOffline(!navigator.onLine);
    const installed = () => clearInstallPrompt();
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  if (dismissed || !offline) return null;
  return (
    <aside className="app-status-notice" role="status">
      <span><WifiOff size={17} /></span>
      <p>You are offline. Tasks and account features need a connection.</p>
      <button className="notice-dismiss" type="button" aria-label="Dismiss" onClick={() => setDismissed(true)}><X size={16} /></button>
    </aside>
  );
}
