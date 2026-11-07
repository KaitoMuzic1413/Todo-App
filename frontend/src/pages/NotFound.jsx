import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';

const LEGAL_ACCEPTANCE_VERSION = '2026-10-26';

const getSafeHomeTarget = () => {
  try {
    const user = JSON.parse(localStorage.getItem('todo-user') || 'null');
    const token = localStorage.getItem('token');
    const acceptedPolicies =
      localStorage.getItem('todo-legal-accepted-version') === LEGAL_ACCEPTANCE_VERSION;

    if (user?._id && token?.trim() && acceptedPolicies) return '/dashboard';
  } catch {
    // Ignore malformed cached session data and fall back to sign in.
  }

  return '/signin';
};

const NotFound = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-slate-50 text-center'>
      <img src='/404_NotFound.png' alt='404 Not Found' className='mb-6 w-96 max-w-full' />
      <p className='text-xl font-semibold'>{t.notFoundTitle}</p>
      <button
        type='button'
        onClick={() => navigate(getSafeHomeTarget(), { replace: true })}
        className='mt-4 inline-block cursor-pointer rounded-3xl bg-primary px-6 py-3 font-medium text-white shadow-md transition hover:bg-primary-dark'
      >
        {t.backToHome}
      </button>
    </div>
  );
};

export default NotFound;
