import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, UserPlus, Mail, Lock, Eye, EyeOff, CheckCircle2, UserRound } from 'lucide-react';
import { registerWithEmail } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import AuthLayout from '@/components/AuthLayout';
import PolicyConsentModal from '@/components/PolicyConsentModal';

const SignUpPage = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isVietnamese = language === 'vi';
  const [email, setEmail] = useState(() => sessionStorage.getItem('todo-auth-email') || '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(() => localStorage.getItem('todo-legal-accepted-version') === '2026-10-26');
  const [showPolicyConsent, setShowPolicyConsent] = useState(false);

  const validatePassword = (pwd) => {
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,20}$/;
    return passwordRegex.test(pwd);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!acceptedPolicies) {
      setShowPolicyConsent(true);
      return;
    }

    const trimmedEmail = email.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!isValidEmail) {
      setError(t.invalidEmail || 'Invalid email address.');
      return;
    }

    if (!validatePassword(password)) {
      setError(
        'Password must be 8-20 characters, include letters and numbers, with no special characters.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await registerWithEmail(trimmedEmail, password, name.trim());

      setSuccessMessage('Account created successfully! Redirecting to Sign In...');

      setTimeout(() => {
        navigate('/signin');
      }, 2000);
    } catch (requestError) {
      if (
        requestError?.response?.status === 409 ||
        requestError?.response?.data?.exists
      ) {
        sessionStorage.setItem('todo-auth-email', trimmedEmail);
        navigate('/signin', { replace: true });
        return;
      } else {
        setError(
          requestError?.response?.data?.message ||
            'Failed to create account. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className='w-full max-w-md rounded-3xl border border-violet-200/70 bg-white/85 p-8 shadow-accent-ring backdrop-blur-sm dark:border-violet-500/20 dark:bg-slate-900/85 dark:shadow-accent-ring'>
        <div className='mb-6 text-center'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'>
            <UserPlus className='h-8 w-8' />
          </div>
          <h1 className='mt-5 text-3xl font-bold text-slate-900 dark:text-white'>
            Sign Up
          </h1>
          <p className='mt-2 text-sm text-slate-500 dark:text-slate-300'>
            Create an account to get started.
          </p>
        </div>

        <form id='signup-form' onSubmit={handleSubmit} className='space-y-4'>
          <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
            {t.displayNameOptional || 'Display name (optional)'}
            <div className='relative mt-2'>
              <UserRound className='absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
              <input
                type='text'
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder={t.displayName || 'Your name'}
                disabled={Boolean(successMessage)}
                className='h-12 w-full rounded-3xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
              />
            </div>
          </label>
          <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
            {t.emailAddress || 'Email Address'}
            <div className='relative mt-2'>
              <Mail className='absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
              <input
                type='email'
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  sessionStorage.setItem('todo-auth-email', event.target.value);
                }}
                placeholder='name@example.com'
                disabled={Boolean(successMessage)}
                className='h-12 w-full rounded-3xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
              />
            </div>
          </label>

          <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
            Password
            <div className='relative mt-2'>
              <Lock className='absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder='8-20 alphanumeric characters'
                disabled={Boolean(successMessage)}
                className='h-12 w-full rounded-3xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              >
                {showPassword ? <Eye className='h-5 w-5' /> : <EyeOff className='h-5 w-5' />}
              </button>
            </div>
            <p className='mt-1 text-xs text-slate-400 dark:text-slate-400'>
              Must be 8–20 characters with letters and numbers.
            </p>
          </label>

          <p className='text-center text-xs leading-6 text-slate-500 dark:text-slate-400'>
            <Link to='/policies/privacy' className='font-medium text-violet-600 underline underline-offset-2 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300'>{isVietnamese ? 'Chính sách quyền riêng tư' : 'Privacy Policy'}</Link>
            {', '}
            <Link to='/policies/terms' className='font-medium text-violet-600 underline underline-offset-2 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300'>{isVietnamese ? 'điều khoản sử dụng' : 'Terms of Use'}</Link>
            {isVietnamese ? ' và ' : ' '}
            <Link to='/policies/cookies' className='font-medium text-violet-600 underline underline-offset-2 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300'>{isVietnamese ? 'chính sách cookie &amp; lưu trữ' : 'Cookie & Storage Policy'}</Link>
          </p>

          {error ? <p className='text-sm text-rose-500'>{error}</p> : null}

          {successMessage ? (
            <div className='flex items-center gap-2 rounded-3xl bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400'>
              <CheckCircle2 className='h-5 w-5 flex-shrink-0' />
              <span>{successMessage}</span>
            </div>
          ) : null}

          <button
            type='submit'
            disabled={isSubmitting || Boolean(successMessage)}
            className='inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent transition-transform hover:-translate-y-0.5 disabled:opacity-60 '
          >
            {isSubmitting
              ? 'Creating account...'
              : successMessage
              ? 'Redirecting...'
              : 'Sign Up'}
            <ArrowRight className='h-4 w-4' />
          </button>
        </form>

        <div className='mt-6 text-center text-sm text-slate-500 dark:text-slate-400'>
          Already have an account?{' '}
          <Link
            to='/signin'
            className='font-semibold text-violet-600 hover:underline dark:text-violet-400'
          >
            Sign in
          </Link>
        </div>
      </div>
      <PolicyConsentModal open={showPolicyConsent} onDecline={() => setShowPolicyConsent(false)} onAccept={() => { localStorage.setItem('todo-legal-accepted-version', '2026-10-26'); setAcceptedPolicies(true); setShowPolicyConsent(false); window.setTimeout(() => document.getElementById('signup-form')?.requestSubmit(), 0); }} />
    </AuthLayout>
  );
};

export default SignUpPage;
