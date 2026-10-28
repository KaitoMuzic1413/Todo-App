import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, LoaderCircle, MailCheck } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { resendVerificationEmail, verifyEmail } from '@/lib/api';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const [status, setStatus] = useState(() => (token && email ? 'verifying' : 'missing'));
  const [message, setMessage] = useState('');
  const [resendState, setResendState] = useState('idle');

  useEffect(() => {
    let active = true;

    if (!token || !email) return () => { active = false; };

    verifyEmail(token, email)
      .then(({ data }) => {
        if (!active) return;
        setStatus('success');
        setMessage(data?.message || 'Email verified successfully.');
      })
      .catch((error) => {
        if (!active) return;
        setStatus('error');
        setMessage(error.response?.data?.message || 'This verification link is invalid or has expired.');
      });

    return () => { active = false; };
  }, [email, token]);

  const handleResend = async () => {
    const targetEmail = email || sessionStorage.getItem('todo-auth-email') || '';
    if (!targetEmail) return;
    try {
      setResendState('sending');
      await resendVerificationEmail(targetEmail.trim());
      setResendState('sent');
    } catch (error) {
      setResendState('error');
      setMessage(error.response?.data?.message || 'Could not resend the verification email.');
    }
  };

  const isLoading = status === 'verifying';
  const isSuccess = status === 'success';

  return (
    <AuthLayout>
      <div className='w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80'>
        <div className='mb-6 text-center'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'>
            {isLoading ? <LoaderCircle className='h-8 w-8 animate-spin' /> : isSuccess ? <CheckCircle2 className='h-8 w-8' /> : status === 'error' || status === 'missing' ? <CircleAlert className='h-8 w-8' /> : <MailCheck className='h-8 w-8' />}
          </div>
          <h1 className='mt-5 text-3xl font-bold text-slate-900 dark:text-white'>
            {isLoading ? 'Verifying email...' : isSuccess ? 'Email verified' : 'Verify your email'}
          </h1>
          <p className='mt-2 text-sm text-slate-500 dark:text-slate-300'>
            {isLoading
              ? 'Please wait while we confirm your address.'
              : isSuccess
                ? 'Your account is ready. You can sign in now.'
                : status === 'missing'
                  ? 'Open the verification link from your email, or request a new one below.'
                  : message}
          </p>
        </div>

        {message && !isLoading && !isSuccess && status !== 'missing' ? (
          <p className='mb-4 rounded-3xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300'>{message}</p>
        ) : null}

        {resendState === 'sent' ? (
          <p className='mb-4 rounded-3xl bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-300'>
            If this account needs verification, a new email is on its way.
          </p>
        ) : null}

        <div className='space-y-3'>
          {!isSuccess ? (
            <button
              type='button'
              onClick={handleResend}
              disabled={resendState === 'sending' || (!email && !sessionStorage.getItem('todo-auth-email'))}
              className='inline-flex w-full items-center justify-center gap-2 rounded-3xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-violet-800 dark:bg-violet-500/10 dark:text-violet-200'
            >
              {resendState === 'sending' ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <MailCheck className='h-4 w-4' />}
              Resend verification email
            </button>
          ) : null}

          <Link
            to='/signin'
            className='inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent transition hover:-translate-y-0.5'
          >
            Go to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
