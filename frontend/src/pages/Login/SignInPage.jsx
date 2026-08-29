import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { ArrowRight, LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { loginWithEmail } from '@/lib/api';

const SignInPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await loginWithEmail(trimmedEmail, password);
      
      const rawUser = res.data?.user || res.data;

      // Clone user object and remove password safely to avoid storing sensitive data
      const safeUser = { ...(rawUser || {}) };
      delete safeUser.password;

      // Save safe user info to localStorage
      localStorage.setItem('todo-user', JSON.stringify(safeUser));
      
      if (safeUser?.email) {
        localStorage.setItem('todo-user-email', safeUser.email);
      }
      if (res.data?.token) {
        localStorage.setItem('token', res.data.token);
      }

      // Notify components about auth state change
      window.dispatchEvent(new Event('todo-auth-changed'));

      // Redirect to home page
      navigate('/home', { replace: true });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || 'Invalid email or password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.22),transparent_40%),linear-gradient(135deg,#f5f7fb,#eef2ff)] p-6 dark:bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.2),transparent_38%),linear-gradient(135deg,#0f172a,#111827)]'>
      <div className='w-full max-w-md rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80'>
        <div className='mb-6 text-center'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'>
            <LogIn className='h-8 w-8' />
          </div>
          <h1 className='mt-5 text-3xl font-bold text-slate-900 dark:text-white'>
            Sign In
          </h1>
          <p className='mt-2 text-sm text-slate-500 dark:text-slate-300'>
            Welcome back! Please enter your details.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Email Input */}
          <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
            Email address
            <div className='relative mt-2'>
              <Mail className='absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='name@example.com'
                className='h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder='Enter your password'
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

          {/* Error Message */}
          {error ? <p className='text-sm text-rose-500'>{error}</p> : null}

          {/* Submit Button */}
          <button
            type='submit'
            disabled={isSubmitting}
            className='inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-transform hover:-translate-y-0.5 disabled:opacity-60 dark:shadow-violet-900/30'
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
            <ArrowRight className='h-4 w-4' />
          </button>
        </form>

        {/* Link to SignUp */}
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
    </div>
  );
};

export default SignInPage;