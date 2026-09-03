import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { resetPassword } from '@/lib/api';
import AuthLayout from '@/components/AuthLayout';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      await resetPassword(token, newPassword);
      localStorage.removeItem('todo-user');
      localStorage.removeItem('todo-user-email');
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('todo-auth-changed'));
      alert('Password updated successfully! Please sign in.');
      navigate('/signin', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Token is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className='w-full max-w-md rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80'>
        <div className='mb-6 text-center'>
          <h1 className='text-3xl font-bold text-slate-900 dark:text-white'>Reset Password</h1>
          <p className='mt-2 text-sm text-slate-500 dark:text-slate-300'>
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
            New Password
            <div className='relative mt-2'>
              <Lock className='absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder='Enter new password'
                className='h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
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

          {error ? <p className='text-sm text-rose-500'>{error}</p> : null}

          <button
            type='submit'
            disabled={loading}
            className='inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-60'
          >
            {loading ? 'Updating...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
};

export default ResetPasswordPage;