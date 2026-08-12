import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Mail } from 'lucide-react';
import { loginWithEmail } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';

const LoginPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!isValidEmail) {
      setError(t.invalidEmail);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await loginWithEmail(trimmedEmail);
      const user = response.data.user;

      localStorage.setItem('todo-user', JSON.stringify(user));
      localStorage.setItem('todo-user-email', user.email);
      navigate('/');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Unable to sign in with email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.22),transparent_40%),linear-gradient(135deg,#f5f7fb,#eef2ff)] p-6 dark:bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.2),transparent_38%),linear-gradient(135deg,#0f172a,#111827)]'>
      <div className='w-full max-w-md rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80'>
        <div className='mb-6 text-center'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'>
            <Mail className='h-8 w-8' />
          </div>
          <h1 className='mt-5 text-3xl font-bold text-slate-900 dark:text-white'>{t.welcome}</h1>
          <p className='mt-2 text-sm text-slate-500 dark:text-slate-300'>{t.signInIntro}</p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
            {t.emailAddress}
            <input
              type='email'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder='name@example.com'
              className='mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
            />
          </label>

          {error ? <p className='text-sm text-rose-500'>{error}</p> : null}

          <button
            type='submit'
            disabled={isSubmitting}
            className='inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-transform hover:-translate-y-0.5 disabled:opacity-60 dark:shadow-violet-900/30'
          >
            {isSubmitting ? t.signingIn : t.signIn}
            <ArrowRight className='h-4 w-4' />
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
