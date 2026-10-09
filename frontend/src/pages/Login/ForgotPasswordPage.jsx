import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { forgotPassword, resetPassword, verifyResetOtp } from '@/lib/api';
import AuthLayout from '@/components/AuthLayout';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    // 1. Chặn tuyệt đối hành vi submit/reload mặc định của trình duyệt
    if (e) e.preventDefault();

    // 2. Không cho phép gửi trùng request khi đang chờ xử lý
    if (loading) return;

    setError('');
    setMessage('');

    try {
      setLoading(true);

      if (!codeSent) {
        const res = await forgotPassword(email.trim());
        setMessage(res?.data?.message || 'If an account exists for that email, a password reset code has been sent.');
        setCodeSent(true);
      } else if (!codeVerified) {
        const res = await verifyResetOtp(email.trim(), otp);
        setCodeVerified(true);
        setMessage(res?.data?.message || 'Code verified. You can now create a new password.');
      } else {
        const res = await resetPassword(email.trim(), otp, newPassword);
        setMessage(res?.data?.message || 'Password updated successfully. Please sign in.');
        setPasswordReset(true);
        setOtp('');
        setNewPassword('');
      }
    } catch (err) {
      // Lấy thông báo lỗi từ server hoặc fallback báo lỗi chung
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Something went wrong. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setMessage('');
    try {
      setLoading(true);
      const res = await forgotPassword(email.trim());
      setOtp('');
      setCodeVerified(false);
      setNewPassword('');
      setMessage(res?.data?.message || 'If an account exists for that email, a password reset code has been sent.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className='w-full max-w-md rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80'>
        <div className='mb-6 text-center'>
          <h1 className='text-3xl font-bold text-slate-900 dark:text-white'>
            Forgot Password
          </h1>
          <p className='mt-2 text-sm text-slate-500 dark:text-slate-300'>
            {passwordReset ? 'Your password has been updated.' : codeVerified ? 'Create a new password for your account.' : codeSent ? 'Enter the 6-digit verification code sent to your email.' : 'Enter your email address to receive a verification code.'}
          </p>
        </div>

        {!passwordReset ? (
        <form onSubmit={handleSubmit} className='space-y-4'>
          <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
            Email address
            <div className='relative mt-2'>
              <Mail className='absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
              <input
                type='email'
                required
                disabled={loading || codeSent}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='name@example.com'
                className='h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
              />
            </div>
          </label>

          {codeSent && !codeVerified ? (
            <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
              Verification code
              <input
                type='text'
                required
                disabled={loading}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode='numeric'
                autoComplete='one-time-code'
                maxLength={6}
                placeholder='6-digit code'
                className='mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
              />
            </label>
          ) : null}

          {codeVerified && !passwordReset ? (
            <>
              <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
                New password
                <input
                  type='password'
                  required
                  minLength={8}
                  maxLength={20}
                  disabled={loading}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder='8-20 characters with letters and numbers'
                  className='mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
                />
              </label>
            </>
          ) : null}

          {codeSent && !codeVerified ? (
            <button type='button' disabled={loading} onClick={handleResendCode} className='text-sm font-medium text-violet-600 hover:underline disabled:opacity-50 dark:text-violet-400'>
              Resend verification code
            </button>
          ) : null}

          {error ? <p className='text-sm text-rose-500'>{error}</p> : null}
          {message ? (
            <p className='text-sm text-emerald-500'>{message}</p>
          ) : null}

          <button
            type='submit'
            disabled={loading}
            className='inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {loading ? (!codeSent ? 'Sending...' : codeVerified ? 'Updating...' : 'Verifying...') : (!codeSent ? 'Send Verification Code' : codeVerified ? 'Reset Password' : 'Verify Code')}
          </button>
        </form>
        ) : null}

        <div className='mt-6 text-center'>
          <Link
            to='/signin'
            className='inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400'
          >
            <ArrowLeft className='h-4 w-4' /> Back to Sign In
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;