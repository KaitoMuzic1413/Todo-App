import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { createInvite } from '@/lib/api';

const CreateInvitePage = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [code, setCode] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('todo-user') || 'null');
      setIsAdmin(!!u?.isAdmin);
      if (!u?.isAdmin) {
        // redirect non-admins away
        // keep simple: navigate back
        // eslint-disable-next-line no-console
        console.warn('Non-admin tried to access create invite page');
      }
    } catch (e) {
      setIsAdmin(false);
    }
  }, []);

  const handleCreate = async () => {
    setMessage('');
    if (!code.trim()) return setMessage('Mã không được để trống');
    try {
      setProcessing(true);
      const user = JSON.parse(localStorage.getItem('todo-user') || 'null');
      const res = await createInvite(user._id, code.trim(), Number(expiresInDays || 30));
      setMessage('Tạo mã thành công: ' + res.data.invite.code);
      setCode('');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Lỗi khi tạo mã');
    } finally {
      setProcessing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className='rounded-[28px] border border-slate-200/80 bg-white/80 p-6 text-slate-500 dark:border-slate-800 dark:bg-slate-900/70'>
        <h2 className='text-lg font-semibold'>Bạn không có quyền truy cập</h2>
        <p className='mt-2 text-sm'>Trang này chỉ dành cho quản trị viên.</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <header className='rounded-[16px] border border-slate-200/80 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/70 flex items-start justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Tạo mã mời</h1>
          <p className='mt-2 text-sm text-slate-500'>Tạo mã mời để cấp quyền Premium cho người dùng.</p>
        </div>
        <div className='ml-4 flex-shrink-0'>
          <button
            type='button'
            onClick={() => navigate(-1)}
            className='inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
          >
            Quay về
          </button>
        </div>
      </header>

      <div className='rounded-2xl border p-4'>
        <label className='block text-sm font-medium text-slate-700'>Mã mời</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder='INVITE-ABC-123' className='mt-2 w-full rounded-2xl border px-3 py-2' />
        <label className='mt-3 block text-sm font-medium text-slate-700'>Hết hạn (ngày)</label>
        <input type='number' value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} className='mt-2 w-28 rounded-2xl border px-3 py-2' />
        <div className='mt-4 flex gap-2'>
          <button onClick={handleCreate} disabled={processing} className='rounded-2xl bg-blue-600 px-4 py-2 text-white'>
            {processing ? 'Đang tạo...' : 'Tạo mã'}
          </button>
          <button onClick={() => { setCode(''); setExpiresInDays(30); setMessage(''); }} className='rounded-2xl border px-4 py-2'>Reset</button>
        </div>
        {message ? <p className='mt-3 text-sm text-slate-600'>{message}</p> : null}
      </div>
    </div>
  );
};

export default CreateInvitePage;
