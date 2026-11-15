import { useEffect, useState } from 'react';

const useCurrentTime = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const updateNow = () => setNow(new Date());
    const intervalId = setInterval(updateNow, 30 * 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updateNow();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', updateNow);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', updateNow);
    };
  }, []);

  return now;
};

export default useCurrentTime;
