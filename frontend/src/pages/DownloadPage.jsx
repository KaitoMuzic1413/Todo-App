import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import { LayoutShell } from '@/components/LayoutShell';
import DesktopAppDownloads from '@/components/DesktopAppDownloads';

const DownloadPage = () => {
  const [searchParams] = useSearchParams();
  const selectedPlatform = ['windows', 'linux'].includes(searchParams.get('platform')) ? searchParams.get('platform') : null;

  return (
    <LayoutShell>
      <div className='space-y-7'>
        <Header />
        <DesktopAppDownloads selectedPlatform={selectedPlatform} />
      </div>
    </LayoutShell>
  );
};

export default DownloadPage;
