import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Mail } from 'lucide-react';
import { forgotPassword } from '@/lib/api';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      setLoading(true);
      const res = await forgotPassword(email.trim());
      setMessage(res.data.message || 'Email sent successfully!');
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.22),transparent_40%),linear-gradient(135deg,#f5f7fb,#eef2ff)] p-6 dark:bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.2),transparent_38%),linear-gradient(135deg,#0f172a,#111827)]'>
      <div className='w-full max-w-md rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80'>
        <div className='mb-6 text-center'>
          <h1 className='text-3xl font-bold text-slate-900 dark:text-white'>Forgot Password</h1>
          <p className='mt-2 text-sm text-slate-500 dark:text-slate-300'>
            Enter your email address to receive a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
            Email address
            <div className='relative mt-2'>
              <Mail className='absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
              <input
                type='email'
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='name@example.com'
                className='h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
              />
            </div>
          </label>

          {error ? <p className='text-sm text-rose-500'>{error}</p> : null}
          {message ? <p className='text-sm text-emerald-500'>{message}</p> : null}

          <button
            type='submit'
            disabled={loading}
            className='inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-60'
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className='mt-6 text-center'>
          <Link
            to='/signin'
            className='inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400'
          >
            <ArrowLeft className='h-4 w-4' /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;