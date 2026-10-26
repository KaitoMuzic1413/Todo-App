import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { loginWithEmail } from '@/lib/api';
import AuthLayout from '@/components/AuthLayout';
import PolicyConsentModal from '@/components/PolicyConsentModal';

const SignInPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const [email, setEmail] = useState(() => sessionStorage.getItem('todo-auth-email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(() => localStorage.getItem('todo-legal-accepted-version') === '2026-10-26');
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [pendingLoginResponse, setPendingLoginResponse] = useState(null);
  const isFormValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length > 0;

  const completeLogin = (res) => {
    const rawUser = res.data?.user || res.data;
    const safeUser = { ...(rawUser || {}) };
    delete safeUser.password;

    localStorage.setItem('todo-user', JSON.stringify(safeUser));

    if (safeUser?.email) {
      localStorage.setItem('todo-user-email', safeUser.email);
    }
    sessionStorage.removeItem('todo-auth-email');
    if (res.data?.token) {
      localStorage.setItem('token', res.data.token);
    }

    window.dispatchEvent(new Event('todo-auth-changed'));
    navigate('/dashboard', { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || !password) {
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await loginWithEmail(trimmedEmail, password);

      // Only show the policy popup after the server confirms the credentials.
      if (!acceptedPolicies) {
        setPendingLoginResponse(res);
        setShowPolicyModal(true);
        return;
      }

      completeLogin(res);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || 'Invalid email or password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptPolicies = () => {
    localStorage.setItem('todo-legal-accepted-version', '2026-10-26');
    setAcceptedPolicies(true);
    setShowPolicyModal(false);

    if (pendingLoginResponse) {
      const response = pendingLoginResponse;
      setPendingLoginResponse(null);
      completeLogin(response);
    }
  };

  return (
    <AuthLayout>
      <div className='w-full max-w-md rounded-3xl border border-violet-200/70 bg-white/85 p-8 shadow-accent-ring backdrop-blur-sm dark:border-violet-500/20 dark:bg-slate-900/85 dark:shadow-accent-ring'>
        <div className='mb-6 text-center'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'>
            <LogIn className='h-8 w-8' />
          </div>
          <h1 className='mt-5 text-3xl font-bold text-slate-900 dark:text-white'>
            Sign In
          </h1>
          <p className='mt-2 text-sm text-slate-500 dark:text-slate-300'>
            Welcome back! Please enter your details.
          </p>
        </div>

        <form id='signin-form' onSubmit={handleSubmit} className='space-y-4'>
          <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
            Email address
            <div className='relative mt-2'>
              <Mail className='absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
              <input
                type='email'
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  sessionStorage.setItem('todo-auth-email', e.target.value);
                }}
                placeholder='name@example.com'
                className='h-12 w-full rounded-3xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder='Enter your password'
                className='h-12 w-full rounded-3xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              >
                {showPassword ? <EyeOff className='h-5 w-5' /> : <Eye className='h-5 w-5' />}
              </button>
            </div>
          </label>

          <div className='flex min-h-5 items-center justify-between gap-3 pt-1'>
            <div className='min-w-0 flex-1'>
              {error ? <p role='alert' className='text-xs leading-5 text-rose-500'>{error}</p> : null}
            </div>
            <Link
              to='/forgot-password'
              className='shrink-0 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400'
            >
              Forgot password?
            </Link>
          </div>

          <p className='text-center text-xs leading-6 text-slate-500 dark:text-slate-400'>
            <Link to='/policies/privacy' className='font-medium text-violet-600 underline underline-offset-2 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300'>{isVietnamese ? 'Chính sách quyền riêng tư' : 'Privacy Policy'}</Link>
            {', '}
            <Link to='/policies/terms' className='font-medium text-violet-600 underline underline-offset-2 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300'>{isVietnamese ? 'điều khoản sử dụng' : 'Terms of Use'}</Link>
            {isVietnamese ? ' và ' : ' '}
            <Link to='/policies/cookies' className='font-medium text-violet-600 underline underline-offset-2 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300'>{isVietnamese ? 'chính sách cookie &amp; lưu trữ' : 'Cookie & Storage Policy'}</Link>
          </p>

          <button
            type='submit'
            disabled={!isFormValid || isSubmitting}
            aria-disabled={!isFormValid || isSubmitting}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent transition-all ${!isFormValid || isSubmitting ? 'cursor-not-allowed opacity-40 grayscale' : 'cursor-pointer hover:-translate-y-0.5'}`}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
            <ArrowRight className='h-4 w-4' />
          </button>
        </form>

        <div className='mt-6 text-center text-sm text-slate-500 dark:text-slate-400'>
          Don't have an account?{' '}
          <Link
            to='/signup'
            className='font-semibold text-violet-600 hover:underline dark:text-violet-400'
          >
            Sign up
          </Link>
        </div>
      </div>
      <PolicyConsentModal open={showPolicyModal} onDecline={() => { setShowPolicyModal(false); setPendingLoginResponse(null); }} onAccept={handleAcceptPolicies} />
    </AuthLayout>
  );
};

export default SignInPage;
