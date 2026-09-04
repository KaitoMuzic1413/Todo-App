import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, UserPlus, Mail, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { registerWithEmail } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import AuthLayout from '@/components/AuthLayout';

const SignUpPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate password: 8-20 characters with letters and numbers
  const validatePassword = (pwd) => {
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,20}$/;
    return passwordRegex.test(pwd);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

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
      await registerWithEmail(trimmedEmail, password);

      // Success
      setSuccessMessage('Account created successfully! Redirecting to Sign In...');

      // Wait 2s and go signin
      setTimeout(() => {
        navigate('/signin');
      }, 2000);
    } catch (requestError) {
      if (
        requestError?.response?.status === 409 ||
        requestError?.response?.data?.exists
      ) {
        setError('Account already exists. Please sign in instead.');
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
      <div className='w-full max-w-md rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80'>
        <div className='mb-6 text-center'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'>
            <UserPlus className='h-8 w-8' />
          </div>
          <h1 className='mt-5 text-3xl font-bold text-slate-900 dark:text-white'>
            Sign Up
          </h1>
          <p className='mt-2 text-sm text-slate-500 dark:text-slate-300'>
            Create an account to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Email Input */}
          <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
            {t.emailAddress || 'Email Address'}
            <div className='relative mt-2'>
              <Mail className='absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
              <input
                type='email'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder='name@example.com'
                disabled={Boolean(successMessage)}
                className='h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
              />
            </div>
          </label>

          {/* Password Input */}
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
                className='h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
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

          {/* Error Message */}
          {error ? <p className='text-sm text-rose-500'>{error}</p> : null}

          {/* Success Message */}
          {successMessage ? (
            <div className='flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400'>
              <CheckCircle2 className='h-5 w-5 flex-shrink-0' />
              <span>{successMessage}</span>
            </div>
          ) : null}

          {/* Submit Button */}
          <button
            type='submit'
            disabled={isSubmitting || Boolean(successMessage)}
            className='inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-transform hover:-translate-y-0.5 disabled:opacity-60 dark:shadow-violet-900/30'
          >
            {isSubmitting
              ? 'Creating account...'
              : successMessage
              ? 'Redirecting...'
              : 'Sign Up'}
            <ArrowRight className='h-4 w-4' />
          </button>
        </form>

        {/* Navigation to Login */}
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
    </AuthLayout>
  );
};

export default SignUpPage;